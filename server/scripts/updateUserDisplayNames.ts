import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";

async function main() {
    const db = await getDb();
    if (!db) {
        console.error("[updateUserDisplayNames] データベースに接続できません");
        process.exit(1);
    }

    const updates: { id: number; name: string; role: "field_worker" | "sales_office" | "sub_admin" | "admin" }[] = [
        { id: 2, name: "加藤健資", role: "admin" },
        { id: 3, name: "古澤清隆", role: "admin" },
        { id: 4, name: "野島悟", role: "field_worker" },
        { id: 5, name: "目黒弥須子", role: "field_worker" },
        { id: 6, name: "齋藤祐美", role: "field_worker" },
        { id: 7, name: "高野晴香", role: "field_worker" },
        { id: 8, name: "渡邊千尋", role: "field_worker" },
        { id: 9, name: "金子真由美", role: "field_worker" },
        { id: 10, name: "高野涼香", role: "field_worker" },
        { id: 11, name: "澁木芳美", role: "field_worker" },
        { id: 12, name: "樋口義則", role: "field_worker" },
        { id: 13, name: "太田千明", role: "field_worker" },
        { id: 14, name: "山崎正昭", role: "field_worker" },
        { id: 15, name: "落合岳朗", role: "field_worker" },
        { id: 16, name: "澁木健治郎", role: "field_worker" },
        { id: 17, name: "近藤一樹", role: "field_worker" },
        { id: 18, name: "松永旭生", role: "field_worker" },
        { id: 19, name: "鈴木竜輔", role: "field_worker" },
        { id: 20, name: "斉藤政春", role: "field_worker" },
        { id: 21, name: "土田宏子", role: "field_worker" },
        { id: 22, name: "笠井　猛", role: "field_worker" },
        { id: 23, name: "頓所　歩", role: "field_worker" },
        { id: 24, name: "永井富美華", role: "field_worker" },
        { id: 25, name: "関根光繁", role: "field_worker" },
        { id: 26, name: "青池和磨", role: "field_worker" },
        { id: 27, name: "星　英子", role: "field_worker" },
        { id: 28, name: "浅見道則", role: "field_worker" },
        { id: 29, name: "不破俊典", role: "field_worker" },
        { id: 30, name: "服部　亮", role: "field_worker" },
        { id: 31, name: "渡辺ゆり夏", role: "field_worker" },
        { id: 32, name: "内田　陽", role: "field_worker" },
    ];

    for (const u of updates) {
        try {
            await db
                .update(schema.users)
                .set({ name: u.name, role: u.role })
                .where(eq(schema.users.id, u.id));
            console.log(`[updateUserDisplayNames] Updated user id=${u.id} -> name=${u.name}, role=${u.role}`);
        } catch (error) {
            console.error(`[updateUserDisplayNames] Failed to update user id=${u.id}:`, error);
        }
    }

    console.log("[updateUserDisplayNames] 完了しました");
    process.exit(0);
}

main().catch((error) => {
    console.error("[updateUserDisplayNames] 予期せぬエラー:", error);
    process.exit(1);
});


