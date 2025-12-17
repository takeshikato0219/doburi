import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createTRPCRouter, adminProcedure, subAdminProcedure } from "../_core/trpc";
import { getDb, getPool, schema } from "../db";
import { eq } from "drizzle-orm";

export const usersRouter = createTRPCRouter({
    // 全ユーザー一覧を取得（管理者専用）
    list: adminProcedure.query(async () => {
        const db = await getDb();
        if (!db) {
            console.warn("[users.list] DB is null");
            return [];
        }

        try {
            // selectUsersSafely は db.ts から動的 import する
            const { selectUsersSafely } = await import("../db");
            const users = await selectUsersSafely(db);

            console.log("[users.list] Loaded users from DB:", users.length);

            // id 昇順にソートして、フロント用に整形
            return users
                .sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0))
                .map((u: any) => ({
                    id: u.id,
                    username: u.username,
                    name: u.name ?? null,
                    role: u.role ?? "field_worker",
                    category: u.category ?? null,
                }));
        } catch (error: any) {
            console.error("[users.list] List error:", error);
            return [];
        }
    }),

    // ユーザーを作成（管理者専用）
    create: adminProcedure
        .input(
            z.object({
                username: z.string(),
                password: z.string(),
                name: z.string().optional(), // 表示名（社員名）
                role: z
                    .enum(["field_worker", "sales_office", "sub_admin", "admin", "external"])
                    .default("field_worker"),
                category: z.preprocess(
                    (val) => {
                        // 空文字列、undefined、または無効な値の場合はnull
                        if (!val || val === "" || (val !== "elephant" && val !== "squirrel")) {
                            return null;
                        }
                        return val;
                    },
                    z.enum(["elephant", "squirrel"]).nullable().optional()
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

            // role ENUMにexternalが含まれているか確認し、含まれていない場合は追加
            const pool = getPool();
            if (pool) {
                try {
                    const [columns]: any = await pool.execute(
                        `SHOW COLUMNS FROM \`users\` WHERE Field = 'role'`
                    );
                    if (columns.length > 0) {
                        const columnType = columns[0].Type;
                        if (!columnType.includes("external")) {
                            await pool.execute(
                                `ALTER TABLE \`users\` MODIFY COLUMN \`role\` ENUM('field_worker', 'sales_office', 'sub_admin', 'admin', 'external') NOT NULL DEFAULT 'field_worker'`
                            );
                            console.log("[users.create] Added 'external' to role ENUM");
                        }
                    }
                } catch (alterError: any) {
                    console.log(
                        "[users.create] Role ENUM update may have been skipped:",
                        alterError?.message
                    );
                }
            }

            // ユーザー名の重複チェック
            const existing = await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.username, input.username))
                .limit(1);

            if (existing.length > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "このユーザー名は既に使用されています",
                });
            }

            const hashedPassword = await bcrypt.hash(input.password, 10);

            // categoryの値を決定
            let categoryValue: "elephant" | "squirrel" | undefined = undefined;
            if (input.role !== "external") {
                const category = input.category;
                if (category === "elephant" || category === "squirrel") {
                    categoryValue = category;
                }
            }

            // external または category 未指定のときは生 SQL で category を省く
            if (input.role === "external" || categoryValue === undefined) {
                const pool2 = getPool();
                if (pool2) {
                    await pool2.execute(
                        `INSERT INTO \`users\` (\`username\`, \`password\`, \`name\`, \`role\`, \`createdAt\`, \`updatedAt\`) VALUES (?, ?, ?, ?, NOW(), NOW())`,
                        [input.username, hashedPassword, input.name || null, input.role]
                    );
                } else {
                    await db.insert(schema.users).values({
                        username: input.username,
                        password: hashedPassword,
                        name: input.name || null,
                        role: input.role,
                        category: null,
                    });
                }
            } else {
                await db.insert(schema.users).values({
                    username: input.username,
                    password: hashedPassword,
                    name: input.name || null,
                    role: input.role,
                    category: categoryValue,
                });
            }

            return { success: true };
        }),

    // ユーザーを更新（管理者専用）
    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                username: z.string().optional(),
                password: z.preprocess(
                    (val) => {
                        // 空文字列の場合は undefined に変換（パスワードを変更しない）
                        if (val === "" || val === null) {
                            return undefined;
                        }
                        return val;
                    },
                    z.string().min(1, "パスワードは1文字以上である必要があります").optional()
                ),
                name: z.string().optional(), // 表示名（社員名）
                role: z
                    .enum(["field_worker", "sales_office", "sub_admin", "admin", "external"])
                    .optional(),
                category: z.preprocess(
                    (val) => {
                        // 空文字列、undefined、または無効な値の場合はnull
                        if (!val || val === "" || (val !== "elephant" && val !== "squirrel")) {
                            return null;
                        }
                        return val;
                    },
                    z.enum(["elephant", "squirrel"]).nullable().optional()
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

            // ユーザー名の重複チェック（変更する場合）
            if (input.username !== undefined) {
                const existing = await db
                    .select({ id: schema.users.id, username: schema.users.username })
                    .from(schema.users)
                    .where(eq(schema.users.username, input.username))
                    .limit(1);

                if (existing.length > 0 && existing[0].id !== input.id) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "このユーザー名は既に使用されています",
                    });
                }
            }

            const updateData: any = {};
            if (input.username !== undefined) updateData.username = input.username;
            if (input.password !== undefined && input.password.trim() !== "") {
                // パスワードが空文字列でない場合のみ更新
                console.log(`[users.update] パスワードを更新します: userId=${input.id}`);
                updateData.password = await bcrypt.hash(input.password.trim(), 10);
            } else if (input.password !== undefined) {
                console.log(`[users.update] パスワードは空文字列のため更新しません: userId=${input.id}`);
            }
            if (input.name !== undefined) updateData.name = input.name;
            if (input.role !== undefined) updateData.role = input.role;

            // category の処理
            if (input.category !== undefined) {
                if (input.role === "external") {
                    // external ロールは category を送らない
                } else {
                    if (input.category === "elephant" || input.category === "squirrel") {
                        updateData.category = input.category;
                    }
                }
            }

            if (Object.keys(updateData).length > 0) {
                console.log(`[users.update] 更新データ:`, Object.keys(updateData));
                await db
                    .update(schema.users)
                    .set(updateData)
                    .where(eq(schema.users.id, input.id));
                console.log(`[users.update] ✅ ユーザーを更新しました: userId=${input.id}`);
            } else {
                console.log(`[users.update] ⚠️ 更新するデータがありません: userId=${input.id}`);
            }

            return { success: true };
        }),

    // ユーザーを削除（管理者専用）
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

            await db.delete(schema.users).where(eq(schema.users.id, input.id));

            return { success: true };
        }),
});
