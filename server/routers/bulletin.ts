import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../_core/trpc";
import { getDb, schema } from "../db";
import { sql } from "drizzle-orm";

// bulletinMessagesテーブルとexpireDaysカラムを安全に用意するヘルパー
async function ensureBulletinTable(db: any) {
    try {
        // 既存テーブルがあるか確認
        await db.execute(sql`SELECT 1 FROM \`bulletinMessages\` LIMIT 1`);
    } catch (error: any) {
        // drizzle の DrizzleQueryError 配下に本当の MySQL エラー情報が入っていることがある
        const msg = String(error?.message || "");
        const causeMsg = String(error?.cause?.message || "");
        const code = error?.code || error?.cause?.code || "";

        const combinedMsg = `${msg} ${causeMsg}`;

        // テーブルが無い場合は作成（DrizzleQueryError でラップされているケースも含めて判定）
        if (
            code === "ER_NO_SUCH_TABLE" ||
            combinedMsg.includes("ER_NO_SUCH_TABLE") ||
            combinedMsg.includes("doesn't exist") ||
            combinedMsg.includes("does not exist")
        ) {
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS \`bulletinMessages\` (
                    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    \`userId\` int NOT NULL,
                    \`message\` text NOT NULL,
                    \`expireDays\` int NOT NULL DEFAULT 5,
                    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);
            return;
        }
        // expireDaysカラムが無い場合は追加
        if (
            combinedMsg.includes("Unknown column 'expireDays'") ||
            combinedMsg.includes("unknown column 'expireDays'")
        ) {
            await db.execute(sql`
                ALTER TABLE \`bulletinMessages\`
                ADD COLUMN \`expireDays\` int NOT NULL DEFAULT 5
            `);
            return;
        }
        // createdAtカラムが無い場合は追加
        if (
            combinedMsg.includes("Unknown column 'createdAt'") ||
            combinedMsg.includes("unknown column 'createdAt'")
        ) {
            await db.execute(sql`
                ALTER TABLE \`bulletinMessages\`
                ADD COLUMN \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
            `);
            return;
        }
        throw error;
    }
}

export const bulletinRouter = createTRPCRouter({
    // 掲示板メッセージ作成（全ユーザー利用可）
    create: protectedProcedure
        .input(
            z.object({
                message: z.string().min(1).max(500),
                // 掲載期間（日数）: 1 / 3 / 5（指定なしの場合は5日）
                expireDays: z.number().int().optional(),
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

            // テーブルとカラムを安全に用意
            await ensureBulletinTable(db);

            try {
                // 掲載日数（1/3/5日）を指定（指定なしなら5日）
                const expireDays = input.expireDays && [1, 3, 5].includes(input.expireDays)
                    ? input.expireDays
                    : 5;

                await db.execute(
                    sql`INSERT INTO \`bulletinMessages\` (\`userId\`, \`message\`, \`expireDays\`) VALUES (${ctx.user!.id}, ${input.message}, ${expireDays})`
                );

                // 直近のIDを取得
                const [rows]: any = await db.execute(
                    sql`SELECT LAST_INSERT_ID() as id`
                );
                const id = rows && rows[0] ? rows[0].id : undefined;

                return { id };
            } catch (error: any) {
                console.error("[bulletin.create] insert error:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error?.message || "掲示板メッセージの作成に失敗しました",
                });
            }
        }),

    // 掲示板メッセージ削除（投稿者本人 or 管理者）
    delete: protectedProcedure
        .input(
            z.object({
                id: z.number().int(),
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

            await ensureBulletinTable(db);

            // 対象メッセージ取得
            const [rows]: any = await db.execute(
                sql`SELECT * FROM \`bulletinMessages\` WHERE \`id\` = ${input.id} LIMIT 1`
            );
            const msg = rows && rows[0];
            if (!msg) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "メッセージが見つかりません",
                });
            }

            // 投稿者本人か管理者のみ削除可能
            if (msg.userId !== ctx.user!.id && ctx.user!.role !== "admin") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "このメッセージを削除する権限がありません",
                });
            }

            await db.execute(
                sql`DELETE FROM \`bulletinMessages\` WHERE \`id\` = ${input.id}`
            );

            return { success: true };
        }),

    // 最新の掲示板メッセージを取得（上位20件）
    list: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "データベースに接続できません",
            });
        }

        // テーブルとカラムを安全に用意
        await ensureBulletinTable(db);

        // 掲載期限を過ぎたメッセージを削除
        try {
            await db.execute(
                sql`
                    DELETE FROM \`bulletinMessages\`
                    WHERE TIMESTAMPDIFF(DAY, \`createdAt\`, NOW()) >= \`expireDays\`
                `
            );
        } catch (error) {
            console.error("[bulletin.list] 古いメッセージの削除に失敗しました:", error);
        }

        // 掲載期限内のメッセージのみ取得（新しい順に20件）
        let messages: any[] = [];
        try {
            const [rows]: any = await db.execute(
                sql`
                    SELECT * FROM \`bulletinMessages\`
                    WHERE TIMESTAMPDIFF(DAY, \`createdAt\`, NOW()) < \`expireDays\`
                    ORDER BY \`createdAt\` DESC
                    LIMIT 20
                `
            );
            messages = rows || [];
        } catch (error) {
            console.error("[bulletin.list] select error:", error);
            messages = [];
        }

        // 投稿者情報を取得
        const userIds = [...new Set(messages.map((m) => m.userId))];
        let users: any[] = [];
        if (userIds.length > 0) {
            const { inArray } = await import("drizzle-orm");
            const { selectUsersSafely } = await import("../db");
            users = await selectUsersSafely(db, inArray(schema.users.id, userIds));
        }
        const userMap = new Map(users.map((u) => [u.id, u]));

        return messages.map((m) => ({
            ...m,
            user: userMap.get(m.userId) || null,
        }));
    }),
});


