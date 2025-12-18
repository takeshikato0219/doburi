import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, subAdminProcedure, publicProcedure } from "../_core/trpc";
import { getDb, schema } from "../db";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";

// ==== ここから新しい時間計算ロジック（UTC/タイムゾーンは一切使わない）====

// JSTで現在の日時を取得するヘルパー関数
function getJSTNow(): { year: number; month: number; day: number; hour: number; minute: number } {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    return {
        year: parseInt(parts.find(p => p.type === 'year')?.value || '0'),
        month: parseInt(parts.find(p => p.type === 'month')?.value || '1'),
        day: parseInt(parts.find(p => p.type === 'day')?.value || '1'),
        hour: parseInt(parts.find(p => p.type === 'hour')?.value || '0'),
        minute: parseInt(parts.find(p => p.type === 'minute')?.value || '0'),
    };
}

// "HH:MM" → 分（0〜1439）。不正値は null。
function timeToMinutes(t?: string | null): number | null {
    if (!t) return null;
    const [hh, mm] = t.split(":");
    const h = Number(hh);
    const m = Number(mm);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const total = h * 60 + m;
    if (total < 0 || total > 23 * 60 + 59) return null;
    return total;
}

// 分（0〜1439）→ "HH:MM"
function minutesToTime(mins: number): string {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
    const h = String(Math.floor(clamped / 60)).padStart(2, "0");
    const m = String(clamped % 60).padStart(2, "0");
    return `${h}:${m}`;
}

// 出勤・退勤の文字列を「同じ日の start/end」と「勤務分」に正規化
function normalizeWorkTimes(
    inStr?: string | null,
    outStr?: string | null
): { clockInTime: string; clockOutTime: string; rawMinutes: number } {
    let inMin = timeToMinutes(inStr);
    let outMin = timeToMinutes(outStr);

    // どちらも無い場合は 08:30-17:30 を仮の範囲にする
    if (inMin == null && outMin == null) {
        inMin = 8 * 60 + 30;
        outMin = 17 * 60 + 30;
    }
    // 片方だけ入っている場合は同じ値にする
    if (inMin == null && outMin != null) inMin = outMin;
    if (outMin == null && inMin != null) outMin = inMin;

    const start = Math.min(inMin!, outMin!);
    const end = Math.max(inMin!, outMin!);
    const rawMinutes = Math.max(0, end - start);

    return {
        clockInTime: minutesToTime(start),
        clockOutTime: minutesToTime(end),
        rawMinutes,
    };
}

// DB からアクティブな休憩時間を取得
async function getActiveBreakTimes(db: Awaited<ReturnType<typeof getDb>>): Promise<any[]> {
    if (!db) return [];
    try {
        const all = await db.select().from(schema.breakTimes);
        return all.filter((bt) => bt.isActive === "true");
    } catch (error) {
        console.warn("[attendance] Failed to fetch breakTimes:", error);
        return [];
    }
}

// 勤務時間（分）から、休憩を差し引いた「実労働分」を計算
async function calculateWorkMinutes(
    clockInTime: string,
    clockOutTime: string,
    db: Awaited<ReturnType<typeof getDb>>
): Promise<number> {
    const startMin = timeToMinutes(clockInTime);
    const endMin = timeToMinutes(clockOutTime);
    if (startMin == null || endMin == null) return 0;
    if (!db) return Math.max(0, endMin - startMin);

    const baseMinutes = Math.max(0, endMin - startMin);
    const breakTimes = await getActiveBreakTimes(db);

    let breakTotal = 0;
    for (const bt of breakTimes) {
        const s = timeToMinutes(bt.startTime);
        const eRaw = timeToMinutes(bt.endTime);
        if (s == null || eRaw == null) continue;
        let e = eRaw;
        // 休憩の方が日を跨いでいても、勤務は同一日なので実質重ならないが、
        // 一応 24h を足して「翌日まで続く」として扱う。
        if (e < s) {
            e += 24 * 60;
        }

        // 勤務区間 [startMin, endMin] と休憩区間 [s, e] の重なり
        const overlapStart = Math.max(startMin, s);
        const overlapEnd = Math.min(endMin, e);
        if (overlapEnd > overlapStart) {
            breakTotal += overlapEnd - overlapStart;
        }
    }

    const result = Math.max(0, baseMinutes - breakTotal);
    return result;
}

