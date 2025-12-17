import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createTRPCRouter, adminProcedure, subAdminProcedure } from "../_core/trpc";
import { getDb, schema } from "../db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { format } from "date-fns";
import { ENV } from "../_core/env";

/**
 * バックアップファイルをAWS S3にアップロード
 */
async function uploadToS3(filePath: string, fileName: string): Promise<boolean> {
    if (!ENV.awsS3Enabled) {
        console.log("[Backup] AWS S3バックアップは無効になっています");
        return false;
    }

    if (!ENV.awsS3Bucket || !ENV.awsAccessKeyId || !ENV.awsSecretAccessKey) {
        console.warn("[Backup] AWS S3の設定が不完全です。クラウドバックアップをスキップします");
        return false;
    }

    try {
        const s3Client = new S3Client({
            region: ENV.awsS3Region,
            credentials: {
                accessKeyId: ENV.awsAccessKeyId,
                secretAccessKey: ENV.awsSecretAccessKey,
            },
        });

        const fileContent = fs.readFileSync(filePath);
        const s3Key = `backups/${fileName}`;

        const command = new PutObjectCommand({
            Bucket: ENV.awsS3Bucket,
            Key: s3Key,
            Body: fileContent,
            ContentType: "application/json",
        });

        await s3Client.send(command);
        console.log(`[Backup] ✅ クラウドバックアップ成功: s3://${ENV.awsS3Bucket}/${s3Key}`);
        return true;
    } catch (error: any) {
        console.error("[Backup] ❌ クラウドバックアップエラー:", error.message);
        // クラウドバックアップの失敗はローカルバックアップの成功を妨げない
        return false;
    }
}

/**
 * 重要なデータをバックアップする
 */
