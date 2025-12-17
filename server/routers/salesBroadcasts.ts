import { createTRPCRouter, adminProcedure, subAdminProcedure, protectedProcedure } from "../_core/trpc";
import { getDb, schema } from "../db";
import { eq, and, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addDays } from "date-fns";

export const salesBroadcastsRouter = createTRPCRouter({
    // 営業（準管理者以上）からの拡散を作成（元の仕様に戻す）
    create: subAdminProcedure
        .input(
            z.object({
                vehicleId: z.number(),
                message: z.string().min(1),
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

            // 7日後の日時を設定
            const expiresAt = addDays(new Date(), 7);

            const [result] = await db
                .insert(schema.salesBroadcasts)
                .values({
                    vehicleId: input.vehicleId,
                    createdBy: ctx.user!.id,
                    message: input.message,
                    expiresAt,
                })
                .$returningId();

            // 拡散項目を車両のメモにも保存（車ごとのメモとして蓄積）
            try {
                await db.insert(schema.vehicleMemos).values({
                    vehicleId: input.vehicleId,
                    userId: ctx.user!.id,
                    content: `【拡散項目】${input.message}`,
                });
            } catch (error) {
                console.error("[salesBroadcasts.create] Failed to add memo from broadcast:", error);
            }

            return { id: result };
        }),

    // 未読の営業からの拡散を取得（自分が読んでいないもの）
    getUnread: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "データベースに接続できません",
            });
        }

        // 有効期限内の拡散を取得
        const now = new Date();
        const broadcasts = await db
            .select()
            .from(schema.salesBroadcasts)
            .where(gt(schema.salesBroadcasts.expiresAt, now));

        // 自分が読んだ拡散IDを取得
        const readBroadcasts = await db
            .select()
            .from(schema.salesBroadcastReads)
            .where(eq(schema.salesBroadcastReads.userId, ctx.user!.id));

        const readBroadcastIds = new Set(readBroadcasts.map((r) => r.broadcastId));

        // 未読の拡散をフィルタリング
        const unreadBroadcasts = broadcasts.filter((b) => !readBroadcastIds.has(b.id));

        // 車両情報と作成者情報を取得
        const vehicleIds = [...new Set(unreadBroadcasts.map((b) => b.vehicleId))];
        const userIds = [...new Set(unreadBroadcasts.map((b) => b.createdBy))];

        let vehicles: any[] = [];
        let users: any[] = [];
        let vehicleTypes: any[] = [];
        if (vehicleIds.length > 0) {
            const { inArray } = await import("drizzle-orm");
            vehicles = await db.select().from(schema.vehicles).where(inArray(schema.vehicles.id, vehicleIds));

            // 車種情報を取得
            const vehicleTypeIds = [...new Set(vehicles.map((v) => v.vehicleTypeId))];
            if (vehicleTypeIds.length > 0) {
                vehicleTypes = await db
                    .select()
                    .from(schema.vehicleTypes)
                    .where(inArray(schema.vehicleTypes.id, vehicleTypeIds));
            }
        }
        if (userIds.length > 0) {
            const { inArray } = await import("drizzle-orm");
            const { selectUsersSafely } = await import("../db");
            users = await selectUsersSafely(db, inArray(schema.users.id, userIds));
        }

        const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
        const userMap = new Map(users.map((u) => [u.id, u]));
        const vehicleTypeMap = new Map(vehicleTypes.map((vt) => [vt.id, vt]));

        return unreadBroadcasts.map((broadcast) => {
            const vehicle = vehicleMap.get(broadcast.vehicleId);
            const vehicleType = vehicle ? vehicleTypeMap.get(vehicle.vehicleTypeId) : null;
            return {
                ...broadcast,
                vehicle: vehicle ? { ...vehicle, vehicleType } : null,
                createdByUser: userMap.get(broadcast.createdBy),
            };
        });
    }),

    // 拡散を既読にする
    markAsRead: protectedProcedure
        .input(z.object({ broadcastId: z.number() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            // 既に読んでいるか確認
            const existing = await db
                .select()
                .from(schema.salesBroadcastReads)
                .where(
                    and(
                        eq(schema.salesBroadcastReads.broadcastId, input.broadcastId),
                        eq(schema.salesBroadcastReads.userId, ctx.user!.id)
                    )
                );

            if (existing.length === 0) {
                await db.insert(schema.salesBroadcastReads).values({
                    broadcastId: input.broadcastId,
                    userId: ctx.user!.id,
                });
            }

            return { success: true };
        }),

    // 期限切れの拡散を削除（定期実行用、管理者のみ）
    deleteExpired: subAdminProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "データベースに接続できません",
            });
        }

        const now = new Date();
        const { lt } = await import("drizzle-orm");
        const expiredBroadcasts = await db
            .select()
            .from(schema.salesBroadcasts)
            .where(lt(schema.salesBroadcasts.expiresAt, now));

        if (expiredBroadcasts.length > 0) {
            const expiredIds = expiredBroadcasts.map((b) => b.id);
            const { inArray } = await import("drizzle-orm");

            // 既読記録も削除
            await db.delete(schema.salesBroadcastReads).where(inArray(schema.salesBroadcastReads.broadcastId, expiredIds));

            // 拡散を削除
            await db.delete(schema.salesBroadcasts).where(inArray(schema.salesBroadcasts.id, expiredIds));
        }

        return { deleted: expiredBroadcasts.length };
    }),
});

