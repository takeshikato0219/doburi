import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../_core/trpc";
import { getDb, schema } from "../db";
import { eq, desc } from "drizzle-orm";

export const notificationsRouter = createTRPCRouter({
    // 自分宛ての未読通知一覧
    getMyUnread: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "データベースに接続できません",
            });
        }

        const rows = await db
            .select()
            .from(schema.notifications)
            .where(
                eq(schema.notifications.userId, ctx.user!.id)
            )
            .orderBy(desc(schema.notifications.createdAt));

        // isRead が 'false' のものだけ返す
        return rows.filter((n) => n.isRead === "false");
    }),

    // 通知を既読にする
    markAsRead: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await db
                .update(schema.notifications)
                .set({ isRead: "true" } as any)
                .where(
                    eq(schema.notifications.id, input.id)
                );

            return { success: true };
        }),
});