export async function createBackup() {
    const db = await getDb();
    if (!db) {
        throw new Error("データベースに接続できません");
    }

    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
    const backupData: any = {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        data: {},
    };

    try {
        // 1. 車両データ（存在するカラムのみを動的に取得）
        let vehicles: any[] = [];
        try {
            // まず、存在するカラムを取得（データベース名は動的に取得）
            const columnsResult = await db.execute(sql`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'vehicles'
                AND COLUMN_NAME NOT IN ('outsourcingDestination', 'outsourcingStartDate', 'outsourcingEndDate')
                ORDER BY ORDINAL_POSITION
            `);

            const columns = (columnsResult as any[]).map((row: any) => row.COLUMN_NAME);

            if (columns.length === 0) {
                // カラム情報が取得できない場合は、基本的なカラムのみを選択
                vehicles = await db.select({
                    id: schema.vehicles.id,
                    vehicleNumber: schema.vehicles.vehicleNumber,
                    vehicleTypeId: schema.vehicles.vehicleTypeId,
                    category: schema.vehicles.category,
                    customerName: schema.vehicles.customerName,
                    desiredDeliveryDate: schema.vehicles.desiredDeliveryDate,
                    status: schema.vehicles.status,
                    createdAt: schema.vehicles.createdAt,
                    updatedAt: schema.vehicles.updatedAt,
                }).from(schema.vehicles);
            } else {
                // 存在するカラムのみを選択するSQLクエリを構築
                const columnList = columns.map((col: string) => `\`${col}\``).join(", ");
                const rawQuery = sql.raw(`SELECT ${columnList} FROM \`vehicles\``);
                const result = await db.execute(rawQuery);
                vehicles = (result as any[]).map((row: any) => {
                    const obj: any = {};
                    columns.forEach((col: string) => {
                        obj[col] = row[col];
                    });
                    return obj;
                });
            }
        } catch (error: any) {
            console.error("[Backup] Error fetching vehicles:", error.message);
            // フォールバック: 基本的なカラムのみを選択
            try {
                vehicles = await db.select({
                    id: schema.vehicles.id,
                    vehicleNumber: schema.vehicles.vehicleNumber,
                    vehicleTypeId: schema.vehicles.vehicleTypeId,
                    category: schema.vehicles.category,
                    customerName: schema.vehicles.customerName,
                    desiredDeliveryDate: schema.vehicles.desiredDeliveryDate,
                    status: schema.vehicles.status,
                    createdAt: schema.vehicles.createdAt,
                    updatedAt: schema.vehicles.updatedAt,
                }).from(schema.vehicles);
            } catch (fallbackError: any) {
                console.error("[Backup] Fallback also failed:", fallbackError.message);
                vehicles = [];
            }
        }
        backupData.data.vehicles = vehicles;

        // 2. チェック項目（存在するカラムのみを動的に取得）
        let checkItems: any[] = [];
        try {
            // まず、存在するカラムを取得
            const checkItemsColumnsResult = await db.execute(sql`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'checkItems'
                ORDER BY ORDINAL_POSITION
            `);

            const checkItemsColumns = (checkItemsColumnsResult as any[]).map((row: any) => row.COLUMN_NAME);

            if (checkItemsColumns.length === 0) {
                // カラム情報が取得できない場合は、基本的なカラムのみを選択
                checkItems = await db.select({
                    id: schema.checkItems.id,
                    category: schema.checkItems.category,
                    name: schema.checkItems.name,
                    description: schema.checkItems.description,
                    createdAt: schema.checkItems.createdAt,
                    updatedAt: schema.checkItems.updatedAt,
                }).from(schema.checkItems);
            } else {
                // 存在するカラムのみを選択するSQLクエリを構築
                const columnList = checkItemsColumns.map((col: string) => `\`${col}\``).join(", ");
                const rawQuery = sql.raw(`SELECT ${columnList} FROM \`checkItems\``);
                const result = await db.execute(rawQuery);
                checkItems = (result as any[]).map((row: any) => {
                    const obj: any = {};
                    checkItemsColumns.forEach((col: string) => {
                        obj[col] = row[col];
                    });
                    return obj;
                });
            }
        } catch (error: any) {
            console.error("[Backup] Error fetching checkItems:", error.message);
            // フォールバック: 基本的なカラムのみを選択
            try {
                checkItems = await db.select({
                    id: schema.checkItems.id,
                    category: schema.checkItems.category,
                    name: schema.checkItems.name,
                    description: schema.checkItems.description,
                    createdAt: schema.checkItems.createdAt,
                    updatedAt: schema.checkItems.updatedAt,
                }).from(schema.checkItems);
            } catch (fallbackError: any) {
                console.error("[Backup] Fallback also failed for checkItems:", fallbackError.message);
                checkItems = [];
            }
        }
        backupData.data.checkItems = checkItems;

        // 3. ユーザー情報（存在するカラムのみを動的に取得）
        let users: any[] = [];
        try {
            const { selectUsersSafely } = await import("../db");
            users = await selectUsersSafely(db);
        } catch (error: any) {
            console.error("[Backup] Error fetching users:", error.message);
            // フォールバック: 基本的なカラムのみを選択
            try {
                // まず、存在するカラムを取得
                const usersColumnsResult = await db.execute(sql`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'users'
                    ORDER BY ORDINAL_POSITION
                `);

                const usersColumns = (usersColumnsResult as any[]).map((row: any) => row.COLUMN_NAME);

                if (usersColumns.length > 0) {
                    // 存在するカラムのみを選択するSQLクエリを構築
                    const columnList = usersColumns.map((col: string) => `\`${col}\``).join(", ");
                    const rawQuery = sql.raw(`SELECT ${columnList} FROM \`users\``);
                    const result = await db.execute(rawQuery);
                    users = (result as any[]).map((row: any) => {
                        const obj: any = {};
                        usersColumns.forEach((col: string) => {
                            obj[col] = row[col];
                        });
                        return obj;
                    });
                } else {
                    // 最小限のカラムのみを選択
                    users = await db.select({
                        id: schema.users.id,
                        username: schema.users.username,
                        role: schema.users.role,
                    }).from(schema.users);
                }
            } catch (fallbackError: any) {
                console.error("[Backup] Fallback also failed for users:", fallbackError.message);
                users = [];
            }
        }
        backupData.data.users = users;

        // 4. スタッフスケジュール表示順序
        try {
            const displayOrder = await db.select().from(schema.staffScheduleDisplayOrder);
            backupData.data.staffScheduleDisplayOrder = displayOrder;
        } catch (error) {
            console.warn("[Backup] staffScheduleDisplayOrder not available:", error);
        }

        // 5. 車種管理
        const vehicleTypes = await db.select().from(schema.vehicleTypes);
        backupData.data.vehicleTypes = vehicleTypes;

        // 6. 工程管理
        const processes = await db.select().from(schema.processes);
        backupData.data.processes = processes;

        // 7. 休憩時間設定（存在するカラムのみを動的に取得）
        let breakTimes: any[] = [];
        try {
            // まず、存在するカラムを取得
            const breakTimesColumnsResult = await db.execute(sql`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'breakTimes'
                ORDER BY ORDINAL_POSITION
            `);

            const breakTimesColumns = (breakTimesColumnsResult as any[]).map((row: any) => row.COLUMN_NAME);

            if (breakTimesColumns.length === 0) {
                // カラム情報が取得できない場合は、基本的なカラムのみを選択
                breakTimes = await db.select({
                    id: schema.breakTimes.id,
                    name: schema.breakTimes.name,
                    startTime: schema.breakTimes.startTime,
                    endTime: schema.breakTimes.endTime,
                    durationMinutes: schema.breakTimes.durationMinutes,
                    isActive: schema.breakTimes.isActive,
                    createdAt: schema.breakTimes.createdAt,
                    updatedAt: schema.breakTimes.updatedAt,
                }).from(schema.breakTimes);
            } else {
                // 存在するカラムのみを選択するSQLクエリを構築
                const columnList = breakTimesColumns.map((col: string) => `\`${col}\``).join(", ");
                const rawQuery = sql.raw(`SELECT ${columnList} FROM \`breakTimes\``);
                const result = await db.execute(rawQuery);
                breakTimes = (result as any[]).map((row: any) => {
                    const obj: any = {};
                    breakTimesColumns.forEach((col: string) => {
                        obj[col] = row[col];
                    });
                    return obj;
                });
            }
        } catch (error: any) {
            console.error("[Backup] Error fetching breakTimes:", error.message);
            // フォールバック: 基本的なカラムのみを選択
            try {
                breakTimes = await db.select({
                    id: schema.breakTimes.id,
                    name: schema.breakTimes.name,
                    startTime: schema.breakTimes.startTime,
                    endTime: schema.breakTimes.endTime,
                    durationMinutes: schema.breakTimes.durationMinutes,
                    isActive: schema.breakTimes.isActive,
                    createdAt: schema.breakTimes.createdAt,
                    updatedAt: schema.breakTimes.updatedAt,
                }).from(schema.breakTimes);
            } catch (fallbackError: any) {
                console.error("[Backup] Fallback also failed for breakTimes:", fallbackError.message);
                breakTimes = [];
            }
        }
        backupData.data.breakTimes = breakTimes;

        // 8. 出勤記録（重要）
        try {
            const attendanceRecords = await db.select().from(schema.attendanceRecords);
            backupData.data.attendanceRecords = attendanceRecords;
        } catch (error) {
            console.warn("[Backup] attendanceRecords not available:", error);
        }

        // 9. 出勤編集履歴
        try {
            const attendanceEditLogs = await db.select().from(schema.attendanceEditLogs);
            backupData.data.attendanceEditLogs = attendanceEditLogs;
        } catch (error) {
            console.warn("[Backup] attendanceEditLogs not available:", error);
        }

        // 10. 作業記録（重要）
        try {
            const workRecords = await db.select().from(schema.workRecords);
            backupData.data.workRecords = workRecords;
        } catch (error) {
            console.warn("[Backup] workRecords not available:", error);
        }

        // 11. 車両工程ターゲット（工程管理の一部）
        try {
            const vehicleProcessTargets = await db.select().from(schema.vehicleProcessTargets);
            backupData.data.vehicleProcessTargets = vehicleProcessTargets;
        } catch (error) {
            console.warn("[Backup] vehicleProcessTargets not available:", error);
        }

        // 12. 車種工程基準（工程管理の一部）
        try {
            const vehicleTypeProcessStandards = await db.select().from(schema.vehicleTypeProcessStandards);
            backupData.data.vehicleTypeProcessStandards = vehicleTypeProcessStandards;
        } catch (error) {
            console.warn("[Backup] vehicleTypeProcessStandards not available:", error);
        }

        // 13. 車両メモ
        try {
            const vehicleMemos = await db.select().from(schema.vehicleMemos);
            backupData.data.vehicleMemos = vehicleMemos;
        } catch (error) {
            console.warn("[Backup] vehicleMemos not available:", error);
        }

        // 14. 車両チェック
        try {
            const vehicleChecks = await db.select().from(schema.vehicleChecks);
            backupData.data.vehicleChecks = vehicleChecks;
        } catch (error) {
            console.warn("[Backup] vehicleChecks not available:", error);
        }

        // 15. チェック依頼
        try {
            const checkRequests = await db.select().from(schema.checkRequests);
            backupData.data.checkRequests = checkRequests;
        } catch (error) {
            console.warn("[Backup] checkRequests not available:", error);
        }

        // 16. スタッフスケジュール
        try {
            const staffScheduleEntries = await db.select().from(schema.staffScheduleEntries);
            backupData.data.staffScheduleEntries = staffScheduleEntries;
        } catch (error) {
            console.warn("[Backup] staffScheduleEntries not available:", error);
        }

        // 17. スタッフスケジュール編集履歴
        try {
            const staffScheduleEditLogs = await db.select().from(schema.staffScheduleEditLogs);
            backupData.data.staffScheduleEditLogs = staffScheduleEditLogs;
        } catch (error) {
            console.warn("[Backup] staffScheduleEditLogs not available:", error);
        }

        // 18. 車両外注情報
        try {
            const vehicleOutsourcing = await db.select().from(schema.vehicleOutsourcing);
            backupData.data.vehicleOutsourcing = vehicleOutsourcing;
        } catch (error) {
            console.warn("[Backup] vehicleOutsourcing not available:", error);
        }

        // 19. 車両注意ポイント
        try {
            const vehicleAttentionPoints = await db.select().from(schema.vehicleAttentionPoints);
            backupData.data.vehicleAttentionPoints = vehicleAttentionPoints;
        } catch (error) {
            console.warn("[Backup] vehicleAttentionPoints not available:", error);
        }

        // バックアップファイルに保存
        const backupFileName = `backup_${timestamp}.json`;
        const backupFilePath = path.join(backupDir, backupFileName);
        fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), "utf-8");

        // 古いバックアップを削除（30日以上前のもの）
        const files = fs.readdirSync(backupDir);
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        let deletedCount = 0;

        for (const file of files) {
            if (file.startsWith("backup_") && file.endsWith(".json")) {
                const filePath = path.join(backupDir, file);
                const stats = fs.statSync(filePath);
                if (stats.mtime.getTime() < thirtyDaysAgo) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`[Backup] 古いバックアップを削除: ${file}`);
                }
            }
        }

        if (deletedCount > 0) {
            console.log(`[Backup] ${deletedCount}件の古いバックアップを削除しました（30日以上前）`);
        }

        const recordCount = {
            vehicles: vehicles.length,
            checkItems: checkItems.length,
            users: users.length,
            vehicleTypes: vehicleTypes.length,
            processes: processes.length,
            breakTimes: breakTimes.length,
            attendanceRecords: backupData.data.attendanceRecords?.length || 0,
            attendanceEditLogs: backupData.data.attendanceEditLogs?.length || 0,
            workRecords: backupData.data.workRecords?.length || 0,
            vehicleProcessTargets: backupData.data.vehicleProcessTargets?.length || 0,
            vehicleTypeProcessStandards: backupData.data.vehicleTypeProcessStandards?.length || 0,
            vehicleMemos: backupData.data.vehicleMemos?.length || 0,
            vehicleChecks: backupData.data.vehicleChecks?.length || 0,
            checkRequests: backupData.data.checkRequests?.length || 0,
            staffScheduleEntries: backupData.data.staffScheduleEntries?.length || 0,
            staffScheduleEditLogs: backupData.data.staffScheduleEditLogs?.length || 0,
            vehicleOutsourcing: backupData.data.vehicleOutsourcing?.length || 0,
            vehicleAttentionPoints: backupData.data.vehicleAttentionPoints?.length || 0,
        };

        console.log(`[Backup] バックアップ作成完了: ${backupFileName}`);
        console.log(`[Backup] 記録数:`, recordCount);

        // クラウドストレージへの自動アップロード
        let cloudUploadSuccess = false;
        try {
            cloudUploadSuccess = await uploadToS3(backupFilePath, backupFileName);
        } catch (error: any) {
            console.error("[Backup] クラウドアップロード中にエラーが発生しました（無視）:", error.message);
            // クラウドアップロードの失敗はローカルバックアップの成功を妨げない
        }

        return {
            success: true,
            fileName: backupFileName,
            filePath: backupFilePath,
            recordCount,
            cloudUploaded: cloudUploadSuccess,
        };
    } catch (error: any) {
        console.error("[Backup] バックアップ作成エラー:", error);
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "バックアップの作成に失敗しました",
        });
    }
}

