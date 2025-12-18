import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, subAdminProcedure } from "../_core/trpc";
import { getDb, schema } from "../db";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";
import { startOfDay, endOfDay } from "date-fns";

// JSTで現在の日時を取得するヘルパー関数
function getJSTNow(): { year: number; month: number; day: number } {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    return {
        year: parseInt(parts.find(p => p.type === 'year')?.value || '0'),
        month: parseInt(parts.find(p => p.type === 'month')?.value || '1'),
        day: parseInt(parts.find(p => p.type === 'day')?.value || '1'),
    };
}

export const workRecordsRouter = createTRPCRouter({
    // 作業中の記録を取得
    getActive: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
            return [];
        }

        const records = await db
            .select({
                id: schema.workRecords.id,
                vehicleId: schema.workRecords.vehicleId,
                processId: schema.workRecords.processId,
                startTime: schema.workRecords.startTime,
            })
            .from(schema.workRecords)
            .where(
                and(
                    eq(schema.workRecords.userId, ctx.user!.id),
                    isNull(schema.workRecords.endTime)
                )
            );

        // TODO: 車両情報、工程情報を結合

        return records.map((r) => {
            // DateオブジェクトはUTCとして保存されているが、クライアント側でJSTとして表示される
            // 9時間を加算するのは間違い（Dateオブジェクトは常にUTCとして扱われるため）
            // クライアント側でIntl.DateTimeFormatを使ってJSTとして表示する
            return {
                id: r.id,
                vehicleId: r.vehicleId,
                vehicleNumber: "未取得",
                vehicleType: "未取得",
                processId: r.processId,
                processName: "未取得",
                startTime: r.startTime,
            };
        });
    }),

    // 1週間分の作業記録を取得（今日から7日前まで、またはサンプルデータの日付範囲）
    getTodayRecords: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
            console.warn("[workRecords.getTodayRecords] Database connection failed");
            return [];
        }

        // 1週間分（今日から7日前まで）の範囲を取得（JSTで取得）
        const jstNow = getJSTNow();
        const today = new Date(jstNow.year, jstNow.month - 1, jstNow.day);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const start = startOfDay(weekAgo); // 7日前の開始
        const end = endOfDay(today); // 今日の終了

        // サンプルデータの日付範囲（2024年12月）も含める
        const sampleDataStart = new Date("2024-12-01T00:00:00+09:00");
        const sampleDataEnd = new Date("2024-12-31T23:59:59+09:00");
        
        // より広い範囲で取得（今日の範囲 + サンプルデータの範囲）
        const actualStart = start < sampleDataStart ? start : sampleDataStart;
        const actualEnd = end > sampleDataEnd ? end : sampleDataEnd;

        console.log(`[workRecords.getTodayRecords] Fetching records from ${actualStart.toISOString()} to ${actualEnd.toISOString()}`);

        const records = await db
            .select()
            .from(schema.workRecords)
            .where(
                and(
                    eq(schema.workRecords.userId, ctx.user!.id),
                    gte(schema.workRecords.startTime, actualStart),
                    lte(schema.workRecords.startTime, actualEnd)
                )
            )
            .orderBy(schema.workRecords.startTime);

        console.log(`[workRecords.getTodayRecords] Found ${records.length} records`);

        // 車両情報、工程情報を取得
        const vehicles = await db.select().from(schema.vehicles);
        const processes = await db.select().from(schema.processes);

        const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
        const processMap = new Map(processes.map((p) => [p.id, p]));

        return records.map((r) => {
            const vehicle = vehicleMap.get(r.vehicleId);
            const process = processMap.get(r.processId);

            // DateオブジェクトはUTCとして保存されているが、クライアント側でJSTとして表示される
            // 9時間を加算するのは間違い（Dateオブジェクトは常にUTCとして扱われるため）
            // クライアント側でIntl.DateTimeFormatを使ってJSTとして表示する

            return {
                id: r.id,
                vehicleId: r.vehicleId,
                vehicleNumber: vehicle?.vehicleNumber || "不明",
                processId: r.processId,
                processName: process?.name || "不明",
                startTime: r.startTime,
                endTime: r.endTime,
                durationMinutes: r.endTime
                    ? Math.floor((r.endTime.getTime() - r.startTime.getTime()) / 1000 / 60)
                    : null,
                workDescription: r.workDescription,
            };
        });
    }),

    // 作業記録を作成
    create: protectedProcedure
        .input(
            z.object({
                userId: z.number(),
                vehicleId: z.number(),
                processId: z.number(),
                startTime: z.string(),
                endTime: z.string().optional(),
                workDescription: z.string().optional(),
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

            // 管理者のみ他のユーザーの記録を作成可能
            if (input.userId !== ctx.user!.id && ctx.user!.role !== "admin" && ctx.user!.role !== "sub_admin") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "権限がありません",
                });
            }

            try {
                // JSTタイムゾーン（+09:00）が含まれているISO文字列を正しくパース
                // 例: "2025-12-02T09:00:00+09:00" → JSTの2025-12-02 09:00:00として解釈
                // new Date()は自動的にUTCに変換するので、そのまま使用する
                const startTimeDate = new Date(input.startTime);
                const endTimeDate = input.endTime ? new Date(input.endTime) : null;

                // パースされた時刻が正しいか確認（JSTで表示）
                const startTimeJST = startTimeDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                const endTimeJST = endTimeDate ? endTimeDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : null;

                console.log("[workRecords.create] 作業記録を追加:", {
                    userId: input.userId,
                    vehicleId: input.vehicleId,
                    processId: input.processId,
                    startTimeInput: input.startTime,
                    startTimeDate: startTimeDate.toISOString(),
                    startTimeDateUTC: startTimeDate.toUTCString(),
                    startTimeJST: startTimeJST,
                    endTimeInput: input.endTime,
                    endTimeDate: endTimeDate?.toISOString(),
                    endTimeDateUTC: endTimeDate?.toUTCString(),
                    endTimeJST: endTimeJST,
                });

                // MySQLのtimestamp型はUTCとして保存される
                // new Date()でパースした時刻は既にUTCとして扱われているので、そのまま保存
                await db.insert(schema.workRecords).values({
                    userId: input.userId,
                    vehicleId: input.vehicleId,
                    processId: input.processId,
                    startTime: startTimeDate,
                    endTime: endTimeDate,
                    workDescription: input.workDescription,
                });

                // 挿入されたレコードを取得（最新のレコードを取得）
                const [inserted] = await db
                    .select()
                    .from(schema.workRecords)
                    .where(
                        and(
                            eq(schema.workRecords.userId, input.userId),
                            eq(schema.workRecords.vehicleId, input.vehicleId),
                            eq(schema.workRecords.processId, input.processId)
                        )
                    )
                    .orderBy(desc(schema.workRecords.id))
                    .limit(1);

                if (!inserted) {
                    console.error(`[workRecords.create] 警告: 挿入した作業記録が見つかりません`);
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "作業記録の作成に成功しましたが、データの確認に失敗しました",
                    });
                }

                console.log(`[workRecords.create] 作業記録を作成しました: ユーザーID=${input.userId}, 車両ID=${input.vehicleId}, 記録ID=${inserted.id}`);
                console.log(`[workRecords.create] 保存されたstartTime:`, {
                    id: inserted.id,
                    startTime: inserted.startTime,
                    startTimeISO: inserted.startTime?.toISOString(),
                    startTimeJST: inserted.startTime?.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
                    startDate: inserted.startTime ? new Date(inserted.startTime).toISOString().split('T')[0] : null,
                });

                // 作成されたレコードの詳細情報を取得
                const vehicles = await db.select().from(schema.vehicles);
                const processes = await db.select().from(schema.processes);
                const vehicle = vehicles.find(v => v.id === inserted.vehicleId);
                const process = processes.find(p => p.id === inserted.processId);

                return {
                    id: inserted.id,
                    startTime: inserted.startTime,
                    endTime: inserted.endTime,
                    vehicleId: inserted.vehicleId,
                    processId: inserted.processId,
                    vehicleNumber: vehicle?.vehicleNumber || "不明",
                    customerName: vehicle?.customerName || null,
                    processName: process?.name || "不明",
                    workDescription: inserted.workDescription || null,
                    durationMinutes: inserted.endTime
                        ? Math.floor((new Date(inserted.endTime).getTime() - new Date(inserted.startTime).getTime()) / (1000 * 60))
                        : 0,
                };
            } catch (error: any) {
                console.error(`[workRecords.create] エラー: 作業記録作成に失敗しました`, {
                    error: error,
                    message: error?.message,
                    stack: error?.stack,
                    code: error?.code,
                    input: {
                        userId: input.userId,
                        vehicleId: input.vehicleId,
                        processId: input.processId,
                        startTime: input.startTime,
                        endTime: input.endTime,
                    },
                });
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error?.message || "作業記録の作成に失敗しました",
                    cause: error,
                });
            }
        }),

    // 全スタッフの作業記録を取得（準管理者以上）
    getAllRecords: subAdminProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            return [];
        }

        const records = await db
            .select()
            .from(schema.workRecords)
            .orderBy(schema.workRecords.startTime);

        // ユーザー、車両、工程情報を取得（nameやcategoryカラムが存在しない場合に対応）
        const { selectUsersSafely } = await import("../db");
        const users = await selectUsersSafely(db);
        const vehicles = await db.select().from(schema.vehicles);
        const processes = await db.select().from(schema.processes);

        const userMap = new Map(users.map((u) => [u.id, u]));
        const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
        const processMap = new Map(processes.map((p) => [p.id, p]));

        return records.map((r) => {
            const user = userMap.get(r.userId);
            const vehicle = vehicleMap.get(r.vehicleId);
            const process = processMap.get(r.processId);

            // DateオブジェクトはUTCとして保存されているが、クライアント側でJSTとして表示される
            // 9時間を加算するのは間違い（Dateオブジェクトは常にUTCとして扱われるため）
            // クライアント側でIntl.DateTimeFormatを使ってJSTとして表示する

            return {
                id: r.id,
                userId: r.userId,
                userName: user?.name || user?.username || "不明",
                vehicleId: r.vehicleId,
                vehicleNumber: vehicle?.vehicleNumber || "不明",
                processId: r.processId,
                processName: process?.name || "不明",
                startTime: r.startTime,
                endTime: r.endTime,
                durationMinutes: r.endTime
                    ? Math.floor((r.endTime.getTime() - r.startTime.getTime()) / 1000 / 60)
                    : null,
                workDescription: r.workDescription,
            };
        });
    }),

    // 作業記録を更新（準管理者以上）
    update: subAdminProcedure
        .input(
            z.object({
                id: z.number(),
                vehicleId: z.number().optional(),
                processId: z.number().optional(),
                startTime: z.string().optional(),
                endTime: z.string().optional(),
                workDescription: z.string().optional(),
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

            const updateData: any = {};
            if (input.vehicleId !== undefined) updateData.vehicleId = input.vehicleId;
            if (input.processId !== undefined) updateData.processId = input.processId;
            if (input.startTime !== undefined) updateData.startTime = new Date(input.startTime);
            if (input.endTime !== undefined) updateData.endTime = input.endTime ? new Date(input.endTime) : null;
            if (input.workDescription !== undefined) updateData.workDescription = input.workDescription;

            await db
                .update(schema.workRecords)
                .set(updateData)
                .where(eq(schema.workRecords.id, input.id));

            return { success: true };
        }),

    // 自分の作業記録を更新（一般ユーザー用）
    updateMyRecord: protectedProcedure
        .input(
            z.object({
                id: z.number(),
                vehicleId: z.number().optional(),
                processId: z.number().optional(),
                startTime: z.string().optional(),
                endTime: z.string().optional(),
                workDescription: z.string().optional(),
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

            // 自分の記録か確認
            const [record] = await db
                .select()
                .from(schema.workRecords)
                .where(eq(schema.workRecords.id, input.id))
                .limit(1);

            if (!record) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "作業記録が見つかりません",
                });
            }

            // 準管理者以上はいつでも編集可能
            if (record.userId !== ctx.user!.id && ctx.user!.role !== "admin" && ctx.user!.role !== "sub_admin") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "自分の記録のみ編集できます",
                });
            }

            // 一般ユーザーは「1週間以内」の記録のみ編集可能
            if (record.userId === ctx.user!.id && ctx.user!.role === "field_worker") {
                // JSTで今日の日付を取得
                const jstNow = getJSTNow();
                const today = new Date(jstNow.year, jstNow.month - 1, jstNow.day);
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                const limit = startOfDay(weekAgo); // 7日前の0時

                if (record.startTime < limit) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "自分の作業記録は「1週間以内」の分のみ編集できます",
                    });
                }
            }

            const updateData: any = {};
            if (input.vehicleId !== undefined) updateData.vehicleId = input.vehicleId;
            if (input.processId !== undefined) updateData.processId = input.processId;
            if (input.startTime !== undefined) updateData.startTime = new Date(input.startTime);
            if (input.endTime !== undefined) updateData.endTime = input.endTime ? new Date(input.endTime) : null;
            if (input.workDescription !== undefined) updateData.workDescription = input.workDescription;

            await db
                .update(schema.workRecords)
                .set(updateData)
                .where(eq(schema.workRecords.id, input.id));

            console.log(`[workRecords.updateMyRecord] 作業記録を更新しました: ID=${input.id}, 更新項目=${Object.keys(updateData).join(", ")}`);

            // 更新後のデータを確認
            const [updated] = await db
                .select()
                .from(schema.workRecords)
                .where(eq(schema.workRecords.id, input.id))
                .limit(1);

            if (!updated) {
                console.error(`[workRecords.updateMyRecord] 警告: 更新した作業記録が見つかりません: ID=${input.id}`);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "作業記録の更新に成功しましたが、データの確認に失敗しました",
                });
            }

            return { success: true };
        }),

    // 作業記録を削除（準管理者以上）
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

            // 削除前にデータを確認
            const [record] = await db
                .select()
                .from(schema.workRecords)
                .where(eq(schema.workRecords.id, input.id))
                .limit(1);

            if (!record) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "作業記録が見つかりません",
                });
            }

            console.log(`[workRecords.delete] 作業記録を削除します: ID=${input.id}, ユーザーID=${record.userId}, 車両ID=${record.vehicleId}`);

            await db.delete(schema.workRecords).where(eq(schema.workRecords.id, input.id));

            console.log(`[workRecords.delete] 作業記録を削除しました: ID=${input.id}`);

            return { success: true };
        }),

    // 自分の作業記録を削除（一般ユーザー用）
    deleteMyRecord: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            // 自分の記録か確認
            const [record] = await db
                .select()
                .from(schema.workRecords)
                .where(eq(schema.workRecords.id, input.id))
                .limit(1);

            if (!record) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "作業記録が見つかりません",
                });
            }

            // 準管理者以上はいつでも削除可能
            if (record.userId !== ctx.user!.id && ctx.user!.role !== "admin" && ctx.user!.role !== "sub_admin") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "自分の記録のみ削除できます",
                });
            }

            // 一般ユーザーは「1週間以内」の記録のみ削除可能
            if (record.userId === ctx.user!.id && ctx.user!.role === "field_worker") {
                // JSTで今日の日付を取得
                const jstNow = getJSTNow();
                const today = new Date(jstNow.year, jstNow.month - 1, jstNow.day);
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                const limit = startOfDay(weekAgo); // 7日前の0時

                if (record.startTime < limit) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "自分の作業記録は「1週間以内」の分のみ削除できます",
                    });
                }
            }

            console.log(`[workRecords.deleteMyRecord] 作業記録を削除します: ID=${input.id}, ユーザーID=${record.userId}, 車両ID=${record.vehicleId}`);

            await db.delete(schema.workRecords).where(eq(schema.workRecords.id, input.id));

            console.log(`[workRecords.deleteMyRecord] 作業記録を削除しました: ID=${input.id}`);

            return { success: true };
        }),

    // 作業を開始
    start: protectedProcedure
        .input(
            z.object({
                vehicleId: z.number(),
                processId: z.number(),
                workDescription: z.string().optional(),
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

            // 既に作業中の記録がないか確認
            const activeRecords = await db
                .select()
                .from(schema.workRecords)
                .where(
                    and(
                        eq(schema.workRecords.userId, ctx.user!.id),
                        isNull(schema.workRecords.endTime)
                    )
                );

            if (activeRecords.length > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "既に作業中の記録があります。先に作業を終了してください。",
                });
            }

            await db.insert(schema.workRecords).values({
                userId: ctx.user!.id,
                vehicleId: input.vehicleId,
                processId: input.processId,
                startTime: new Date(),
                endTime: null,
                workDescription: input.workDescription,
            });

            // 挿入されたレコードを取得（最新のレコードを取得）
            const [inserted] = await db
                .select()
                .from(schema.workRecords)
                .where(
                    and(
                        eq(schema.workRecords.userId, ctx.user!.id),
                        eq(schema.workRecords.vehicleId, input.vehicleId),
                        eq(schema.workRecords.processId, input.processId),
                        isNull(schema.workRecords.endTime)
                    )
                )
                .orderBy(schema.workRecords.id)
                .limit(1);

            if (!inserted) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "作業記録の作成に成功しましたが、データの確認に失敗しました",
                });
            }

            return {
                id: inserted.id,
                startTime: inserted.startTime,
            };
        }),

    // 作業を終了
    stop: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            // 記録を取得して確認
            const [record] = await db
                .select()
                .from(schema.workRecords)
                .where(eq(schema.workRecords.id, input.id))
                .limit(1);

            if (!record) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "作業記録が見つかりません",
                });
            }

            // 自分の記録か、管理者か確認
            if (record.userId !== ctx.user!.id && ctx.user!.role !== "admin" && ctx.user!.role !== "sub_admin") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "権限がありません",
                });
            }

            const endTime = new Date();
            const durationMinutes = Math.floor(
                (endTime.getTime() - record.startTime.getTime()) / 1000 / 60
            );

            await db
                .update(schema.workRecords)
                .set({
                    endTime,
                })
                .where(eq(schema.workRecords.id, input.id));

            return {
                id: input.id,
                endTime,
                durationMinutes,
            };
        }),
});

