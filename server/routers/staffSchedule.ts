import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, subAdminProcedure, adminProcedure } from "../_core/trpc";
import { getDb, getPool, schema } from "../db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { startOfDay, endOfDay, format, eachDayOfInterval, getDay } from "date-fns";

// スタッフ休み予定用のデフォルト20名（あとから名前編集で自由に変更可能）
const FIXED_STAFF_NAMES: string[] = Array.from({ length: 20 }, (_, i) => `スタッフ${i + 1}`);

// 21日始まりの20日終わりの期間を計算する関数
function getMonthPeriod21st(date: Date): { start: Date; end: Date } {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    let startDate: Date;
    let endDate: Date;

    if (day >= 21) {
        // 21日以降の場合、今月21日から来月20日まで
        startDate = new Date(year, month, 21);
        endDate = new Date(year, month + 1, 20);
    } else {
        // 21日未満の場合、先月21日から今月20日まで
        startDate = new Date(year, month - 1, 21);
        endDate = new Date(year, month, 20);
    }

    return {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
    };
}

// スケジュール取得の共通ロジック
async function getScheduleQuery(db: any, baseDateStr?: string) {
    try {
        // テーブルが存在しない場合は作成
        try {
            await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffScheduleEntries\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`userId\` int NOT NULL,
                        \`scheduleDate\` date NOT NULL,
                        \`status\` enum('work','rest','request','exhibition','other','morning','afternoon','business_trip','exhibition_duty','paid_leave','delivery','payment_date') DEFAULT 'work' NOT NULL,
                        \`comment\` varchar(100),
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                    )`);
            await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffScheduleDisplayOrder\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`userId\` int NOT NULL UNIQUE,
                        \`displayOrder\` int NOT NULL,
                        \`displayName\` varchar(100),
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                    )`);
            // displayNameカラムが存在しない場合は追加
            try {
                await db.execute(sql`ALTER TABLE \`staffScheduleDisplayOrder\` ADD COLUMN \`displayName\` varchar(100)`);
            } catch (error: any) {
                // カラムが既に存在する場合は無視
                if (!error?.message?.includes("Duplicate column") && !error?.message?.includes("already exists")) {
                    // 無視
                }
            }
            await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffScheduleEditLogs\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`userId\` int NOT NULL,
                        \`editorId\` int NOT NULL,
                        \`fieldName\` varchar(50) NOT NULL,
                        \`oldValue\` text,
                        \`newValue\` text,
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
            )`);
            await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffScheduleAdjustments\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`userId\` int NOT NULL,
                        \`periodStart\` date NOT NULL,
                        \`periodEnd\` date NOT NULL,
                        \`adjustment\` int NOT NULL DEFAULT 0,
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
            )`);
            await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffScheduleStatusColors\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`status\` varchar(50) NOT NULL UNIQUE,
                        \`colorClass\` varchar(100) NOT NULL,
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
            )`);
        } catch (error: any) {
            // テーブルが既に存在する場合は無視
            if (!error?.message?.includes("already exists")) {
                console.warn("[staffSchedule] テーブル作成エラー（無視）:", error?.message);
            }
        }

        // 基準日から21日始まりの1ヶ月期間を計算
        const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
        const { start, end } = getMonthPeriod21st(baseDate);

        // 表示順序を取得（テーブルが存在しない場合は空配列）
        let displayOrders: any[] = [];
        try {
            displayOrders = await db.select().from(schema.staffScheduleDisplayOrder);
        } catch (error: any) {
            // テーブルが存在しない場合は空配列を返す（エラーをスローしない）
            const errorMessage = error?.message || "";
            const errorCode = error?.code || error?.errno || "";
            const errorString = String(errorMessage) + String(errorCode);

            if (
                errorCode === "ER_NO_SUCH_TABLE" ||
                errorCode === 1146 ||
                errorString.includes("doesn't exist") ||
                errorString.includes("Unknown table") ||
                errorString.includes("Table") && errorString.includes("doesn't exist") ||
                errorMessage.includes("staffScheduleDisplayOrder")
            ) {
                console.warn("[staffSchedule] 表示順序テーブルが存在しません。マイグレーションを実行してください。");
                displayOrders = [];
            } else {
                // その他のエラーは再スロー
                console.error("[staffSchedule] 表示順序取得エラー:", error);
                throw error;
            }
        }
        // staffScheduleDisplayOrder にデータが無ければ、独立した20人のスタッフを自動作成
        if (displayOrders.length === 0) {
            const defaultStaff = FIXED_STAFF_NAMES.map((name, index) => ({
                userId: index + 1,
                displayOrder: index + 1,
                displayName: name,
            }));
            await db.insert(schema.staffScheduleDisplayOrder).values(defaultStaff);
            displayOrders = await db.select().from(schema.staffScheduleDisplayOrder);
        } else {
            // 既存データが20件未満の場合、不足分をFIXED_STAFF_NAMESから補完
            const existingIds = new Set(displayOrders.map((o) => o.userId));
            const inserts: any[] = [];
            for (let i = 0; i < FIXED_STAFF_NAMES.length; i++) {
                const userId = i + 1;
                if (!existingIds.has(userId)) {
                    inserts.push({
                        userId,
                        displayOrder: userId,
                        displayName: FIXED_STAFF_NAMES[i],
                    });
                }
            }
            if (inserts.length > 0) {
                await db.insert(schema.staffScheduleDisplayOrder).values(inserts);
                displayOrders = await db.select().from(schema.staffScheduleDisplayOrder);
            }
        }

        const displayOrderMap = new Map(displayOrders.map((o) => [o.userId, o.displayOrder]));
        const displayNameMap = new Map(displayOrders.map((o) => [o.userId, o.displayName]));

        // スタッフ一覧（usersテーブルとは独立）
        const staffList = displayOrders.map((o) => ({
            id: o.userId,
            name: o.displayName || `スタッフ${o.userId}`,
            displayOrder: o.displayOrder,
        }));

        // 表示順序でソートし、20人に制限
        const limitedUsers = [...staffList]
            .sort((a, b) => (a.displayOrder ?? a.id) - (b.displayOrder ?? b.id))
            .slice(0, 20);

        // 期間内のスケジュールエントリを取得
        let entries: any[] = [];
        try {
            // date型のカラムは文字列形式（YYYY-MM-DD）で比較
            const startStr = format(start, "yyyy-MM-dd");
            const endStr = format(end, "yyyy-MM-dd");
            // date型カラムは文字列として比較（Drizzle ORMは自動的に型変換してくれる）
            entries = await db
                .select()
                .from(schema.staffScheduleEntries)
                .where(
                    and(
                        gte(schema.staffScheduleEntries.scheduleDate, startStr as any),
                        lte(schema.staffScheduleEntries.scheduleDate, endStr as any)
                    )
                );
        } catch (error: any) {
            // テーブルが存在しない場合は空配列を返す（エラーをスローしない）
            const errorMessage = error?.message || "";
            const errorCode = error?.code || error?.errno || "";
            const errorString = String(errorMessage) + String(errorCode);

            if (
                errorCode === "ER_NO_SUCH_TABLE" ||
                errorCode === 1146 ||
                errorString.includes("doesn't exist") ||
                errorString.includes("Unknown table") ||
                (errorString.includes("Table") && errorString.includes("doesn't exist")) ||
                errorMessage.includes("staffScheduleEntries")
            ) {
                console.warn("[staffSchedule] スケジュールエントリテーブルが存在しません。マイグレーションを実行してください。");
                entries = [];
            } else {
                // その他のエラーは再スロー
                console.error("[staffSchedule] スケジュールエントリ取得エラー:", error);
                throw error;
            }
        }

        // ユーザーIDと日付でマップを作成
        const entryMap = new Map<string, typeof entries[0]>();
        entries.forEach((entry) => {
            // scheduleDateはdate型なので、文字列として扱う
            const dateStr = typeof entry.scheduleDate === "string"
                ? entry.scheduleDate
                : format(new Date(entry.scheduleDate), "yyyy-MM-dd");
            const key = `${entry.userId}_${dateStr}`;
            entryMap.set(key, entry);
        });

        // 期間内の全日付を生成
        const allDates = eachDayOfInterval({ start, end });

        // 各日付のデータを構築
        const scheduleData = allDates.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const dayOfWeek = getDay(date); // 0=日曜日, 6=土曜日
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            const userEntries = limitedUsers.map((user) => {
                const key = `${user.id}_${dateStr}`;
                const entry = entryMap.get(key);
                // 土日はデフォルトで休み、それ以外は出勤
                const defaultStatus = isWeekend ? "rest" : "work";
                const displayName = displayNameMap.get(user.id) || user.name || "不明";
                return {
                    userId: user.id,
                    userName: displayName,
                    status: entry?.status || defaultStatus,
                    comment: entry?.comment || null,
                };
            });

            return {
                date: dateStr,
                dateObj: date,
                dayOfWeek,
                isWeekend,
                userEntries,
            };
        });

        // 調整休テーブルから、この期間の調整値を取得（生SQLでシンプルに取得）
        const adjustmentMap = new Map<number, number>();
        try {
            const periodStartStr = format(start, "yyyy-MM-dd");
            const periodEndStr = format(end, "yyyy-MM-dd");
            const [rows]: any = await db.execute(
                sql`SELECT \`userId\`, \`periodStart\`, \`periodEnd\`, \`adjustment\` FROM \`staffScheduleAdjustments\` WHERE \`periodStart\` = ${periodStartStr} AND \`periodEnd\` = ${periodEndStr}`
            );
            for (const row of rows || []) {
                const value = typeof row.adjustment === "number" ? row.adjustment : 0;
                adjustmentMap.set(row.userId, value);
            }
        } catch (error: any) {
            const msg = error?.message || "";
            if (!msg.includes("staffScheduleAdjustments")) {
                console.warn("[staffSchedule] 調整休テーブル取得エラー（無視）:", msg);
            }
        }

        // 集計データを計算
        const summary = limitedUsers.map((user) => {
            // 期間内の該当ユーザーのエントリを取得
            const userEntries = entries.filter((e) => e.userId === user.id);

            // 期間内の全日付で、該当ユーザーのエントリがある日付を確認
            const userEntryDates = new Set(
                userEntries.map((e) => {
                    const dateStr = typeof e.scheduleDate === "string"
                        ? e.scheduleDate
                        : format(new Date(e.scheduleDate), "yyyy-MM-dd");
                    return dateStr;
                })
            );

            // 期間内の全日付で、エントリがある日とない日を区別
            let workDays = 0;
            let restDays = 0;
            let requestDays = 0;
            let exhibitionDays = 0;
            let otherDays = 0;
            let businessTripDays = 0;

            allDates.forEach((date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const dayOfWeek = getDay(date);
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                if (userEntryDates.has(dateStr)) {
                    // エントリがある場合は、そのエントリの状態をカウント
                    const entry = userEntries.find((e) => {
                        const entryDateStr = typeof e.scheduleDate === "string"
                            ? e.scheduleDate
                            : format(new Date(e.scheduleDate), "yyyy-MM-dd");
                        return entryDateStr === dateStr;
                    });
                    if (entry) {
                        if (entry.status === "work") workDays++;
                        else if (entry.status === "rest") restDays++;
                        else if (entry.status === "request") requestDays++;
                        else if (entry.status === "exhibition") exhibitionDays++;
                        else if (entry.status === "other") otherDays++;
                        else if (entry.status === "morning") workDays += 0.5; // 午前出は0.5日としてカウント
                        else if (entry.status === "afternoon") workDays += 0.5; // 午後出は0.5日としてカウント
                        else if (entry.status === "business_trip") businessTripDays++;
                    }
                } else {
                    // エントリがない場合は、デフォルト値（土日は休み、平日は出勤）
                    if (isWeekend) {
                        restDays++;
                    } else {
                        workDays++;
                    }
                }
            });

            // 公休 = 法定休日（土日）の数（期間内の全日付で計算）
            const publicHolidays = allDates.filter((d) => {
                const dayOfWeek = getDay(d);
                return dayOfWeek === 0 || dayOfWeek === 6;
            }).length;

            // 有休 = 休み + 希望休（実際に登録されたもの）
            const paidLeave = restDays + requestDays;

            // 調整休（デフォルト0）※合計とは独立して管理
            const adjustment = adjustmentMap.get(user.id) ?? 0;

            // 合計 = 公休 + 有休（調整休は合計には含めず、別枠で表示）
            const totalRest = publicHolidays + paidLeave;

            // 休みの数 = 実際に登録された休み（rest）の日数
            const actualRestDays = restDays;

            const displayName = displayNameMap.get(user.id) || user.name || "不明";
            return {
                userId: user.id,
                userName: displayName,
                workDays: Number(workDays.toFixed(1)), // 小数点第1位まで表示（0.5を含む）
                restDays: actualRestDays, // 実際に休みとして登録された日数
                publicHolidays,
                paidLeave,
                totalRest,
                adjustment,
                businessTripDays, // 出張の日数
            };
        });

        return {
            period: {
                start: format(start, "yyyy-MM-dd"),
                end: format(end, "yyyy-MM-dd"),
            },
            scheduleData,
            summary,
            users: limitedUsers.map((u) => ({
                id: u.id,
                name: displayNameMap.get(u.id) || u.name || "不明",
                displayOrder: displayOrderMap.get(u.id) ?? u.id,
            })),
        };
    } catch (error: any) {
        console.error("[staffSchedule] getScheduleQuery エラー:", error);
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error?.message || "スケジュールの取得に失敗しました",
            cause: error,
        });
    }
}