// ==== ここまで新しい時間計算ロジック ====

export const attendanceRouter = createTRPCRouter({
    // 指定日の出退勤状況を取得（workDate + HH:MM ベース）
    getTodayStatus: protectedProcedure
        .input(
            z.object({
                workDate: z.string(), // "YYYY-MM-DD"（フロントで決めた日付）
            })
        )
        .query(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) {
                console.warn("[attendance.getTodayStatus] Database connection failed, returning sample data");
                // サンプルデータを返す（今日の出勤記録）
                const jstNow = getJSTNow();
                const todayStr = `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
                
                // 今日の日付と一致する場合のみサンプルデータを返す
                if (input.workDate === todayStr) {
                    return {
                        clockInTime: "08:30",
                        clockOutTime: null, // 作業中
                        workMinutes: Math.floor((jstNow.hour * 60 + jstNow.minute) - (8 * 60 + 30)), // 現在時刻までの勤務時間
                        workDate: todayStr,
                    };
                } else {
                    // 過去の日付の場合は退勤済みのサンプルデータ
                    return {
                        clockInTime: "08:30",
                        clockOutTime: "17:30",
                        workMinutes: 480, // 8時間（休憩1時間を除く）
                        workDate: input.workDate,
                    };
                }
            }

            const workDateStr = input.workDate;

            // そのユーザーの今日の出勤記録を1件取得（基本1件想定）
            const { desc } = await import("drizzle-orm");
            const [record] = await db
                .select()
                .from(schema.attendanceRecords)
                .where(
                    and(
                        eq(schema.attendanceRecords.userId, ctx.user!.id),
                        // workDate は "YYYY-MM-DD" の文字列として扱う
                        eq(schema.attendanceRecords.workDate, workDateStr as any)
                    )
                )
                .orderBy(desc(schema.attendanceRecords.id))
                .limit(1);

            if (!record) {
                return null;
            }

            const workMinutes =
                record.clockInTime && record.clockOutTime
                    ? await calculateWorkMinutes(record.clockInTime, record.clockOutTime, db)
                    : record.workMinutes ?? null;

            return {
                id: record.id,
                workDate: record.workDate,
                clockInTime: record.clockInTime,
                clockOutTime: record.clockOutTime,
                workMinutes,
            };
        }),

    // 出勤打刻（管理アカウント専用）
    clockIn: subAdminProcedure
        .input(
            z.object({
                workDate: z.string().optional(), // "YYYY-MM-DD"
                deviceType: z.enum(["pc", "mobile"]).optional().default("pc"),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            // JSTで現在の日時を取得
            const jstNow = getJSTNow();
            // フロントから来ていればそれを優先、無ければサーバーの「今日」（JST）
            const todayStr = input.workDate ?? `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
            const timeStr = `${String(jstNow.hour).padStart(2, "0")}:${String(jstNow.minute).padStart(2, "0")}`;

            // 今日の出勤記録を確認（1日1件想定）
            const [existing] = await db
                .select()
                .from(schema.attendanceRecords)
                .where(
                    and(
                        eq(schema.attendanceRecords.userId, ctx.user!.id),
                        eq(schema.attendanceRecords.workDate, todayStr as any)
                    )
                )
                .limit(1);

            if (existing) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "今日は既に出勤しています",
                });
            }

            await db
                .insert(schema.attendanceRecords)
                .values({
                    userId: ctx.user!.id,
                    workDate: todayStr as any,
                    clockInTime: timeStr,
                    clockInDevice: input.deviceType,
                });

            // 挿入されたレコードを取得（最新のものを取得）
            const { desc } = await import("drizzle-orm");
            const [inserted] = await db
                .select()
                .from(schema.attendanceRecords)
                .where(eq(schema.attendanceRecords.userId, ctx.user!.id))
                .orderBy(desc(schema.attendanceRecords.id))
                .limit(1);

            if (!inserted) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "出勤記録の作成に失敗しました",
                });
            }

            return {
                id: inserted.id,
                workDate: inserted.workDate,
                clockInTime: inserted.clockInTime,
            };
        }),

    // 退勤打刻
    // 退勤打刻（管理アカウント専用）
    clockOut: subAdminProcedure
        .input(z.object({ workDate: z.string().optional() }).optional())
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            // JSTで現在の日時を取得
            const jstNow = getJSTNow();
            const todayStr = input?.workDate ?? `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
            const timeStr = `${String(jstNow.hour).padStart(2, "0")}:${String(jstNow.minute).padStart(2, "0")}`;

            // 今日の未退勤記録を取得
            const [record] = await db
                .select()
                .from(schema.attendanceRecords)
                .where(
                    and(
                        eq(schema.attendanceRecords.userId, ctx.user!.id),
                        eq(schema.attendanceRecords.workDate, todayStr as any)
                    )
                )
                .limit(1);

            if (!record) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "出勤記録が見つかりません",
                });
            }

            const norm = normalizeWorkTimes(record.clockInTime, timeStr);
            const workMinutes = await calculateWorkMinutes(norm.clockInTime, norm.clockOutTime, db);

            await db
                .update(schema.attendanceRecords)
                .set({
                    workDate: todayStr as any,
                    clockInTime: norm.clockInTime,
                    clockOutTime: norm.clockOutTime,
                    workMinutes,
                    clockOutDevice: "pc",
                })
                .where(eq(schema.attendanceRecords.id, record.id));

            return {
                id: record.id,
                workDate: todayStr,
                clockInTime: norm.clockInTime,
                clockOutTime: norm.clockOutTime,
                workMinutes,
            };
        }),

    // 全スタッフの「今日」の出退勤状況を取得（準管理者以上・workDate ベース）
    // ※現在は管理画面からは使用せず、getAllStaffByDate で日付指定する運用
    getAllStaffToday: subAdminProcedure.query(async () => {
        try {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            // JSTで現在の日時を取得
            const jstNow = getJSTNow();
            const todayStr = `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;

            // 全ユーザーを取得（nameやcategoryカラムが存在しない場合に対応）
            const { selectUsersSafely } = await import("../db");
            const allUsers = await selectUsersSafely(db);

            // externalロールのユーザーを除外（社外アカウントは出勤記録に含めない）
            const staffUsers = allUsers.filter((u: any) => u.role !== "external");

            // 各ユーザーの出退勤記録を取得
            const result = await Promise.all(
                staffUsers.map(async (user) => {
                    try {
                        const attendanceRecords = await db
                            .select()
                            .from(schema.attendanceRecords)
                            .where(
                                and(
                                    eq(schema.attendanceRecords.userId, user.id),
                                    eq(schema.attendanceRecords.workDate, todayStr as any)
                                )
                            )
                            .limit(1);
                        const attendance = attendanceRecords[0] || null;

                        const workMinutes =
                            attendance?.clockInTime && attendance?.clockOutTime
                                ? await calculateWorkMinutes(attendance.clockInTime, attendance.clockOutTime, db)
                                : attendance?.workMinutes ?? null;

                        return {
                            userId: user.id,
                            userName: user.name || user.username,
                            attendance: attendance
                                ? {
                                    id: attendance.id,
                                    workDate: attendance.workDate,
                                    clockInTime: attendance.clockInTime,
                                    clockOutTime: attendance.clockOutTime,
                                    workMinutes,
                                    clockInDevice: attendance.clockInDevice,
                                    clockOutDevice: attendance.clockOutDevice,
                                }
                                : null,
                        };
                    } catch (error) {
                        console.error(`Error processing user ${user.id}:`, error);
                        // エラーが発生したユーザーはnullのattendanceを返す
                        return {
                            userId: user.id,
                            userName: user.name || user.username,
                            attendance: null,
                        };
                    }
                })
            );

            return result;
        } catch (error) {
            console.error("Error in getAllStaffToday:", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error instanceof Error ? error.message : "スタッフ情報の取得に失敗しました",
            });
        }
    }),

    // 特定日の全スタッフの出退勤状況を取得（準管理者以上・workDate ベース）
    getAllStaffByDate: subAdminProcedure
        .input(z.object({ date: z.string() }))
        .query(async ({ input }) => {
            try {
                const db = await getDb();
                if (!db) {
                    console.warn("[attendance.getAllStaffByDate] Database connection failed, returning sample data");
                    // サンプルデータを返す（20人のスタッフの出退勤記録）
                    const sampleStaff = [];
                    const jstNow = getJSTNow();
                    const todayStr = `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
                    const isToday = input.date === todayStr;
                    
                    for (let i = 1; i <= 20; i++) {
                        const clockInHour = 8 + (i % 3); // 8時、9時、10時のいずれか
                        const clockInMinute = (i * 5) % 30; // 0分、5分、10分...25分
                        const clockInTime = `${String(clockInHour).padStart(2, "0")}:${String(clockInMinute).padStart(2, "0")}`;
                        
                        // 今日の場合は退勤していない、過去の場合は退勤済み
                        const clockOutTime = isToday ? null : "17:30";
                        const workMinutes = isToday 
                            ? Math.floor((jstNow.hour * 60 + jstNow.minute) - (clockInHour * 60 + clockInMinute))
                            : 480; // 8時間
                        
                        sampleStaff.push({
                            userId: i,
                            userName: `スタッフ${i}`,
                            userUsername: `user${String(i).padStart(3, "0")}`,
                            clockIn: clockInTime,
                            clockOut: clockOutTime,
                            workDuration: workMinutes,
                            clockInDevice: "pc",
                            clockOutDevice: clockOutTime ? "pc" : null,
                            workDate: input.date,
                        });
                    }
                    
                    return sampleStaff;
                }

                // 全ユーザーを取得（nameやcategoryカラムが存在しない場合に対応）
                const { selectUsersSafely } = await import("../db");
                const allUsers = await selectUsersSafely(db);

                // externalロールのユーザーを除外（社外アカウントは出勤記録に含めない）
                const staffUsers = allUsers.filter((u: any) => u.role !== "external");

                // 各ユーザーの出退勤記録を取得（指定日の出勤記録のみ）
                const result = await Promise.all(
                    staffUsers.map(async (user) => {
                        try {
                            // 指定日の出勤記録のみを取得（clockInが指定日の範囲内）
                            const [attendance] = await db
                                .select()
                                .from(schema.attendanceRecords)
                                .where(
                                    and(
                                        eq(schema.attendanceRecords.userId, user.id),
                                        eq(schema.attendanceRecords.workDate, input.date as any)
                                    )
                                )
                                .limit(1);

                            const workMinutes =
                                attendance?.clockInTime && attendance?.clockOutTime
                                    ? await calculateWorkMinutes(attendance.clockInTime, attendance.clockOutTime, db)
                                    : attendance?.workMinutes ?? null;

                            return {
                                userId: user.id,
                                userName: user.name || user.username,
                                attendance: attendance
                                    ? {
                                        id: attendance.id,
                                        workDate: attendance.workDate,
                                        clockInTime: attendance.clockInTime,
                                        clockOutTime: attendance.clockOutTime,
                                        workMinutes,
                                        clockInDevice: attendance.clockInDevice,
                                        clockOutDevice: attendance.clockOutDevice,
                                    }
                                    : null,
                            };
                        } catch (error) {
                            console.error(`Error processing user ${user.id}:`, error);
                            // エラーが発生したユーザーはnullのattendanceを返す
                            return {
                                userId: user.id,
                                userName: user.name || user.username,
                                attendance: null,
                            };
                        }
                    })
                );

                return result;
            } catch (error) {
                console.error("Error in getAllStaffByDate:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error instanceof Error ? error.message : "スタッフ情報の取得に失敗しました",
                });
            }
        }),

    // 管理者が代理で出勤打刻（準管理者以上）
    adminClockIn: subAdminProcedure
        .input(
            z.object({
                userId: z.number(),
                // フロントがまだ古い形（clockInだけ）で呼んでいる場合もあるので、workDate/time は任意にしてサーバー側で補完する
                workDate: z.string().optional(), // "YYYY-MM-DD"
                time: z.string().optional(), // "HH:MM"
                deviceType: z.enum(["pc", "mobile"]).optional().default("pc"),
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

            // workDate / time が来ていなければ「今」の日付と時刻で補完する（JST）
            const jstNow = getJSTNow();
            const workDateStr = input.workDate ?? `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
            const timeStr = input.time ?? `${hh}:${mm}`;

            // ★ いったん「1日1件チェック」は外して、必ずレコードを1件追加する
            await db
                .insert(schema.attendanceRecords)
                .values({
                    userId: input.userId,
                    workDate: workDateStr as any,
                    clockInTime: timeStr,
                    clockInDevice: input.deviceType,
                });

            const [user] = await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, input.userId))
                .limit(1);

            return {
                id: input.userId,
                userName: user?.name || user?.username || "不明",
            };
        }),

    // 管理者が代理で退勤打刻（準管理者以上）
    adminClockOut: subAdminProcedure
        .input(
            z.object({
                userId: z.number(),
                workDate: z.string(), // "YYYY-MM-DD" - 必ずこの日のレコードだけを対象にする
                time: z.string(),     // "HH:MM"
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

            const [record] = await db
                .select()
                .from(schema.attendanceRecords)
                .where(
                    and(
                        eq(schema.attendanceRecords.userId, input.userId),
                        eq(schema.attendanceRecords.workDate, input.workDate as any)
                    )
                )
                .limit(1);

            if (!record) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "出勤記録が見つかりません",
                });
            }

            const norm = normalizeWorkTimes(record.clockInTime, input.time);
            const workMinutes = await calculateWorkMinutes(norm.clockInTime, norm.clockOutTime, db);

            await db
                .update(schema.attendanceRecords)
                .set({
                    workDate: input.workDate as any,
                    clockInTime: norm.clockInTime,
                    clockOutTime: norm.clockOutTime,
                    workMinutes,
                    clockOutDevice: "pc",
                })
                .where(eq(schema.attendanceRecords.id, record.id));

            const [user] = await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, input.userId))
                .limit(1);

            return {
                id: input.userId,
                userName: user?.name || user?.username || "不明",
            };
        }),

    // 出退勤記録を更新（準管理者以上）
    updateAttendance: subAdminProcedure
        .input(
            z.object({
                attendanceId: z.number(),
                workDate: z.string(), // "YYYY-MM-DD" - 必ずこの日の中で正規化する
                clockInTime: z.string().nullable().optional(), // "HH:MM"
                clockOutTime: z.string().nullable().optional(), // "HH:MM"
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

            // 既存の記録を取得
            const [record] = await db
                .select()
                .from(schema.attendanceRecords)
                .where(eq(schema.attendanceRecords.id, input.attendanceId))
                .limit(1);

            if (!record) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "出退勤記録が見つかりません",
                });
            }

            // 出勤時刻と退勤時刻を決定
            // - 入力値が指定されている場合はそれを使用（空文字列の場合はnullに変換）
            // - 入力値がundefinedの場合は既存値を維持
            // - 退勤時刻がnullの場合はnullのまま（出勤中の場合）
            const newClockInTime = input.clockInTime !== undefined
                ? (input.clockInTime === "" ? null : input.clockInTime)
                : record.clockInTime;
            const newClockOutTime = input.clockOutTime !== undefined
                ? (input.clockOutTime === "" ? null : input.clockOutTime)
                : record.clockOutTime;

            // 退勤時刻がnullの場合は、normalizeWorkTimesを使わずに直接処理
            let finalClockInTime: string;
            let finalClockOutTime: string | null;
            let workMinutes: number | null;

            if (newClockOutTime === null) {
                // 出勤中（退勤時刻がnull）の場合
                // 出勤時刻だけを正規化（退勤時刻はnullのまま）
                if (newClockInTime) {
                    const norm = normalizeWorkTimes(newClockInTime, newClockInTime);
                    finalClockInTime = norm.clockInTime;
                    finalClockOutTime = null;
                    // 退勤時刻がない場合はworkMinutesは計算できない（null）
                    workMinutes = null;
                } else {
                    // 出勤時刻もnullの場合は既存値を維持
                    finalClockInTime = record.clockInTime || "";
                    finalClockOutTime = null;
                    workMinutes = null;
                }
            } else {
                // 退勤時刻がある場合は通常通り正規化
                const norm = normalizeWorkTimes(newClockInTime, newClockOutTime);
                finalClockInTime = norm.clockInTime;
                finalClockOutTime = norm.clockOutTime;
                workMinutes = await calculateWorkMinutes(finalClockInTime, finalClockOutTime, db);
            }

            const updateData: any = {
                workDate: new Date(input.workDate),
                clockInTime: finalClockInTime,
                clockOutTime: finalClockOutTime,
                workMinutes,
            };

            await db
                .update(schema.attendanceRecords)
                .set(updateData)
                .where(eq(schema.attendanceRecords.id, input.attendanceId));

            // 更新後のデータを取得して確認
            const [updatedRecord] = await db
                .select()
                .from(schema.attendanceRecords)
                .where(eq(schema.attendanceRecords.id, input.attendanceId))
                .limit(1);

            if (!updatedRecord) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "更新後のデータを取得できませんでした",
                });
            }

            return {
                success: true,
                attendance: {
                    id: updatedRecord.id,
                    workDate: updatedRecord.workDate,
                    clockInTime: updatedRecord.clockInTime,
                    clockOutTime: updatedRecord.clockOutTime,
                    workMinutes: updatedRecord.workMinutes,
                }
            };
        }),

    // 今日の未退勤記録を23:59に自動退勤（自動実行用、publicProcedureで実行可能）
    autoCloseTodayAt2359: publicProcedure.mutation(async () => {
        try {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            // JSTで現在の日時を取得
            const jstNow = getJSTNow();
            const todayStr = `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;

            // 今日の未退勤記録を取得（clockOutTime が空のもの）
            const unclosedRecords = await db
                .select()
                .from(schema.attendanceRecords)
                .where(
                    and(
                        eq(schema.attendanceRecords.workDate, new Date(todayStr)),
                        isNull(schema.attendanceRecords.clockOutTime)
                    )
                );

            let count = 0;

            for (const record of unclosedRecords) {
                const norm = normalizeWorkTimes(record.clockInTime, "23:59");
                const workMinutes = await calculateWorkMinutes(norm.clockInTime, norm.clockOutTime, db);

                await db
                    .update(schema.attendanceRecords)
                    .set({
                        clockOutTime: norm.clockOutTime,
                        clockOutDevice: "auto-23:59",
                        workMinutes,
                    })
                    .where(eq(schema.attendanceRecords.id, record.id));

                count++;
            }

            if (count > 0) {
                console.log(`[自動退勤] ${count}件の未退勤記録を23:59に自動退勤処理しました`);
            }

            return { count };
        } catch (error) {
            console.error("Error in autoCloseTodayAt2359:", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error instanceof Error ? error.message : "自動退勤処理に失敗しました",
            });
        }
    }),

    // 出退勤記録を削除（準管理者以上）
    deleteAttendance: subAdminProcedure
        .input(z.object({ attendanceId: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await db
                .delete(schema.attendanceRecords)
                .where(eq(schema.attendanceRecords.id, input.attendanceId));

            return { success: true };
        }),

    // 編集履歴を取得（準管理者以上）
    getEditLogs: subAdminProcedure
        .input(
            z.object({
                attendanceId: z.number().optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
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

            let logs;
            if (input.attendanceId) {
                logs = await db
                    .select()
                    .from(schema.attendanceEditLogs)
                    .where(eq(schema.attendanceEditLogs.attendanceId, input.attendanceId))
                    .orderBy(schema.attendanceEditLogs.createdAt);
            } else {
                logs = await db
                    .select()
                    .from(schema.attendanceEditLogs)
                    .orderBy(schema.attendanceEditLogs.createdAt);
            }

            // ユーザー情報を取得（nameやcategoryカラムが存在しない場合に対応）
            const { selectUsersSafely } = await import("../db");
            const users = await selectUsersSafely(db);
            const userMap = new Map(users.map((u) => [u.id, u]));

            // 出退勤記録情報を取得
            const attendanceIds = [...new Set(logs.map((log) => log.attendanceId))];
            let attendances: any[] = [];
            if (attendanceIds.length > 0) {
                attendances = await db
                    .select()
                    .from(schema.attendanceRecords)
                    .where(inArray(schema.attendanceRecords.id, attendanceIds));
            }

            return logs.map((log) => {
                const editor = userMap.get(log.editorId);
                const attendance = attendances.find((a) => a.id === log.attendanceId);
                const attendanceUser = attendance ? userMap.get(attendance.userId) : null;

                return {
                    id: log.id,
                    attendanceId: log.attendanceId,
                    editorId: log.editorId,
                    editorName: editor?.name || editor?.username || "不明",
                    editorUsername: editor?.username || "不明",
                    userName: attendanceUser?.name || attendanceUser?.username || "不明",
                    fieldName: log.fieldName,
                    oldValue: log.oldValue,
                    newValue: log.newValue,
                    createdAt: log.createdAt,
                };
            });
        }),

    // 過去の出勤記録のworkMinutesを再計算（準管理者以上・バッチ処理）
    recalculateAllWorkMinutes: subAdminProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "データベースに接続できません",
            });
        }

        // すべての出勤記録を取得（clockInTimeとclockOutTimeが存在するもの）
        const allRecords = await db
            .select()
            .from(schema.attendanceRecords)
            .where(
                and(
                    sql`${schema.attendanceRecords.clockInTime} IS NOT NULL`,
                    sql`${schema.attendanceRecords.clockOutTime} IS NOT NULL`
                )
            );

        console.log(`[recalculateAllWorkMinutes] 対象レコード数: ${allRecords.length}`);

        let updatedCount = 0;
        let errorCount = 0;
        const errors: Array<{ id: number; error: string }> = [];

        for (const record of allRecords) {
            try {
                if (!record.clockInTime || !record.clockOutTime) {
                    continue;
                }

                // 正規化してから再計算
                const norm = normalizeWorkTimes(record.clockInTime, record.clockOutTime);
                const newWorkMinutes = await calculateWorkMinutes(norm.clockInTime, norm.clockOutTime, db);

                // workMinutesが変更されている場合のみ更新
                if (record.workMinutes !== newWorkMinutes) {
                    await db
                        .update(schema.attendanceRecords)
                        .set({
                            workMinutes: newWorkMinutes,
                        })
                        .where(eq(schema.attendanceRecords.id, record.id));

                    updatedCount++;

                    if (updatedCount % 100 === 0) {
                        console.log(`[recalculateAllWorkMinutes] ${updatedCount}件更新済み...`);
                    }
                }
            } catch (error) {
                errorCount++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                errors.push({
                    id: record.id,
                    error: errorMessage,
                });
                console.error(`[recalculateAllWorkMinutes] レコードID ${record.id} の更新に失敗:`, errorMessage);
            }
        }

        console.log(`[recalculateAllWorkMinutes] 完了: 更新 ${updatedCount}件, エラー ${errorCount}件`);

        return {
            total: allRecords.length,
            updated: updatedCount,
            errors: errorCount,
            errorDetails: errors.slice(0, 10), // 最初の10件のエラーのみ返す
        };
    }),
});

