import { createTRPCRouter, protectedProcedure } from "../_core/trpc";
import { getDb, getPool, schema } from "../db";
import { eq, sql, inArray, and, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// MySQLのCONVERT_TZの結果を正しくJSTとして扱う関数
// MySQLが返すDATETIME文字列（例: "2025-12-03 13:30:00"）をJSTのISO文字列に変換
function parseJSTDateTime(mysqlDateTime: any): Date | null {
    if (!mysqlDateTime) return null;
    try {
        // MySQLのDATETIME文字列をJSTのISO文字列に変換
        // 例: "2025-12-03 13:30:00" → "2025-12-03T13:30:00+09:00"
        let dateStr: string;
        if (typeof mysqlDateTime === 'string') {
            dateStr = mysqlDateTime;
        } else if (mysqlDateTime instanceof Date) {
            // Dateオブジェクトの場合は、そのまま使用（既にUTCとして保存されている）
            // JSTに変換する必要がある場合は、toLocaleStringを使用
            const jstDate = new Date(mysqlDateTime.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
            if (isNaN(jstDate.getTime())) return null;
            return jstDate;
        } else if (mysqlDateTime.toISOString) {
            dateStr = mysqlDateTime.toISOString();
            // ISO文字列の場合は、そのまま使用（UTCとして解釈）
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            return date;
        } else {
            dateStr = String(mysqlDateTime);
        }
        
        // "YYYY-MM-DD HH:MM:SS"形式を"YYYY-MM-DDTHH:MM:SS+09:00"に変換
        // または既にISO形式の場合はそのまま使用
        let jstISOString: string;
        if (dateStr.includes('T')) {
            // 既にISO形式（例: "2025-12-03T13:30:00Z" または "2025-12-03T13:30:00+09:00"）
            jstISOString = dateStr;
        } else {
            // "YYYY-MM-DD HH:MM:SS"形式を"YYYY-MM-DDTHH:MM:SS+09:00"に変換
            jstISOString = dateStr.replace(' ', 'T') + '+09:00';
        }
        
        const date = new Date(jstISOString);
        // 無効な日付の場合はnullを返す
        if (isNaN(date.getTime())) {
            console.warn(`[parseJSTDateTime] 無効な日付文字列: ${mysqlDateTime} (変換後: ${jstISOString})`);
            return null;
        }
        return date;
    } catch (error) {
        console.error(`[parseJSTDateTime] エラー:`, error, `入力値:`, mysqlDateTime);
        return null;
    }
}

export const analyticsRouter = createTRPCRouter({
    getVehicleTypeStats: protectedProcedure
        .input(
            z.object({
                vehicleIds: z.array(z.number()).optional(),
            }).optional()
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                return [];
            }

            const conditions: any[] = [isNotNull(schema.workRecords.endTime)];
            if (input?.vehicleIds && input.vehicleIds.length > 0) {
                conditions.push(inArray(schema.vehicles.id, input.vehicleIds));
            }

            const stats = await db
                .select({
                    vehicleTypeId: schema.vehicles.vehicleTypeId,
                    vehicleCount: sql<number>`COUNT(DISTINCT ${schema.vehicles.id})`.as("vehicleCount"),
                    totalMinutes: sql<number>`COALESCE(SUM(TIMESTAMPDIFF(MINUTE, ${schema.workRecords.startTime}, ${schema.workRecords.endTime})), 0)`.as("totalMinutes"),
                })
                .from(schema.vehicles)
                .leftJoin(schema.workRecords, eq(schema.vehicles.id, schema.workRecords.vehicleId))
                .where(conditions.length === 1 ? conditions[0] : and(...conditions))
                .groupBy(schema.vehicles.vehicleTypeId);

            // 車種名を取得
            const vehicleTypes = await db.select().from(schema.vehicleTypes);
            const vehicleTypeMap = new Map(vehicleTypes.map((vt) => [vt.id, vt.name]));

            return stats.map((stat) => {
                const vehicleCount = Number(stat.vehicleCount) || 0;
                const totalMinutes = Number(stat.totalMinutes) || 0;
                const averageMinutes = vehicleCount > 0 ? Math.round(totalMinutes / vehicleCount) : 0;

                return {
                    vehicleTypeId: stat.vehicleTypeId,
                    vehicleTypeName: vehicleTypeMap.get(stat.vehicleTypeId) || "不明",
                    vehicleCount,
                    totalMinutes,
                    averageMinutes,
                };
            });
        }),

    getProcessStats: protectedProcedure
        .input(
            z.object({
                vehicleIds: z.array(z.number()).optional(),
            }).optional()
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                return [];
            }

            const conditions: any[] = [isNotNull(schema.workRecords.endTime)];
            if (input?.vehicleIds && input.vehicleIds.length > 0) {
                conditions.push(inArray(schema.workRecords.vehicleId, input.vehicleIds));
            }

            const stats = await db
                .select({
                    processId: schema.workRecords.processId,
                    workCount: sql<number>`COUNT(*)`.as("workCount"),
                    totalMinutes: sql<number>`COALESCE(SUM(TIMESTAMPDIFF(MINUTE, ${schema.workRecords.startTime}, ${schema.workRecords.endTime})), 0)`.as("totalMinutes"),
                })
                .from(schema.workRecords)
                .where(conditions.length === 1 ? conditions[0] : and(...conditions))
                .groupBy(schema.workRecords.processId);

            // 工程名を取得
            const processes = await db.select().from(schema.processes);
            const processMap = new Map(processes.map((p) => [p.id, p.name]));

            return stats.map((stat) => {
                const workCount = Number(stat.workCount) || 0;
                const totalMinutes = Number(stat.totalMinutes) || 0;
                const averageMinutes = workCount > 0 ? Math.round(totalMinutes / workCount) : 0;

                return {
                    processId: stat.processId,
                    processName: processMap.get(stat.processId) || "不明",
                    workCount,
                    totalMinutes,
                    averageMinutes,
                };
            });
        }),

    getVehicleTypeProcessStats: protectedProcedure
        .input(
            z.object({
                vehicleIds: z.array(z.number()).optional(),
            }).optional()
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                return [];
            }

            const conditions: any[] = [isNotNull(schema.workRecords.endTime)];
            if (input?.vehicleIds && input.vehicleIds.length > 0) {
                conditions.push(inArray(schema.vehicles.id, input.vehicleIds));
            }

            const stats = await db
                .select({
                    vehicleTypeId: schema.vehicles.vehicleTypeId,
                    processId: schema.workRecords.processId,
                    workCount: sql<number>`COUNT(*)`.as("workCount"),
                    totalMinutes: sql<number>`COALESCE(SUM(TIMESTAMPDIFF(MINUTE, ${schema.workRecords.startTime}, ${schema.workRecords.endTime})), 0)`.as("totalMinutes"),
                })
                .from(schema.workRecords)
                .innerJoin(schema.vehicles, eq(schema.workRecords.vehicleId, schema.vehicles.id))
                .where(conditions.length === 1 ? conditions[0] : and(...conditions))
                .groupBy(schema.vehicles.vehicleTypeId, schema.workRecords.processId);

            // 車種名と工程名を取得
            const vehicleTypes = await db.select().from(schema.vehicleTypes);
            const processes = await db.select().from(schema.processes);
            const vehicleTypeMap = new Map(vehicleTypes.map((vt) => [vt.id, vt.name]));
            const processMap = new Map(processes.map((p) => [p.id, p.name]));

            // 標準時間を取得
            const standards = await db.select().from(schema.vehicleTypeProcessStandards);
            const standardMap = new Map(
                standards.map((s) => [`${s.vehicleTypeId}-${s.processId}`, s.standardMinutes])
            );

            return stats.map((stat) => {
                const workCount = Number(stat.workCount) || 0;
                const totalMinutes = Number(stat.totalMinutes) || 0;
                const averageMinutes = workCount > 0 ? Math.round(totalMinutes / workCount) : 0;
                const standardMinutes =
                    standardMap.get(`${stat.vehicleTypeId}-${stat.processId}`) || null;

                return {
                    vehicleTypeId: stat.vehicleTypeId,
                    vehicleTypeName: vehicleTypeMap.get(stat.vehicleTypeId) || "不明",
                    processId: stat.processId,
                    processName: processMap.get(stat.processId) || "不明",
                    workCount,
                    totalMinutes,
                    averageMinutes,
                    standardMinutes,
                };
            });
        }),

    /**
     * 営業日を計算するヘルパー関数（土日を除く）
     * 今日から過去に遡って、指定された営業日数分の日付を返す
     */
    getBusinessDaysAgo: protectedProcedure
        .input(z.object({ days: z.number() }))
        .query(async ({ input }) => {
            // JSTで今日の日付を取得
            const now = new Date();
            const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
            const dates: string[] = [];
            let currentDate = new Date(now);
            // JSTで昨日から開始
            currentDate.setDate(currentDate.getDate() - 1);

            while (dates.length < input.days) {
                const jstParts = jstFormatter.formatToParts(currentDate);
                const y = jstParts.find(p => p.type === 'year')?.value || '0';
                const m = jstParts.find(p => p.type === 'month')?.value || '01';
                const d = jstParts.find(p => p.type === 'day')?.value || '01';
                const dateStr = `${y}-${m}-${d}`;
                
                // 曜日を取得（JSTで）
                const dayOfWeek = currentDate.getUTCDay();
                // 0=日曜, 6=土曜をスキップ
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    dates.push(dateStr);
                }
                currentDate.setDate(currentDate.getDate() - 1);
            }

            return dates;
        }),

    /**
     * 現場スタッフ（field_worker）で、
     * - 前日（当日は除外）に出勤していて
     * - 出勤記録がある人だけを対象
     * - 「出勤時間（休憩時間を引いた数） - 作業記録時間（休憩時間を引いた数）」が±1時間をはみ出した場合のみ警告
     */
    getRecentLowWorkUsers: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            return [];
        }

        // 前日のみを対象（当日は除外、土日も含む）- JSTで取得
        const now = new Date();
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const jstParts = jstFormatter.formatToParts(now);
        const y = parseInt(jstParts.find(p => p.type === 'year')?.value || '0');
        const m = parseInt(jstParts.find(p => p.type === 'month')?.value || '1');
        const d = parseInt(jstParts.find(p => p.type === 'day')?.value || '1');
        const today = new Date(y, m - 1, d);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

        const businessDates: string[] = [yesterdayStr];

        // attendanceRecords と workRecords を結合して、「過去3営業日の出勤日 × ユーザー」の作業時間を集計
        const pool = getPool();
        if (!pool) {
            return [];
        }

        const datePlaceholders = businessDates.map(() => "?").join(",");
        // 出勤記録があるすべてのユーザー・日付の組み合わせを取得（作業記録の有無に関わらず）
        const query = `
            SELECT DISTINCT
                ar.userId AS userId,
                COALESCE(u.name, u.username) AS userName,
                ar.workDate AS workDate
            FROM \`attendanceRecords\` ar
            INNER JOIN \`users\` u ON u.id = ar.userId
            WHERE
                ar.workDate IN (${datePlaceholders})
                AND ar.clockInTime IS NOT NULL
                AND u.role = 'field_worker'
        `;
        const [rows]: any = await pool.execute(query, businessDates);

        type Row = {
            userId: number;
            userName: string;
            workDate: string | Date;
        };

        const map = new Map<
            number,
            {
                userId: number;
                userName: string;
                dates: string[];
            }
        >();

        // 各ユーザー・日付の組み合わせに対して、getWorkReportDetailと同じロジックでdifferenceMinutesを計算
        for (const r of rows as Row[]) {
            const userId = Number((r as any).userId);
            const userName = (r as any).userName as string;
            const workDate =
                typeof r.workDate === "string"
                    ? r.workDate
                    : (r.workDate as Date).toISOString().slice(0, 10);

            try {
                // getWorkReportDetailと同じロジックで計算
                // 出勤記録を取得
                const attendanceQuery = `
                    SELECT
                        ar.id AS attendanceId,
                        ar.workDate,
                        ar.clockInTime,
                        ar.clockOutTime,
                        ar.workMinutes AS attendanceWorkMinutes,
                        COALESCE(
                            ar.workMinutes,
                            TIMESTAMPDIFF(
                                MINUTE,
                                STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockInTime), '%Y-%m-%d %H:%i'),
                                STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockOutTime), '%Y-%m-%d %H:%i')
                            ),
                            0
                        ) AS attendanceMinutes
                    FROM \`attendanceRecords\` ar
                    WHERE
                        ar.userId = ?
                        AND ar.workDate = ?
                        AND ar.clockInTime IS NOT NULL
                    LIMIT 1
                `;
                const [attendanceRows]: any = await pool.execute(attendanceQuery, [
                    userId,
                    workDate,
                ]);

                if (!attendanceRows || attendanceRows.length === 0) {
                    continue;
                }

                const attendance = attendanceRows[0];

                // 休憩時間を取得（出勤時間の計算でも使用するため先に取得）
                const breakTimesForAttendance = await db.select().from(schema.breakTimes).then((times) =>
                    times.filter((bt) => bt.isActive === "true")
                );

                // 時刻文字列（"HH:MM"）を分に変換する関数（出勤時間計算用）
                const timeToMinutesForAttendance = (t?: string | null): number | null => {
                    if (!t) return null;
                    const [hh, mm] = t.split(":");
                    const h = Number(hh);
                    const m = Number(mm);
                    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
                    const total = h * 60 + m;
                    if (total < 0 || total > 23 * 60 + 59) return null;
                    return total;
                };

                // 出勤時間を正しく計算（休憩時間を考慮）
                let attendanceMinutes: number;
                if (attendance.attendanceWorkMinutes !== null && attendance.attendanceWorkMinutes !== undefined) {
                    // attendanceWorkMinutesが存在する場合はそれを使用（既に休憩時間を引いた実労働時間）
                    attendanceMinutes = Number(attendance.attendanceWorkMinutes);
                } else if (attendance.clockInTime && attendance.clockOutTime) {
                    // attendanceWorkMinutesが存在しない場合は、clockInTimeとclockOutTimeから計算
                    // 休憩時間を考慮した実労働時間を計算
                    const startMin = timeToMinutesForAttendance(attendance.clockInTime);
                    const endMin = timeToMinutesForAttendance(attendance.clockOutTime);
                    if (startMin !== null && endMin !== null) {
                        const baseMinutes = Math.max(0, endMin - startMin);
                        let breakTotal = 0;
                        for (const bt of breakTimesForAttendance) {
                            const s = timeToMinutesForAttendance(bt.startTime);
                            const eRaw = timeToMinutesForAttendance(bt.endTime);
                            if (s === null || eRaw === null) continue;
                            let e = eRaw;
                            if (e < s) {
                                e += 24 * 60;
                            }
                            const overlapStart = Math.max(startMin, s);
                            const overlapEnd = Math.min(endMin, e);
                            if (overlapEnd > overlapStart) {
                                breakTotal += overlapEnd - overlapStart;
                            }
                        }
                        attendanceMinutes = Math.max(0, baseMinutes - breakTotal);
                    } else {
                        attendanceMinutes = 0;
                    }
                } else {
                    attendanceMinutes = 0;
                }

                // 作業記録を取得（JSTベースで日付を比較）
                const workRecordsQuery = `
                    SELECT DISTINCT
                        wr.id,
                        wr.startTime,
                        wr.endTime
                    FROM \`workRecords\` wr
                    WHERE
                        wr.userId = ?
                        AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                `;
                const [workRecordsRows]: any = await pool.execute(workRecordsQuery, [
                    userId,
                    workDate,
                ]);

                // 休憩時間を取得
                const breakTimes = await db.select().from(schema.breakTimes).then((times) =>
                    times.filter((bt) => bt.isActive === "true")
                );

                // 時刻文字列（"HH:MM"）を分に変換する関数
                const timeToMinutes = (t?: string | null): number | null => {
                    if (!t) return null;
                    const [hh, mm] = t.split(":");
                    const h = Number(hh);
                    const m = Number(mm);
                    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
                    const total = h * 60 + m;
                    if (total < 0 || total > 23 * 60 + 59) return null;
                    return total;
                };

                // Dateオブジェクトから時刻文字列（"HH:MM"）を取得する関数（JSTで取得）
                const dateToTimeString = (date: Date): string => {
                    // JST（Asia/Tokyo）で時刻を取得
                    const formatter = new Intl.DateTimeFormat('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                    });
                    const parts = formatter.formatToParts(date);
                    const hours = parts.find(p => p.type === 'hour')?.value || '00';
                    const minutes = parts.find(p => p.type === 'minute')?.value || '00';
                    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
                };

                // 作業記録をマージして重複を排除
                const sortedRecords = (workRecordsRows || []).filter((r: any) => r.startTime).sort((a: any, b: any) => {
                    const startA = new Date(a.startTime).getTime();
                    const startB = new Date(b.startTime).getTime();
                    return startA - startB;
                });

                const mergedIntervals: Array<{ start: Date; end: Date }> = [];

                for (const record of sortedRecords) {
                    if (!record.startTime) continue;

                    const start = new Date(record.startTime);
                    const end = record.endTime ? new Date(record.endTime) : new Date();

                    let merged = false;
                    for (let i = 0; i < mergedIntervals.length; i++) {
                        const interval = mergedIntervals[i];
                        // 重複または隣接している場合（1分以内のギャップもマージ）
                        if (!(end.getTime() < interval.start.getTime() - 60000 || start.getTime() > interval.end.getTime() + 60000)) {
                            // マージ
                            interval.start = start.getTime() < interval.start.getTime() ? start : interval.start;
                            interval.end = end.getTime() > interval.end.getTime() ? end : interval.end;
                            merged = true;
                            break;
                        }
                    }

                    if (!merged) {
                        mergedIntervals.push({ start, end });
                    }
                }

                // マージされた各インターバルに対して、休憩時間を引いた時間を計算
                let totalWorkMinutes = 0;

                for (let i = 0; i < mergedIntervals.length; i++) {
                    const interval = mergedIntervals[i];
                    const startDate = interval.start;
                    const endDate = interval.end;

                    const startTimeStr = dateToTimeString(startDate);
                    const endTimeStr = dateToTimeString(endDate);

                    const startMin = timeToMinutes(startTimeStr);
                    const endMin = timeToMinutes(endTimeStr);

                    if (startMin === null || endMin === null) {
                        continue;
                    }

                    const baseMinutes = Math.max(0, endMin - startMin);
                    let breakTotal = 0;

                    for (const bt of breakTimes) {
                        const s = timeToMinutes(bt.startTime);
                        const e = timeToMinutes(bt.endTime);
                        if (s === null || e === null) continue;

                        const overlapStart = Math.max(startMin, s);
                        const overlapEnd = Math.min(endMin, e);
                        if (overlapEnd > overlapStart) {
                            breakTotal += overlapEnd - overlapStart;
                        }
                    }

                    const duration = Math.max(0, baseMinutes - breakTotal);
                    totalWorkMinutes += duration;
                }

                // 比較サマリーの計算
                // 出勤時間（休憩時間を引いた数） - 作業記録時間（休憩時間を引いた数）
                const differenceMinutes = Math.abs(attendanceMinutes - totalWorkMinutes);

                // ±1時間（60分）をはみ出した場合のみ警告を出す
                if (differenceMinutes > 60) {
                    if (!map.has(userId)) {
                        map.set(userId, { userId, userName, dates: [] });
                    }
                    const entry = map.get(userId)!;
                    if (!entry.dates.includes(workDate)) {
                        entry.dates.push(workDate);
                    }
                }
            } catch (error) {
                // エラーが発生した場合はスキップ
                console.error(`[getRecentLowWorkUsers] エラー (userId: ${userId}, workDate: ${workDate}):`, error);
            }
        }

        // 日付は新しい順に並べる
        const result = Array.from(map.values()).map((v) => ({
            ...v,
            dates: v.dates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
        }));

        return result;
    }),

    /**
     * 過去3営業日以内で出勤記録が入力されていない現場スタッフを取得
     * - 過去3営業日のいずれかの日に出勤記録がないユーザーを取得
     */
    getMissingAttendanceUsers: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            return [];
        }

        // 過去3営業日を計算（土日を除く）- JSTで取得
        const now = new Date();
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const businessDates: string[] = [];
        let currentDate = new Date(now);
        currentDate.setDate(currentDate.getDate() - 1); // 昨日から開始

        while (businessDates.length < 3) {
            const jstParts = jstFormatter.formatToParts(currentDate);
            const y = jstParts.find(p => p.type === 'year')?.value || '0';
            const m = jstParts.find(p => p.type === 'month')?.value || '01';
            const d = jstParts.find(p => p.type === 'day')?.value || '01';
            const dateStr = `${y}-${m}-${d}`;
            
            const dayOfWeek = currentDate.getUTCDay();
            // 0=日曜, 6=土曜をスキップ
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                businessDates.push(dateStr);
            }
            currentDate.setDate(currentDate.getDate() - 1);
        }

        if (businessDates.length === 0) {
            return [];
        }

        const pool = getPool();
        if (!pool) {
            return [];
        }

        // 現場スタッフ（field_worker）を取得
        const users = await db.select().from(schema.users);
        const fieldWorkers = users.filter((u: any) => u.role === "field_worker");

        if (fieldWorkers.length === 0) {
            return [];
        }

        const userIds = fieldWorkers.map((u: any) => u.id);
        const userIdPlaceholders = userIds.map(() => "?").join(",");
        const datePlaceholders = businessDates.map(() => "?").join(",");

        // 過去3営業日で出勤記録があるユーザー・日付の組み合わせを取得
        const query = `
            SELECT DISTINCT
                ar.userId AS userId,
                ar.workDate AS workDate
            FROM \`attendanceRecords\` ar
            WHERE
                ar.userId IN (${userIdPlaceholders})
                AND ar.workDate IN (${datePlaceholders})
                AND ar.clockInTime IS NOT NULL
        `;
        const [rows]: any = await pool.execute(query, [...userIds, ...businessDates]);

        // ユーザーIDと日付の組み合わせをSetで管理
        const existingAttendanceSet = new Set<string>();
        rows.forEach((row: any) => {
            const userId = Number(row.userId);
            const workDate = typeof row.workDate === "string"
                ? row.workDate
                : (row.workDate as Date).toISOString().slice(0, 10);
            existingAttendanceSet.add(`${userId}_${workDate}`);
        });

        // 出勤記録がないユーザー・日付の組み合わせを集計
        const map = new Map<
            number,
            {
                userId: number;
                userName: string;
                dates: string[];
            }
        >();

        fieldWorkers.forEach((user: any) => {
            const missingDates: string[] = [];
            businessDates.forEach((dateStr) => {
                const key = `${user.id}_${dateStr}`;
                if (!existingAttendanceSet.has(key)) {
                    missingDates.push(dateStr);
                }
            });

            if (missingDates.length > 0) {
                map.set(user.id, {
                    userId: user.id,
                    userName: user.name || user.username || "不明",
                    dates: missingDates,
                });
            }
        });

        // 日付は新しい順に並べる
        const result = Array.from(map.values()).map((v) => ({
            ...v,
            dates: v.dates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
        }));

        return result;
    }),

    /**
     * 作業報告が出勤時間を超えている可能性があるユーザーを取得
     * - 過去3営業日のいずれかの日に出勤していて
     * - その日の作業記録の合計が、出勤記録の勤務時間（両方とも休憩時間を引いた後の値）を30分以上超えているユーザーを取得
     * - ±30分以内の差異は許容範囲として警告を出さない
     */
    getExcessiveWorkUsers: protectedProcedure.query(async () => {
        console.log("[getExcessiveWorkUsers] 開始");
        const db = await getDb();
        if (!db) {
            console.log("[getExcessiveWorkUsers] データベースに接続できません");
            return [];
        }

        // 過去3営業日を計算（土日を除く）- JSTで取得
        const now = new Date();
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const businessDates: string[] = [];
        let currentDate = new Date(now);
        currentDate.setDate(currentDate.getDate() - 1); // 昨日から開始

        while (businessDates.length < 3) {
            const jstParts = jstFormatter.formatToParts(currentDate);
            const y = jstParts.find(p => p.type === 'year')?.value || '0';
            const m = jstParts.find(p => p.type === 'month')?.value || '01';
            const d = jstParts.find(p => p.type === 'day')?.value || '01';
            const dateStr = `${y}-${m}-${d}`;
            
            const dayOfWeek = currentDate.getUTCDay();
            // 0=日曜, 6=土曜をスキップ
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                businessDates.push(dateStr);
            }
            currentDate.setDate(currentDate.getDate() - 1);
        }

        console.log("[getExcessiveWorkUsers] 過去3営業日:", businessDates);

        if (businessDates.length === 0) {
            console.log("[getExcessiveWorkUsers] 営業日がありません");
            return [];
        }

        const pool = getPool();
        if (!pool) {
            console.log("[getExcessiveWorkUsers] データベースプールに接続できません");
            return [];
        }

        // 出勤記録があるユーザー・日付の組み合わせを取得
        const datePlaceholders = businessDates.map(() => "?").join(",");
        const query = `
            SELECT DISTINCT
                ar.userId AS userId,
                COALESCE(u.name, u.username) AS userName,
                ar.workDate AS workDate
            FROM \`attendanceRecords\` ar
            INNER JOIN \`users\` u ON u.id = ar.userId
            WHERE
                ar.workDate IN (${datePlaceholders})
                AND ar.clockInTime IS NOT NULL
                AND u.role = 'field_worker'
        `;
        const [rows]: any = await pool.execute(query, businessDates);
        console.log(`[getExcessiveWorkUsers] 出勤記録があるユーザー・日付の組み合わせ数: ${rows?.length || 0}`);

        const map = new Map<
            number,
            {
                userId: number;
                userName: string;
                dates: string[];
            }
        >();

        // 各ユーザー・日付の組み合わせに対して、getWorkReportDetailのロジックを使用してdifferenceMinutesを計算
        // getWorkReportDetailのロジックを直接使用するために、同じ計算を実行
        for (const r of rows as any[]) {
            const userId = Number(r.userId);
            const userName = r.userName as string;
            const workDate =
                typeof r.workDate === "string"
                    ? r.workDate
                    : (r.workDate as Date).toISOString().slice(0, 10);

            try {
                // getWorkReportDetailと同じロジックで計算
                // 出勤記録を取得
                const attendanceQuery = `
                    SELECT
                        ar.id AS attendanceId,
                        ar.workDate,
                        ar.clockInTime,
                        ar.clockOutTime,
                        ar.workMinutes AS attendanceWorkMinutes,
                        COALESCE(
                            ar.workMinutes,
                            TIMESTAMPDIFF(
                                MINUTE,
                                STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockInTime), '%Y-%m-%d %H:%i'),
                                STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockOutTime), '%Y-%m-%d %H:%i')
                            ),
                            0
                        ) AS attendanceMinutes
                    FROM \`attendanceRecords\` ar
                    WHERE
                        ar.userId = ?
                        AND ar.workDate = ?
                        AND ar.clockInTime IS NOT NULL
                    LIMIT 1
                `;
                const [attendanceRows]: any = await pool.execute(attendanceQuery, [
                    userId,
                    workDate,
                ]);

                if (!attendanceRows || attendanceRows.length === 0) {
                    continue;
                }

                const attendance = attendanceRows[0];

                // 休憩時間を取得（出勤時間の計算でも使用するため先に取得）
                const breakTimesForAttendance = await db.select().from(schema.breakTimes).then((times) =>
                    times.filter((bt) => bt.isActive === "true")
                );

                // 時刻文字列（"HH:MM"）を分に変換する関数（出勤時間計算用）
                const timeToMinutesForAttendance = (t?: string | null): number | null => {
                    if (!t) return null;
                    const [hh, mm] = t.split(":");
                    const h = Number(hh);
                    const m = Number(mm);
                    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
                    const total = h * 60 + m;
                    if (total < 0 || total > 23 * 60 + 59) return null;
                    return total;
                };

                // 出勤時間を正しく計算（休憩時間を考慮）
                let attendanceMinutes: number;
                if (attendance.attendanceWorkMinutes !== null && attendance.attendanceWorkMinutes !== undefined) {
                    // attendanceWorkMinutesが存在する場合はそれを使用（既に休憩時間を引いた実労働時間）
                    attendanceMinutes = Number(attendance.attendanceWorkMinutes);
                } else if (attendance.clockInTime && attendance.clockOutTime) {
                    // attendanceWorkMinutesが存在しない場合は、clockInTimeとclockOutTimeから計算
                    // 休憩時間を考慮した実労働時間を計算
                    const startMin = timeToMinutesForAttendance(attendance.clockInTime);
                    const endMin = timeToMinutesForAttendance(attendance.clockOutTime);
                    if (startMin !== null && endMin !== null) {
                        const baseMinutes = Math.max(0, endMin - startMin);
                        let breakTotal = 0;
                        for (const bt of breakTimesForAttendance) {
                            const s = timeToMinutesForAttendance(bt.startTime);
                            const eRaw = timeToMinutesForAttendance(bt.endTime);
                            if (s === null || eRaw === null) continue;
                            let e = eRaw;
                            if (e < s) {
                                e += 24 * 60;
                            }
                            const overlapStart = Math.max(startMin, s);
                            const overlapEnd = Math.min(endMin, e);
                            if (overlapEnd > overlapStart) {
                                breakTotal += overlapEnd - overlapStart;
                            }
                        }
                        attendanceMinutes = Math.max(0, baseMinutes - breakTotal);
                    } else {
                        attendanceMinutes = 0;
                    }
                } else {
                    attendanceMinutes = 0;
                }

                // 作業記録を取得（JSTベースで日付を比較）
                const workRecordsQuery = `
                    SELECT DISTINCT
                        wr.id,
                        wr.startTime,
                        wr.endTime
                    FROM \`workRecords\` wr
                    WHERE
                        wr.userId = ?
                        AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                `;
                const [workRecordsRows]: any = await pool.execute(workRecordsQuery, [
                    userId,
                    workDate,
                ]);

                // 休憩時間を取得
                const breakTimes = await db.select().from(schema.breakTimes).then((times) =>
                    times.filter((bt) => bt.isActive === "true")
                );

                // 時刻文字列（"HH:MM"）を分に変換する関数
                const timeToMinutes = (t?: string | null): number | null => {
                    if (!t) return null;
                    const [hh, mm] = t.split(":");
                    const h = Number(hh);
                    const m = Number(mm);
                    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
                    const total = h * 60 + m;
                    if (total < 0 || total > 23 * 60 + 59) return null;
                    return total;
                };

                // Dateオブジェクトから時刻文字列（"HH:MM"）を取得する関数（JSTで取得）
                const dateToTimeString = (date: Date): string => {
                    // JST（Asia/Tokyo）で時刻を取得
                    const formatter = new Intl.DateTimeFormat('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                    });
                    const parts = formatter.formatToParts(date);
                    const hours = parts.find(p => p.type === 'hour')?.value || '00';
                    const minutes = parts.find(p => p.type === 'minute')?.value || '00';
                    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
                };

                // 作業記録をマージして重複を排除（getWorkReportDetailと同じロジック）
                const sortedRecords = (workRecordsRows || []).filter((r: any) => r.startTime).sort((a: any, b: any) => {
                    const startA = new Date(a.startTime).getTime();
                    const startB = new Date(b.startTime).getTime();
                    return startA - startB;
                });

                const mergedIntervals: Array<{ start: Date; end: Date }> = [];

                for (const record of sortedRecords) {
                    if (!record.startTime) continue;

                    const start = new Date(record.startTime);
                    const end = record.endTime ? new Date(record.endTime) : new Date();

                    // 既存のインターバルと重複または隣接しているかチェック（getWorkReportDetailと同じロジック）
                    let merged = false;
                    for (let i = 0; i < mergedIntervals.length; i++) {
                        const interval = mergedIntervals[i];
                        // 重複または隣接している場合（1分以内のギャップもマージ）
                        if (!(end.getTime() < interval.start.getTime() - 60000 || start.getTime() > interval.end.getTime() + 60000)) {
                            // マージ
                            interval.start = start.getTime() < interval.start.getTime() ? start : interval.start;
                            interval.end = end.getTime() > interval.end.getTime() ? end : interval.end;
                            merged = true;
                            break;
                        }
                    }

                    if (!merged) {
                        mergedIntervals.push({ start, end });
                    }
                }

                console.log(`[getExcessiveWorkUsers] マージされたインターバル数 (userId: ${userId}, workDate: ${workDate}):`, mergedIntervals.length);

                // マージされた各インターバルに対して、休憩時間を引いた時間を計算
                let totalWorkMinutes = 0;

                for (let i = 0; i < mergedIntervals.length; i++) {
                    const interval = mergedIntervals[i];
                    const startDate = interval.start;
                    const endDate = interval.end;

                    const startTimeStr = dateToTimeString(startDate);
                    const endTimeStr = dateToTimeString(endDate);

                    console.log(`[getExcessiveWorkUsers] インターバル[${i}] (userId: ${userId}, workDate: ${workDate}): ${startTimeStr} - ${endTimeStr}`);

                    let startMin = timeToMinutes(startTimeStr);
                    const endMin = timeToMinutes(endTimeStr);

                    if (startMin === null || endMin === null) {
                        console.log(`[getExcessiveWorkUsers] 時刻の変換失敗 (userId: ${userId}, workDate: ${workDate}):`, { startTimeStr, endTimeStr });
                        continue;
                    }

                    // 朝休憩（06:00-08:30）がある場合、作業記録の開始時刻が06:00より前の場合は08:30からカウント
                    const morningBreakStart = timeToMinutes("06:00");
                    const morningBreakEnd = timeToMinutes("08:30");
                    if (morningBreakStart !== null && morningBreakEnd !== null) {
                        // 朝休憩が有効かチェック（breakTimesは既にisActive === "true"でフィルタ済み）
                        const hasMorningBreak = breakTimes.some(bt => {
                            const btStart = timeToMinutes(bt.startTime);
                            const btEnd = timeToMinutes(bt.endTime);
                            return btStart === morningBreakStart && btEnd === morningBreakEnd;
                        });

                        if (hasMorningBreak && startMin < morningBreakStart) {
                            // 朝休憩がある場合、開始時刻を08:30に調整
                            startMin = morningBreakEnd;
                            console.log(`[getExcessiveWorkUsers] 朝休憩適用 (userId: ${userId}, workDate: ${workDate}): 開始時刻を${startTimeStr}から08:30に調整`);
                        }
                    }

                    const baseMinutes = Math.max(0, endMin - startMin);
                    console.log(`[getExcessiveWorkUsers] インターバル[${i}] 基本時間 (userId: ${userId}, workDate: ${workDate}): ${baseMinutes}分 (${Math.floor(baseMinutes / 60)}時間${baseMinutes % 60}分)`);

                    let breakTotal = 0;

                    for (const bt of breakTimes) {
                        const s = timeToMinutes(bt.startTime);
                        const e = timeToMinutes(bt.endTime);
                        if (s === null || e === null) continue;

                        // 朝休憩（06:00-08:30）は既に開始時刻の調整で処理済みなのでスキップ
                        if (s === morningBreakStart && e === morningBreakEnd) {
                            continue;
                        }

                        const overlapStart = Math.max(startMin, s);
                        const overlapEnd = Math.min(endMin, e);
                        if (overlapEnd > overlapStart) {
                            const overlapMinutes = overlapEnd - overlapStart;
                            breakTotal += overlapMinutes;
                            console.log(`[getExcessiveWorkUsers] 休憩時間重複 (userId: ${userId}, workDate: ${workDate}):`, {
                                intervalIndex: i,
                                workInterval: `${startMin}分-${endMin}分 (${startTimeStr}-${endTimeStr})`,
                                breakInterval: `${s}分-${e}分 (${bt.startTime}-${bt.endTime})`,
                                overlap: `${overlapStart}分-${overlapEnd}分 (${overlapMinutes}分)`,
                                breakTotal: `${breakTotal}分`
                            });
                        }
                    }

                    const duration = Math.max(0, baseMinutes - breakTotal);
                    console.log(`[getExcessiveWorkUsers] インターバル[${i}] 最終計算 (userId: ${userId}, workDate: ${workDate}):`, {
                        baseMinutes: `${baseMinutes}分 (${Math.floor(baseMinutes / 60)}時間${baseMinutes % 60}分)`,
                        breakTotal: `${breakTotal}分 (${Math.floor(breakTotal / 60)}時間${breakTotal % 60}分)`,
                        duration: `${duration}分 (${Math.floor(duration / 60)}時間${duration % 60}分)`
                    });
                    totalWorkMinutes += duration;
                }

                // 比較サマリーの計算
                const differenceMinutes = totalWorkMinutes - attendanceMinutes;

                const absDiff = Math.abs(differenceMinutes);
                // 作業時間が出勤時間を超えている場合のみ警告（60分以上の差がある場合）
                const shouldWarn = differenceMinutes > 60;
                console.log(`[getExcessiveWorkUsers] 計算結果 (userId: ${userId}, workDate: ${workDate}): attendanceMinutes=${attendanceMinutes}分, totalWorkMinutes=${totalWorkMinutes}分, differenceMinutes=${differenceMinutes}分, absDifference=${absDiff}分, shouldWarn=${shouldWarn}`);

                // すべての計算結果をログ出力（デバッグ用）
                console.log(`[getExcessiveWorkUsers] デバッグ詳細 (userId: ${userId}, workDate: ${workDate}):`, {
                    attendanceWorkMinutes: attendance.attendanceWorkMinutes,
                    attendanceMinutesRaw: attendance.attendanceMinutes,
                    clockInTime: attendance.clockInTime,
                    clockOutTime: attendance.clockOutTime,
                    calculatedAttendanceMinutes: attendanceMinutes,
                    workRecordsCount: workRecordsRows?.length || 0,
                    mergedIntervalsCount: mergedIntervals.length,
                    totalWorkMinutes,
                    differenceMinutes,
                    absDiff,
                    shouldWarn,
                    threshold: 60,
                });

                // 作業時間が出勤時間を60分以上超えている場合のみ警告を出す
                if (shouldWarn) {
                    if (!map.has(userId)) {
                        map.set(userId, { userId, userName, dates: [] });
                    }
                    const entry = map.get(userId)!;
                    if (!entry.dates.includes(workDate)) {
                        entry.dates.push(workDate);
                    }
                }
            } catch (error) {
                // エラーが発生した場合はスキップ
                console.error(`[getExcessiveWorkUsers] エラー (userId: ${userId}, workDate: ${workDate}):`, error);
            }
        }

        // 日付は新しい順に並べる
        const result = Array.from(map.values()).map((v) => ({
            ...v,
            dates: v.dates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
        }));

        console.log(`[getExcessiveWorkUsers] 警告対象ユーザー数: ${result.length}`, result.map(r => ({
            userId: r.userId,
            userName: r.userName,
            dates: r.dates,
        })));

        return result;
    }),

    /**
     * 特定ユーザーの特定日の作業報告詳細を取得
     * - 出勤時間と作業時間の比較
     * - 各作業記録の詳細
     */
    getWorkReportDetail: protectedProcedure
        .input(
            z.object({
                userId: z.number(),
                workDate: z.string(), // "YYYY-MM-DD"
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new Error("データベースに接続できません");
            }

            const pool = getPool();
            if (!pool) {
                throw new Error("データベースプールに接続できません");
            }

            // 出勤記録を取得
            const attendanceQuery = `
                SELECT
                    ar.id AS attendanceId,
                    ar.workDate,
                    ar.clockInTime,
                    ar.clockOutTime,
                    ar.workMinutes AS attendanceWorkMinutes,
                    COALESCE(
                        ar.workMinutes,
                        TIMESTAMPDIFF(
                            MINUTE,
                            STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockInTime), '%Y-%m-%d %H:%i'),
                            STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockOutTime), '%Y-%m-%d %H:%i')
                        ),
                        0
                    ) AS attendanceMinutes,
                    COALESCE(u.name, u.username) AS userName
                FROM \`attendanceRecords\` ar
                INNER JOIN \`users\` u ON u.id = ar.userId
                WHERE
                    ar.userId = ?
                    AND ar.workDate = ?
                    AND ar.clockInTime IS NOT NULL
                LIMIT 1
            `;
            const [attendanceRows]: any = await pool.execute(attendanceQuery, [
                input.userId,
                input.workDate,
            ]);

            if (!attendanceRows || attendanceRows.length === 0) {
                return {
                    userId: input.userId,
                    workDate: input.workDate,
                    userName: null,
                    attendance: null,
                    workRecords: [],
                    summary: {
                        attendanceMinutes: 0,
                        workMinutes: 0,
                        differenceMinutes: 0,
                    },
                };
            }

            const attendance = attendanceRows[0];
            const userName = attendance.userName;

            // 出勤時間の計算:
            // 作業報告のエラー検出時は、8:30より前の時間をカウント外にする
            // - attendanceWorkMinutes (workMinutesカラム) が存在する場合でも、8:30より前の時間を除外する必要がある
            // - そのため、clockInTimeとclockOutTimeから再計算する
            let attendanceMinutes: number = 0;
            if (attendance.clockInTime && attendance.clockOutTime) {
                const timeToMinutesForDetail = (t?: string | null): number | null => {
                    if (!t) return null;
                    const [hh, mm] = t.split(":");
                    const h = Number(hh);
                    const m = Number(mm);
                    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
                    const total = h * 60 + m;
                    if (total < 0 || total > 23 * 60 + 59) return null;
                    return total;
                };

                let startMin = timeToMinutesForDetail(attendance.clockInTime);
                const endMin = timeToMinutesForDetail(attendance.clockOutTime);
                if (startMin !== null && endMin !== null) {
                    // 8:30より前の場合は8:30からカウント
                    const workStartTime = timeToMinutesForDetail("08:30");
                    if (workStartTime !== null && startMin < workStartTime) {
                        startMin = workStartTime;
                        console.log(`[getWorkReportDetail] 作業開始時刻調整 (userId: ${input.userId}, workDate: ${input.workDate}): ${attendance.clockInTime} → 08:30`);
                    }
                    const baseMinutes = Math.max(0, endMin - startMin);
                    
                    // 休憩時間を取得
                    const breakTimesForDetail = await db.select().from(schema.breakTimes).then((times) =>
                        times.filter((bt) => bt.isActive === "true")
                    );
                    
                    let breakTotal = 0;
                    for (const bt of breakTimesForDetail) {
                        const s = timeToMinutesForDetail(bt.startTime);
                        const eRaw = timeToMinutesForDetail(bt.endTime);
                        if (s === null || eRaw === null) continue;
                        let e = eRaw;
                        if (e < s) {
                            e += 24 * 60;
                        }
                        const overlapStart = Math.max(startMin, s);
                        const overlapEnd = Math.min(endMin, e);
                        if (overlapEnd > overlapStart) {
                            breakTotal += overlapEnd - overlapStart;
                        }
                    }
                    attendanceMinutes = Math.max(0, baseMinutes - breakTotal);
                } else {
                    // 時刻の変換に失敗した場合は、既存のロジックを使用
                    attendanceMinutes = attendance.attendanceWorkMinutes !== null && attendance.attendanceWorkMinutes !== undefined
                        ? Number(attendance.attendanceWorkMinutes)
                        : Math.max(0, (Number(attendance.attendanceMinutes) || 0) - 90);
                }
            } else {
                // clockInTimeまたはclockOutTimeがない場合は、既存のロジックを使用
                attendanceMinutes = attendance.attendanceWorkMinutes !== null && attendance.attendanceWorkMinutes !== undefined
                    ? Number(attendance.attendanceWorkMinutes)
                    : Math.max(0, (Number(attendance.attendanceMinutes) || 0) - 90);
            }

            console.log("[getWorkReportDetail] 出勤時間の計算:", {
                attendanceWorkMinutes: attendance.attendanceWorkMinutes,
                attendanceMinutesRaw: attendance.attendanceMinutes,
                calculatedAttendanceMinutes: attendanceMinutes,
                clockInTime: attendance.clockInTime,
                clockOutTime: attendance.clockOutTime,
                calculationNote: "8:30より前の時間は除外されています",
            });

            // 作業記録を取得
            // JSTベースで日付を比較（CONVERT_TZでUTCからJSTに変換してから日付を取得）
            // DISTINCTを使用して重複を防ぐ
            // 作業記録を取得
            // MySQLのtimestamp型はUTCとして保存されるため、UTCからJSTに変換してから日付を比較
            // CONVERT_TZを使用して、UTC（'+00:00'）からJST（'+09:00'）に変換
            // また、JSTでの時刻文字列も取得して、クライアント側で正しく表示できるようにする
            const workRecordsQuery = `
                SELECT DISTINCT
                    wr.id,
                    wr.vehicleId,
                    wr.processId,
                    wr.startTime,
                    wr.endTime,
                    TIMESTAMPDIFF(
                        MINUTE,
                        wr.startTime,
                        COALESCE(wr.endTime, NOW())
                    ) AS durationMinutes,
                    v.vehicleNumber,
                    v.customerName,
                    p.name AS processName,
                    wr.workDescription,
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) AS startDateJST,
                    CONVERT_TZ(wr.startTime, '+00:00', '+09:00') AS startTimeJST,
                    CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00') AS endTimeJST,
                    TIME(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) AS startTimeStr,
                    TIME(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) AS endTimeStr
                FROM \`workRecords\` wr
                LEFT JOIN \`vehicles\` v ON v.id = wr.vehicleId
                LEFT JOIN \`processes\` p ON p.id = wr.processId
                WHERE
                    wr.userId = ?
                    AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                ORDER BY wr.startTime ASC
            `;
            console.log("[getWorkReportDetail] 作業記録クエリ実行:", {
                userId: input.userId,
                workDate: input.workDate,
            });
            const [workRecordsRows]: any = await pool.execute(workRecordsQuery, [
                input.userId,
                input.workDate,
            ]);
            console.log("[getWorkReportDetail] 作業記録取得結果:", {
                count: workRecordsRows?.length || 0,
                records: workRecordsRows?.slice(0, 3).map((r: any) => ({
                    id: r.id,
                    startTime: r.startTime,
                    startTimeJST: r.startTimeJST,
                    startDateJST: r.startDateJST,
                })),
            });

            // 休憩時間を取得
            const breakTimes = await db.select().from(schema.breakTimes).then((times) =>
                times.filter((bt) => bt.isActive === "true")
            );

            // 時刻文字列（"HH:MM"）を分に変換する関数（attendance.tsと同じロジック）
            const timeToMinutes = (t?: string | null): number | null => {
                if (!t) return null;
                const [hh, mm] = t.split(":");
                const h = Number(hh);
                const m = Number(mm);
                if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
                const total = h * 60 + m;
                if (total < 0 || total > 23 * 60 + 59) return null;
                return total;
            };

            // Dateオブジェクトから時刻文字列（"HH:MM"）を取得する関数（JSTで取得）
            const dateToTimeString = (date: Date): string => {
                // JST（Asia/Tokyo）で時刻を取得
                const formatter = new Intl.DateTimeFormat('ja-JP', {
                    timeZone: 'Asia/Tokyo',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                });
                const parts = formatter.formatToParts(date);
                const hours = parts.find(p => p.type === 'hour')?.value || '00';
                const minutes = parts.find(p => p.type === 'minute')?.value || '00';
                return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
            };

            // 各作業記録のdurationMinutesを計算（休憩時間を引く）
            const workRecordsWithBreakTime = await Promise.all(
                (workRecordsRows || []).map(async (row: any) => {
                    if (!row.startTime) {
                        return {
                            id: row.id,
                            vehicleId: Number(row.vehicleId) || 0,
                            processId: Number(row.processId) || 0,
                            startTime: row.startTime,
                            endTime: row.endTime,
                            durationMinutes: 0,
                            vehicleNumber: row.vehicleNumber || "不明",
                            customerName: row.customerName || null,
                            processName: row.processName || "不明",
                            workDescription: row.workDescription || null,
                        };
                    }

                    // データベースから取得した時刻をJSTとして解釈
                    // SQLクエリで既にJSTに変換した時刻文字列（startTimeStr, endTimeStr）を使用
                    // これにより、タイムゾーンの問題を回避
                    const startTimeStr = row.startTimeStr ? row.startTimeStr.substring(0, 5) : dateToTimeString(new Date(row.startTime));
                    const endTimeStr = row.endTimeStr ? row.endTimeStr.substring(0, 5) : (row.endTime ? dateToTimeString(new Date(row.endTime)) : dateToTimeString(new Date()));

                    // デバッグログ
                    console.log(`[getWorkReportDetail] 作業記録[${row.id}] 時刻変換:`, {
                        startTimeRaw: row.startTime,
                        startTimeStr: row.startTimeStr,
                        startTimeStrParsed: startTimeStr,
                        endTimeRaw: row.endTime,
                        endTimeStr: row.endTimeStr,
                        endTimeStrParsed: endTimeStr,
                    });

                    // startTimeとendTimeをJSTのISO文字列として返す
                    // SQLクエリで既にJSTに変換した時刻を使用
                    const startTimeJST = row.startTimeJST ? parseJSTDateTime(row.startTimeJST) : new Date(row.startTime);
                    const endTimeJST = row.endTimeJST ? parseJSTDateTime(row.endTimeJST) : (row.endTime ? new Date(row.endTime) : null);

                    // 無効なDateオブジェクトをチェック
                    const isValidStartTime = startTimeJST && !isNaN(startTimeJST.getTime());
                    const isValidEndTime = endTimeJST && !isNaN(endTimeJST.getTime());

                    // Dateオブジェクトから直接経過時間を計算（ミリ秒単位）
                    let durationMs = 0;
                    if (isValidStartTime && isValidEndTime) {
                        durationMs = endTimeJST.getTime() - startTimeJST.getTime();
                    } else if (isValidStartTime && !endTimeJST) {
                        // 終了時刻がない場合は現在時刻との差を計算
                        durationMs = new Date().getTime() - startTimeJST.getTime();
                    }
                    const baseMinutes = Math.max(0, Math.floor(durationMs / (1000 * 60)));

                    // 休憩時間を引く（時刻文字列から分に変換して計算）
                    let breakTotal = 0;
                    const startMin = timeToMinutes(startTimeStr);
                    const endMin = timeToMinutes(endTimeStr);

                    if (startMin !== null && endMin !== null) {
                        // 日をまたぐ場合の処理
                        let actualEndMin = endMin;
                        if (endMin < startMin) {
                            // 日をまたいでいる場合（例: 18:00 → 02:20）
                            actualEndMin = endMin + 24 * 60; // 24時間（1440分）を加算
                        }

                        for (const bt of breakTimes) {
                            const s = timeToMinutes(bt.startTime);
                            const e = timeToMinutes(bt.endTime);
                            if (s === null || e === null) continue;

                            // 休憩時間も日をまたぐ場合を考慮
                            let actualBreakEnd = e;
                            if (e < s) {
                                actualBreakEnd = e + 24 * 60;
                            }

                            // 作業区間と休憩区間の重なりを計算
                            const overlapStart = Math.max(startMin, s);
                            const overlapEnd = Math.min(actualEndMin, actualBreakEnd);
                            if (overlapEnd > overlapStart) {
                                breakTotal += overlapEnd - overlapStart;
                            }
                        }
                    }

                    // NaNチェックを追加
                    const baseMinutesNum = typeof baseMinutes === 'number' && !isNaN(baseMinutes) ? baseMinutes : 0;
                    const breakTotalNum = typeof breakTotal === 'number' && !isNaN(breakTotal) ? breakTotal : 0;
                    const duration = Math.max(0, baseMinutesNum - breakTotalNum);

                    // durationがNaNでないことを確認
                    const finalDuration = typeof duration === 'number' && !isNaN(duration) ? duration : 0;

                    return {
                        id: row.id,
                        vehicleId: Number(row.vehicleId) || 0,
                        processId: Number(row.processId) || 0,
                        startTime: startTimeJST,
                        endTime: endTimeJST,
                        startTimeJST: startTimeJST, // JST変換済みの時刻を追加
                        endTimeJST: endTimeJST, // JST変換済みの時刻を追加
                        startTimeStr: startTimeStr, // JST時刻文字列を保存
                        endTimeStr: endTimeStr, // JST時刻文字列を保存
                        durationMinutes: finalDuration,
                        vehicleNumber: row.vehicleNumber || "不明",
                        customerName: row.customerName || null,
                        processName: row.processName || "不明",
                        workDescription: row.workDescription || null,
                    };
                })
            );

            const workRecords = workRecordsWithBreakTime;

            // 作業記録の合計時間を計算（重複時間を考慮し、休憩時間を引く）
            // まず、作業記録をマージして重複を排除
            // startTimeStrとendTimeStrを直接使用してマージ処理を行う（タイムゾーンの問題を回避）
            const sortedRecords = [...workRecords].filter(r => r.startTime).sort((a: any, b: any) => {
                // startTimeStrを直接使用してソート（時刻文字列の比較）
                const startA = a.startTimeStr || dateToTimeString(new Date(a.startTime!));
                const startB = b.startTimeStr || dateToTimeString(new Date(b.startTime!));
                return startA.localeCompare(startB);
            });

            const mergedIntervals: Array<{ startTimeStr: string; endTimeStr: string; startDate?: Date; endDate?: Date }> = [];

            for (const record of sortedRecords) {
                if (!record.startTime) continue;

                const recordAny = record as any;
                // JST時刻文字列を直接使用
                const startTimeStr = recordAny.startTimeStr || dateToTimeString(new Date(record.startTime));
                const endTimeStr = recordAny.endTimeStr || (record.endTime ? dateToTimeString(new Date(record.endTime)) : dateToTimeString(new Date()));

                // 時刻文字列を分に変換して比較
                const startMin = timeToMinutes(startTimeStr);
                const endMin = timeToMinutes(endTimeStr);
                if (startMin === null || endMin === null) continue;

                // 日をまたぐ場合の処理
                let actualEndMin = endMin;
                if (endMin < startMin) {
                    actualEndMin = endMin + 24 * 60;
                }

                // 既存のインターバルと重複または隣接しているかチェック（分単位で比較）
                let merged = false;
                for (let i = 0; i < mergedIntervals.length; i++) {
                    const interval = mergedIntervals[i];
                    const intervalStartMin = timeToMinutes(interval.startTimeStr);
                    const intervalEndMin = timeToMinutes(interval.endTimeStr);
                    if (intervalStartMin === null || intervalEndMin === null) continue;

                    let actualIntervalEndMin = intervalEndMin;
                    if (intervalEndMin < intervalStartMin) {
                        actualIntervalEndMin = intervalEndMin + 24 * 60;
                    }

                    // 重複または隣接している場合（1分以内のギャップもマージ）
                    if (!(actualEndMin < intervalStartMin - 1 || startMin > actualIntervalEndMin + 1)) {
                        // マージ（より早い開始時刻とより遅い終了時刻を保存）
                        const newStartMin = Math.min(startMin, intervalStartMin);
                        const newEndMin = Math.max(actualEndMin, actualIntervalEndMin);

                        // 分を時刻文字列に変換
                        const newStartHours = Math.floor(newStartMin / 60) % 24;
                        const newStartMins = newStartMin % 60;
                        const newEndHours = Math.floor(newEndMin / 60) % 24;
                        const newEndMins = newEndMin % 60;

                        interval.startTimeStr = `${String(newStartHours).padStart(2, '0')}:${String(newStartMins).padStart(2, '0')}`;
                        interval.endTimeStr = `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
                        merged = true;
                        break;
                    }
                }

                if (!merged) {
                    mergedIntervals.push({ startTimeStr, endTimeStr });
                }
            }

            // 各インターバルの詳細情報を収集（表示用）
            const intervalDetails: Array<{
                index: number;
                startTime: string;
                endTime: string;
                baseMinutes: number;
                breakTotal: number;
                duration: number;
                breakDetails: Array<{
                    breakTime: string;
                    overlap: number;
                }>;
            }> = [];

            // マージされた各インターバルに対して、休憩時間を引いた時間を計算（詳細情報も収集）
            let workMinutes = 0;

            console.log("[getWorkReportDetail] マージされたインターバル数:", mergedIntervals.length);
            for (let i = 0; i < mergedIntervals.length; i++) {
                const interval = mergedIntervals[i];

                // 時刻文字列を直接使用
                const startTimeStr = interval.startTimeStr;
                const endTimeStr = interval.endTimeStr;

                console.log(`[getWorkReportDetail] インターバル[${i}]: ${startTimeStr} - ${endTimeStr}`);

                // 時刻文字列から分に変換して経過時間を計算
                let startMin = timeToMinutes(startTimeStr);
                const endMin = timeToMinutes(endTimeStr);

                if (startMin === null || endMin === null) {
                    console.log("[getWorkReportDetail] 時刻の変換失敗:", { startTimeStr, endTimeStr });
                    continue;
                }

                // 朝休憩（06:00-08:30）がある場合、作業記録の開始時刻が06:00より前の場合は08:30からカウント
                const morningBreakStart = timeToMinutes("06:00");
                const morningBreakEnd = timeToMinutes("08:30");
                if (morningBreakStart !== null && morningBreakEnd !== null) {
                    // 朝休憩が有効かチェック（breakTimesは既にisActive === "true"でフィルタ済み）
                    const hasMorningBreak = breakTimes.some(bt => {
                        const btStart = timeToMinutes(bt.startTime);
                        const btEnd = timeToMinutes(bt.endTime);
                        return btStart === morningBreakStart && btEnd === morningBreakEnd;
                    });

                    if (hasMorningBreak && startMin < morningBreakStart) {
                        // 朝休憩がある場合、開始時刻を08:30に調整
                        startMin = morningBreakEnd;
                        console.log(`[getWorkReportDetail] 朝休憩適用: 開始時刻を${startTimeStr}から08:30に調整`);
                    }
                }

                // 日をまたぐ場合の処理
                let actualEndMin = endMin;
                if (endMin < startMin) {
                    // 日をまたいでいる場合（例: 17:30 → 02:00）
                    actualEndMin = endMin + 24 * 60; // 24時間（1440分）を加算
                    console.log(`[getWorkReportDetail] 日をまたぐ作業記録: ${startTimeStr} → ${endTimeStr} (${startMin}分 → ${actualEndMin}分)`);
                }

                const baseMinutes = actualEndMin - startMin;
                console.log(`[getWorkReportDetail] インターバル[${i}] 基本時間: ${baseMinutes}分 (${Math.floor(baseMinutes / 60)}時間${baseMinutes % 60}分)`);

                let breakTotal = 0;
                const breakDetails: Array<{ breakTime: string; overlap: number }> = [];

                for (const bt of breakTimes) {
                    const s = timeToMinutes(bt.startTime);
                    const e = timeToMinutes(bt.endTime);
                    if (s === null || e === null || startMin === null || actualEndMin === null) {
                        console.log("[getWorkReportDetail] 休憩時間の変換失敗:", { start: bt.startTime, end: bt.endTime });
                        continue;
                    }

                    // 朝休憩（06:00-08:30）は既に開始時刻の調整で処理済みなのでスキップ
                    if (s === morningBreakStart && e === morningBreakEnd) {
                        continue;
                    }

                    // 休憩時間も日をまたぐ場合を考慮
                    let actualBreakEnd = e;
                    if (e < s) {
                        actualBreakEnd = e + 24 * 60;
                    }

                    // 作業区間と休憩区間の重なりを計算（分単位で）
                    // 作業記録が日をまたぐ場合、開始時刻から24時間後の終了時刻までの範囲を考慮
                    const workStart = startMin;
                    const workEnd = actualEndMin;

                    // 重なりの計算
                    let overlapStart = Math.max(workStart, s);
                    let overlapEnd = Math.min(workEnd, actualBreakEnd);

                    // 重なりが日をまたぐ場合は、開始日の範囲内のみを考慮
                    // 作業記録が日をまたぐ場合、休憩時間も日をまたぐ可能性がある
                    if (actualEndMin > 24 * 60) {
                        // 作業記録が日をまたいでいる場合
                        // 1. 開始日（0時〜24時）の範囲
                        // 2. 終了日（0時〜実際の終了時刻）の範囲
                        // の両方で休憩時間との重なりを計算

                        // 開始日の範囲（startMin 〜 24*60）
                        const day1End = 24 * 60;
                        let overlap1 = 0;
                        if (overlapStart < day1End) {
                            overlap1 = Math.min(overlapEnd, day1End) - Math.max(overlapStart, workStart);
                        }

                        // 終了日の範囲（0 〜 endMin）
                        const day2Start = 24 * 60;
                        const day2End = actualEndMin;
                        let overlap2 = 0;
                        if (overlapEnd > day2Start && overlapStart < day2End) {
                            const day2WorkStart = Math.max(0, overlapStart - day2Start);
                            const day2WorkEnd = Math.min(actualEndMin - day2Start, overlapEnd - day2Start);
                            overlap2 = day2WorkEnd - day2WorkStart;
                        }

                        const overlapMinutes = Math.max(0, overlap1 + overlap2);
                        if (overlapMinutes > 0) {
                            breakTotal += overlapMinutes;
                            breakDetails.push({
                                breakTime: `${bt.startTime} - ${bt.endTime}`,
                                overlap: overlapMinutes,
                            });
                            console.log("[getWorkReportDetail] 休憩時間重複（日をまたぐ）:", {
                                intervalIndex: i,
                                workInterval: `${startTimeStr}-${endTimeStr} (${startMin}分-${actualEndMin}分)`,
                                breakInterval: `${bt.startTime}-${bt.endTime} (${s}分-${actualBreakEnd}分)`,
                                overlap: `${overlapMinutes}分 (day1: ${overlap1}分, day2: ${overlap2}分)`,
                                breakTotal: `${breakTotal}分`
                            });
                        }
                    } else {
                        // 通常の場合（日をまたがない）
                        if (overlapEnd > overlapStart) {
                            const overlapMinutes = overlapEnd - overlapStart;
                            breakTotal += overlapMinutes;
                            breakDetails.push({
                                breakTime: `${bt.startTime} - ${bt.endTime}`,
                                overlap: overlapMinutes,
                            });
                            console.log("[getWorkReportDetail] 休憩時間重複:", {
                                intervalIndex: i,
                                workInterval: `${startMin}分-${endMin}分 (${startTimeStr}-${endTimeStr})`,
                                breakInterval: `${s}分-${e}分 (${bt.startTime}-${bt.endTime})`,
                                overlap: `${overlapStart}分-${overlapEnd}分 (${overlapMinutes}分)`,
                                breakTotal: `${breakTotal}分`
                            });
                        }
                    }
                }

                const duration = Math.max(0, baseMinutes - breakTotal);
                console.log(`[getWorkReportDetail] インターバル[${i}] 最終計算:`, {
                    baseMinutes: `${baseMinutes}分 (${Math.floor(baseMinutes / 60)}時間${baseMinutes % 60}分)`,
                    breakTotal: `${breakTotal}分 (${Math.floor(breakTotal / 60)}時間${breakTotal % 60}分)`,
                    duration: `${duration}分 (${Math.floor(duration / 60)}時間${duration % 60}分)`
                });
                workMinutes += duration;

                intervalDetails.push({
                    index: i,
                    startTime: startTimeStr,
                    endTime: endTimeStr,
                    baseMinutes,
                    breakTotal,
                    duration,
                    breakDetails,
                });
            }

            // 比較サマリーの計算
            const differenceMinutes = workMinutes - attendanceMinutes;

            return {
                userId: input.userId,
                workDate: input.workDate,
                userName,
                attendance: {
                    id: attendance.attendanceId,
                    workDate: attendance.workDate,
                    clockInTime: attendance.clockInTime,
                    clockOutTime: attendance.clockOutTime,
                    attendanceMinutes,  // 休憩時間を差し引いた値
                },
                workRecords,
                summary: {
                    attendanceMinutes,
                    workMinutes,
                    differenceMinutes,
                },
                breakTimeDetails: {
                    breakTimes: breakTimes.map(bt => ({ start: bt.startTime, end: bt.endTime })),
                    intervals: intervalDetails,
                },
            };
        }),

    /**
     * 車両ごとの制作時間を集計する
     * - 1台あたりの総作業時間（全期間）
     * - 工程ごとの総作業時間
     * - 工程をクリックしたときに表示する「誰が・いつ・何分」単位の明細
     */
    getVehicleProductionTimes: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            return [];
        }

        const rows = await db
            .select({
                vehicleId: schema.workRecords.vehicleId,
                vehicleNumber: schema.vehicles.vehicleNumber,
                customerName: schema.vehicles.customerName,
                desiredDeliveryDate: schema.vehicles.desiredDeliveryDate,
                completionDate: schema.vehicles.completionDate,
                processId: schema.workRecords.processId,
                processName: schema.processes.name,
                userId: schema.workRecords.userId,
                userName: schema.users.name,
                userUsername: schema.users.username,
                workDate: sql<string>`DATE(${schema.workRecords.startTime})`.as("workDate"),
                // 進行中の作業も含めて「今までにかかった時間」を見る
                minutes: sql<number>`COALESCE(TIMESTAMPDIFF(MINUTE, ${schema.workRecords.startTime}, COALESCE(${schema.workRecords.endTime}, NOW())), 0)`.as(
                    "minutes",
                ),
            })
            .from(schema.workRecords)
            .innerJoin(schema.vehicles, eq(schema.workRecords.vehicleId, schema.vehicles.id))
            .innerJoin(schema.processes, eq(schema.workRecords.processId, schema.processes.id))
            .innerJoin(schema.users, eq(schema.workRecords.userId, schema.users.id));

        type VehicleAgg = {
            vehicleId: number;
            vehicleNumber: string;
            customerName: string | null;
            totalMinutes: number;
            desiredDeliveryDate: Date | null;
            completionDate: Date | null;
            processes: {
                processId: number;
                processName: string;
                totalMinutes: number;
                details: {
                    userId: number;
                    userName: string;
                    workDate: string;
                    minutes: number;
                }[];
            }[];
        };

        const vehicleMap = new Map<number, VehicleAgg>();

        for (const row of rows) {
            const minutes = Number(row.minutes) || 0;
            if (minutes <= 0) continue;

            let vehicle = vehicleMap.get(row.vehicleId);
            if (!vehicle) {
                vehicle = {
                    vehicleId: row.vehicleId,
                    vehicleNumber: row.vehicleNumber,
                    customerName: row.customerName ?? null,
                    desiredDeliveryDate: (row as any).desiredDeliveryDate ?? null,
                    completionDate: (row as any).completionDate ?? null,
                    totalMinutes: 0,
                    processes: [],
                };
                vehicleMap.set(row.vehicleId, vehicle);
            }

            vehicle.totalMinutes += minutes;

            let process = vehicle.processes.find((p) => p.processId === row.processId);
            if (!process) {
                process = {
                    processId: row.processId,
                    processName: row.processName,
                    totalMinutes: 0,
                    details: [],
                };
                vehicle.processes.push(process);
            }

            process.totalMinutes += minutes;
            process.details.push({
                userId: row.userId,
                userName: row.userName || row.userUsername,
                workDate: row.workDate,
                minutes,
            });
        }

        // 各車両ごとに工程・明細をソート
        const vehicles = Array.from(vehicleMap.values()).map((v) => {
            const processes = [...v.processes]
                .map((p) => ({
                    ...p,
                    details: [...p.details].sort((a, b) => {
                        if (a.workDate === b.workDate) {
                            return a.userId - b.userId;
                        }
                        return a.workDate < b.workDate ? -1 : 1;
                    }),
                }))
                .sort((a, b) => b.totalMinutes - a.totalMinutes);

            return {
                ...v,
                processes,
            };
        });

        // 総時間が長い順にソートして返す
        vehicles.sort((a, b) => b.totalMinutes - a.totalMinutes);

        return vehicles;
    }),

    // 作業記録管理を入れていない人を取得（今日出勤しているが作業記録がない人）
    getUsersWithoutWorkRecords: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            return [];
        }

        // 今日の日付をJSTで取得（正しい方法）
        const now = new Date();
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const jstParts = jstFormatter.formatToParts(now);
        const y = jstParts.find(p => p.type === 'year')?.value || '0';
        const m = jstParts.find(p => p.type === 'month')?.value || '01';
        const d = jstParts.find(p => p.type === 'day')?.value || '01';
        const jstTodayStr = `${y}-${m}-${d}`;

        // 全ユーザーを取得（externalロールを除外）
        const { selectUsersSafely } = await import("../db");
        const allUsers = await selectUsersSafely(db);
        const staffUsers = allUsers.filter((u: any) => u.role !== "external");

        // 今日出勤しているユーザーを取得
        const attendanceRecords = await db
            .select({
                userId: schema.attendanceRecords.userId,
                clockInTime: schema.attendanceRecords.clockInTime,
                clockOutTime: schema.attendanceRecords.clockOutTime,
            })
            .from(schema.attendanceRecords)
            .where(eq(schema.attendanceRecords.workDate, jstTodayStr as any));

        const usersWithAttendance = new Set(attendanceRecords.map((ar) => ar.userId));

        // 今日の作業記録があるユーザーを取得（JSTベースで日付を比較）
        const pool = getPool();
        if (!pool) {
            return [];
        }

        // JSTベースで今日の日付で作業記録を取得
        const workRecordsQuery = `
            SELECT DISTINCT
                wr.userId AS userId
            FROM \`workRecords\` wr
            WHERE
                DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = ?
        `;
        const [workRecordsRows]: any = await pool.execute(workRecordsQuery, [jstTodayStr]);

        const usersWithWorkRecords = new Set(
            (workRecordsRows || []).map((row: any) => Number(row.userId))
        );

        // 出勤しているが作業記録がないユーザーを抽出
        const usersWithoutWorkRecords = staffUsers
            .filter((user: any) => {
                return usersWithAttendance.has(user.id) && !usersWithWorkRecords.has(user.id);
            })
            .map((user: any) => {
                const attendance = attendanceRecords.find((ar) => ar.userId === user.id);
                return {
                    userId: user.id,
                    userName: user.name || user.username,
                    clockInTime: attendance?.clockInTime || null,
                    clockOutTime: attendance?.clockOutTime || null,
                };
            });

        return usersWithoutWorkRecords;
    }),

    // 作業記録管理不備がある人を取得
    // 条件：
    // - 4日以内（当日は除く）に出勤した人
    // - 勤務時間 - 作業記録時間 = ±1時間を超えている
    // - または、出勤したけど作業報告を入れていない人
    getWorkRecordIssues: protectedProcedure.query(async () => {
        console.log("[getWorkRecordIssues] 開始");
        const db = await getDb();
        if (!db) {
            console.log("[getWorkRecordIssues] データベースに接続できません");
            return [];
        }

        // 過去4日間（当日は除く）の日付を計算（JSTベース）
        const now = new Date();
        // JSTで今日の日付を取得（正しい方法）
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const jstParts = jstFormatter.formatToParts(now);
        const y = parseInt(jstParts.find(p => p.type === 'year')?.value || '0');
        const m = jstParts.find(p => p.type === 'month')?.value || '01';
        const d = jstParts.find(p => p.type === 'day')?.value || '01';
        const today = new Date(y, parseInt(m) - 1, parseInt(d));

        const targetDates: string[] = [];
        for (let i = 1; i <= 4; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateY = date.getFullYear();
            const dateM = String(date.getMonth() + 1).padStart(2, "0");
            const dateD = String(date.getDate()).padStart(2, "0");
            targetDates.push(`${dateY}-${dateM}-${dateD}`);
        }

        console.log(`[getWorkRecordIssues] 今日の日付（JST）: ${y}-${m}-${d}`);
        console.log(`[getWorkRecordIssues] 対象日付: ${targetDates.join(", ")}`);

        if (targetDates.length === 0) {
            console.log("[getWorkRecordIssues] 対象日付がありません");
            return [];
        }

        const pool = getPool();
        if (!pool) {
            return [];
        }

        // クリア済みの不備を取得（テーブルが存在しない場合は空のセットを返す）
        const clearedSet = new Set<string>();
        try {
            const clearedQuery = `
                SELECT DISTINCT
                    userId,
                    DATE_FORMAT(workDate, '%Y-%m-%d') AS workDate
                FROM \`workRecordIssueClears\`
            `;
            const [clearedRows]: any = await pool.execute(clearedQuery);
            if (clearedRows && clearedRows.length > 0) {
                for (const row of clearedRows) {
                    clearedSet.add(`${row.userId}-${row.workDate}`);
                }
            }
        } catch (error: any) {
            // テーブルが存在しない場合はエラーを無視して続行
            if (error?.code === 'ER_NO_SUCH_TABLE' || error?.message?.includes("doesn't exist")) {
                console.log("[getWorkRecordIssues] workRecordIssueClearsテーブルが存在しません。スキップします。");
            } else {
                console.warn("[getWorkRecordIssues] クリア済み不備の取得エラー:", error);
            }
        }

        // 出勤記録があるユーザー・日付の組み合わせを取得
        // workDateはdate型なので、文字列として比較する
        const datePlaceholders = targetDates.map(() => "?").join(",");
        const query = `
            SELECT DISTINCT
                ar.userId AS userId,
                COALESCE(u.name, u.username) AS userName,
                u.role AS userRole,
                DATE_FORMAT(ar.workDate, '%Y-%m-%d') AS workDate
            FROM \`attendanceRecords\` ar
            INNER JOIN \`users\` u ON u.id = ar.userId
            WHERE
                ar.workDate IN (${datePlaceholders})
                AND ar.clockInTime IS NOT NULL
                AND u.role != 'external'
                AND u.role != 'admin'
                AND u.role != 'sales_office'
        `;
        console.log(`[getWorkRecordIssues] クエリ実行前: targetDates=${JSON.stringify(targetDates)}, クエリ=${query}`);
        const [rows]: any = await pool.execute(query, targetDates);
        console.log(`[getWorkRecordIssues] 出勤記録があるユーザー・日付の組み合わせ数: ${rows?.length || 0}`);
        if (rows && rows.length > 0) {
            console.log("[getWorkRecordIssues] 出勤記録のサンプル:", rows.slice(0, 3));
            // 12月2日のデータを確認
            const dec2Rows = rows.filter((r: any) => r.workDate === "2025-12-02");
            console.log(`[getWorkRecordIssues] 12月2日の出勤記録数: ${dec2Rows.length}`);
            if (dec2Rows.length > 0) {
                console.log("[getWorkRecordIssues] 12月2日の出勤記録:", dec2Rows);
            }
        }

        const map = new Map<
            number,
            {
                userId: number;
                userName: string;
                dates: string[];
            }
        >();

        if (!rows || rows.length === 0) {
            console.log("[getWorkRecordIssues] 出勤記録が1件も見つかりませんでした");
            return [];
        }

        console.log(`[getWorkRecordIssues] 処理対象のユーザー・日付の組み合わせ: ${rows.length}件`);

        // 各ユーザー・日付の組み合わせに対して、勤務時間と作業記録時間を比較
        for (const r of rows as any[]) {
            const userId = Number(r.userId);
            const userName = r.userName as string;
            const userRole = r.userRole as string;
            const workDate =
                typeof r.workDate === "string"
                    ? r.workDate
                    : (r.workDate as Date).toISOString().slice(0, 10);

            // 管理者と営業スタッフは警告を出さない
            if (userRole === 'admin' || userRole === 'sales_office') {
                console.log(`[getWorkRecordIssues] スキップ (userId: ${userId}, userName: ${userName}, role: ${userRole}): 管理者または営業スタッフのため警告を出しません`);
                continue;
            }

            console.log(`[getWorkRecordIssues] 処理開始: userId=${userId}, userName=${userName}, workDate=${workDate}, role=${userRole}`);

            // クリア済みの不備はスキップ
            if (clearedSet.has(`${userId}-${workDate}`)) {
                console.log(`[getWorkRecordIssues] スキップ (userId: ${userId}, workDate: ${workDate}): クリア済み`);
                continue;
            }

            try {
                // 出勤記録を取得
                const attendanceQuery = `
                    SELECT
                        ar.id AS attendanceId,
                        ar.workDate,
                        ar.clockInTime,
                        ar.clockOutTime,
                        ar.workMinutes AS attendanceWorkMinutes
                    FROM \`attendanceRecords\` ar
                    WHERE
                        ar.userId = ?
                        AND ar.workDate = ?
                        AND ar.clockInTime IS NOT NULL
                    LIMIT 1
                `;
                const [attendanceRows]: any = await pool.execute(attendanceQuery, [
                    userId,
                    workDate,
                ]);

                if (!attendanceRows || attendanceRows.length === 0) {
                    console.log(`[getWorkRecordIssues] 出勤記録が見つかりません (userId: ${userId}, workDate: ${workDate})`);
                    continue;
                }

                console.log(`[getWorkRecordIssues] 出勤記録を取得 (userId: ${userId}, workDate: ${workDate}): clockInTime=${attendanceRows[0].clockInTime}, clockOutTime=${attendanceRows[0].clockOutTime}`);

                const attendance = attendanceRows[0];

                // 休憩時間を取得
                const breakTimesForAttendance = await db.select().from(schema.breakTimes).then((times) =>
                    times.filter((bt) => bt.isActive === "true")
                );

                // 時刻文字列（"HH:MM"）を分に変換する関数
                const timeToMinutes = (t?: string | null): number | null => {
                    if (!t) return null;
                    const [hh, mm] = t.split(":");
                    const h = Number(hh);
                    const m = Number(mm);
                    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
                    const total = h * 60 + m;
                    if (total < 0 || total > 23 * 60 + 59) return null;
                    return total;
                };

                // 出勤時間を計算（休憩時間を考慮）
                // 作業報告のエラー検出時は、8:30より前の時間をカウント外にする
                let attendanceMinutes: number = 0;
                if (attendance.attendanceWorkMinutes !== null && attendance.attendanceWorkMinutes !== undefined) {
                    // attendanceWorkMinutesが既に計算されている場合でも、8:30より前の時間を除外する必要がある
                    // そのため、clockInTimeとclockOutTimeから再計算する
                    if (attendance.clockInTime && attendance.clockOutTime) {
                        let startMin = timeToMinutes(attendance.clockInTime);
                        const endMin = timeToMinutes(attendance.clockOutTime);
                        if (startMin !== null && endMin !== null) {
                            // 8:30より前の場合は8:30からカウント
                            const workStartTime = timeToMinutes("08:30");
                            if (workStartTime !== null && startMin < workStartTime) {
                                startMin = workStartTime;
                                console.log(`[getWorkRecordIssues] 作業開始時刻調整 (userId: ${userId}, workDate: ${workDate}): ${attendance.clockInTime} → 08:30`);
                            }
                            const baseMinutes = Math.max(0, endMin - startMin);
                            let breakTotal = 0;
                            for (const bt of breakTimesForAttendance) {
                                const s = timeToMinutes(bt.startTime);
                                const eRaw = timeToMinutes(bt.endTime);
                                if (s === null || eRaw === null) continue;
                                let e = eRaw;
                                if (e < s) {
                                    e += 24 * 60;
                                }
                                const overlapStart = Math.max(startMin, s);
                                const overlapEnd = Math.min(endMin, e);
                                if (overlapEnd > overlapStart) {
                                    breakTotal += overlapEnd - overlapStart;
                                }
                            }
                            attendanceMinutes = Math.max(0, baseMinutes - breakTotal);
                        } else {
                    attendanceMinutes = Number(attendance.attendanceWorkMinutes);
                        }
                    } else {
                        attendanceMinutes = Number(attendance.attendanceWorkMinutes);
                    }
                } else if (attendance.clockInTime && attendance.clockOutTime) {
                    let startMin = timeToMinutes(attendance.clockInTime);
                    const endMin = timeToMinutes(attendance.clockOutTime);
                    if (startMin !== null && endMin !== null) {
                        // 8:30より前の場合は8:30からカウント
                        const workStartTime = timeToMinutes("08:30");
                        if (workStartTime !== null && startMin < workStartTime) {
                            startMin = workStartTime;
                            console.log(`[getWorkRecordIssues] 作業開始時刻調整 (userId: ${userId}, workDate: ${workDate}): ${attendance.clockInTime} → 08:30`);
                        }
                        const baseMinutes = Math.max(0, endMin - startMin);
                        let breakTotal = 0;
                        for (const bt of breakTimesForAttendance) {
                            const s = timeToMinutes(bt.startTime);
                            const eRaw = timeToMinutes(bt.endTime);
                            if (s === null || eRaw === null) continue;
                            let e = eRaw;
                            if (e < s) {
                                e += 24 * 60;
                            }
                            const overlapStart = Math.max(startMin, s);
                            const overlapEnd = Math.min(endMin, e);
                            if (overlapEnd > overlapStart) {
                                breakTotal += overlapEnd - overlapStart;
                            }
                        }
                        attendanceMinutes = Math.max(0, baseMinutes - breakTotal);
                    }
                } else if (attendance.clockInTime && !attendance.clockOutTime) {
                    // 出勤しているが退勤していない場合も、作業記録がない場合は不備として扱う
                    // この場合は後で作業記録がない場合の判定で処理される
                    attendanceMinutes = 0;
                }

                // 作業記録を取得（JSTベースで日付を比較）
                // startTimeとendTimeをJSTに変換して取得
                const workRecordsQuery = `
                    SELECT DISTINCT
                        wr.id,
                        wr.startTime,
                        wr.endTime,
                        CONVERT_TZ(wr.startTime, '+00:00', '+09:00') AS startTimeJST,
                        CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00') AS endTimeJST
                    FROM \`workRecords\` wr
                    WHERE
                        wr.userId = ?
                        AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                `;
                console.log(`[getWorkRecordIssues] 作業記録クエリ実行前: userId=${userId}, workDate=${workDate}`);
                const [workRecordsRows]: any = await pool.execute(workRecordsQuery, [
                    userId,
                    workDate,
                ]);

                console.log(`[getWorkRecordIssues] 作業記録クエリ結果 (userId: ${userId}, workDate: ${workDate}): ${workRecordsRows?.length || 0}件`);
                if (workRecordsRows && workRecordsRows.length > 0) {
                    console.log(`[getWorkRecordIssues] 作業記録の詳細:`, workRecordsRows.map((r: any) => {
                        const startTimeJSTDate = parseJSTDateTime(r.startTimeJST);
                        const endTimeJSTDate = parseJSTDateTime(r.endTimeJST);
                        // 有効な日付かどうかをチェック
                        const isValidStartDate = startTimeJSTDate && !isNaN(startTimeJSTDate.getTime());
                        const isValidEndDate = endTimeJSTDate && !isNaN(endTimeJSTDate.getTime());
                        return {
                            id: r.id,
                            startTime: r.startTime,
                            startTimeJST: r.startTimeJST,
                            startTimeJSTParsed: isValidStartDate ? startTimeJSTDate.toISOString() : null,
                            startTimeJSTString: isValidStartDate ? startTimeJSTDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : null,
                            endTime: r.endTime,
                            endTimeJST: r.endTimeJST,
                            endTimeJSTParsed: isValidEndDate ? endTimeJSTDate.toISOString() : null,
                            endTimeJSTString: isValidEndDate ? endTimeJSTDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : null,
                        };
                    }));
                }

                // 作業記録がない場合は不備
                if (!workRecordsRows || workRecordsRows.length === 0) {
                    console.log(`[getWorkRecordIssues] 作業記録なしを検出 (userId: ${userId}, workDate: ${workDate}, userName: ${userName})`);
                    if (!map.has(userId)) {
                        map.set(userId, { userId, userName, dates: [] });
                    }
                    const entry = map.get(userId)!;
                    if (!entry.dates.includes(workDate)) {
                        entry.dates.push(workDate);
                    }
                    continue;
                }

                console.log(`[getWorkRecordIssues] 作業記録あり (userId: ${userId}, workDate: ${workDate}): ${workRecordsRows.length}件`);

                // 休憩時間を取得
                const breakTimes = await db.select().from(schema.breakTimes).then((times) =>
                    times.filter((bt) => bt.isActive === "true")
                );

                // Dateオブジェクトから時刻文字列（"HH:MM"）を取得する関数（JSTで取得）
                const dateToTimeString = (date: Date): string => {
                    // JST（Asia/Tokyo）で時刻を取得
                    const formatter = new Intl.DateTimeFormat('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                    });
                    const parts = formatter.formatToParts(date);
                    const hours = parts.find(p => p.type === 'hour')?.value || '00';
                    const minutes = parts.find(p => p.type === 'minute')?.value || '00';
                    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
                };

                // 作業記録をマージして重複を排除
                // startTimeJSTとendTimeJSTから時刻文字列を取得して使用（getWorkReportDetailと同じロジック）
                const sortedRecords = (workRecordsRows || []).filter((r: any) => r.startTimeJST).map((r: any) => {
                    const startTimeJSTDate = parseJSTDateTime(r.startTimeJST);
                    const endTimeJSTDate = r.endTimeJST ? parseJSTDateTime(r.endTimeJST) : null;
                    const startTimeStr = startTimeJSTDate ? dateToTimeString(startTimeJSTDate) : "";
                    const endTimeStr = endTimeJSTDate ? dateToTimeString(endTimeJSTDate) : dateToTimeString(new Date());
                    return {
                        ...r,
                        startTimeStr,
                        endTimeStr,
                    };
                }).sort((a: any, b: any) => {
                    // 時刻文字列でソート
                    return a.startTimeStr.localeCompare(b.startTimeStr);
                });

                const mergedIntervals: Array<{ startTimeStr: string; endTimeStr: string }> = [];

                for (const record of sortedRecords) {
                    if (!record.startTimeStr) continue;

                    const startTimeStr = record.startTimeStr;
                    const endTimeStr = record.endTimeStr;

                    // 時刻文字列を分に変換して比較
                    const startMin = timeToMinutes(startTimeStr);
                    const endMin = timeToMinutes(endTimeStr);
                    if (startMin === null || endMin === null) continue;

                    // 日をまたぐ場合の処理
                    let actualEndMin = endMin;
                    if (endMin < startMin) {
                        actualEndMin = endMin + 24 * 60;
                    }

                    // 既存のインターバルと重複または隣接しているかチェック（分単位で比較）
                    let merged = false;
                    for (let i = 0; i < mergedIntervals.length; i++) {
                        const interval = mergedIntervals[i];
                        const intervalStartMin = timeToMinutes(interval.startTimeStr);
                        const intervalEndMin = timeToMinutes(interval.endTimeStr);
                        if (intervalStartMin === null || intervalEndMin === null) continue;

                        let actualIntervalEndMin = intervalEndMin;
                        if (intervalEndMin < intervalStartMin) {
                            actualIntervalEndMin = intervalEndMin + 24 * 60;
                        }

                        // 重複または隣接している場合（1分以内のギャップもマージ）
                        if (!(actualEndMin < intervalStartMin - 1 || startMin > actualIntervalEndMin + 1)) {
                            // マージ（より早い開始時刻とより遅い終了時刻を保存）
                            const newStartMin = Math.min(startMin, intervalStartMin);
                            const newEndMin = Math.max(actualEndMin, actualIntervalEndMin);

                            // 分を時刻文字列に変換
                            const newStartHours = Math.floor(newStartMin / 60) % 24;
                            const newStartMins = newStartMin % 60;
                            const newEndHours = Math.floor(newEndMin / 60) % 24;
                            const newEndMins = newEndMin % 60;

                            interval.startTimeStr = `${String(newStartHours).padStart(2, '0')}:${String(newStartMins).padStart(2, '0')}`;
                            interval.endTimeStr = `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
                            merged = true;
                            break;
                        }
                    }

                    if (!merged) {
                        mergedIntervals.push({ startTimeStr, endTimeStr });
                    }
                }

                // マージされた各インターバルに対して、休憩時間を引いた時間を計算
                let totalWorkMinutes = 0;

                console.log(`[getWorkRecordIssues] マージされたインターバル数 (userId: ${userId}, workDate: ${workDate}): ${mergedIntervals.length}`);

                for (let i = 0; i < mergedIntervals.length; i++) {
                    const interval = mergedIntervals[i];
                    const startTimeStr = interval.startTimeStr;
                    const endTimeStr = interval.endTimeStr;

                    console.log(`[getWorkRecordIssues] インターバル[${i}] (userId: ${userId}, workDate: ${workDate}): ${startTimeStr} - ${endTimeStr}`);

                    let startMin = timeToMinutes(startTimeStr);
                    const endMin = timeToMinutes(endTimeStr);

                    if (startMin === null || endMin === null) {
                        console.log(`[getWorkRecordIssues] 時刻の変換失敗 (userId: ${userId}, workDate: ${workDate}): startTimeStr=${startTimeStr}, endTimeStr=${endTimeStr}`);
                        continue;
                    }

                    // 朝休憩（06:00-08:30）がある場合、作業記録の開始時刻が06:00より前の場合は08:30からカウント
                    const morningBreakStart = timeToMinutes("06:00");
                    const morningBreakEnd = timeToMinutes("08:30");
                    if (morningBreakStart !== null && morningBreakEnd !== null) {
                        // 朝休憩が有効かチェック（breakTimesは既にisActive === "true"でフィルタ済み）
                        const hasMorningBreak = breakTimes.some(bt => {
                            const btStart = timeToMinutes(bt.startTime);
                            const btEnd = timeToMinutes(bt.endTime);
                            return btStart === morningBreakStart && btEnd === morningBreakEnd;
                        });

                        if (hasMorningBreak && startMin < morningBreakStart) {
                            // 朝休憩がある場合、開始時刻を08:30に調整
                            startMin = morningBreakEnd;
                            console.log(`[getWorkRecordIssues] 朝休憩適用 (userId: ${userId}, workDate: ${workDate}): 開始時刻を${startTimeStr}から08:30に調整`);
                        }
                    }

                    // 日をまたぐ場合の処理
                    let actualEndMin = endMin;
                    if (endMin < startMin) {
                        // 日をまたいでいる場合（例: 17:30 → 02:00）
                        actualEndMin = endMin + 24 * 60; // 24時間（1440分）を加算
                        console.log(`[getWorkRecordIssues] 日をまたぐ作業記録: ${startTimeStr} → ${endTimeStr} (${startMin}分 → ${actualEndMin}分)`);
                    }

                    const baseMinutes = actualEndMin - startMin;
                    let breakTotal = 0;

                    console.log(`[getWorkRecordIssues] インターバル[${i}] 基本時間 (userId: ${userId}, workDate: ${workDate}): ${baseMinutes}分 (${Math.floor(baseMinutes / 60)}時間${baseMinutes % 60}分)`);

                    for (const bt of breakTimes) {
                        const s = timeToMinutes(bt.startTime);
                        const e = timeToMinutes(bt.endTime);
                        if (s === null || e === null) continue;

                        // 朝休憩（06:00-08:30）は既に開始時刻の調整で処理済みなのでスキップ
                        if (s === morningBreakStart && e === morningBreakEnd) {
                            continue;
                        }

                        // 休憩時間も日をまたぐ場合を考慮
                        let actualBreakEnd = e;
                        if (e < s) {
                            actualBreakEnd = e + 24 * 60;
                        }

                        // 作業区間と休憩区間の重なりを計算（分単位で）
                        const overlapStart = Math.max(startMin, s);
                        const overlapEnd = Math.min(actualEndMin, actualBreakEnd);
                        if (overlapEnd > overlapStart) {
                            const overlapMinutes = overlapEnd - overlapStart;
                            breakTotal += overlapMinutes;
                            console.log(`[getWorkRecordIssues] 休憩時間重複 (userId: ${userId}, workDate: ${workDate}):`, {
                                intervalIndex: i,
                                workInterval: `${startTimeStr}-${endTimeStr} (${startMin}分-${actualEndMin}分)`,
                                breakInterval: `${bt.startTime}-${bt.endTime} (${s}分-${actualBreakEnd}分)`,
                                overlap: `${overlapStart}分-${overlapEnd}分 (${overlapMinutes}分)`,
                            });
                        }
                    }

                    const duration = Math.max(0, baseMinutes - breakTotal);
                    totalWorkMinutes += duration;
                    console.log(`[getWorkRecordIssues] インターバル[${i}] 最終計算 (userId: ${userId}, workDate: ${workDate}):`, {
                        baseMinutes: `${baseMinutes}分`,
                        breakTotal: `${breakTotal}分`,
                        duration: `${duration}分 (${Math.floor(duration / 60)}時間${duration % 60}分)`,
                        totalWorkMinutes: `${totalWorkMinutes}分 (累計)`,
                    });
                }

                // 勤務時間 - 作業記録時間の差が±1時間（60分）を超えている場合は不備
                const differenceMinutes = Math.abs(attendanceMinutes - totalWorkMinutes);
                console.log(`[getWorkRecordIssues] 計算結果 (userId: ${userId}, userName: ${userName}, workDate: ${workDate}):`);
                console.log(`  - attendanceMinutes: ${attendanceMinutes}分 (${Math.floor(attendanceMinutes / 60)}時間${attendanceMinutes % 60}分)`);
                console.log(`  - totalWorkMinutes: ${totalWorkMinutes}分 (${Math.floor(totalWorkMinutes / 60)}時間${totalWorkMinutes % 60}分)`);
                console.log(`  - differenceMinutes: ${differenceMinutes}分 (${Math.floor(differenceMinutes / 60)}時間${differenceMinutes % 60}分)`);
                console.log(`  - 判定: ${differenceMinutes > 60 ? '不備あり' : '不備なし'} (閾値: 60分)`);

                if (differenceMinutes > 60) {
                    console.log(`[getWorkRecordIssues] ⚠️ 不備を検出 (userId: ${userId}, userName: ${userName}, workDate: ${workDate}): 差が${differenceMinutes}分`);
                    if (!map.has(userId)) {
                        map.set(userId, { userId, userName, dates: [] });
                    }
                    const entry = map.get(userId)!;
                    if (!entry.dates.includes(workDate)) {
                        entry.dates.push(workDate);
                    }
                } else {
                    console.log(`[getWorkRecordIssues] ✅ 不備なし (userId: ${userId}, userName: ${userName}, workDate: ${workDate}): 差が${differenceMinutes}分（60分以下）`);
                }
            } catch (error) {
                // エラーが発生した場合はスキップ
                console.error(`[getWorkRecordIssues] エラー (userId: ${userId}, workDate: ${workDate}):`, error);
            }
        }

        // 日付は新しい順に並べる
        const result = Array.from(map.values()).map((v) => ({
            ...v,
            dates: v.dates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
        }));

        console.log(`[getWorkRecordIssues] 完了: ${result.length}件の不備を検出`);
        if (result.length > 0) {
            console.log("[getWorkRecordIssues] 不備の詳細:", JSON.stringify(result, null, 2));
        } else {
            console.log("[getWorkRecordIssues] 不備は検出されませんでした");
            console.log(`[getWorkRecordIssues] 処理したユーザー・日付の組み合わせ数: ${rows?.length || 0}`);
            if (rows && rows.length > 0) {
                console.log("[getWorkRecordIssues] 処理したユーザー・日付の組み合わせ:", rows.map((r: any) => ({
                    userId: r.userId,
                    userName: r.userName,
                    workDate: r.workDate
                })));
            }
        }
        return result;
    }),

    /**
     * 大分類別の作業時間を集計
     * 昨日、今日、一週間、11月の各期間で大分類別の総合作業時間を返す
     */
    getWorkTimeByMajorCategory: protectedProcedure.query(async () => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) {
            return {
                yesterday: [],
                today: [],
                week: [],
                november: [],
            };
        }

        // JSTで現在の日時を取得（正しい方法）
        const now = new Date();
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const jstParts = jstFormatter.formatToParts(now);
        const y = parseInt(jstParts.find(p => p.type === 'year')?.value || '0');
        const m = parseInt(jstParts.find(p => p.type === 'month')?.value || '1');
        const d = parseInt(jstParts.find(p => p.type === 'day')?.value || '1');
        const today = new Date(y, m - 1, d);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        // 11月の開始日と終了日（現在の年を使用）
        const currentYear = y;
        const novemberStart = new Date(currentYear, 10, 1); // 11月1日（月は0始まり）
        const novemberEnd = new Date(currentYear, 10, 30, 23, 59, 59); // 11月30日

        // 大分類別の作業時間を集計するSQLクエリ
        const getWorkTimeByCategory = async (startDate: Date, endDate: Date) => {
            const query = `
                SELECT 
                    COALESCE(p.majorCategory, '未分類') AS majorCategory,
                    SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))) AS totalMinutes
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                    AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d')
                    AND wr.endTime IS NOT NULL
                GROUP BY p.majorCategory
                ORDER BY totalMinutes DESC
            `;

            const [rows]: any = await pool.execute(query, [
                startDate.toISOString().slice(0, 10),
                endDate.toISOString().slice(0, 10),
            ]);

            return (rows || []).map((row: any) => ({
                majorCategory: row.majorCategory || "未分類",
                totalMinutes: Number(row.totalMinutes) || 0,
            }));
        };

        // 各期間のデータを取得
        const yesterdayData = await getWorkTimeByCategory(yesterday, yesterday);
        const todayData = await getWorkTimeByCategory(today, today);
        const weekData = await getWorkTimeByCategory(weekAgo, today);
        const novemberData = await getWorkTimeByCategory(novemberStart, novemberEnd);
        
        // 4日分のデータを取得（今日、昨日、一昨日、3日前）
        const dayBeforeYesterday = new Date(today);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        const dayBeforeYesterdayData = await getWorkTimeByCategory(dayBeforeYesterday, dayBeforeYesterday);
        const threeDaysAgoData = await getWorkTimeByCategory(threeDaysAgo, threeDaysAgo);

        return {
            yesterday: yesterdayData,
            today: todayData,
            week: weekData,
            november: novemberData,
            dayBeforeYesterday: dayBeforeYesterdayData,
            threeDaysAgo: threeDaysAgoData,
        };
    }),

    /**
     * 昨日と一昨日の大分類別の総合作業時間を取得
     */
    getWorkTimeByMajorCategoryTodayYesterday: protectedProcedure.query(async () => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) {
            return {
                yesterday: [],
                dayBeforeYesterday: [],
            };
        }

        // JSTで現在の日時を取得
        const now = new Date();
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const jstParts = jstFormatter.formatToParts(now);
        const y = parseInt(jstParts.find(p => p.type === 'year')?.value || '0');
        const m = parseInt(jstParts.find(p => p.type === 'month')?.value || '1');
        const d = parseInt(jstParts.find(p => p.type === 'day')?.value || '1');
        const today = new Date(y, m - 1, d);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBeforeYesterday = new Date(today);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

        // 大分類別の作業時間を集計するSQLクエリ
        const getWorkTimeByCategory = async (targetDate: Date) => {
            const query = `
                SELECT 
                    COALESCE(p.majorCategory, '未分類') AS majorCategory,
                    SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))) AS totalMinutes
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                    AND wr.endTime IS NOT NULL
                GROUP BY p.majorCategory
                ORDER BY totalMinutes DESC
            `;

            const [rows]: any = await pool.execute(query, [
                targetDate.toISOString().slice(0, 10),
            ]);

            return (rows || []).map((row: any) => ({
                majorCategory: row.majorCategory || "未分類",
                totalMinutes: Number(row.totalMinutes) || 0,
            }));
        };

        const yesterdayData = await getWorkTimeByCategory(yesterday);
        const dayBeforeYesterdayData = await getWorkTimeByCategory(dayBeforeYesterday);

        return {
            yesterday: yesterdayData,
            dayBeforeYesterday: dayBeforeYesterdayData,
        };
    }),

    /**
     * 作業中の車両とその作業時間を取得（作業掲載ページ用）
     * 5時間未満の車両は除外
     */
    getActiveVehiclesWithWorkTime: protectedProcedure.query(async () => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) {
            return [];
        }

        // 作業中の車両を取得
        const vehicles = await db
            .select()
            .from(schema.vehicles)
            .where(eq(schema.vehicles.status, "in_progress"));

        if (vehicles.length === 0) {
            return [];
        }

        const vehicleIds = vehicles.map((v) => v.id);
        const vehicleTypes = await db.select().from(schema.vehicleTypes);
        const vehicleTypeMap = new Map(vehicleTypes.map((vt) => [vt.id, vt.name]));

        // 各車両の作業時間を計算（SQLで集計）
        const placeholders = vehicleIds.map(() => "?").join(",");
        const totalWorkTimeQuery = `
            SELECT 
                vehicleId,
                COALESCE(SUM(TIMESTAMPDIFF(MINUTE, startTime, COALESCE(endTime, NOW()))), 0) AS totalMinutes
            FROM \`workRecords\`
            WHERE vehicleId IN (${placeholders})
            GROUP BY vehicleId
        `;

        const [workTimeRows]: any = await pool.execute(totalWorkTimeQuery, vehicleIds);
        const workTimeMap = new Map<number, number>();
        if (workTimeRows) {
            workTimeRows.forEach((row: any) => {
                workTimeMap.set(row.vehicleId, Number(row.totalMinutes) || 0);
            });
        }

        // 5時間未満（300分未満）の車両を除外
        const filteredVehicles = vehicles.filter((vehicle) => {
            const totalMinutes = workTimeMap.get(vehicle.id) || 0;
            return totalMinutes >= 300; // 5時間 = 300分
        });

        if (filteredVehicles.length === 0) {
            return [];
        }

        const filteredVehicleIds = filteredVehicles.map((v) => v.id);
        const filteredPlaceholders = filteredVehicleIds.map(() => "?").join(",");

        // 各車両の作業者ごとの作業時間を取得
        const userWorkTimeQuery = `
            SELECT 
                wr.vehicleId,
                wr.userId,
                COALESCE(u.name, u.username) AS userName,
                COALESCE(SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))), 0) AS userMinutes
            FROM \`workRecords\` wr
            INNER JOIN \`users\` u ON u.id = wr.userId
            WHERE wr.vehicleId IN (${filteredPlaceholders})
            GROUP BY wr.vehicleId, wr.userId, u.name, u.username
            ORDER BY wr.vehicleId, userMinutes DESC
        `;

        const [userWorkTimeRows]: any = await pool.execute(userWorkTimeQuery, filteredVehicleIds);
        const userWorkTimeMap = new Map<number, Array<{ userName: string; minutes: number }>>();
        if (userWorkTimeRows) {
            userWorkTimeRows.forEach((row: any) => {
                const vehicleId = row.vehicleId;
                const existing = userWorkTimeMap.get(vehicleId) || [];
                existing.push({
                    userName: row.userName,
                    minutes: Number(row.userMinutes) || 0,
                });
                userWorkTimeMap.set(vehicleId, existing);
            });
        }

        // メモと注意ポイントを取得
        const memos = await db
            .select()
            .from(schema.vehicleMemos)
            .where(inArray(schema.vehicleMemos.vehicleId, filteredVehicleIds));
        
        const attentionPoints = await db
            .select()
            .from(schema.vehicleAttentionPoints)
            .where(inArray(schema.vehicleAttentionPoints.vehicleId, filteredVehicleIds));

        const memosMap = new Map<number, string[]>();
        memos.forEach((memo) => {
            const existing = memosMap.get(memo.vehicleId) || [];
            existing.push(memo.content);
            memosMap.set(memo.vehicleId, existing);
        });

        const attentionPointsMap = new Map<number, string[]>();
        attentionPoints.forEach((ap) => {
            const existing = attentionPointsMap.get(ap.vehicleId) || [];
            existing.push(ap.content);
            attentionPointsMap.set(ap.vehicleId, existing);
        });

        // 車両情報と作業時間を結合
        return filteredVehicles.map((vehicle) => {
            const totalMinutes = workTimeMap.get(vehicle.id) || 0;
            const userWorkTimes = userWorkTimeMap.get(vehicle.id) || [];
            return {
                id: vehicle.id,
                vehicleNumber: vehicle.vehicleNumber,
                customerName: vehicle.customerName,
                vehicleTypeName: vehicleTypeMap.get(vehicle.vehicleTypeId) || "不明",
                desiredDeliveryDate: vehicle.desiredDeliveryDate,
                totalMinutes,
                userWorkTimes, // 作業者ごとの作業時間
                memos: memosMap.get(vehicle.id) || [], // メモ
                attentionPoints: attentionPointsMap.get(vehicle.id) || [], // 注意ポイント
            };
        }).sort((a, b) => b.totalMinutes - a.totalMinutes); // 作業時間の多い順にソート
    }),

    /**
     * 大分類別の作業記録詳細を取得（誰が何をしたか）
     */
    getWorkDetailsByMajorCategory: protectedProcedure
        .input(
            z.object({
                majorCategory: z.string(),
                date: z.string(), // "today" | "yesterday" | "2024-12-03" などの形式
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            const pool = getPool();
            if (!db || !pool) {
                return [];
            }

            // JSTで現在の日時を取得（正しい方法）
            const now = new Date();
            const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
            const jstParts = jstFormatter.formatToParts(now);
            const y = parseInt(jstParts.find(p => p.type === 'year')?.value || '0');
            const m = parseInt(jstParts.find(p => p.type === 'month')?.value || '1');
            const d = parseInt(jstParts.find(p => p.type === 'day')?.value || '1');
            let targetDate: Date;

            if (input.date === "today") {
                targetDate = new Date(y, m - 1, d);
            } else if (input.date === "yesterday") {
                const today = new Date(y, m - 1, d);
                targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() - 1);
            } else {
                // 日付文字列の場合
                targetDate = new Date(input.date);
            }

            const query = `
                SELECT 
                    wr.id,
                    wr.userId,
                    wr.vehicleId,
                    wr.processId,
                    wr.startTime,
                    wr.endTime,
                    wr.workDescription,
                    COALESCE(u.name, u.username) AS userName,
                    v.vehicleNumber,
                    v.customerName,
                    p.name AS processName,
                    p.minorCategory,
                    TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW())) AS durationMinutes,
                    TIME(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) AS startTimeStr,
                    TIME(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) AS endTimeStr
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                INNER JOIN \`users\` u ON u.id = wr.userId
                LEFT JOIN \`vehicles\` v ON v.id = wr.vehicleId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                    AND COALESCE(p.majorCategory, '未分類') = ?
                    AND wr.endTime IS NOT NULL
                ORDER BY wr.startTime ASC
            `;

            const [rows]: any = await pool.execute(query, [
                targetDate.toISOString().slice(0, 10),
                input.majorCategory,
            ]);

            return (rows || []).map((row: any) => ({
                id: row.id,
                userId: row.userId,
                userName: row.userName,
                vehicleId: row.vehicleId,
                vehicleNumber: row.vehicleNumber || "不明",
                customerName: row.customerName,
                processId: row.processId,
                processName: row.processName,
                minorCategory: row.minorCategory,
                workDescription: row.workDescription,
                startTime: row.startTime,
                endTime: row.endTime,
                startTimeStr: row.startTimeStr ? row.startTimeStr.substring(0, 5) : null,
                endTimeStr: row.endTimeStr ? row.endTimeStr.substring(0, 5) : null,
                durationMinutes: Number(row.durationMinutes) || 0,
            }));
        }),

    // 作業記録管理不備をクリア（準管理者以上）
    clearWorkRecordIssue: protectedProcedure
        .input(
            z.object({
                userId: z.number(),
                workDate: z.string(), // "YYYY-MM-DD"形式
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

            try {
                // 既にクリア済みかチェック
                const existing = await db
                    .select()
                    .from(schema.workRecordIssueClears)
                    .where(
                        and(
                            eq(schema.workRecordIssueClears.userId, input.userId),
                            eq(schema.workRecordIssueClears.workDate, input.workDate)
                        )
                    )
                    .limit(1);

                if (existing.length > 0) {
                    return { success: true, message: "既にクリア済みです" };
                }

                // クリア記録を追加
                await db.insert(schema.workRecordIssueClears).values({
                    userId: input.userId,
                    workDate: input.workDate,
                    clearedBy: ctx.user!.id,
                });

                return { success: true };
            } catch (error: any) {
                // テーブルが存在しない場合やその他のエラーを適切に処理
                const errorMessage = error?.message || String(error);
                const errorCode = error?.code;
                // DrizzleQueryErrorの場合、causeの中にエラーコードがある可能性がある
                const causeErrorCode = error?.cause?.code;
                const causeErrorMessage = error?.cause?.message || error?.cause?.sqlMessage || "";
                
                // エラーコードまたはメッセージからテーブルが存在しないことを判定
                const isTableNotFound = 
                    errorCode === 'ER_NO_SUCH_TABLE' || 
                    causeErrorCode === 'ER_NO_SUCH_TABLE' ||
                    errorMessage.includes("doesn't exist") || 
                    causeErrorMessage.includes("doesn't exist") ||
                    errorMessage.includes("Unknown column") ||
                    causeErrorMessage.includes("Unknown column");
                
                if (isTableNotFound) {
                    console.error("[clearWorkRecordIssue] テーブルまたはカラムが存在しません:", errorMessage, causeErrorMessage);
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "workRecordIssueClearsテーブルが存在しません。データベースマイグレーションを実行してください。",
                    });
                }
                
                console.error("[clearWorkRecordIssue] エラー:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: `不備のクリアに失敗しました: ${errorMessage}`,
                });
            }
        }),

    // ふみかチェック一覧を取得（管理者専用）
    getWorkRecordIssueClears: protectedProcedure.query(async ({ ctx }) => {
        // 管理者・準管理者のみアクセス可能
        if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin") {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "アクセス権限がありません",
            });
        }

        const db = await getDb();
        if (!db) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "データベースに接続できません",
            });
        }

        const pool = getPool();
        if (!pool) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "データベースに接続できません",
            });
        }

        try {
            // ふみかチェック一覧を取得（ユーザー名とクリアした人の名前も含む）
            const query = `
                SELECT 
                    wric.id,
                    wric.userId,
                    wric.workDate,
                    wric.clearedBy,
                    wric.clearedAt,
                    wric.createdAt,
                    u.name AS userName,
                    u.username AS userUsername,
                    clearedByUser.name AS clearedByName,
                    clearedByUser.username AS clearedByUsername
                FROM \`workRecordIssueClears\` wric
                INNER JOIN \`users\` u ON u.id = wric.userId
                INNER JOIN \`users\` clearedByUser ON clearedByUser.id = wric.clearedBy
                ORDER BY wric.clearedAt DESC
            `;

            const [rows]: any = await pool.execute(query);

            return rows.map((row: any) => ({
                id: row.id,
                userId: row.userId,
                workDate: row.workDate,
                clearedBy: row.clearedBy,
                clearedAt: row.clearedAt,
                createdAt: row.createdAt,
                userName: row.userName || row.userUsername,
                clearedByName: row.clearedByName || row.clearedByUsername,
            }));
        } catch (error: any) {
            // テーブルが存在しない場合は空配列を返す
            if (error?.code === 'ER_NO_SUCH_TABLE' || error?.message?.includes("doesn't exist")) {
                console.log("[getWorkRecordIssueClears] workRecordIssueClearsテーブルが存在しません。空配列を返します。");
                return [];
            }
            throw error;
        }
    }),

    /**
     * 昨日と一昨日の大分類別作業時間を取得
     */
    getTotalWorkTimeTodayYesterday: protectedProcedure.query(async () => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) {
            return {
                yesterday: [],
                dayBeforeYesterday: [],
            };
        }

        // JSTで現在の日時を取得
        const now = new Date();
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const jstParts = jstFormatter.formatToParts(now);
        const y = parseInt(jstParts.find(p => p.type === 'year')?.value || '0');
        const m = parseInt(jstParts.find(p => p.type === 'month')?.value || '1');
        const d = parseInt(jstParts.find(p => p.type === 'day')?.value || '1');
        const today = new Date(y, m - 1, d);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBeforeYesterday = new Date(today);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

        // 大分類別の作業時間を取得するSQLクエリ
        const getWorkTimeByCategory = async (targetDate: Date) => {
            const query = `
                SELECT 
                    COALESCE(p.majorCategory, '未分類') AS majorCategory,
                    SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))) AS totalMinutes
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                    AND wr.endTime IS NOT NULL
                GROUP BY p.majorCategory
                ORDER BY totalMinutes DESC
            `;

            const [rows]: any = await pool.execute(query, [
                targetDate.toISOString().slice(0, 10),
            ]);

            return (rows || []).map((row: any) => ({
                majorCategory: row.majorCategory || "未分類",
                totalMinutes: Number(row.totalMinutes) || 0,
            }));
        };

        const yesterdayData = await getWorkTimeByCategory(yesterday);
        const dayBeforeYesterdayData = await getWorkTimeByCategory(dayBeforeYesterday);

        return {
            yesterday: yesterdayData,
            dayBeforeYesterday: dayBeforeYesterdayData,
        };
    }),

    /**
     * 昨日と一昨日の作業記録詳細を取得（誰がどの車でどんな作業をしたか）
     */
    getWorkDetailsYesterdayDayBefore: protectedProcedure.query(async () => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) {
            return {
                yesterday: [],
                dayBeforeYesterday: [],
            };
        }

        // JSTで現在の日時を取得
        const now = new Date();
        const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const jstParts = jstFormatter.formatToParts(now);
        const y = parseInt(jstParts.find(p => p.type === 'year')?.value || '0');
        const m = parseInt(jstParts.find(p => p.type === 'month')?.value || '1');
        const d = parseInt(jstParts.find(p => p.type === 'day')?.value || '1');
        const today = new Date(y, m - 1, d);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBeforeYesterday = new Date(today);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

        // 作業記録詳細を取得するSQLクエリ
        const getWorkDetails = async (targetDate: Date) => {
            const query = `
                SELECT 
                    wr.id,
                    wr.userId,
                    wr.vehicleId,
                    wr.processId,
                    wr.startTime,
                    wr.endTime,
                    wr.workDescription,
                    COALESCE(u.name, u.username) AS userName,
                    v.vehicleNumber,
                    v.customerName,
                    p.name AS processName,
                    p.minorCategory,
                    TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW())) AS durationMinutes,
                    TIME(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) AS startTimeStr,
                    TIME(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) AS endTimeStr
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                INNER JOIN \`users\` u ON u.id = wr.userId
                LEFT JOIN \`vehicles\` v ON v.id = wr.vehicleId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                    AND wr.endTime IS NOT NULL
                ORDER BY wr.startTime ASC
            `;

            const [rows]: any = await pool.execute(query, [
                targetDate.toISOString().slice(0, 10),
            ]);

            return (rows || []).map((row: any) => ({
                id: row.id,
                userId: row.userId,
                userName: row.userName,
                vehicleId: row.vehicleId,
                vehicleNumber: row.vehicleNumber || "不明",
                customerName: row.customerName,
                processId: row.processId,
                processName: row.processName,
                minorCategory: row.minorCategory,
                workDescription: row.workDescription,
                startTime: row.startTime,
                endTime: row.endTime,
                startTimeStr: row.startTimeStr ? row.startTimeStr.substring(0, 5) : null,
                endTimeStr: row.endTimeStr ? row.endTimeStr.substring(0, 5) : null,
                durationMinutes: Number(row.durationMinutes) || 0,
            }));
        };

        const yesterdayDetails = await getWorkDetails(yesterday);
        const dayBeforeYesterdayDetails = await getWorkDetails(dayBeforeYesterday);

        return {
            yesterday: yesterdayDetails,
            dayBeforeYesterday: dayBeforeYesterdayDetails,
        };
    }),

    /**
     * 12月の車両別作業時間一覧を取得（跨ぎ判定含む）
     */
    getVehicleWorkTimeByMonth: protectedProcedure
        .input(
            z.object({
                year: z.number(),
                month: z.number(), // 1-12
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            const pool = getPool();
            if (!db || !pool) {
                return [];
            }

            const { year, month } = input;
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59); // 月の最終日

            // 12月の各車両の作業時間を集計
            const query = `
                SELECT 
                    v.id AS vehicleId,
                    v.vehicleNumber,
                    v.customerName,
                    vt.name AS vehicleTypeName,
                    SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))) AS totalMinutes,
                    MIN(DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00'))) AS firstWorkDate,
                    MAX(DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00'))) AS lastWorkDate,
                    MIN(DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00'))) AS firstEndDate,
                    MAX(DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00'))) AS lastEndDate
                FROM \`workRecords\` wr
                INNER JOIN \`vehicles\` v ON v.id = wr.vehicleId
                LEFT JOIN \`vehicleTypes\` vt ON vt.id = v.vehicleTypeId
                WHERE 
                    (
                        (DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                        AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d'))
                        OR
                        (DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                        AND DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d'))
                    )
                    AND wr.endTime IS NOT NULL
                GROUP BY v.id, v.vehicleNumber, v.customerName, vt.name
                ORDER BY totalMinutes DESC
            `;

            const [rows]: any = await pool.execute(query, [
                monthStart.toISOString().slice(0, 10),
                monthEnd.toISOString().slice(0, 10),
                monthStart.toISOString().slice(0, 10),
                monthEnd.toISOString().slice(0, 10),
            ]);

            // 跨ぎ判定：作業記録が他の月に跨っているかチェック
            // 各車両の作業記録が12月以外の月にも跨っているかを確認
            const crossMonthCheckQuery = `
                SELECT DISTINCT
                    wr.vehicleId,
                    CASE 
                        WHEN MIN(DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00'))) < STR_TO_DATE(?, '%Y-%m-%d')
                        OR MAX(DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00'))) > STR_TO_DATE(?, '%Y-%m-%d')
                        THEN 1
                        ELSE 0
                    END AS isCrossMonth
                FROM \`workRecords\` wr
                WHERE 
                    (
                        (DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                        AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d'))
                        OR
                        (DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                        AND DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d'))
                    )
                    AND wr.endTime IS NOT NULL
                GROUP BY wr.vehicleId
            `;
            
            const [crossMonthRows]: any = await pool.execute(crossMonthCheckQuery, [
                monthStart.toISOString().slice(0, 10), // 12月開始日より前
                monthEnd.toISOString().slice(0, 10), // 12月終了日より後
                monthStart.toISOString().slice(0, 10),
                monthEnd.toISOString().slice(0, 10),
                monthStart.toISOString().slice(0, 10),
                monthEnd.toISOString().slice(0, 10),
            ]);
            
            const crossMonthMap = new Map<number, boolean>();
            (crossMonthRows || []).forEach((row: any) => {
                crossMonthMap.set(Number(row.vehicleId), Number(row.isCrossMonth) === 1);
            });
            
            const result = (rows || []).map((row: any) => {
                const vehicleId = Number(row.vehicleId);
                const isCrossMonth = crossMonthMap.get(vehicleId) || false;

                return {
                    vehicleId: Number(row.vehicleId),
                    vehicleNumber: row.vehicleNumber || "",
                    customerName: row.customerName || "",
                    vehicleTypeName: row.vehicleTypeName || "",
                    totalMinutes: Number(row.totalMinutes) || 0,
                    isCrossMonth: isCrossMonth,
                };
            });

            return result;
        }),
});

