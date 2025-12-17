import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure, subAdminProcedure } from "../_core/trpc";
import { getDb, schema } from "../db";
import { eq } from "drizzle-orm";

export const breakTimesRouter = createTRPCRouter({
    // 休憩時間一覧を取得
    list: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            return [];
        }

        const breakTimes = await db
            .select()
            .from(schema.breakTimes)
            .orderBy(schema.breakTimes.startTime);

        return breakTimes;
    }),

    // 休憩時間を作成（管理者専用）
    create: adminProcedure
        .input(
            z.object({
                name: z.string().min(1),
                startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM形式
                endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM形式
                durationMinutes: z.number().int().min(0),
                isActive: z.enum(["true", "false"]).default("true"),
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

            await db.insert(schema.breakTimes).values({
                name: input.name,
                startTime: input.startTime,
                endTime: input.endTime,
                durationMinutes: input.durationMinutes,
                isActive: input.isActive,
            });

            return { success: true };
        }),

    // 休憩時間を更新（管理者専用）
    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().min(1).optional(),
                startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
                endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
                durationMinutes: z.number().int().min(0).optional(),
                isActive: z.enum(["true", "false"]).optional(),
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
            if (input.name !== undefined) updateData.name = input.name;
            if (input.startTime !== undefined) updateData.startTime = input.startTime;
            if (input.endTime !== undefined) updateData.endTime = input.endTime;
            if (input.durationMinutes !== undefined) updateData.durationMinutes = input.durationMinutes;
            if (input.isActive !== undefined) updateData.isActive = input.isActive;

            await db
                .update(schema.breakTimes)
                .set(updateData)
                .where(eq(schema.breakTimes.id, input.id));

            return { success: true };
        }),

    // 休憩時間を削除（管理者専用）
    delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            try {
                // 削除前にデータの存在確認
                const [breakTime] = await db
                    .select()
                    .from(schema.breakTimes)
                    .where(eq(schema.breakTimes.id, input.id))
                    .limit(1);

                if (!breakTime) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "休憩時間が見つかりません",
                    });
                }

                // 削除実行
            await db.delete(schema.breakTimes).where(eq(schema.breakTimes.id, input.id));

            return { success: true };
            } catch (error: any) {
                console.error("[breakTimes.delete] エラー:", error);
                
                // 既にTRPCErrorの場合はそのままスロー
                if (error instanceof TRPCError) {
                    throw error;
                }

                // データベースエラーの場合
                if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.code === '23000') {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "この休憩時間は他のデータで使用されているため削除できません",
                    });
                }

                // その他のエラー
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: `休憩時間の削除に失敗しました: ${error?.message || String(error)}`,
                });
            }
        }),
});

