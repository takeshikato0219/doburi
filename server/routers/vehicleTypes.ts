import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure, subAdminProcedure } from "../_core/trpc";
import { getDb, schema } from "../db";
import { eq } from "drizzle-orm";

export const vehicleTypesRouter = createTRPCRouter({
    // 車種一覧を取得
    list: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            return [];
        }

        const vehicleTypes = await db.select().from(schema.vehicleTypes);

        return vehicleTypes;
    }),

    // 車種を作成（管理者専用）
    create: subAdminProcedure
        .input(
            z.object({
                name: z.string(),
                description: z.string().optional(),
                standardTotalMinutes: z.number().optional(),
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

            await db.insert(schema.vehicleTypes).values({
                name: input.name,
                description: input.description,
                standardTotalMinutes: input.standardTotalMinutes,
            });

            return { success: true };
        }),

    // 車種を更新（管理者専用）
    update: subAdminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().optional(),
                description: z.string().optional(),
                standardTotalMinutes: z.number().optional(),
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
            if (input.description !== undefined) updateData.description = input.description;
            if (input.standardTotalMinutes !== undefined)
                updateData.standardTotalMinutes = input.standardTotalMinutes;

            await db
                .update(schema.vehicleTypes)
                .set(updateData)
                .where(eq(schema.vehicleTypes.id, input.id));

            return { success: true };
        }),

    // 車種を削除（管理者専用）
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

            await db.delete(schema.vehicleTypes).where(eq(schema.vehicleTypes.id, input.id));

            return { success: true };
        }),
});

