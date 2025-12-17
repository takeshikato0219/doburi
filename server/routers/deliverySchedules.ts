import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure, subAdminProcedure } from "../_core/trpc";
import { getDb, getPool, schema } from "../db";
import { and, gte, lte, eq, or, isNull, desc, sql, inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

// 指定年月の開始日と終了日を取得
function getMonthRange(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // 翌月0日 = 当月末
    return { start, end };
}

// 遅れ日数を計算（今日 - 納期）。未来の場合は 0。
function calcDelayDays(dueDate: Date | null): number {
    if (!dueDate) return 0;
    const today = new Date();
    const d = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffMs = t.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
}

// 本番環境でテーブルが無い場合に自動で作成するヘルパー
async function ensureDeliverySchedulesTable(db: any) {
    try {
        await db.execute(
            `
            CREATE TABLE IF NOT EXISTS \`deliverySchedules\` (
              \`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
              \`vehicleName\` VARCHAR(255) NOT NULL,
              \`vehicleType\` VARCHAR(255),
              \`customerName\` VARCHAR(255),
              \`optionName\` VARCHAR(255),
              \`optionCategory\` VARCHAR(255),
              \`prefecture\` VARCHAR(100),
              \`baseCarReady\` ENUM('yes','no'),
              \`furnitureReady\` ENUM('yes','no'),
              \`inCharge\` VARCHAR(100),
              \`productionMonth\` VARCHAR(100),
              \`dueDate\` DATE,
              \`desiredIncomingPlannedDate\` DATE,
              \`incomingPlannedDate\` DATE,
              \`shippingPlannedDate\` DATE,
              \`deliveryPlannedDate\` DATE,
              \`comment\` TEXT,
              \`claimComment\` TEXT,
              \`photosJson\` TEXT,
              \`oemComment\` TEXT,
              \`status\` ENUM('katomo_stock','wg_storage','wg_production','wg_wait_pickup','katomo_picked_up','katomo_checked','completed') NOT NULL DEFAULT 'katomo_stock',
              \`completionStatus\` ENUM('ok','checked','revision_requested'),
              \`pickupConfirmed\` ENUM('true','false') NOT NULL DEFAULT 'false',
              \`incomingPlannedDateConfirmed\` ENUM('true','false') NOT NULL DEFAULT 'false',
              \`specSheetUrl\` TEXT,
              \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            `
        );

        // 既存のテーブルに必要なカラムが存在しない場合は追加
        const pool = getPool();
        if (pool) {
            const columnsToCheck = [
                { name: 'status', type: "ENUM('katomo_stock','wg_storage','wg_production','wg_wait_pickup','katomo_picked_up','katomo_checked','completed') NOT NULL DEFAULT 'katomo_stock'", after: 'oemComment' },
                { name: 'productionMonth', type: 'VARCHAR(100)', after: 'inCharge' },
                { name: 'desiredIncomingPlannedDate', type: 'DATE', after: 'dueDate' },
                { name: 'completionStatus', type: "ENUM('ok','checked','revision_requested')", after: 'status' },
                { name: 'incomingPlannedDateConfirmed', type: "ENUM('true','false') NOT NULL DEFAULT 'false'", after: 'pickupConfirmed' },
            ];

            for (const col of columnsToCheck) {
                try {
                    const [columns]: any = await pool.execute(
                        `SHOW COLUMNS FROM \`deliverySchedules\` LIKE '${col.name}'`
                    );
                    if (columns.length === 0) {
                        await pool.execute(
                            `ALTER TABLE \`deliverySchedules\` ADD COLUMN \`${col.name}\` ${col.type} AFTER \`${col.after}\``
                        );
                        console.log(`[deliverySchedules] Added ${col.name} column`);
                    } else if (col.name === 'status') {
                        // statusカラムが既に存在する場合、ENUM値を更新（katomo_picked_upを追加）
                        try {
                            await pool.execute(
                                `ALTER TABLE \`deliverySchedules\` MODIFY COLUMN \`status\` ${col.type}`
                            );
                            console.log(`[deliverySchedules] Updated ${col.name} ENUM values`);
                        } catch (updateError: any) {
                            // ENUMの更新が失敗した場合はログのみ（既に新しいENUM値が含まれている可能性がある）
                            console.log(`[deliverySchedules] ENUM update for ${col.name} may have been skipped:`, updateError?.message);
                        }
                    }
                } catch (alterError: any) {
                    // カラムが既に存在する場合は無視
                    if (!alterError?.message?.includes("Duplicate column") && !alterError?.message?.includes("already exists")) {
                        console.error(`[deliverySchedules] Failed to add ${col.name} column:`, alterError);
                    }
                }
            }
        }
    } catch (e) {
        console.error("[deliverySchedules] ensureDeliverySchedulesTable failed:", e);
    }
}

export const deliverySchedulesRouter = createTRPCRouter({
    // 公開（パスワードなし）用の一覧取得
    publicList: publicProcedure
        .input(
            z.object({
                year: z.number(),
                month: z.number().min(1).max(12),
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await ensureDeliverySchedulesTable(db);

            const { start, end } = getMonthRange(input.year, input.month);
            const startStr = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
            const endStr = `${input.year}-${String(input.month).padStart(2, "0")}-${new Date(input.year, input.month, 0).getDate()}`;

            try {
                console.log(`[deliverySchedules.publicList] Fetching records for ${input.year}-${input.month}`);

                // すべてのレコードを取得してから、JavaScript側でフィルタリング（より安全）
                let allRecords: any[] = [];
                try {
                    // テーブルが存在するか確認してからselectを実行
                    const pool = getPool();
                    if (pool) {
                        const [tables]: any = await pool.execute(
                            "SHOW TABLES LIKE 'deliverySchedules'"
                        );
                        if (tables.length === 0) {
                            console.warn("[deliverySchedules.publicList] Table doesn't exist, returning empty array");
                            return [];
                        }
                    }

                    allRecords = await db.select().from(schema.deliverySchedules);
                    console.log(`[deliverySchedules.publicList] Fetched ${allRecords.length} total records`);
                } catch (selectError: any) {
                    console.error("[deliverySchedules.publicList] Select error:", selectError);
                    console.error("[deliverySchedules.publicList] Select error message:", selectError?.message);
                    console.error("[deliverySchedules.publicList] Select error code:", selectError?.code);
                    // エラーが発生した場合は空配列を返す（安全のため）
                    console.warn("[deliverySchedules.publicList] Error during select, returning empty array");
                    return [];
                }

                // 安全な日付比較関数
                const isDateInRange = (dateValue: any, startStr: string, endStr: string): boolean => {
                    if (!dateValue) return false;
                    try {
                        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
                        if (isNaN(date.getTime())) return false;
                        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                        return dateStr >= startStr && dateStr <= endStr;
                    } catch (e) {
                        console.warn("[deliverySchedules.publicList] Date parsing error:", e, dateValue);
                        return false;
                    }
                };

                // フィルタリング: 完成していない車両は常に表示、完成した車両は納期範囲内のみ表示
                const records = allRecords.filter((r: any) => {
                    try {
                        // 完成していない車両（status !== "completed"）は、納期が過ぎていても常に表示
                        if (r.status !== "completed" && r.status !== null) {
                            return true;
                        }

                        // 完成した車両（status === "completed"）は、従来通りのフィルタリングロジックを適用
                        // deliveryPlannedDateが指定月の範囲内
                        if (r.deliveryPlannedDate && isDateInRange(r.deliveryPlannedDate, startStr, endStr)) {
                            return true;
                        }

                        // deliveryPlannedDateがnull/未設定で、dueDateが指定月の範囲内
                        if ((!r.deliveryPlannedDate || r.deliveryPlannedDate === null) && r.dueDate && isDateInRange(r.dueDate, startStr, endStr)) {
                            return true;
                        }

                        // 両方null/未設定の場合は、すべて表示（新規登録された車両も含む）
                        if ((!r.deliveryPlannedDate || r.deliveryPlannedDate === null) && (!r.dueDate || r.dueDate === null)) {
                            return true;
                        }

                        // その他の日付が指定月の範囲外の場合でも、最近作成されたレコード（30日以内）は表示
                        const createdAt = r.createdAt ? new Date(r.createdAt) : null;
                        if (createdAt && !isNaN(createdAt.getTime())) {
                            const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysSinceCreation <= 30) {
                                return true; // 最近作成されたレコードは表示
                            }
                        }

                        return false;
                    } catch (e) {
                        console.warn("[deliverySchedules.publicList] Filter error for record:", r.id, e);
                        // エラーが発生した場合は表示する（安全のため）
                        return true;
                    }
                });

                console.log(`[deliverySchedules.publicList] Total records fetched: ${allRecords.length}`);
                console.log(`[deliverySchedules.publicList] Filtered to ${records.length} records`);
                console.log(`[deliverySchedules.publicList] Completed items: ${allRecords.filter((r: any) => r.status === "completed").length}`);
                console.log(`[deliverySchedules.publicList] Incomplete items: ${allRecords.filter((r: any) => r.status !== "completed").length}`);

                const finalRecords = records;
                console.log(`[deliverySchedules.publicList] Returning ${finalRecords.length} records`);

                return finalRecords.map((r) => {
                    try {
                        return {
                            ...r,
                            delayDays: calcDelayDays(r.dueDate),
                        };
                    } catch (e) {
                        console.warn("[deliverySchedules.publicList] Mapping error for record:", r.id, e);
                        return {
                            ...r,
                            delayDays: 0,
                        };
                    }
                });
            } catch (error: any) {
                console.error("[deliverySchedules.publicList] Error:", error);
                console.error("[deliverySchedules.publicList] Error message:", error?.message);
                console.error("[deliverySchedules.publicList] Error stack:", error?.stack);
                // エラーが発生した場合は空配列を返す（安全のため）
                console.warn("[deliverySchedules.publicList] Returning empty array due to error");
                return [];
            }
        }),

    // アプリ側（ログイン後）の一覧取得
    list: protectedProcedure
        .input(
            z.object({
                year: z.number(),
                month: z.number().min(1).max(12),
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await ensureDeliverySchedulesTable(db);

            const { start, end } = getMonthRange(input.year, input.month);
            const startStr = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
            const endStr = `${input.year}-${String(input.month).padStart(2, "0")}-${new Date(input.year, input.month, 0).getDate()}`;

            try {
                console.log(`[deliverySchedules.list] Fetching records for ${input.year}-${input.month}`);

                // すべてのレコードを取得してから、JavaScript側でフィルタリング（より安全）
                let allRecords: any[] = [];
                try {
                    console.log("[deliverySchedules.list] Attempting to fetch records...");

                    // 直接selectを実行（テーブル存在確認をスキップ）
                    allRecords = await db.select().from(schema.deliverySchedules);
                    console.log(`[deliverySchedules.list] ✅ Successfully fetched ${allRecords.length} total records`);

                    if (allRecords.length > 0) {
                        console.log("[deliverySchedules.list] First record sample:", JSON.stringify(allRecords[0], null, 2));
                    }
                } catch (selectError: any) {
                    console.error("[deliverySchedules.list] ❌ Select error:", selectError);
                    console.error("[deliverySchedules.list] ❌ Select error message:", selectError?.message);
                    console.error("[deliverySchedules.list] ❌ Select error code:", selectError?.code);
                    console.error("[deliverySchedules.list] ❌ Select error stack:", selectError?.stack);

                    // エラーが発生した場合でも、生SQLクエリで試行
                    try {
                        console.log("[deliverySchedules.list] Attempting raw SQL query...");
                        const pool = getPool();
                        if (pool) {
                            const [rows]: any = await pool.execute("SELECT * FROM deliverySchedules ORDER BY id DESC");
                            allRecords = rows || [];
                            console.log(`[deliverySchedules.list] ✅ Raw SQL fetched ${allRecords.length} records`);
                        }
                    } catch (rawSqlError: any) {
                        console.error("[deliverySchedules.list] ❌ Raw SQL error:", rawSqlError);
                        // エラーでも空配列を返す
                        return [];
                    }
                }

                // 安全な日付比較関数
                const isDateInRange = (dateValue: any, startStr: string, endStr: string): boolean => {
                    if (!dateValue) return false;
                    try {
                        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
                        if (isNaN(date.getTime())) return false;
                        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                        return dateStr >= startStr && dateStr <= endStr;
                    } catch (e) {
                        console.warn("[deliverySchedules.list] Date parsing error:", e, dateValue);
                        return false;
                    }
                };

                // フィルタリング: 完成していない車両は常に表示、完成した車両は納期範囲内のみ表示
                const records = allRecords.filter((r: any) => {
                    try {
                        // 完成していない車両（status !== "completed"）は、納期が過ぎていても常に表示
                        if (r.status !== "completed" && r.status !== null) {
                            return true;
                        }

                        // 完成した車両（status === "completed"）は、従来通りのフィルタリングロジックを適用
                        // deliveryPlannedDateが指定月の範囲内
                        if (r.deliveryPlannedDate && isDateInRange(r.deliveryPlannedDate, startStr, endStr)) {
                            return true;
                        }

                        // deliveryPlannedDateがnull/未設定で、dueDateが指定月の範囲内
                        if ((!r.deliveryPlannedDate || r.deliveryPlannedDate === null) && r.dueDate && isDateInRange(r.dueDate, startStr, endStr)) {
                            return true;
                        }

                        // 両方null/未設定の場合は、すべて表示（新規登録された車両も含む）
                        if ((!r.deliveryPlannedDate || r.deliveryPlannedDate === null) && (!r.dueDate || r.dueDate === null)) {
                            return true;
                        }

                        // その他の日付が指定月の範囲外の場合でも、最近作成されたレコード（30日以内）は表示
                        const createdAt = r.createdAt ? new Date(r.createdAt) : null;
                        if (createdAt && !isNaN(createdAt.getTime())) {
                            const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysSinceCreation <= 30) {
                                return true; // 最近作成されたレコードは表示
                            }
                        }

                        return false;
                    } catch (e) {
                        console.warn("[deliverySchedules.list] Filter error for record:", r.id, e);
                        // エラーが発生した場合は表示する（安全のため）
                        return true;
                    }
                });

                console.log(`[deliverySchedules.list] Total records fetched: ${allRecords.length}`);
                console.log(`[deliverySchedules.list] Filtered to ${records.length} records`);
                console.log(`[deliverySchedules.list] Completed items: ${allRecords.filter((r: any) => r.status === "completed").length}`);
                console.log(`[deliverySchedules.list] Incomplete items: ${allRecords.filter((r: any) => r.status !== "completed").length}`);

                const finalRecords = records;
                console.log(`[deliverySchedules.list] Returning ${finalRecords.length} records`);

                return finalRecords.map((r) => {
                    try {
                        return {
                            ...r,
                            delayDays: calcDelayDays(r.dueDate),
                        };
                    } catch (e) {
                        console.warn("[deliverySchedules.list] Mapping error for record:", r.id, e);
                        return {
                            ...r,
                            delayDays: 0,
                        };
                    }
                });
            } catch (error: any) {
                console.error("[deliverySchedules.list] Error:", error);
                console.error("[deliverySchedules.list] Error message:", error?.message);
                console.error("[deliverySchedules.list] Error stack:", error?.stack);
                // エラーが発生した場合は空配列を返す（安全のため）
                console.warn("[deliverySchedules.list] Returning empty array due to error");
                return [];
            }
        }),

    // 1件取得
    get: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await ensureDeliverySchedulesTable(db);

            const [record] = await db
                .select()
                .from(schema.deliverySchedules)
                .where(eq(schema.deliverySchedules.id, input.id))
                .limit(1);

            if (!record) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "レコードが見つかりません",
                });
            }

            return {
                ...record,
                delayDays: calcDelayDays(record.dueDate),
            };
        }),

    // 作成（準管理者以上）
    create: subAdminProcedure
        .input(
            z.object({
                vehicleName: z.string(),
                vehicleType: z.string().optional(),
                customerName: z.string().optional(),
                optionName: z.string().optional(),
                optionCategory: z.string().optional(),
                prefecture: z.string().optional(),
                baseCarReady: z.enum(["yes", "no"]).optional(),
                furnitureReady: z.enum(["yes", "no"]).optional(),
                inCharge: z.string().optional(),
                productionMonth: z.string().optional(), // ワングラム制作分（例: "11月ワングラム制作分"）
                dueDate: z.string().optional(), // yyyy-MM-dd（ワングラム入庫予定）
                desiredIncomingPlannedDate: z.string().optional(), // yyyy-MM-dd（希望ワングラム完成予定日・katomo入力）
                incomingPlannedDate: z.string().optional(),
                shippingPlannedDate: z.string().optional(),
                deliveryPlannedDate: z.string().optional(),
                comment: z.string().optional(),
                claimComment: z.string().optional(),
                photosJson: z.string().optional(),
                oemComment: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await ensureDeliverySchedulesTable(db);

            const parseDate = (value?: string): string | undefined => {
                if (!value) return undefined;
                // YYYY-MM-DD形式の文字列をそのまま返す
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    return value;
                }
                // それ以外の場合はDateオブジェクトに変換してからYYYY-MM-DD形式に
                const d = new Date(value);
                if (isNaN(d.getTime())) return undefined;
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
            };

            try {
                // ENUM値の正規化（空文字列や無効な値はundefinedにしてフィールドを除外）
                const normalizeEnum = (value?: string, validValues?: string[]): string | undefined => {
                    if (!value || value === "" || value === "undefined" || value === undefined) return undefined;
                    if (validValues && !validValues.includes(value)) return undefined;
                    return value;
                };

                // 文字列値の正規化（空文字列はundefinedにしてフィールドを除外）
                const normalizeString = (value?: string): string | undefined => {
                    if (!value || value === "" || value === "undefined" || value === undefined) return undefined;
                    return value;
                };

                console.log("[deliverySchedules.create] Raw input:", JSON.stringify(input, null, 2));

                const insertData: any = {
                    vehicleName: input.vehicleName,
                    vehicleType: normalizeString(input.vehicleType),
                    customerName: normalizeString(input.customerName),
                    optionName: normalizeString(input.optionName),
                    optionCategory: normalizeString(input.optionCategory),
                    prefecture: normalizeString(input.prefecture),
                    baseCarReady: normalizeEnum(input.baseCarReady, ["yes", "no"]),
                    furnitureReady: normalizeEnum(input.furnitureReady, ["yes", "no"]),
                    inCharge: normalizeString(input.inCharge),
                    productionMonth: normalizeString(input.productionMonth),
                    dueDate: parseDate(input.dueDate),
                    desiredIncomingPlannedDate: parseDate(input.desiredIncomingPlannedDate),
                    incomingPlannedDate: parseDate(input.incomingPlannedDate),
                    shippingPlannedDate: parseDate(input.shippingPlannedDate),
                    deliveryPlannedDate: parseDate(input.deliveryPlannedDate),
                    comment: normalizeString(input.comment),
                    claimComment: normalizeString(input.claimComment),
                    photosJson: normalizeString(input.photosJson),
                    oemComment: normalizeString(input.oemComment),
                    // status と pickupConfirmed はスキーマのデフォルト値を使用（明示的に設定しない）
                };

                console.log("[deliverySchedules.create] Insert data:", JSON.stringify(insertData, null, 2));

                // 生のSQLクエリを使用して、値があるフィールドのみを挿入
                const fields: string[] = ["vehicleName"];
                const values: any[] = [insertData.vehicleName];
                const placeholders: string[] = ["?"];

                if (insertData.vehicleType !== undefined) {
                    fields.push("vehicleType");
                    values.push(insertData.vehicleType);
                    placeholders.push("?");
                }
                if (insertData.customerName !== undefined) {
                    fields.push("customerName");
                    values.push(insertData.customerName);
                    placeholders.push("?");
                }
                if (insertData.optionName !== undefined) {
                    fields.push("optionName");
                    values.push(insertData.optionName);
                    placeholders.push("?");
                }
                if (insertData.optionCategory !== undefined) {
                    fields.push("optionCategory");
                    values.push(insertData.optionCategory);
                    placeholders.push("?");
                }
                if (insertData.prefecture !== undefined) {
                    fields.push("prefecture");
                    values.push(insertData.prefecture);
                    placeholders.push("?");
                }
                if (insertData.baseCarReady !== undefined) {
                    fields.push("baseCarReady");
                    values.push(insertData.baseCarReady);
                    placeholders.push("?");
                }
                if (insertData.furnitureReady !== undefined) {
                    fields.push("furnitureReady");
                    values.push(insertData.furnitureReady);
                    placeholders.push("?");
                }
                if (insertData.inCharge !== undefined) {
                    fields.push("inCharge");
                    values.push(insertData.inCharge);
                    placeholders.push("?");
                }
                if (insertData.productionMonth !== undefined) {
                    fields.push("productionMonth");
                    values.push(insertData.productionMonth);
                    placeholders.push("?");
                }
                if (insertData.dueDate !== undefined) {
                    fields.push("dueDate");
                    values.push(insertData.dueDate);
                    placeholders.push("?");
                }
                if (insertData.desiredIncomingPlannedDate !== undefined) {
                    fields.push("desiredIncomingPlannedDate");
                    values.push(insertData.desiredIncomingPlannedDate);
                    placeholders.push("?");
                }
                if (insertData.incomingPlannedDate !== undefined) {
                    fields.push("incomingPlannedDate");
                    values.push(insertData.incomingPlannedDate);
                    placeholders.push("?");
                }
                if (insertData.shippingPlannedDate !== undefined) {
                    fields.push("shippingPlannedDate");
                    values.push(insertData.shippingPlannedDate);
                    placeholders.push("?");
                }
                if (insertData.deliveryPlannedDate !== undefined) {
                    fields.push("deliveryPlannedDate");
                    values.push(insertData.deliveryPlannedDate);
                    placeholders.push("?");
                }
                if (insertData.comment !== undefined) {
                    fields.push("comment");
                    values.push(insertData.comment);
                    placeholders.push("?");
                }
                if (insertData.claimComment !== undefined) {
                    fields.push("claimComment");
                    values.push(insertData.claimComment);
                    placeholders.push("?");
                }
                if (insertData.photosJson !== undefined) {
                    fields.push("photosJson");
                    values.push(insertData.photosJson);
                    placeholders.push("?");
                }
                if (insertData.oemComment !== undefined) {
                    fields.push("oemComment");
                    values.push(insertData.oemComment);
                    placeholders.push("?");
                }

                // status と pickupConfirmed はデフォルト値を使用（フィールドリストに含めない）

                const sql = `INSERT INTO \`deliverySchedules\` (\`${fields.join("`, `")}\`) VALUES (${placeholders.join(", ")})`;
                console.log("[deliverySchedules.create] SQL:", sql);
                console.log("[deliverySchedules.create] Values:", values);

                // 生のSQLクエリを実行
                const pool = getPool();
                if (!pool) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "データベースプールが利用できません",
                    });
                }
                await pool.execute(sql, values);

                return { success: true };
            } catch (error: any) {
                console.error("[deliverySchedules.create] Error:", error);
                console.error("[deliverySchedules.create] Error stack:", error?.stack);
                console.error("[deliverySchedules.create] Input:", JSON.stringify(input, null, 2));
                const errorMessage = error?.message || String(error);
                const errorCode = error?.code || "UNKNOWN";
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: `登録に失敗しました: ${errorMessage} (コード: ${errorCode})`,
                });
            }
        }),

    // 更新（準管理者以上、またはワングラム側はincomingPlannedDateのみ）
    update: protectedProcedure
        .input(
            z.object({
                id: z.number(),
                vehicleName: z.string().optional(),
                vehicleType: z.string().optional(),
                customerName: z.string().optional(),
                optionName: z.string().optional(),
                optionCategory: z.string().optional(),
                prefecture: z.string().optional(),
                baseCarReady: z.enum(["yes", "no"]).optional(),
                furnitureReady: z.enum(["yes", "no"]).optional(),
                inCharge: z.string().optional(),
                productionMonth: z.string().optional(), // ワングラム制作分（例: "11月ワングラム制作分"）
                dueDate: z.string().optional(),
                desiredIncomingPlannedDate: z.string().optional(), // yyyy-MM-dd（希望ワングラム完成予定日・katomo入力）
                incomingPlannedDate: z.string().optional(),
                shippingPlannedDate: z.string().optional(),
                deliveryPlannedDate: z.string().optional(),
                comment: z.string().optional(),
                claimComment: z.string().optional(),
                photosJson: z.string().optional(),
                oemComment: z.string().optional(),
                status: z
                    .enum(["katomo_stock", "wg_storage", "wg_production", "wg_wait_pickup", "katomo_picked_up", "katomo_checked", "completed"])
                    .optional(),
                completionStatus: z
                    .enum(["ok", "checked", "revision_requested"])
                    .optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await ensureDeliverySchedulesTable(db);

            // ワングラム側（externalロール）は incomingPlannedDate のみ編集可能
            const userRole = ctx.user?.role;
            const isExternal = userRole === "external";
            const isSubAdminOrAdmin = userRole === "sub_admin" || userRole === "admin";

            if (isExternal) {
                // externalロールの場合、incomingPlannedDate以外のフィールドを除外
                const allowedFields = ["id", "incomingPlannedDate"];
                const restrictedFields = Object.keys(input).filter(key => !allowedFields.includes(key));
                if (restrictedFields.length > 0) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: `ワングラム側は「ワングラム完成予定日（ワングラム入力）」のみ編集可能です。`,
                    });
                }
            } else if (!isSubAdminOrAdmin) {
                // external以外でsub_admin/adminでない場合は拒否
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "この操作は管理者・準管理者のみが実行できます。",
                });
            }

            // 更新前のincomingPlannedDateを取得（通知用）
            let previousIncomingPlannedDate: string | null = null;
            if (isExternal && input.incomingPlannedDate !== undefined) {
                const [existing] = await db
                    .select({ incomingPlannedDate: schema.deliverySchedules.incomingPlannedDate })
                    .from(schema.deliverySchedules)
                    .where(eq(schema.deliverySchedules.id, input.id))
                    .limit(1);
                if (existing?.incomingPlannedDate) {
                    // DateオブジェクトをYYYY-MM-DD形式の文字列に変換
                    const date = existing.incomingPlannedDate instanceof Date
                        ? existing.incomingPlannedDate
                        : new Date(existing.incomingPlannedDate);
                    if (!isNaN(date.getTime())) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const day = String(date.getDate()).padStart(2, "0");
                        previousIncomingPlannedDate = `${year}-${month}-${day}`;
                    }
                }
            }

            // 必要なカラムが存在するか確認し、存在しない場合は追加
            const pool = getPool();
            if (pool) {
                const columnsToCheck = [
                    { name: 'productionMonth', type: 'VARCHAR(100)', after: 'inCharge' },
                    { name: 'desiredIncomingPlannedDate', type: 'DATE', after: 'dueDate' },
                    { name: 'incomingPlannedDateConfirmed', type: "ENUM('true','false') NOT NULL DEFAULT 'false'", after: 'pickupConfirmed' },
                    { name: 'completionStatus', type: "ENUM('ok','checked','revision_requested')", after: 'status' },
                ];

                for (const col of columnsToCheck) {
                    try {
                        const [columns]: any = await pool.execute(
                            `SHOW COLUMNS FROM \`deliverySchedules\` LIKE '${col.name}'`
                        );
                        if (columns.length === 0) {
                            await pool.execute(
                                `ALTER TABLE \`deliverySchedules\` ADD COLUMN \`${col.name}\` ${col.type} AFTER \`${col.after}\``
                            );
                            console.log(`[deliverySchedules.update] Added ${col.name} column`);
                        }
                    } catch (alterError: any) {
                        // カラムが既に存在する場合は無視
                        if (!alterError?.message?.includes("Duplicate column") && !alterError?.message?.includes("already exists")) {
                            console.error(`[deliverySchedules.update] Failed to ensure ${col.name} column:`, alterError);
                        }
                    }
                }
            }

            const parseDate = (value?: string | null) => {
                // nullまたは空文字列の場合はnullを返す（日付をクリアするため）
                if (value === null || value === "") return null;
                // undefinedの場合はundefinedを返す（更新しない）
                if (value === undefined) return undefined;
                // YYYY-MM-DD形式の文字列をそのまま返す
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    return value;
                }
                // それ以外の場合はDateオブジェクトに変換してからYYYY-MM-DD形式に
                const d = new Date(value);
                if (isNaN(d.getTime())) return undefined;
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
            };

            const updateData: any = {};
            if (input.vehicleName !== undefined) updateData.vehicleName = input.vehicleName;
            if (input.vehicleType !== undefined) updateData.vehicleType = input.vehicleType;
            if (input.customerName !== undefined) updateData.customerName = input.customerName;
            if (input.optionName !== undefined) updateData.optionName = input.optionName;
            if (input.optionCategory !== undefined) updateData.optionCategory = input.optionCategory;
            if (input.prefecture !== undefined) updateData.prefecture = input.prefecture;
            if (input.baseCarReady !== undefined) updateData.baseCarReady = input.baseCarReady;
            if (input.furnitureReady !== undefined) updateData.furnitureReady = input.furnitureReady;
            if (input.inCharge !== undefined) updateData.inCharge = input.inCharge;
            if (input.productionMonth !== undefined) {
                // 空文字列の場合はnullに変換
                updateData.productionMonth = input.productionMonth === "" ? null : input.productionMonth;
            }

            const due = parseDate(input.dueDate);
            if (input.dueDate !== undefined) updateData.dueDate = due ?? null;
            const desiredIncoming = parseDate(input.desiredIncomingPlannedDate);
            if (input.desiredIncomingPlannedDate !== undefined)
                updateData.desiredIncomingPlannedDate = desiredIncoming ?? null;
            const incoming = parseDate(input.incomingPlannedDate);
            if (input.incomingPlannedDate !== undefined)
                updateData.incomingPlannedDate = incoming;
            const shipping = parseDate(input.shippingPlannedDate);
            if (input.shippingPlannedDate !== undefined)
                updateData.shippingPlannedDate = shipping;
            const delivery = parseDate(input.deliveryPlannedDate);
            if (input.deliveryPlannedDate !== undefined)
                updateData.deliveryPlannedDate = delivery ?? null;

            if (input.comment !== undefined) updateData.comment = input.comment;
            if (input.claimComment !== undefined) updateData.claimComment = input.claimComment;
            if (input.photosJson !== undefined) updateData.photosJson = input.photosJson;
            if (input.oemComment !== undefined) updateData.oemComment = input.oemComment;
            if (input.status !== undefined) updateData.status = input.status;
            if (input.completionStatus !== undefined) updateData.completionStatus = input.completionStatus;

            console.log("[deliverySchedules.update] Update data:", JSON.stringify(updateData, null, 2));
            console.log("[deliverySchedules.update] Updating record ID:", input.id);

            // 更新データが空の場合はエラー
            if (Object.keys(updateData).length === 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "更新するデータがありません",
                });
            }

            try {
                // すべての更新を生SQLクエリで実行
                const pool = getPool();
                if (pool) {
                    // 必要なカラムが存在するか確認し、存在しない場合は追加
                    const requiredColumns = [
                        { name: 'status', type: "ENUM('katomo_stock','wg_storage','wg_production','wg_wait_pickup','katomo_picked_up','katomo_checked','completed') NOT NULL DEFAULT 'katomo_stock'", after: 'oemComment' },
                        { name: 'productionMonth', type: 'VARCHAR(100)', after: 'inCharge' },
                        { name: 'desiredIncomingPlannedDate', type: 'DATE', after: 'dueDate' },
                        { name: 'completionStatus', type: "ENUM('ok','checked','revision_requested')", after: 'status' },
                        { name: 'incomingPlannedDateConfirmed', type: "ENUM('true','false') NOT NULL DEFAULT 'false'", after: 'pickupConfirmed' },
                    ];

                    for (const col of requiredColumns) {
                        try {
                            const [columns]: any = await pool.execute(
                                `SHOW COLUMNS FROM \`deliverySchedules\` LIKE '${col.name}'`
                            );
                            if (columns.length === 0) {
                                await pool.execute(
                                    `ALTER TABLE \`deliverySchedules\` ADD COLUMN \`${col.name}\` ${col.type} AFTER \`${col.after}\``
                                );
                                console.log(`[deliverySchedules.update] Added missing ${col.name} column`);
                            } else if (col.name === 'status') {
                                // statusカラムが既に存在する場合、ENUM値を更新（katomo_picked_upを追加）
                                try {
                                    await pool.execute(
                                        `ALTER TABLE \`deliverySchedules\` MODIFY COLUMN \`status\` ${col.type}`
                                    );
                                    console.log(`[deliverySchedules.update] Updated ${col.name} ENUM values`);
                                } catch (updateError: any) {
                                    // ENUMの更新が失敗した場合はログのみ（既に新しいENUM値が含まれている可能性がある）
                                    console.log(`[deliverySchedules.update] ENUM update for ${col.name} may have been skipped:`, updateError?.message);
                                }
                            }
                        } catch (alterError: any) {
                            // カラムが既に存在する場合は無視
                            if (!alterError?.message?.includes("Duplicate column") && !alterError?.message?.includes("already exists")) {
                                console.warn(`[deliverySchedules.update] Failed to add ${col.name} column:`, alterError?.message);
                            }
                        }
                    }

                    // updateDataからundefinedを除外し、有効なフィールドのみを抽出
                    const validUpdateData: Record<string, any> = {};
                    for (const [key, value] of Object.entries(updateData)) {
                        // undefinedは除外、nullは許可
                        if (value !== undefined) {
                            validUpdateData[key] = value;
                        }
                    }

                    // 有効なフィールドがない場合はエラー
                    if (Object.keys(validUpdateData).length === 0) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: "更新する有効なデータがありません",
                        });
                    }

                    // updateDataの各フィールドをSET句に変換
                    const fields: string[] = [];
                    const values: any[] = [];

                    for (const [key, value] of Object.entries(validUpdateData)) {
                        fields.push(`\`${key}\` = ?`);
                        values.push(value);
                    }

                    // IDを最後に追加
                    values.push(input.id);

                    const updateQuery = `UPDATE \`deliverySchedules\` SET ${fields.join(", ")} WHERE \`id\` = ?`;
                    console.log("[deliverySchedules.update] Executing SQL:", updateQuery);
                    console.log("[deliverySchedules.update] Values:", values);
                    console.log("[deliverySchedules.update] Valid update data keys:", Object.keys(validUpdateData));
                    try {
                        await pool.execute(updateQuery, values);
                        console.log("[deliverySchedules.update] ✅ Fields updated using raw SQL");
                    } catch (sqlError: any) {
                        console.error("[deliverySchedules.update] ❌ SQL execution error:", sqlError);
                        console.error("[deliverySchedules.update] ❌ SQL query:", updateQuery);
                        console.error("[deliverySchedules.update] ❌ SQL values:", values);
                        throw sqlError;
                    }
                } else {
                    // poolが取得できない場合は通常のDrizzleクエリを使用
                    // undefinedを除外
                    const validUpdateData: any = {};
                    for (const [key, value] of Object.entries(updateData)) {
                        if (value !== undefined) {
                            validUpdateData[key] = value;
                        }
                    }
                    await db
                        .update(schema.deliverySchedules)
                        .set(validUpdateData)
                        .where(eq(schema.deliverySchedules.id, input.id));
                }

                console.log("[deliverySchedules.update] ✅ Update successful");

                // ワングラム側がincomingPlannedDateを更新した場合、準管理者以上に通知を送る
                if (isExternal && input.incomingPlannedDate !== undefined) {
                    const currentIncoming = parseDate(input.incomingPlannedDate);
                    // 値が変更された場合（新規設定または更新）に通知
                    const previousValue = previousIncomingPlannedDate || "";
                    const currentValue = currentIncoming || "";
                    const shouldNotify = currentValue !== "" && previousValue !== currentValue;

                    if (shouldNotify) {
                        try {
                            // 通知対象: 管理者・準管理者全員
                            const admins = await db
                                .select()
                                .from(schema.users)
                                .where(
                                    or(
                                        eq(schema.users.role, "admin" as any),
                                        eq(schema.users.role, "sub_admin" as any)
                                    )
                                );

                            // 対象の納車スケジュール情報を取得
                            const [schedule] = await db
                                .select()
                                .from(schema.deliverySchedules)
                                .where(eq(schema.deliverySchedules.id, input.id))
                                .limit(1);

                            const title = "ワングラム完成予定日が入力されました";
                            const baseName = schedule?.vehicleName || "納車スケジュール";
                            let dateStr = "";
                            if (currentIncoming) {
                                try {
                                    const dateObj = new Date(currentIncoming);
                                    if (!isNaN(dateObj.getTime())) {
                                        dateStr = dateObj.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
                                    } else {
                                        dateStr = currentIncoming; // パースできない場合はそのまま表示
                                    }
                                } catch (e) {
                                    dateStr = currentIncoming; // エラーの場合はそのまま表示
                                }
                            }
                            const message = `${baseName} のワングラム完成予定日（ワングラム入力）が ${dateStr} に設定されました。`;

                            if (admins.length > 0) {
                                await db.insert(schema.notifications).values(
                                    admins.map((admin) => ({
                                        userId: admin.id,
                                        title,
                                        message,
                                        type: "info" as any,
                                    }))
                                );
                                console.log(`[deliverySchedules.update] 📧 Sent notifications to ${admins.length} admins/sub_admins`);
                            }
                        } catch (notificationError: any) {
                            // 通知の送信に失敗しても、更新自体は成功とする
                            console.error("[deliverySchedules.update] ❌ Failed to send notifications:", notificationError);
                        }
                    }
                }

                return { success: true };
            } catch (updateError: any) {
                console.error("[deliverySchedules.update] ❌ Update error:", updateError);
                console.error("[deliverySchedules.update] ❌ Error message:", updateError?.message);
                console.error("[deliverySchedules.update] ❌ Error code:", updateError?.code);
                console.error("[deliverySchedules.update] ❌ Error stack:", updateError?.stack);
                console.error("[deliverySchedules.update] ❌ Update data was:", JSON.stringify(updateData, null, 2));

                // カラムが存在しないエラーの場合、より詳細なメッセージを提供
                const errorMessage = updateError?.message || String(updateError);
                if (errorMessage.includes("Unknown column") || errorMessage.includes("doesn't exist")) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: `更新に失敗しました: データベースのカラムが見つかりません。エラー: ${errorMessage}`,
                    });
                }

                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: `更新に失敗しました: ${errorMessage}`,
                });
            }
        }),

    // 削除（準管理者以上）
    delete: subAdminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await ensureDeliverySchedulesTable(db);

            await db.delete(schema.deliverySchedules).where(eq(schema.deliverySchedules.id, input.id));

            return { success: true };
        }),

    // 引き取り予定日を確定（準管理者以上）
    confirmPickup: subAdminProcedure
        .input(z.object({ id: z.number(), confirmed: z.boolean() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await ensureDeliverySchedulesTable(db);

            await db
                .update(schema.deliverySchedules)
                .set({ pickupConfirmed: input.confirmed ? "true" : "false" } as any)
                .where(eq(schema.deliverySchedules.id, input.id));

            if (input.confirmed) {
                // 通知対象: 管理者・準管理者全員 + 名前に「鈴木」を含むユーザー
                const admins = await db
                    .select()
                    .from(schema.users)
                    .where(
                        or(
                            eq(schema.users.role, "admin" as any),
                            eq(schema.users.role, "sub_admin" as any)
                        )
                    );

                const { like } = await import("drizzle-orm");
                const suzukiUsers = await db
                    .select()
                    .from(schema.users)
                    .where(like(schema.users.name, "%鈴木%"))
                    .limit(5);

                const targets = [...admins, ...suzukiUsers];
                const uniqueUserIds = Array.from(new Set(targets.map((u) => u.id)));

                // 対象の納車スケジュール情報を取得
                const [schedule] = await db
                    .select()
                    .from(schema.deliverySchedules)
                    .where(eq(schema.deliverySchedules.id, input.id))
                    .limit(1);

                const title = "引き取り予定日が確定しました";
                const baseName = schedule?.vehicleName || "納車スケジュール";
                const message = `${baseName} の引き取り予定日が確定しました。`;

                if (uniqueUserIds.length > 0) {
                    await db.insert(schema.notifications).values(
                        uniqueUserIds.map((userId) => ({
                            userId,
                            title,
                            message,
                            type: "info" as any,
                        }))
                    );
                }
            }

            return { success: true };
        }),

    // ワングラム完成予定日を確定（準管理者以上）
    confirmIncoming: subAdminProcedure
        .input(z.object({ id: z.number(), confirmed: z.boolean() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await ensureDeliverySchedulesTable(db);

            const pool = getPool();
            if (pool) {
                await pool.execute(
                    "UPDATE deliverySchedules SET incomingPlannedDateConfirmed = ? WHERE id = ?",
                    [input.confirmed ? "true" : "false", input.id]
                );
            } else {
                await db
                    .update(schema.deliverySchedules)
                    .set({ incomingPlannedDateConfirmed: input.confirmed ? "true" : "false" } as any)
                    .where(eq(schema.deliverySchedules.id, input.id));
            }

            if (input.confirmed) {
                // 通知対象: 管理者・準管理者全員 + 名前に「鈴木」を含むユーザー
                const admins = await db
                    .select()
                    .from(schema.users)
                    .where(
                        or(
                            eq(schema.users.role, "admin" as any),
                            eq(schema.users.role, "sub_admin" as any)
                        )
                    );

                const { like } = await import("drizzle-orm");
                const suzukiUsers = await db
                    .select()
                    .from(schema.users)
                    .where(like(schema.users.name, "%鈴木%"))
                    .limit(5);

                const targets = [...admins, ...suzukiUsers];
                const uniqueUserIds = Array.from(new Set(targets.map((u) => u.id)));

                // 対象の納車スケジュール情報を取得
                const [schedule] = await db
                    .select()
                    .from(schema.deliverySchedules)
                    .where(eq(schema.deliverySchedules.id, input.id))
                    .limit(1);

                const title = "ワングラム完成予定日が確定しました";
                const baseName = schedule?.vehicleName || "納車スケジュール";
                const message = `${baseName} のワングラム完成予定日が確定しました。`;

                if (uniqueUserIds.length > 0) {
                    await db.insert(schema.notifications).values(
                        uniqueUserIds.map((userId) => ({
                            userId,
                            title,
                            message,
                            type: "info" as any,
                        }))
                    );
                }
            }

            return { success: true };
        }),

    // 製造注意仕様書をアップロード（準管理者以上）
    uploadSpecSheet: subAdminProcedure
        .input(
            z.object({
                id: z.number(),
                fileData: z.string(), // base64
                fileName: z.string(),
                fileType: z.enum(["image/jpeg", "image/jpg", "application/pdf"]),
            })
        )
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await ensureDeliverySchedulesTable(db);

            // ディレクトリ作成
            const uploadDir = path.resolve(process.cwd(), "uploads", "delivery-specs");
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const extension = input.fileType === "application/pdf" ? "pdf" : "jpg";
            const fileName = `${input.id}_${nanoid()}.${extension}`;
            const filePath = path.join(uploadDir, fileName);

            const base64Data = input.fileData.replace(/^data:.*,/, "");
            const buffer = Buffer.from(base64Data, "base64");
            fs.writeFileSync(filePath, buffer);

            const fileUrl = `/uploads/delivery-specs/${fileName}`;

            await db
                .update(schema.deliverySchedules)
                .set({ specSheetUrl: fileUrl } as any)
                .where(eq(schema.deliverySchedules.id, input.id));

            return { success: true, fileUrl };
        }),

    // チャット一覧取得（全員が閲覧可能）
    getChats: protectedProcedure
        .input(
            z.object({
                deliveryScheduleId: z.number().optional(), // 指定されない場合は全体チャット
            })
        )
        .query(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            // チャットテーブルが存在することを確認
            try {
                await db.execute(
                    `
                    CREATE TABLE IF NOT EXISTS \`deliveryScheduleChats\` (
                      \`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                      \`deliveryScheduleId\` INT,
                      \`userId\` INT NOT NULL,
                      \`message\` TEXT NOT NULL,
                      \`parentId\` INT,
                      \`imageUrl\` TEXT,
                      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    `
                );
                // parentIdカラムが存在しない場合は追加
                try {
                    await db.execute(
                        `ALTER TABLE \`deliveryScheduleChats\` ADD COLUMN \`parentId\` INT`
                    );
                } catch (e: any) {
                    // カラムが既に存在する場合は無視
                    if (!e?.message?.includes("Duplicate column") && !e?.message?.includes("already exists")) {
                        console.error("[deliverySchedules] add parentId column failed:", e);
                    }
                }
                // imageUrlカラムが存在しない場合は追加
                try {
                    await db.execute(
                        `ALTER TABLE \`deliveryScheduleChats\` ADD COLUMN \`imageUrl\` TEXT`
                    );
                } catch (e: any) {
                    // カラムが既に存在する場合は無視
                    if (!e?.message?.includes("Duplicate column") && !e?.message?.includes("already exists")) {
                        console.error("[deliverySchedules] add imageUrl column failed:", e);
                    }
                }
                // 既読管理テーブルを作成
                await db.execute(
                    `
                    CREATE TABLE IF NOT EXISTS \`deliveryScheduleChatReads\` (
                      \`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                      \`chatId\` INT NOT NULL,
                      \`userId\` INT NOT NULL,
                      \`readAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      UNIQUE KEY \`unique_read\` (\`chatId\`, \`userId\`)
                    )
                    `
                );
            } catch (e) {
                console.error("[deliverySchedules] ensureChatTable failed:", e);
            }

            // チャット一覧を取得（返信先情報も含める）
            const chats = await db
                .select({
                    id: schema.deliveryScheduleChats.id,
                    deliveryScheduleId: schema.deliveryScheduleChats.deliveryScheduleId,
                    userId: schema.deliveryScheduleChats.userId,
                    message: schema.deliveryScheduleChats.message,
                    parentId: schema.deliveryScheduleChats.parentId,
                    imageUrl: schema.deliveryScheduleChats.imageUrl,
                    createdAt: schema.deliveryScheduleChats.createdAt,
                    userName: schema.users.name,
                })
                .from(schema.deliveryScheduleChats)
                .leftJoin(schema.users, eq(schema.deliveryScheduleChats.userId, schema.users.id))
                .where(
                    input.deliveryScheduleId !== undefined
                        ? eq(schema.deliveryScheduleChats.deliveryScheduleId, input.deliveryScheduleId)
                        : isNull(schema.deliveryScheduleChats.deliveryScheduleId)
                )
                .orderBy(desc(schema.deliveryScheduleChats.createdAt)) as any;

            // 未読情報を取得（ログインユーザーがいる場合のみ）
            let unreadChatIds: number[] = [];
            if (ctx.user?.id) {
                const readChats = await db
                    .select({ chatId: schema.deliveryScheduleChatReads.chatId })
                    .from(schema.deliveryScheduleChatReads)
                    .where(eq(schema.deliveryScheduleChatReads.userId, ctx.user.id));
                const readChatIdSet = new Set(readChats.map((r: any) => r.chatId));
                unreadChatIds = chats
                    .filter((c: any) => !readChatIdSet.has(c.id) && c.userId !== ctx.user.id)
                    .map((c: any) => c.id);
            }

            // 返信先のユーザー名を取得（parentIdがあるコメントのみ）
            const parentIds = chats.filter((c: any) => c.parentId).map((c: any) => Number(c.parentId)).filter((id: any) => !isNaN(id));
            let parentChatsMap: Record<number, { userName: string | null; message: string }> = {};

            if (parentIds.length > 0) {
                const uniqueParentIds = Array.from(new Set(parentIds)) as number[];
                const parentChats = await db
                    .select({
                        id: schema.deliveryScheduleChats.id,
                        message: schema.deliveryScheduleChats.message,
                        userName: schema.users.name,
                    })
                    .from(schema.deliveryScheduleChats)
                    .leftJoin(schema.users, eq(schema.deliveryScheduleChats.userId, schema.users.id))
                    .where(inArray(schema.deliveryScheduleChats.id, uniqueParentIds)) as any[];

                parentChats.forEach((pc: any) => {
                    parentChatsMap[pc.id] = {
                        userName: pc.userName || null,
                        message: pc.message || "",
                    };
                });
            }

            // 返信先情報を追加
            const chatsWithReplies = chats.map((chat: any) => {
                const result: any = {
                    ...chat,
                    isUnread: unreadChatIds.includes(chat.id),
                };
                if (chat.parentId && parentChatsMap[chat.parentId]) {
                    result.parentUserName = parentChatsMap[chat.parentId].userName;
                    result.parentMessage = parentChatsMap[chat.parentId].message;
                }
                // imageUrlがJSON文字列の場合はパース
                if (chat.imageUrl) {
                    try {
                        result.imageUrls = JSON.parse(chat.imageUrl);
                    } catch {
                        result.imageUrls = [chat.imageUrl];
                    }
                } else {
                    result.imageUrls = [];
                }
                return result;
            });

            return chatsWithReplies;
        }),

    // チャット投稿（全員が投稿可能）
    createChat: protectedProcedure
        .input(
            z.object({
                deliveryScheduleId: z.number().optional(),
                message: z.string().min(1),
                parentId: z.number().optional(), // 返信先のコメントID
                imageUrls: z.array(z.string()).optional(), // 画像URL配列
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            if (!ctx.user?.id) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "ログインが必要です",
                });
            }

            const imageUrlJson = input.imageUrls && input.imageUrls.length > 0
                ? JSON.stringify(input.imageUrls)
                : null;

            await db.insert(schema.deliveryScheduleChats).values({
                deliveryScheduleId: input.deliveryScheduleId || null,
                userId: ctx.user.id,
                message: input.message,
                parentId: input.parentId || null,
                imageUrl: imageUrlJson,
            } as any);

            return { success: true };
        }),

    // チャット画像アップロード（全員が投稿可能）
    uploadChatImage: protectedProcedure
        .input(
            z.object({
                fileData: z.string(), // base64
                fileType: z.enum(["image/jpeg", "image/jpg", "image/png"]),
            })
        )
        .mutation(async ({ input }) => {
            // ディレクトリ作成
            const uploadDir = path.resolve(process.cwd(), "uploads", "delivery-chats");
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const extension = input.fileType === "image/png" ? "png" : "jpg";
            const fileName = `${nanoid()}.${extension}`;
            const filePath = path.join(uploadDir, fileName);

            const base64Data = input.fileData.replace(/^data:.*,/, "");
            const buffer = Buffer.from(base64Data, "base64");
            fs.writeFileSync(filePath, buffer);

            const fileUrl = `/uploads/delivery-chats/${fileName}`;

            return { success: true, fileUrl };
        }),

    // チャット既読マーク（全員が利用可能）
    markChatAsRead: protectedProcedure
        .input(
            z.object({
                chatId: z.number(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            if (!ctx.user?.id) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "ログインが必要です",
                });
            }

            // 既読テーブルが存在することを確認
            try {
                await db.execute(
                    `
                    CREATE TABLE IF NOT EXISTS \`deliveryScheduleChatReads\` (
                      \`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                      \`chatId\` INT NOT NULL,
                      \`userId\` INT NOT NULL,
                      \`readAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      UNIQUE KEY \`unique_read\` (\`chatId\`, \`userId\`)
                    )
                    `
                );
            } catch (e) {
                console.error("[deliverySchedules] ensureChatReadsTable failed:", e);
            }

            // 既読レコードを挿入（重複の場合は無視）
            try {
                await db.insert(schema.deliveryScheduleChatReads).values({
                    chatId: input.chatId,
                    userId: ctx.user.id,
                } as any);
            } catch (e: any) {
                // 既に既読の場合は無視
                if (!e?.message?.includes("Duplicate entry")) {
                    console.error("[deliverySchedules] markChatAsRead failed:", e);
                }
            }

            return { success: true };
        }),

    // チャット削除（管理者・準管理者のみ）
    deleteChat: subAdminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await db.delete(schema.deliveryScheduleChats).where(eq(schema.deliveryScheduleChats.id, input.id));

            return { success: true };
        }),
});


