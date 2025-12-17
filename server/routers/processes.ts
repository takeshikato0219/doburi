import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure, subAdminProcedure } from "../_core/trpc";
import { getDb, schema } from "../db";
import { eq } from "drizzle-orm";

export const processesRouter = createTRPCRouter({
    // 工程一覧を取得
    list: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            return [];
        }

        const processes = await db
            .select()
            .from(schema.processes)
            .orderBy(schema.processes.displayOrder);

        return processes;
    }),

    // 工程を作成（管理者専用）
    create: subAdminProcedure
        .input(
            z.object({
                name: z.string(),
                description: z.string().optional(),
                majorCategory: z.string().optional(),
                minorCategory: z.string().optional(),
                displayOrder: z.number().optional(),
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

            await db.insert(schema.processes).values({
                name: input.name,
                description: input.description,
                majorCategory: input.majorCategory,
                minorCategory: input.minorCategory,
                displayOrder: input.displayOrder || 0,
            });

            return { success: true };
        }),

    // 工程を更新（管理者専用）
    update: subAdminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().optional(),
                description: z.string().optional(),
                majorCategory: z.string().optional(),
                minorCategory: z.string().optional(),
                displayOrder: z.number().optional(),
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
            if (input.majorCategory !== undefined) updateData.majorCategory = input.majorCategory;
            if (input.minorCategory !== undefined) updateData.minorCategory = input.minorCategory;
            if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;

            await db.update(schema.processes).set(updateData).where(eq(schema.processes.id, input.id));

            return { success: true };
        }),

    // 工程を削除（管理者専用）
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

            await db.delete(schema.processes).where(eq(schema.processes.id, input.id));

            return { success: true };
        }),

    // 表示順をまとめて更新（管理者専用）
    reorder: subAdminProcedure
        .input(
            z.object({
                items: z.array(
                    z.object({
                        id: z.number(),
                        displayOrder: z.number(),
                    })
                ),
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

            for (const item of input.items) {
                await db
                    .update(schema.processes)
                    .set({ displayOrder: item.displayOrder })
                    .where(eq(schema.processes.id, item.id));
            }

            return { success: true };
        }),
});

