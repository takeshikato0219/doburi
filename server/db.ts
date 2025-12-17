import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";
import * as schema from "../drizzle/schema";

type DbType = ReturnType<typeof drizzle<typeof schema>>;
let _db: DbType | null = null;
let _pool: Pool | null = null;

/**
 * データベース接続を取得（接続プールを使用）
 */
export async function getDb(): Promise<DbType | null> {
    if (!ENV.databaseUrl) {
        console.warn("[Database] DATABASE_URL is not set");
        console.warn("[Database] MYSQL_URL:", process.env.MYSQL_URL ? "set" : "not set");
        console.warn("[Database] DATABASE_URL:", process.env.DATABASE_URL ? "set" : "not set");
        return null;
    }

    // 接続文字列をログに記録（パスワード部分はマスク）
    const maskedUrl = ENV.databaseUrl.replace(/:([^:@]+)@/, ":****@");
    console.log("[Database] Using connection string:", maskedUrl);

    // プールor db がないときは作り直し
    if (!_pool || !_db) {
        try {
            if (_pool) {
                try {
                    await _pool.end();
                } catch (error) {
                    console.warn("[Database] Error closing old pool:", error);
                }
            }

            _pool = createPool(ENV.databaseUrl);
            _db = drizzle(_pool, { schema, mode: "default" }) as unknown as DbType;
            console.log("[Database] Database connection pool created");
            
            // 接続テストを実行
            try {
                await _pool.execute("SELECT 1");
                console.log("[Database] ✅ Connection test successful");
            } catch (testError: any) {
                console.error("[Database] ❌ Connection test failed:", testError.message);
                console.error("[Database] Error code:", testError.code);
                console.error("[Database] Error errno:", testError.errno);
                throw testError;
            }
        } catch (error: any) {
            console.error("[Database] Failed to create connection pool:", error);
            console.error("[Database] Error message:", error?.message);
            console.error("[Database] Error code:", error?.code);
            console.error("[Database] Error errno:", error?.errno);
            _db = null;
            _pool = null;
            return null;
        }
    }

    return _db;
}

/**
 * 生の MySQL プールを取得（backup.ts などで使う）
 */
export function getPool(): Pool | null {
    return _pool;
}

/**
 * ユーザー情報を安全に取得する（name / category カラムがない DB でも動く）
 */
export async function selectUsersSafely(
    db: Awaited<ReturnType<typeof getDb>>,
    where?: any
) {
    if (!db) return [];

    try {
        const baseSelect = {
            id: schema.users.id,
            username: schema.users.username,
            password: schema.users.password,
            name: (schema.users as any).name,
            role: (schema.users as any).role,
            category: (schema.users as any).category,
        };

        let query = db.select(baseSelect).from(schema.users);
        if (where) {
            query = query.where(where) as any;
        }
        const result = await query;
        return result;
    } catch (error: any) {
        console.error("[selectUsersSafely] Error:", error);

        // name / category が無い古い DB 向けフォールバック
        if (
            error?.message?.includes("category") ||
            error?.message?.includes("name") ||
            error?.code === "ER_BAD_FIELD_ERROR"
        ) {
            try {
                const baseSelect = {
                    id: schema.users.id,
                    username: schema.users.username,
                    password: schema.users.password,
                    role: (schema.users as any).role,
                };

                let query = db.select(baseSelect).from(schema.users);
                if (where) {
                    query = query.where(where) as any;
                }
                const result = await query;
                return result.map((u: any) => ({
                    ...u,
                    name: null,
                    category: null,
                }));
            } catch (innerError: any) {
                console.error("[selectUsersSafely] Fallback also failed:", innerError);
                return [];
            }
        }

        return [];
    }
}

/**
 * ログイン用：username だけでユーザーを取得
 */
export async function getUserByUsername(username: string) {
    console.log("[getUserByUsername] Searching ONLY by username:", username);

    const pool = getPool();
    if (!pool) {
        console.error("[getUserByUsername] ❌ Pool is null - database not connected");
        return undefined;
    }

    try {
        const [rows]: any = await pool.execute(
            `SELECT id, username, password, name, role, category
             FROM users
             WHERE username = ?
             LIMIT 1`,
            [username]
        );

        if (!Array.isArray(rows) || rows.length === 0) {
            console.log("[getUserByUsername] ❌ User not found:", username);
            return undefined;
        }

        const user = rows[0];

        return {
            id: user.id,
            username: user.username,
            password: user.password,
            name: user.name ?? null,
            role: user.role ?? "field_worker",
            category: user.category ?? null,
        };
    } catch (error: any) {
        console.error("[getUserByUsername] ❌ Error:", error);
        console.error("[getUserByUsername] Error message:", error?.message);
        console.error("[getUserByUsername] Error code:", error?.code);
        console.error("[getUserByUsername] Error errno:", error?.errno);
        return undefined;
    }
}

export async function getUserById(id: number) {
    const db = await getDb();
    if (!db) return undefined;
    try {
        const users = await selectUsersSafely(db, eq(schema.users.id, id));
        return users[0];
    } catch (error) {
        console.error("[getUserById] Error:", error);
        return undefined;
    }
}

// 後方互換用
export async function getUserByOpenId(openId: string) {
    return getUserByUsername(openId);
}

/**
 * 休憩時間の初期化（既にあればスキップ）
 */
export async function initializeDefaultBreakTimes() {
    const db = await getDb();
    if (!db) {
        console.warn("[Database] Cannot initialize break times: database not available");
        return;
    }

    try {
        const existing = await db.select().from(schema.breakTimes).limit(1);
        if (existing.length > 0) {
            console.log("[Database] Break times already initialized");
            return;
        }

        await db.insert(schema.breakTimes).values({
            name: "昼休憩",
            startTime: "12:00",
            endTime: "13:20",
            durationMinutes: 80,
            isActive: "true",
        });

        console.log("[Database] Default break times initialized");
    } catch (error) {
        console.warn("[Database] Failed to initialize break times:", error);
    }
}

// スキーマもエクスポート
export { schema };
