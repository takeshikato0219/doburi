import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createTRPCRouter, publicProcedure } from "../_core/trpc";
import { getUserByUsername, getPool } from "../db";
import { setAuthCookie, clearAuthCookie } from "../_core/cookies";

export const authRouter = createTRPCRouter({
    login: publicProcedure
        .input(
            z.object({
                username: z.string(),
                password: z.string(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            try {
                console.log("[Auth] ========== Login attempt ==========");
                console.log("[Auth] Username:", input.username);
                console.log("[Auth] Password length:", input.password?.length || 0);

                // ユーザー取得
                const user = await getUserByUsername(input.username);
                console.log(
                    "[Auth] getUserByUsername result:",
                    user
                        ? { id: user.id, username: user.username, hasPassword: !!user.password }
                        : "null"
                );

                // ユーザーがいない → 401
                if (!user) {
                    console.log("[Auth] ❌ User not found:", input.username);
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "ユーザー名またはパスワードが正しくありません",
                    });
                }

                console.log("[Auth] User found:", {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                });

                // パスワードチェック
                if (!user.password) {
                    console.log("[Auth] ❌ User has no password set:", user.username);
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "ユーザー名またはパスワードが正しくありません",
                    });
                }

                const isPasswordValid = await bcrypt.compare(input.password, user.password);
                if (!isPasswordValid) {
                    console.log("[Auth] ❌ Invalid password for user:", user.username);
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "ユーザー名またはパスワードが正しくありません",
                    });
                }

                console.log("[Auth] ✅ Password verified for user:", user.username);

                // Cookie セット
                await setAuthCookie(ctx.res, user.id);

                console.log("[Auth] Login successful for user:", user.username);

                return {
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        role: user.role,
                    },
                };
            } catch (error) {
                if (error instanceof TRPCError) {
                    throw error;
                }
                console.error("[Auth] Login error:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message:
                        error instanceof Error
                            ? error.message
                            : "ログイン処理中にエラーが発生しました",
                });
            }
        }),

    me: publicProcedure.query(async ({ ctx }) => {
        if (!ctx.user) {
            return null;
        }

        return {
            id: ctx.user.id,
            username: ctx.user.username,
            name: ctx.user.name,
            role: ctx.user.role,
        };
    }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
        clearAuthCookie(ctx.res);
        return { success: true };
    }),

    // サンプル用：パスワードなしでログイン（roleを指定）
    loginAs: publicProcedure
        .input(
            z.object({
                role: z.enum(["admin", "field_worker"]),
            })
        )
        .mutation(async ({ input, ctx }) => {
            try {
                console.log("[Auth] ========== LoginAs attempt ==========");
                console.log("[Auth] Role:", input.role);

                // データベース接続を初期化
                const db = await getDb();
                if (!db) {
                    console.error("[Auth] ❌ Database connection failed");
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "データベースに接続できません。環境変数を確認してください。",
                    });
                }

                const pool = getPool();
                if (!pool) {
                    console.error("[Auth] ❌ Pool is null after getDb()");
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "データベース接続プールが作成できませんでした。",
                    });
                }

                // 指定されたroleの最初のユーザーを取得
                const [rows]: any = await pool.execute(
                    `SELECT id, username, password, name, role, category
                     FROM users
                     WHERE role = ?
                     LIMIT 1`,
                    [input.role]
                );

                if (!Array.isArray(rows) || rows.length === 0) {
                    console.log("[Auth] ❌ User not found with role:", input.role);
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: `${input.role === "admin" ? "管理者" : "一般"}ユーザーが見つかりません`,
                    });
                }

                const user = rows[0];
                console.log("[Auth] ✅ User found:", {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                });

                // Cookie セット
                await setAuthCookie(ctx.res, user.id);

                console.log("[Auth] LoginAs successful for role:", input.role);

                return {
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        name: user.name ?? null,
                        role: user.role,
                    },
                };
            } catch (error) {
                if (error instanceof TRPCError) {
                    throw error;
                }
                console.error("[Auth] LoginAs error:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message:
                        error instanceof Error
                            ? error.message
                            : "ログイン処理中にエラーが発生しました",
                });
            }
        }),
});