export const staffScheduleRouter = createTRPCRouter({
    // スケジュールを取得（閲覧用：一般・準管理者・管理者）
    getSchedule: protectedProcedure
        .input(
            z.object({
                baseDate: z.string().optional(), // 基準日（YYYY-MM-DD形式、省略時は今日）
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }
            return await getScheduleQuery(db, input.baseDate);
        }),

    // スケジュールエントリを更新（管理者のみ）
    updateSchedule: subAdminProcedure
        .input(
            z.object({
                userId: z.number(),
                date: z.string(), // YYYY-MM-DD形式
                status: z.enum(["work", "rest", "request", "exhibition", "other", "morning", "afternoon", "business_trip", "exhibition_duty", "paid_leave", "delivery", "payment_date"]),
                comment: z.string().optional().nullable(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            // テーブルが存在しない場合は作成
            try {
                await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffScheduleEntries\` (
                    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    \`userId\` int NOT NULL,
                    \`scheduleDate\` date NOT NULL,
                    \`status\` enum('work','rest','request','exhibition','other','morning','afternoon') DEFAULT 'work' NOT NULL,
                    \`comment\` varchar(100),
                    \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                )`);
            } catch (error: any) {
                // テーブルが既に存在する場合は無視
                if (!error?.message?.includes("already exists")) {
                    console.warn("[staffSchedule] テーブル作成エラー（無視）:", error?.message);
                }
            }

            // 日付文字列を取得（YYYY-MM-DD形式）
            // input.dateがDateオブジェクトの場合、文字列に変換
            let dateStr: string;
            if (typeof input.date === "string") {
                dateStr = input.date.includes("T") ? input.date.split("T")[0] : input.date;
            } else if (input.date instanceof Date) {
                // Dateオブジェクトの場合はYYYY-MM-DD形式に変換
                dateStr = format(input.date, "yyyy-MM-dd");
            } else {
                // その他の場合は文字列に変換してから処理
                const dateStrRaw = String(input.date);
                dateStr = dateStrRaw.includes("T") ? dateStrRaw.split("T")[0] : dateStrRaw;
            }

            // 日付文字列が正しい形式（YYYY-MM-DD）であることを確認
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dateStr)) {
                // Dateオブジェクトの文字列表現（例: "Fri Nov 21 2025 09:00:00 GMT+0900"）をパース
                try {
                    const parsedDate = new Date(input.date as any);
                    if (!isNaN(parsedDate.getTime())) {
                        dateStr = format(parsedDate, "yyyy-MM-dd");
                    } else {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `無効な日付形式です: ${input.date}`,
                        });
                    }
                } catch (error) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `無効な日付形式です: ${input.date}`,
                    });
                }
            }

            // 既存のエントリを確認（date型カラムは文字列として比較）
            // date型カラムは文字列として比較する必要があるため、sqlヘルパーを使用
            let existing: any[] = [];
            try {
                existing = await db
                    .select()
                    .from(schema.staffScheduleEntries)
                    .where(
                        and(
                            eq(schema.staffScheduleEntries.userId, input.userId),
                            sql`CAST(${schema.staffScheduleEntries.scheduleDate} AS CHAR) = ${dateStr}`
                        )
                    )
                    .limit(1);
            } catch (error: any) {
                // テーブルが存在しない場合は空配列を返す
                const errorMessage = error?.message || "";
                if (errorMessage.includes("staffScheduleEntries") || errorMessage.includes("doesn't exist")) {
                    console.warn("[staffSchedule] スケジュールエントリテーブルが存在しません。");
                    existing = [];
                } else {
                    throw error;
                }
            }

            if (existing.length > 0) {
                // 更新
                // commentが空文字列の場合はnullに変換
                const commentValue = input.comment && input.comment.trim() !== "" ? input.comment.trim() : null;
                await db
                    .update(schema.staffScheduleEntries)
                    .set({
                        status: input.status,
                        comment: commentValue,
                    })
                    .where(eq(schema.staffScheduleEntries.id, existing[0].id));
            } else {
                // 新規作成（生SQLを使用して確実に挿入）
                try {
                    // 日付文字列が正しい形式（YYYY-MM-DD）であることを確認
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(dateStr)) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `無効な日付形式です: ${dateStr}`,
                        });
                    }

                    // 生SQLを使用して挿入（date型カラムには文字列を直接指定）
                    // commentが空文字列の場合はnullに変換
                    const commentValue = input.comment && input.comment.trim() !== "" ? input.comment.trim() : null;
                    await db.execute(
                        sql`INSERT INTO \`staffScheduleEntries\` (\`userId\`, \`scheduleDate\`, \`status\`, \`comment\`) VALUES (${input.userId}, ${dateStr}, ${input.status}, ${commentValue})`
                    );
                } catch (error: any) {
                    console.error("[staffSchedule] INSERTエラー:", error);
                    console.error("[staffSchedule] エラー詳細:", JSON.stringify(error, null, 2));
                    console.error("[staffSchedule] エラーオブジェクト全体:", error);
                    console.error("[staffSchedule] エラーの型:", typeof error);
                    console.error("[staffSchedule] エラーのプロパティ:", Object.keys(error || {}));
                    console.error("[staffSchedule] 日付文字列:", dateStr);
                    console.error("[staffSchedule] 入力データ:", input);

                    // エラーメッセージから詳細を取得
                    const errorMessage = error?.message || error?.toString() || "不明なエラー";
                    const errorCode = error?.code || error?.errno || "";
                    const sqlMessage = error?.sqlMessage || "";
                    const sqlState = error?.sqlState || "";
                    const sqlCode = error?.sqlCode || "";

                    // DrizzleQueryErrorの場合、causeプロパティに詳細がある可能性がある
                    const cause = error?.cause;
                    const causeMessage = cause?.message || "";
                    const causeCode = cause?.code || cause?.errno || "";
                    const causeSqlMessage = cause?.sqlMessage || "";
                    const causeSqlState = cause?.sqlState || "";

                    // より詳細なエラー情報を提供
                    const fullErrorMessage = `スケジュールの登録に失敗しました: ${errorMessage}${causeMessage ? ` (原因: ${causeMessage})` : ""} (コード: ${errorCode || causeCode}, SQL: ${sqlMessage || causeSqlMessage}, SQL状態: ${sqlState || causeSqlState}, SQLコード: ${sqlCode})`;
                    console.error("[staffSchedule] 完全なエラーメッセージ:", fullErrorMessage);

                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: fullErrorMessage,
                    });
                }
            }

            return { success: true };
        }),

    // 複数のスケジュールエントリを一括更新（管理者のみ）
    bulkUpdateSchedule: subAdminProcedure
        .input(
            z.object({
                updates: z.array(
                    z.object({
                        userId: z.number(),
                        date: z.string(),
                        status: z.enum(["work", "rest", "request", "exhibition", "other", "morning", "afternoon", "business_trip", "exhibition_duty", "paid_leave", "delivery", "payment_date"]),
                        comment: z.string().optional().nullable(),
                    })
                ),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            for (const update of input.updates) {
                // 日付文字列を取得（YYYY-MM-DD形式）
                // update.dateがDateオブジェクトの場合、文字列に変換
                let dateStr: string;
                if (typeof update.date === "string") {
                    dateStr = update.date.includes("T") ? update.date.split("T")[0] : update.date;
                } else if (update.date instanceof Date) {
                    // Dateオブジェクトの場合はYYYY-MM-DD形式に変換
                    dateStr = format(update.date, "yyyy-MM-dd");
                } else {
                    // その他の場合は文字列に変換してから処理
                    const dateStrRaw = String(update.date);
                    dateStr = dateStrRaw.includes("T") ? dateStrRaw.split("T")[0] : dateStrRaw;
                }

                // 日付文字列が正しい形式（YYYY-MM-DD）であることを確認
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(dateStr)) {
                    // Dateオブジェクトの文字列表現（例: "Fri Nov 21 2025 09:00:00 GMT+0900"）をパース
                    try {
                        const parsedDate = new Date(update.date as any);
                        if (!isNaN(parsedDate.getTime())) {
                            dateStr = format(parsedDate, "yyyy-MM-dd");
                        } else {
                            throw new TRPCError({
                                code: "BAD_REQUEST",
                                message: `無効な日付形式です: ${update.date}`,
                            });
                        }
                    } catch (error) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `無効な日付形式です: ${update.date}`,
                        });
                    }
                }

                // 既存のエントリを確認（date型カラムは文字列として比較）
                let existing: any[] = [];
                try {
                    existing = await db
                        .select()
                        .from(schema.staffScheduleEntries)
                        .where(
                            and(
                                eq(schema.staffScheduleEntries.userId, update.userId),
                                sql`CAST(${schema.staffScheduleEntries.scheduleDate} AS CHAR) = ${dateStr}`
                            )
                        )
                        .limit(1);
                } catch (error: any) {
                    // テーブルが存在しない場合は空配列を返す
                    const errorMessage = error?.message || "";
                    if (errorMessage.includes("staffScheduleEntries") || errorMessage.includes("doesn't exist")) {
                        console.warn("[staffSchedule] スケジュールエントリテーブルが存在しません。");
                        existing = [];
                    } else {
                        throw error;
                    }
                }

                if (existing.length > 0) {
                    // 更新
                    // commentが空文字列の場合はnullに変換
                    const commentValue = update.comment && update.comment.trim() !== "" ? update.comment.trim() : null;
                    await db
                        .update(schema.staffScheduleEntries)
                        .set({
                            status: update.status,
                            comment: commentValue,
                        })
                        .where(eq(schema.staffScheduleEntries.id, existing[0].id));
                } else {
                    // 新規作成（生SQLを使用して確実に挿入）
                    try {
                        // 日付文字列が正しい形式（YYYY-MM-DD）であることを確認
                        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                        if (!dateRegex.test(dateStr)) {
                            throw new TRPCError({
                                code: "BAD_REQUEST",
                                message: `無効な日付形式です: ${dateStr}`,
                            });
                        }

                        // 生SQLを使用して挿入（date型カラムには文字列を直接指定）
                        // commentが空文字列の場合はnullに変換
                        const commentValue = update.comment && update.comment.trim() !== "" ? update.comment.trim() : null;
                        await db.execute(
                            sql`INSERT INTO \`staffScheduleEntries\` (\`userId\`, \`scheduleDate\`, \`status\`, \`comment\`) VALUES (${update.userId}, ${dateStr}, ${update.status}, ${commentValue})`
                        );
                    } catch (error: any) {
                        console.error("[staffSchedule] INSERTエラー:", error);
                        console.error("[staffSchedule] エラー詳細:", JSON.stringify(error, null, 2));
                        console.error("[staffSchedule] エラーオブジェクト全体:", error);
                        console.error("[staffSchedule] エラーの型:", typeof error);
                        console.error("[staffSchedule] エラーのプロパティ:", Object.keys(error || {}));
                        console.error("[staffSchedule] 日付文字列:", dateStr);
                        console.error("[staffSchedule] 入力データ:", update);

                        // エラーメッセージから詳細を取得
                        const errorMessage = error?.message || error?.toString() || "不明なエラー";
                        const errorCode = error?.code || error?.errno || "";
                        const sqlMessage = error?.sqlMessage || "";
                        const sqlState = error?.sqlState || "";
                        const sqlCode = error?.sqlCode || "";

                        // DrizzleQueryErrorの場合、causeプロパティに詳細がある可能性がある
                        const cause = error?.cause;
                        const causeMessage = cause?.message || "";
                        const causeCode = cause?.code || cause?.errno || "";
                        const causeSqlMessage = cause?.sqlMessage || "";
                        const causeSqlState = cause?.sqlState || "";

                        // より詳細なエラー情報を提供
                        const fullErrorMessage = `スケジュールの登録に失敗しました: ${errorMessage}${causeMessage ? ` (原因: ${causeMessage})` : ""} (コード: ${errorCode || causeCode}, SQL: ${sqlMessage || causeSqlMessage}, SQL状態: ${sqlState || causeSqlState}, SQLコード: ${sqlCode})`;
                        console.error("[staffSchedule] 完全なエラーメッセージ:", fullErrorMessage);

                        throw new TRPCError({
                            code: "INTERNAL_SERVER_ERROR",
                            message: fullErrorMessage,
                        });
                    }
                }
            }

            return { success: true };
        }),

    // スタッフの表示順序を更新（管理者のみ）
    updateDisplayOrder: subAdminProcedure
        .input(
            z.object({
                userId: z.number(),
                displayOrder: z.number(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            // 既存の表示順序を取得（履歴記録用）
            const existing = await db
                .select()
                .from(schema.staffScheduleDisplayOrder)
                .where(eq(schema.staffScheduleDisplayOrder.userId, input.userId))
                .limit(1);

            const oldValue = existing.length > 0 ? existing[0].displayOrder.toString() : null;

            if (existing.length > 0) {
                // 更新
                await db
                    .update(schema.staffScheduleDisplayOrder)
                    .set({ displayOrder: input.displayOrder })
                    .where(eq(schema.staffScheduleDisplayOrder.userId, input.userId));
            } else {
                // 新規作成
                await db.insert(schema.staffScheduleDisplayOrder).values({
                    userId: input.userId,
                    displayOrder: input.displayOrder,
                });
            }

            // 履歴を記録
            await db.insert(schema.staffScheduleEditLogs).values({
                userId: input.userId,
                editorId: ctx.user.id,
                fieldName: "displayOrder",
                oldValue,
                newValue: input.displayOrder.toString(),
            });

            return { success: true };
        }),

    // スタッフの表示名を更新（管理者のみ）
    updateDisplayName: subAdminProcedure
        .input(
            z.object({
                userId: z.number(),
                displayName: z.string(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            // staffScheduleDisplayOrder テーブルの displayName を更新（usersテーブルとは完全に独立）
            const existing = await db
                .select()
                .from(schema.staffScheduleDisplayOrder)
                .where(eq(schema.staffScheduleDisplayOrder.userId, input.userId))
                .limit(1);

            if (existing.length > 0) {
                await db
                    .update(schema.staffScheduleDisplayOrder)
                    .set({ displayName: input.displayName })
                    .where(eq(schema.staffScheduleDisplayOrder.userId, input.userId));
            } else {
                // レコードがない場合は作成（デフォルト表示順は userId）
                await db.insert(schema.staffScheduleDisplayOrder).values({
                    userId: input.userId,
                    displayOrder: input.userId,
                    displayName: input.displayName,
                });
            }

            return { success: true };
        }),

    // スタッフ名変更の履歴を取得（管理者のみ）
    getEditLogs: subAdminProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
        }

        let logs: any[] = [];
        try {
            logs = await db
                .select()
                .from(schema.staffScheduleEditLogs)
                .orderBy(schema.staffScheduleEditLogs.createdAt);
        } catch (error: any) {
            // テーブルが存在しない場合は空配列を返す
            const errorMessage = error?.message || "";
            const errorCode = error?.code || error?.errno || "";
            const errorString = String(errorMessage) + String(errorCode);

            if (
                errorCode === "ER_NO_SUCH_TABLE" ||
                errorCode === 1146 ||
                errorString.includes("doesn't exist") ||
                errorString.includes("Unknown table") ||
                errorMessage.includes("staffScheduleEditLogs")
            ) {
                console.warn("[staffSchedule] 編集履歴テーブルが存在しません。マイグレーションを実行してください。");
                return [];
            } else {
                throw error;
            }
        }

        // ユーザー情報を取得（nameとcategoryカラムが存在しない場合に対応）
        let users: any[] = [];
        try {
            users = await db.select({
                id: schema.users.id,
                username: schema.users.username,
                name: schema.users.name,
                role: schema.users.role,
                category: schema.users.category,
            }).from(schema.users);
        } catch (error: any) {
            // nameまたはcategoryカラムが存在しない場合は、基本カラムのみで取得
            if (error?.message?.includes("category") || error?.message?.includes("name") || error?.code === "ER_BAD_FIELD_ERROR") {
                try {
                    users = await db.select({
                        id: schema.users.id,
                        username: schema.users.username,
                        role: schema.users.role,
                    }).from(schema.users);
                    users = users.map((u) => ({ ...u, name: null, category: null }));
                } catch (innerError: any) {
                    console.warn("[staffSchedule] ユーザー情報の取得に失敗しました:", innerError);
                    users = [];
                }
            } else {
                throw error;
            }
        }
        const userMap = new Map(users.map((u) => [u.id, u]));

        return logs.map((log) => ({
            id: log.id,
            userId: log.userId,
            userName: userMap.get(log.userId)?.name || userMap.get(log.userId)?.username || "不明",
            editorId: log.editorId,
            editorName: userMap.get(log.editorId)?.name || userMap.get(log.editorId)?.username || "不明",
            fieldName: log.fieldName,
            oldValue: log.oldValue,
            newValue: log.newValue,
            createdAt: log.createdAt,
        }));
    }),

    // スケジュールを公開（管理者のみ）
    publishSchedule: subAdminProcedure
        .input(
            z.object({
                periodStart: z.string(), // YYYY-MM-DD形式
                periodEnd: z.string(), // YYYY-MM-DD形式
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            // テーブルが存在しない場合は作成
            try {
                await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffSchedulePublished\` (
                    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    \`periodStart\` date NOT NULL,
                    \`periodEnd\` date NOT NULL,
                    \`isPublished\` enum('true','false') DEFAULT 'false' NOT NULL,
                    \`publishedAt\` timestamp,
                    \`publishedBy\` int,
                    \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                )`);
            } catch (error: any) {
                if (!error?.message?.includes("already exists")) {
                    console.warn("[staffSchedule] 公開テーブル作成エラー（無視）:", error?.message);
                }
            }

            // 既存の公開レコードを確認
            const existing = await db
                .select()
                .from(schema.staffSchedulePublished)
                .where(
                    and(
                        sql`CAST(${schema.staffSchedulePublished.periodStart} AS CHAR) = ${input.periodStart}`,
                        sql`CAST(${schema.staffSchedulePublished.periodEnd} AS CHAR) = ${input.periodEnd}`
                    )
                )
                .limit(1);

            if (existing.length > 0) {
                // 更新
                await db
                    .update(schema.staffSchedulePublished)
                    .set({
                        isPublished: "true",
                        publishedAt: new Date(),
                        publishedBy: ctx.user.id,
                    })
                    .where(eq(schema.staffSchedulePublished.id, existing[0].id));
            } else {
                // 新規作成
                await db.execute(
                    sql`INSERT INTO \`staffSchedulePublished\` (\`periodStart\`, \`periodEnd\`, \`isPublished\`, \`publishedAt\`, \`publishedBy\`) VALUES (${input.periodStart}, ${input.periodEnd}, 'true', NOW(), ${ctx.user.id})`
                );
            }

            return { success: true };
        }),

    // スケジュールを非公開にする（管理者のみ）
    unpublishSchedule: subAdminProcedure
        .input(
            z.object({
                periodStart: z.string(), // YYYY-MM-DD形式
                periodEnd: z.string(), // YYYY-MM-DD形式
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            try {
                await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffSchedulePublished\` (
                    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    \`periodStart\` date NOT NULL,
                    \`periodEnd\` date NOT NULL,
                    \`isPublished\` enum('true','false') DEFAULT 'false' NOT NULL,
                    \`publishedAt\` timestamp,
                    \`publishedBy\` int,
                    \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                )`);
            } catch (error: any) {
                if (!error?.message?.includes("already exists")) {
                    console.warn("[staffSchedule] 公開テーブル作成エラー（無視）:", error?.message);
                }
            }

            const existing = await db
                .select()
                .from(schema.staffSchedulePublished)
                .where(
                    and(
                        sql`CAST(${schema.staffSchedulePublished.periodStart} AS CHAR) = ${input.periodStart}`,
                        sql`CAST(${schema.staffSchedulePublished.periodEnd} AS CHAR) = ${input.periodEnd}`
                    )
                )
                .limit(1);

            if (existing.length > 0) {
                await db
                    .update(schema.staffSchedulePublished)
                    .set({
                        isPublished: "false",
                        publishedAt: null,
                        publishedBy: ctx.user.id,
                    } as any)
                    .where(eq(schema.staffSchedulePublished.id, existing[0].id));
            } else {
                await db.execute(
                    sql`INSERT INTO \`staffSchedulePublished\` (\`periodStart\`, \`periodEnd\`, \`isPublished\`, \`publishedAt\`, \`publishedBy\`) VALUES (${input.periodStart}, ${input.periodEnd}, 'false', NULL, ${ctx.user.id})`
                );
            }

            return { success: true };
        }),

    // 公開されたスケジュールを取得（一般ユーザー用）
    getPublishedSchedule: protectedProcedure
        .input(
            z.object({
                baseDate: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            // 公開テーブルが存在しない場合は空配列を返す
            let publishedPeriods: any[] = [];
            try {
                publishedPeriods = await db
                    .select()
                    .from(schema.staffSchedulePublished)
                    .where(eq(schema.staffSchedulePublished.isPublished, "true"));
            } catch (error: any) {
                if (error?.message?.includes("staffSchedulePublished") || error?.message?.includes("doesn't exist")) {
                    return null; // 公開されたスケジュールがない
                }
                throw error;
            }

            if (publishedPeriods.length === 0) {
                return null; // 公開されたスケジュールがない
            }

            // 最新の公開期間を取得
            const latestPublished = publishedPeriods.sort((a, b) => {
                const dateA = new Date(a.periodStart);
                const dateB = new Date(b.periodStart);
                return dateB.getTime() - dateA.getTime();
            })[0];

            // 公開された期間のスケジュールを取得
            return await getScheduleQuery(db, latestPublished.periodStart);
        }),

    // 調整休を更新（管理者のみ）
    updateAdjustment: subAdminProcedure
        .input(
            z.object({
                userId: z.number(),
                periodStart: z.string(), // YYYY-MM-DD
                periodEnd: z.string(),   // YYYY-MM-DD
                adjustment: z.number(),  // マイナスも許可
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            // テーブルが存在しない場合は作成
            try {
                await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffScheduleAdjustments\` (
                    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    \`userId\` int NOT NULL,
                    \`periodStart\` date NOT NULL,
                    \`periodEnd\` date NOT NULL,
                    \`adjustment\` int NOT NULL DEFAULT 0,
                    \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                )`);
                await db.execute(sql`CREATE TABLE IF NOT EXISTS \`staffScheduleStatusColors\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`status\` varchar(50) NOT NULL UNIQUE,
                        \`colorClass\` varchar(100) NOT NULL,
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
            )`);

                // デフォルトの色設定を初期化
                const defaultColors: Record<string, string> = {
                    work: "bg-blue-100",
                    rest: "bg-pink-200",
                    request: "bg-pink-300",
                    exhibition: "bg-green-100",
                    other: "bg-green-50",
                    morning: "bg-yellow-100",
                    afternoon: "bg-orange-100",
                    business_trip: "bg-purple-100",
                    exhibition_duty: "bg-cyan-100",
                    paid_leave: "bg-red-100",
                    delivery: "bg-indigo-100",
                    payment_date: "bg-amber-100",
                };

                for (const [status, colorClass] of Object.entries(defaultColors)) {
                    try {
                        await db.execute(
                            sql`INSERT IGNORE INTO \`staffScheduleStatusColors\` (\`status\`, \`colorClass\`) VALUES (${status}, ${colorClass})`
                        );
                    } catch (error: any) {
                        // 既に存在する場合は無視
                    }
                }
            } catch (error: any) {
                if (!error?.message?.includes("already exists")) {
                    console.warn("[staffSchedule] 調整休テーブル作成エラー（無視）:", error?.message);
                }
            }

            // 既存レコードを確認（生SQLでシンプルに）
            const [rows]: any = await db.execute(
                sql`SELECT \`id\`, \`adjustment\` FROM \`staffScheduleAdjustments\` WHERE \`userId\` = ${input.userId} AND \`periodStart\` = ${input.periodStart} AND \`periodEnd\` = ${input.periodEnd} LIMIT 1`
            );
            const existing = rows && rows[0] ? rows[0] : null;

            if (existing) {
                await db
                    .execute(
                        sql`UPDATE \`staffScheduleAdjustments\` SET \`adjustment\` = ${input.adjustment} WHERE \`id\` = ${existing.id}`
                    );
            } else {
                await db.execute(
                    sql`INSERT INTO \`staffScheduleAdjustments\` (\`userId\`, \`periodStart\`, \`periodEnd\`, \`adjustment\`) VALUES (${input.userId}, ${input.periodStart}, ${input.periodEnd}, ${input.adjustment})`
                );
            }

            // 編集履歴に残しておくと分かりやすい
            try {
                await db.insert(schema.staffScheduleEditLogs).values({
                    userId: input.userId,
                    editorId: ctx.user.id,
                    fieldName: "adjustment",
                    oldValue: null,
                    newValue: input.adjustment.toString(),
                });
            } catch {
                // 履歴が失敗しても本体は成功とする
            }

            return { success: true };
        }),

    // 期間内のスケジュールを初期状態（平日=出勤、土日=休み）に戻す（管理者のみ）
    resetScheduleToDefault: subAdminProcedure
        .input(
            z.object({
                periodStart: z.string(), // YYYY-MM-DD
                periodEnd: z.string(),   // YYYY-MM-DD
            })
        )
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            try {
                // 指定期間のスケジュールエントリを削除
                await db.execute(
                    sql`DELETE FROM \`staffScheduleEntries\` WHERE \`scheduleDate\` BETWEEN ${input.periodStart} AND ${input.periodEnd}`
                );
            } catch (error: any) {
                const msg = error?.message || "";
                if (!msg.includes("staffScheduleEntries")) {
                    console.error("[staffSchedule] resetScheduleToDefault エラー:", msg);
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: msg || "スケジュールの初期化に失敗しました",
                    });
                }
            }

            try {
                // 調整休もリセット
                await db.execute(
                    sql`DELETE FROM \`staffScheduleAdjustments\` WHERE \`periodStart\` = ${input.periodStart} AND \`periodEnd\` = ${input.periodEnd}`
                );
            } catch (error: any) {
                const msg = error?.message || "";
                if (!msg.includes("staffScheduleAdjustments")) {
                    console.warn("[staffSchedule] 調整休リセットエラー（無視）:", msg);
                }
            }

            return { success: true };
        }),

    // ステータス色設定を取得
    getStatusColors: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
        }

        try {
            const pool = getPool();
            if (!pool) {
                throw new Error("データベースプールが取得できません");
            }

            const [rows] = await pool.execute(
                sql`SELECT \`status\`, \`colorClass\` FROM \`staffScheduleStatusColors\``
            );
            const colorMap: Record<string, string> = {};

            // デフォルトの色設定
            const defaultColors: Record<string, string> = {
                work: "bg-blue-100",
                rest: "bg-pink-200",
                request: "bg-pink-300",
                exhibition: "bg-green-100",
                other: "bg-green-50",
                morning: "bg-yellow-100",
                afternoon: "bg-orange-100",
                business_trip: "bg-purple-100",
                exhibition_duty: "bg-cyan-100",
                paid_leave: "bg-red-100",
                delivery: "bg-indigo-100",
                payment_date: "bg-amber-100",
            };

            if (Array.isArray(rows) && rows.length > 0) {
                for (const row of rows as any[]) {
                    if (row.status && row.colorClass) {
                        colorMap[row.status] = row.colorClass;
                    }
                }
            }

            // データベースにないステータスはデフォルト値を使用
            for (const [status, colorClass] of Object.entries(defaultColors)) {
                if (!colorMap[status]) {
                    colorMap[status] = colorClass;
                }
            }

            return colorMap;
        } catch (error: any) {
            console.warn("[staffSchedule] 色設定取得エラー（デフォルト値を使用）:", error?.message);
            // エラーの場合はデフォルト値を返す
            return {
                work: "bg-blue-100",
                rest: "bg-pink-200",
                request: "bg-pink-300",
                exhibition: "bg-green-100",
                other: "bg-green-50",
                morning: "bg-yellow-100",
                afternoon: "bg-orange-100",
                business_trip: "bg-purple-100",
                exhibition_duty: "bg-cyan-100",
                paid_leave: "bg-red-100",
                delivery: "bg-indigo-100",
                payment_date: "bg-amber-100",
            };
        }
    }),

    // ステータス色設定を更新（管理者のみ）
    updateStatusColor: adminProcedure
        .input(
            z.object({
                status: z.string(),
                colorClass: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "データベースに接続できません" });
            }

            try {
                const pool = getPool();
                if (!pool) {
                    throw new Error("データベースプールが取得できません");
                }

                await pool.execute(
                    sql`INSERT INTO \`staffScheduleStatusColors\` (\`status\`, \`colorClass\`) 
                        VALUES (${input.status}, ${input.colorClass})
                        ON DUPLICATE KEY UPDATE \`colorClass\` = ${input.colorClass}, \`updatedAt\` = CURRENT_TIMESTAMP`
                );
                return { success: true };
            } catch (error: any) {
                console.error("[staffSchedule] 色設定更新エラー:", error?.message);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "色設定の更新に失敗しました",
                });
            }
        }),
});

