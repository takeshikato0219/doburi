import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createTRPCRouter, publicProcedure } from "../_core/trpc";
import { getUserByUsername, getPool, getDb } from "../db";
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
                console.log("[Auth] Attempting to initialize database connection...");
                console.log("[Auth] MYSQL_URL:", process.env.MYSQL_URL ? "set" : "not set");
                console.log("[Auth] DATABASE_URL:", process.env.DATABASE_URL ? "set" : "not set");
                
                // DATABASE_URLの値を確認（マスクして）
                if (process.env.DATABASE_URL) {
                    const maskedDbUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@");
                    console.log("[Auth] DATABASE_URL value:", maskedDbUrl);
                }
                
                const db = await getDb();
                
                // データベース接続が失敗した場合の一時的なフォールバック
                let user: any = null;
                
                if (!db) {
                    console.warn("[Auth] ⚠️ Database connection failed, using fallback mock user");
                    // 一時的なモックユーザーでログインを許可（開発/デバッグ用）
                    user = {
                        id: input.role === "admin" ? 1 : 2,
                        username: input.role === "admin" ? "admin" : "user001",
                        name: input.role === "admin" ? "管理者" : "一般ユーザー",
                        role: input.role,
                        category: null,
                    };
                    console.log("[Auth] ✅ Using fallback mock user:", user);
                } else {
                    const pool = getPool();
                    if (!pool) {
                        console.warn("[Auth] ⚠️ Pool is null, using fallback mock user");
                        user = {
                            id: input.role === "admin" ? 1 : 2,
                            username: input.role === "admin" ? "admin" : "user001",
                            name: input.role === "admin" ? "管理者" : "一般ユーザー",
                            role: input.role,
                            category: null,
                        };
                        console.log("[Auth] ✅ Using fallback mock user:", user);
                    } else {
                        // 指定されたroleの最初のユーザーを取得
                        try {
                            const [rows]: any = await pool.execute(
                                `SELECT id, username, password, name, role, category
                                 FROM users
                                 WHERE role = ?
                                 LIMIT 1`,
                                [input.role]
                            );

                            if (!Array.isArray(rows) || rows.length === 0) {
                                console.log("[Auth] ⚠️ User not found with role, using fallback mock user:", input.role);
                                user = {
                                    id: input.role === "admin" ? 1 : 2,
                                    username: input.role === "admin" ? "admin" : "user001",
                                    name: input.role === "admin" ? "管理者" : "一般ユーザー",
                                    role: input.role,
                                    category: null,
                                };
                            } else {
                                user = rows[0];
                            }
                        } catch (dbError: any) {
                            console.warn("[Auth] ⚠️ Database query failed, using fallback mock user:", dbError.message);
                            user = {
                                id: input.role === "admin" ? 1 : 2,
                                username: input.role === "admin" ? "admin" : "user001",
                                name: input.role === "admin" ? "管理者" : "一般ユーザー",
                                role: input.role,
                                category: null,
                            };
                        }
                    }
                }

                if (!user) {
                    console.log("[Auth] ❌ User not found with role:", input.role);
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: `${input.role === "admin" ? "管理者" : "一般"}ユーザーが見つかりません`,
                    });
                }
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