export const backupRouter = createTRPCRouter({
    // 手動バックアップ作成（管理者のみ）
    createBackup: adminProcedure.mutation(async () => {
        return await createBackup();
    }),

    // バックアップ一覧取得（管理者のみ）
    listBackups: adminProcedure.query(async () => {
        const backupDir = path.resolve(process.cwd(), "backups");
        if (!fs.existsSync(backupDir)) {
            return [];
        }

        const files = fs.readdirSync(backupDir)
            .filter((file) => file.startsWith("backup_") && file.endsWith(".json"))
            .map((file) => {
                const filePath = path.join(backupDir, file);
                const stats = fs.statSync(filePath);
                return {
                    fileName: file,
                    filePath,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime,
                };
            })
            .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

        return files;
    }),

    // バックアップから復元（管理者のみ）
    restoreBackup: adminProcedure
        .input(z.object({ fileName: z.string() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            const backupDir = path.resolve(process.cwd(), "backups");
            const backupFilePath = path.join(backupDir, input.fileName);

            if (!fs.existsSync(backupFilePath)) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "バックアップファイルが見つかりません",
                });
            }

            try {
                const backupContent = fs.readFileSync(backupFilePath, "utf-8");
                const backupData = JSON.parse(backupContent);

                // 復元前に現在のデータをバックアップ（安全のため）
                await createBackup();

                const { eq, inArray } = await import("drizzle-orm");

                // 1. 車両データを復元
                if (backupData.data.vehicles) {
                    // 既存の車両を確認して、存在しないもののみ追加
                    const existingVehicles = await db.select({ id: schema.vehicles.id }).from(schema.vehicles);
                    const existingIds = new Set(existingVehicles.map((v) => v.id));
                    const newVehicles = backupData.data.vehicles.filter((v: any) => !existingIds.has(v.id));
                    if (newVehicles.length > 0) {
                        await db.insert(schema.vehicles).values(newVehicles);
                    }
                }

                // 2. チェック項目を復元
                if (backupData.data.checkItems) {
                    const existingCheckItems = await db.select({ id: schema.checkItems.id }).from(schema.checkItems);
                    const existingIds = new Set(existingCheckItems.map((c) => c.id));
                    const newCheckItems = backupData.data.checkItems.filter((c: any) => !existingIds.has(c.id));
                    if (newCheckItems.length > 0) {
                        await db.insert(schema.checkItems).values(newCheckItems);
                    }
                }

                // 3. ユーザー情報を復元（名前、カテゴリのみ更新、新規作成はしない）
                if (backupData.data.users) {
                    for (const user of backupData.data.users) {
                        await db
                            .update(schema.users)
                            .set({
                                name: user.name,
                                category: user.category,
                            })
                            .where(eq(schema.users.id, user.id));
                    }
                }

                // 4. スタッフスケジュール表示順序を復元
                if (backupData.data.staffScheduleDisplayOrder) {
                    try {
                        for (const order of backupData.data.staffScheduleDisplayOrder) {
                            // 既存のレコードを確認
                            const existing = await db
                                .select()
                                .from(schema.staffScheduleDisplayOrder)
                                .where(eq(schema.staffScheduleDisplayOrder.userId, order.userId))
                                .limit(1);

                            if (existing.length > 0) {
                                // 更新
                                await db
                                    .update(schema.staffScheduleDisplayOrder)
                                    .set({ displayOrder: order.displayOrder })
                                    .where(eq(schema.staffScheduleDisplayOrder.userId, order.userId));
                            } else {
                                // 新規作成
                                await db.insert(schema.staffScheduleDisplayOrder).values(order);
                            }
                        }
                    } catch (error) {
                        console.warn("[Backup] staffScheduleDisplayOrder復元エラー（無視）:", error);
                    }
                }

                // 5. 車種管理を復元
                if (backupData.data.vehicleTypes) {
                    const existingTypes = await db.select({ id: schema.vehicleTypes.id }).from(schema.vehicleTypes);
                    const existingIds = new Set(existingTypes.map((t) => t.id));
                    const newTypes = backupData.data.vehicleTypes.filter((t: any) => !existingIds.has(t.id));
                    if (newTypes.length > 0) {
                        await db.insert(schema.vehicleTypes).values(newTypes);
                    }
                }

                // 6. 工程管理を復元
                if (backupData.data.processes) {
                    const existingProcesses = await db.select({ id: schema.processes.id }).from(schema.processes);
                    const existingIds = new Set(existingProcesses.map((p) => p.id));
                    const newProcesses = backupData.data.processes.filter((p: any) => !existingIds.has(p.id));
                    if (newProcesses.length > 0) {
                        await db.insert(schema.processes).values(newProcesses);
                    }
                }

                // 7. 休憩時間設定を復元
                if (backupData.data.breakTimes) {
                    const existingBreakTimes = await db.select({ id: schema.breakTimes.id }).from(schema.breakTimes);
                    const existingIds = new Set(existingBreakTimes.map((b) => b.id));
                    const newBreakTimes = backupData.data.breakTimes.filter((b: any) => !existingIds.has(b.id));
                    if (newBreakTimes.length > 0) {
                        await db.insert(schema.breakTimes).values(newBreakTimes);
                    }
                }

                // 8. 出勤記録を復元（重要）
                if (backupData.data.attendanceRecords) {
                    try {
                        const existingRecords = await db.select({ id: schema.attendanceRecords.id }).from(schema.attendanceRecords);
                        const existingIds = new Set(existingRecords.map((r) => r.id));
                        const newRecords = backupData.data.attendanceRecords.filter((r: any) => !existingIds.has(r.id));
                        if (newRecords.length > 0) {
                            await db.insert(schema.attendanceRecords).values(newRecords);
                            console.log(`[Backup] ${newRecords.length}件の出勤記録を復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] attendanceRecords復元エラー（無視）:", error);
                    }
                }

                // 9. 出勤編集履歴を復元
                if (backupData.data.attendanceEditLogs) {
                    try {
                        const existingLogs = await db.select({ id: schema.attendanceEditLogs.id }).from(schema.attendanceEditLogs);
                        const existingIds = new Set(existingLogs.map((l) => l.id));
                        const newLogs = backupData.data.attendanceEditLogs.filter((l: any) => !existingIds.has(l.id));
                        if (newLogs.length > 0) {
                            await db.insert(schema.attendanceEditLogs).values(newLogs);
                            console.log(`[Backup] ${newLogs.length}件の出勤編集履歴を復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] attendanceEditLogs復元エラー（無視）:", error);
                    }
                }

                // 10. 作業記録を復元（重要）
                if (backupData.data.workRecords) {
                    try {
                        const existingRecords = await db.select({ id: schema.workRecords.id }).from(schema.workRecords);
                        const existingIds = new Set(existingRecords.map((r) => r.id));
                        const newRecords = backupData.data.workRecords.filter((r: any) => !existingIds.has(r.id));
                        if (newRecords.length > 0) {
                            await db.insert(schema.workRecords).values(newRecords);
                            console.log(`[Backup] ${newRecords.length}件の作業記録を復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] workRecords復元エラー（無視）:", error);
                    }
                }

                // 11. 車両工程ターゲットを復元（工程管理の一部）
                if (backupData.data.vehicleProcessTargets) {
                    try {
                        const existingTargets = await db.select({ id: schema.vehicleProcessTargets.id }).from(schema.vehicleProcessTargets);
                        const existingIds = new Set(existingTargets.map((t) => t.id));
                        const newTargets = backupData.data.vehicleProcessTargets.filter((t: any) => !existingIds.has(t.id));
                        if (newTargets.length > 0) {
                            await db.insert(schema.vehicleProcessTargets).values(newTargets);
                            console.log(`[Backup] ${newTargets.length}件の車両工程ターゲットを復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] vehicleProcessTargets復元エラー（無視）:", error);
                    }
                }

                // 12. 車種工程基準を復元（工程管理の一部）
                if (backupData.data.vehicleTypeProcessStandards) {
                    try {
                        const existingStandards = await db.select({ id: schema.vehicleTypeProcessStandards.id }).from(schema.vehicleTypeProcessStandards);
                        const existingIds = new Set(existingStandards.map((s) => s.id));
                        const newStandards = backupData.data.vehicleTypeProcessStandards.filter((s: any) => !existingIds.has(s.id));
                        if (newStandards.length > 0) {
                            await db.insert(schema.vehicleTypeProcessStandards).values(newStandards);
                            console.log(`[Backup] ${newStandards.length}件の車種工程基準を復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] vehicleTypeProcessStandards復元エラー（無視）:", error);
                    }
                }

                // 13. 車両メモを復元
                if (backupData.data.vehicleMemos) {
                    try {
                        const existingMemos = await db.select({ id: schema.vehicleMemos.id }).from(schema.vehicleMemos);
                        const existingIds = new Set(existingMemos.map((m) => m.id));
                        const newMemos = backupData.data.vehicleMemos.filter((m: any) => !existingIds.has(m.id));
                        if (newMemos.length > 0) {
                            await db.insert(schema.vehicleMemos).values(newMemos);
                            console.log(`[Backup] ${newMemos.length}件の車両メモを復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] vehicleMemos復元エラー（無視）:", error);
                    }
                }

                // 14. 車両チェックを復元
                if (backupData.data.vehicleChecks) {
                    try {
                        const existingChecks = await db.select({ id: schema.vehicleChecks.id }).from(schema.vehicleChecks);
                        const existingIds = new Set(existingChecks.map((c) => c.id));
                        const newChecks = backupData.data.vehicleChecks.filter((c: any) => !existingIds.has(c.id));
                        if (newChecks.length > 0) {
                            await db.insert(schema.vehicleChecks).values(newChecks);
                            console.log(`[Backup] ${newChecks.length}件の車両チェックを復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] vehicleChecks復元エラー（無視）:", error);
                    }
                }

                // 15. チェック依頼を復元
                if (backupData.data.checkRequests) {
                    try {
                        const existingRequests = await db.select({ id: schema.checkRequests.id }).from(schema.checkRequests);
                        const existingIds = new Set(existingRequests.map((r) => r.id));
                        const newRequests = backupData.data.checkRequests.filter((r: any) => !existingIds.has(r.id));
                        if (newRequests.length > 0) {
                            await db.insert(schema.checkRequests).values(newRequests);
                            console.log(`[Backup] ${newRequests.length}件のチェック依頼を復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] checkRequests復元エラー（無視）:", error);
                    }
                }

                // 16. スタッフスケジュールを復元
                if (backupData.data.staffScheduleEntries) {
                    try {
                        const existingEntries = await db.select({ id: schema.staffScheduleEntries.id }).from(schema.staffScheduleEntries);
                        const existingIds = new Set(existingEntries.map((e) => e.id));
                        const newEntries = backupData.data.staffScheduleEntries.filter((e: any) => !existingIds.has(e.id));
                        if (newEntries.length > 0) {
                            await db.insert(schema.staffScheduleEntries).values(newEntries);
                            console.log(`[Backup] ${newEntries.length}件のスタッフスケジュールを復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] staffScheduleEntries復元エラー（無視）:", error);
                    }
                }

                // 17. スタッフスケジュール編集履歴を復元
                if (backupData.data.staffScheduleEditLogs) {
                    try {
                        const existingLogs = await db.select({ id: schema.staffScheduleEditLogs.id }).from(schema.staffScheduleEditLogs);
                        const existingIds = new Set(existingLogs.map((l) => l.id));
                        const newLogs = backupData.data.staffScheduleEditLogs.filter((l: any) => !existingIds.has(l.id));
                        if (newLogs.length > 0) {
                            await db.insert(schema.staffScheduleEditLogs).values(newLogs);
                            console.log(`[Backup] ${newLogs.length}件のスタッフスケジュール編集履歴を復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] staffScheduleEditLogs復元エラー（無視）:", error);
                    }
                }

                // 18. 車両外注情報を復元
                if (backupData.data.vehicleOutsourcing) {
                    try {
                        const existingOutsourcing = await db.select({ id: schema.vehicleOutsourcing.id }).from(schema.vehicleOutsourcing);
                        const existingIds = new Set(existingOutsourcing.map((o) => o.id));
                        const newOutsourcing = backupData.data.vehicleOutsourcing.filter((o: any) => !existingIds.has(o.id));
                        if (newOutsourcing.length > 0) {
                            await db.insert(schema.vehicleOutsourcing).values(newOutsourcing);
                            console.log(`[Backup] ${newOutsourcing.length}件の車両外注情報を復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] vehicleOutsourcing復元エラー（無視）:", error);
                    }
                }

                // 19. 車両注意ポイントを復元
                if (backupData.data.vehicleAttentionPoints) {
                    try {
                        const existingPoints = await db.select({ id: schema.vehicleAttentionPoints.id }).from(schema.vehicleAttentionPoints);
                        const existingIds = new Set(existingPoints.map((p) => p.id));
                        const newPoints = backupData.data.vehicleAttentionPoints.filter((p: any) => !existingIds.has(p.id));
                        if (newPoints.length > 0) {
                            await db.insert(schema.vehicleAttentionPoints).values(newPoints);
                            console.log(`[Backup] ${newPoints.length}件の車両注意ポイントを復元しました`);
                        }
                    } catch (error) {
                        console.warn("[Backup] vehicleAttentionPoints復元エラー（無視）:", error);
                    }
                }

                return { success: true, message: "バックアップから復元しました" };
            } catch (error: any) {
                console.error("[Backup] 復元エラー:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error.message || "バックアップの復元に失敗しました",
                });
            }
        }),

    // バックアップファイルをダウンロード（管理者のみ）
    downloadBackup: adminProcedure
        .input(z.object({ fileName: z.string() }))
        .mutation(async ({ input }) => {
            const backupDir = path.resolve(process.cwd(), "backups");
            const backupFilePath = path.join(backupDir, input.fileName);

            if (!fs.existsSync(backupFilePath)) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "バックアップファイルが見つかりません",
                });
            }

            const content = fs.readFileSync(backupFilePath, "utf-8");
            return {
                fileName: input.fileName,
                content,
            };
        }),
});

