import bcrypt from "bcryptjs";
import { eq, like } from "drizzle-orm";
import { getDb, schema } from "./db";
import { ENV } from "./_core/env";

export async function initializeInitialData() {
    const db = await getDb();
    if (!db) {
        console.warn("[Init] Database not available, skipping initialization");
        return;
    }

    try {
        // 1. 初期ユーザーの作成
        await initializeUsers(db);

        // 2. 初期工程の作成
        await initializeProcesses(db);

        // 3. 初期車種の作成
        await initializeVehicleTypes(db);

        // 4. サンプルデータを投入（環境変数で制御可能、デフォルトは常に実行）
        const shouldInitSampleData = process.env.INIT_SAMPLE_DATA !== "false";
        console.log(`[Init] NODE_ENV: ${process.env.NODE_ENV}, isProduction: ${ENV.isProduction}, INIT_SAMPLE_DATA: ${process.env.INIT_SAMPLE_DATA ?? "undefined (default: true)"}`);
        if (shouldInitSampleData) {
            console.log("[Init] Initializing sample data...");
            await initializeSampleData(db);
        } else {
            console.log("[Init] Skipping sample data initialization (INIT_SAMPLE_DATA=false)");
        }

        console.log("[Init] Initial data initialized successfully");
    } catch (error) {
        console.error("[Init] Failed to initialize initial data:", error);
    }
}

async function initializeUsers(db: any) {
    try {
        // 既存のユーザーを確認
        const existingUsers = await db.select().from(schema.users).limit(1);
        if (existingUsers.length > 0) {
            console.log("[Init] Users already exist, skipping user initialization");
            return;
        }
    } catch (error) {
        console.warn("[Init] Failed to check existing users:", error);
        return;
    }

    // 管理者アカウント
    const adminPassword = await bcrypt.hash("admin123", 10);
    await db.insert(schema.users).values({
        username: "admin",
        password: adminPassword,
        name: "管理者",
        role: "admin",
    });

    // スタッフアカウント（40人）- 大工らしい名前
    const staffPassword = await bcrypt.hash("password", 10);
    const staffUsers = [];
    const carpenterNames = [
        "大工太郎", "棟梁一郎", "職人二郎", "匠三郎", "工務四郎",
        "建築五郎", "現場六郎", "施工七郎", "作業八郎", "建設九郎",
        "大工花子", "職人美咲", "現場由美", "施工さくら", "作業みどり",
        "建築あかり", "工務ひなた", "匠まゆみ", "棟梁あゆみ", "建設なつき"
    ];
    for (let i = 1; i <= 20; i++) {
        const username = `user${String(i).padStart(3, "0")}`;
        const name = carpenterNames[i - 1] || `大工${i}`;
        staffUsers.push({
            username,
            password: staffPassword,
            name,
            role: "field_worker",
        });
    }

    // バッチで挿入（1000件ずつ）
    for (let i = 0; i < staffUsers.length; i += 1000) {
        const batch = staffUsers.slice(i, i + 1000);
        await db.insert(schema.users).values(batch);
    }

    console.log("[Init] Created admin account (admin/admin123) and 20 staff accounts (user001-user020/password)");
}

async function initializeProcesses(db: any) {
    try {
        // 既存の工程を確認
        const existingProcesses = await db.select().from(schema.processes).limit(1);
        if (existingProcesses.length > 0) {
            console.log("[Init] Processes already exist, skipping process initialization");
            return;
        }
    } catch (error) {
        console.warn("[Init] Failed to check existing processes:", error);
        return;
    }

    const processes = [
        { name: "基礎工事", description: "基礎のコンクリート打設、型枠組み", majorCategory: "基礎", minorCategory: "基礎工事", displayOrder: 1 },
        { name: "下地工事", description: "断熱材施工、根太取り付け、床下換気", majorCategory: "下地", minorCategory: "断熱", displayOrder: 2 },
        { name: "電気工事", description: "屋内配線、コンセント・スイッチ設置、分電盤設置", majorCategory: "電気", minorCategory: "配線", displayOrder: 3 },
        { name: "水道工事", description: "給排水管の接続、水回り設備の設置", majorCategory: "水道", minorCategory: "給排水", displayOrder: 4 },
        { name: "内装工事", description: "壁紙貼り、床材施工、天井施工、建具取り付け", majorCategory: "内装", minorCategory: "仕上げ", displayOrder: 5 },
        { name: "外装工事", description: "外壁施工、屋根工事、雨樋取り付け", majorCategory: "外装", minorCategory: "外壁", displayOrder: 6 },
        { name: "設備工事", description: "エアコン設置、換気扇設置、給湯器設置", majorCategory: "設備", minorCategory: "空調", displayOrder: 7 },
        { name: "最終確認", description: "最終清掃、最終チェック、完成検査", majorCategory: "確認", minorCategory: "最終", displayOrder: 8 },
    ];

    await db.insert(schema.processes).values(processes);
    console.log("[Init] Created 10 initial processes");
}

async function initializeVehicleTypes(db: any) {
    try {
        // 既存の車種を確認
        const existingVehicleTypes = await db.select().from(schema.vehicleTypes).limit(1);
        if (existingVehicleTypes.length > 0) {
            console.log("[Init] VehicleTypes already exist, skipping vehicle type initialization");
            return;
        }
    } catch (error) {
        console.warn("[Init] Failed to check existing vehicle types:", error);
        return;
    }

    const vehicleTypes = [
        { name: "一般車両", description: "一般的な車両", standardTotalMinutes: 480 },
        { name: "キャンパー", description: "キャンピングカー", standardTotalMinutes: 720 },
    ];

    await db.insert(schema.vehicleTypes).values(vehicleTypes);
    console.log("[Init] Created initial vehicle types");
}

/**
 * 開発用のサンプルデータを投入する
 * - スタッフ: sample_staff01〜sample_staff40
 * - 車両: SAMPLE-001〜SAMPLE-005
 * - チェック項目: サンプルチェック01〜サンプルチェック30
 */
async function initializeSampleData(db: any) {
    try {
        console.log("[Init] Initializing sample data (users, vehicles, checkItems)...");

        // 1. スタッフサンプル 40人
        try {
            const existingSampleUsers = await db
                .select({ username: schema.users.username })
                .from(schema.users)
                .where(like(schema.users.username, "sample_staff%"))
                .limit(1);

            if (existingSampleUsers.length === 0) {
                const passwordHash = await bcrypt.hash("password", 10);
                const sampleUsers = [];
                for (let i = 1; i <= 40; i++) {
                    const no = String(i).padStart(2, "0");
                    sampleUsers.push({
                        username: `sample_staff${no}`,
                        password: passwordHash,
                        name: `スタッフ${no}`,
                        role: "field_worker" as const,
                    });
                }
                await db.insert(schema.users).values(sampleUsers);
                console.log("[Init] Created 40 sample staff users (sample_staff01-sample_staff40/password)");
            } else {
                console.log("[Init] Sample staff users already exist, skipping");
            }
        } catch (error) {
            console.warn("[Init] Failed to initialize sample staff users:", error);
        }

        // 2. 車両サンプル（大工が家を作っている想定でわかりやすい名前）
        try {
            console.log("[Init] Starting sample vehicle initialization...");
            
            // 既存のサンプル車両とその作業記録を削除
            const existingSampleVehicles = await db
                .select({ id: schema.vehicles.id })
                .from(schema.vehicles)
                .where(like(schema.vehicles.vehicleNumber, "家-%"));
            
            console.log(`[Init] Found ${existingSampleVehicles.length} existing sample vehicles`);
            
            if (existingSampleVehicles.length > 0) {
                const vehicleIds = existingSampleVehicles.map(v => v.id);
                // 作業記録を削除
                const { inArray } = await import("drizzle-orm");
                await db.delete(schema.workRecords).where(inArray(schema.workRecords.vehicleId, vehicleIds));
                // 車両チェック記録も削除
                await db.delete(schema.vehicleChecks).where(inArray(schema.vehicleChecks.vehicleId, vehicleIds));
                // 車両を削除
                await db.delete(schema.vehicles).where(inArray(schema.vehicles.id, vehicleIds));
                console.log(`[Init] Deleted ${existingSampleVehicles.length} existing sample vehicles and their related records`);
            }

            // 車種マスタを確認
                const vehicleTypes = await db
                    .select({ id: schema.vehicleTypes.id })
                    .from(schema.vehicleTypes)
                    .limit(1);
            
            console.log(`[Init] Found ${vehicleTypes.length} vehicle types`);
            
                if (vehicleTypes.length === 0) {
                console.error("[Init] ERROR: No vehicleTypes found! Cannot create sample vehicles.");
                console.error("[Init] Please ensure vehicle types are initialized before sample data.");
                } else {
                    const vehicleTypeId = vehicleTypes[0].id;
                    // 建設現場のサンプルデータ（20件の家）
                    const houseNames = [
                        { number: "001", customer: "田中太郎さんの家", minutes: 480, desiredDeliveryDate: new Date("2024-12-15"), checkDueDate: new Date("2024-12-10"), hasCoating: "yes" as const, hasLine: "no" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "no" as const, outsourcingDestination: "外注先A" },
                        { number: "002", customer: "佐藤花子さんの家", minutes: 720, desiredDeliveryDate: new Date("2024-12-20"), checkDueDate: new Date("2024-12-15"), hasCoating: "no" as const, hasLine: "yes" as const, hasPreferredNumber: "no" as const, hasTireReplacement: "summer" as const, outsourcingDestination: "外注先B" },
                        { number: "003", customer: "鈴木一郎さんの家", minutes: 360, desiredDeliveryDate: new Date("2024-12-18"), checkDueDate: new Date("2024-12-12"), hasCoating: "yes" as const, hasLine: "yes" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "winter" as const, outsourcingDestination: null },
                        { number: "004", customer: "山田次郎さんの家", minutes: 600, desiredDeliveryDate: new Date("2024-12-25"), checkDueDate: new Date("2024-12-20"), hasCoating: "no" as const, hasLine: "no" as const, hasPreferredNumber: "no" as const, hasTireReplacement: "no" as const, outsourcingDestination: "外注先C" },
                        { number: "005", customer: "中村三郎さんの家", minutes: 240, desiredDeliveryDate: new Date("2024-12-12"), checkDueDate: new Date("2024-12-08"), hasCoating: "yes" as const, hasLine: "no" as const, hasPreferredNumber: "no" as const, hasTireReplacement: "no" as const, outsourcingDestination: null },
                        { number: "006", customer: "伊藤四郎さんの家", minutes: 540, desiredDeliveryDate: new Date("2024-12-22"), checkDueDate: new Date("2024-12-17"), hasCoating: "no" as const, hasLine: "yes" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "no" as const, outsourcingDestination: "外注先A" },
                        { number: "007", customer: "高橋五郎さんの家", minutes: 420, desiredDeliveryDate: new Date("2024-12-16"), checkDueDate: new Date("2024-12-11"), hasCoating: "yes" as const, hasLine: "no" as const, hasPreferredNumber: "no" as const, hasTireReplacement: "summer" as const, outsourcingDestination: "外注先B" },
                        { number: "008", customer: "渡辺六郎さんの家", minutes: 680, desiredDeliveryDate: new Date("2024-12-28"), checkDueDate: new Date("2024-12-23"), hasCoating: "no" as const, hasLine: "yes" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "winter" as const, outsourcingDestination: null },
                        { number: "009", customer: "斎藤七郎さんの家", minutes: 380, desiredDeliveryDate: new Date("2024-12-14"), checkDueDate: new Date("2024-12-09"), hasCoating: "yes" as const, hasLine: "yes" as const, hasPreferredNumber: "no" as const, hasTireReplacement: "no" as const, outsourcingDestination: "外注先C" },
                        { number: "010", customer: "小林八郎さんの家", minutes: 520, desiredDeliveryDate: new Date("2024-12-19"), checkDueDate: new Date("2024-12-14"), hasCoating: "no" as const, hasLine: "no" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "no" as const, outsourcingDestination: "外注先A" },
                        { number: "011", customer: "加藤九郎さんの家", minutes: 460, desiredDeliveryDate: new Date("2024-12-17"), checkDueDate: new Date("2024-12-12"), hasCoating: "yes" as const, hasLine: "no" as const, hasPreferredNumber: "no" as const, hasTireReplacement: "summer" as const, outsourcingDestination: "外注先B" },
                        { number: "012", customer: "吉田十郎さんの家", minutes: 640, desiredDeliveryDate: new Date("2024-12-26"), checkDueDate: new Date("2024-12-21"), hasCoating: "no" as const, hasLine: "yes" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "winter" as const, outsourcingDestination: null },
                        { number: "013", customer: "山本十一さんの家", minutes: 340, desiredDeliveryDate: new Date("2024-12-13"), checkDueDate: new Date("2024-12-08"), hasCoating: "yes" as const, hasLine: "yes" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "no" as const, outsourcingDestination: "外注先C" },
                        { number: "014", customer: "松本十二さんの家", minutes: 580, desiredDeliveryDate: new Date("2024-12-24"), checkDueDate: new Date("2024-12-19"), hasCoating: "no" as const, hasLine: "no" as const, hasPreferredNumber: "no" as const, hasTireReplacement: "no" as const, outsourcingDestination: "外注先A" },
                        { number: "015", customer: "井上十三さんの家", minutes: 400, desiredDeliveryDate: new Date("2024-12-15"), checkDueDate: new Date("2024-12-10"), hasCoating: "yes" as const, hasLine: "no" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "summer" as const, outsourcingDestination: "外注先B" },
                        { number: "016", customer: "木村十四さんの家", minutes: 700, desiredDeliveryDate: new Date("2024-12-29"), checkDueDate: new Date("2024-12-24"), hasCoating: "no" as const, hasLine: "yes" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "winter" as const, outsourcingDestination: null },
                        { number: "017", customer: "林十五さんの家", minutes: 320, desiredDeliveryDate: new Date("2024-12-11"), checkDueDate: new Date("2024-12-06"), hasCoating: "yes" as const, hasLine: "yes" as const, hasPreferredNumber: "no" as const, hasTireReplacement: "no" as const, outsourcingDestination: "外注先C" },
                        { number: "018", customer: "斉藤十六さんの家", minutes: 560, desiredDeliveryDate: new Date("2024-12-21"), checkDueDate: new Date("2024-12-16"), hasCoating: "no" as const, hasLine: "no" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "no" as const, outsourcingDestination: "外注先A" },
                        { number: "019", customer: "田村十七さんの家", minutes: 440, desiredDeliveryDate: new Date("2024-12-16"), checkDueDate: new Date("2024-12-11"), hasCoating: "yes" as const, hasLine: "no" as const, hasPreferredNumber: "no" as const, hasTireReplacement: "summer" as const, outsourcingDestination: "外注先B" },
                        { number: "020", customer: "中島十八さんの家", minutes: 620, desiredDeliveryDate: new Date("2024-12-27"), checkDueDate: new Date("2024-12-22"), hasCoating: "no" as const, hasLine: "yes" as const, hasPreferredNumber: "yes" as const, hasTireReplacement: "winter" as const, outsourcingDestination: null },
                    ];
                    const sampleVehicles = [];
                    for (const house of houseNames) {
                        sampleVehicles.push({
                            vehicleNumber: `家-${house.number}`,
                            vehicleTypeId,
                            category: "一般" as const,
                            customerName: house.customer,
                            status: "in_progress" as const,
                            targetTotalMinutes: house.minutes * 1.2, // 目標時間は実績の1.2倍
                            desiredDeliveryDate: house.desiredDeliveryDate,
                            checkDueDate: house.checkDueDate,
                            hasCoating: house.hasCoating,
                            hasLine: house.hasLine,
                            hasPreferredNumber: house.hasPreferredNumber,
                            hasTireReplacement: house.hasTireReplacement,
                            outsourcingDestination: house.outsourcingDestination,
                        });
                    }
                    await db.insert(schema.vehicles).values(sampleVehicles);
                    console.log("[Init] ✅ Created 20 sample vehicles (家-001〜家-020)");
                    
                    // 3. 作業記録のサンプルデータを追加
                    try {
                        // 挿入した車両を取得
                        const vehicles = await db
                            .select({ id: schema.vehicles.id, vehicleNumber: schema.vehicles.vehicleNumber, customerName: schema.vehicles.customerName })
                            .from(schema.vehicles)
                            .where(like(schema.vehicles.vehicleNumber, "家-%"))
                            .orderBy(schema.vehicles.id);
                        
                        const processes = await db
                            .select({ id: schema.processes.id, name: schema.processes.name })
                            .from(schema.processes)
                            .orderBy(schema.processes.displayOrder);
                        
                        // 管理者とスタッフの両方を取得
                        const adminUser = await db
                            .select({ id: schema.users.id })
                            .from(schema.users)
                            .where(eq(schema.users.role, "admin"))
                            .limit(1);
                        
                        const staffUsers = await db
                            .select({ id: schema.users.id })
                            .from(schema.users)
                            .where(eq(schema.users.role, "field_worker"))
                            .limit(20); // 20人のスタッフを使用
                        
                        // 管理者とスタッフを結合
                        const allUsers = adminUser.length > 0 ? [...adminUser, ...staffUsers] : staffUsers;
                        
                        if (vehicles.length > 0 && processes.length > 0 && allUsers.length > 0) {
                            // 既存の作業記録を削除（サンプルデータを再作成するため）
                            const { inArray } = await import("drizzle-orm");
                            const existingWorkRecords = await db
                                .select({ id: schema.workRecords.id })
                                .from(schema.workRecords)
                                .limit(10000);
                            
                            if (existingWorkRecords.length > 0) {
                                const workRecordIds = existingWorkRecords.map(r => r.id);
                                await db.delete(schema.workRecords).where(inArray(schema.workRecords.id, workRecordIds));
                                console.log(`[Init] Deleted ${existingWorkRecords.length} existing work records`);
                            }
                            
                            const workRecords = [];
                            
                            // サンプルページのため、固定日付を使用（2024年12月1日から1ヶ月分）
                            // 日付が進まないように固定値を設定
                            const baseYear = 2024;
                            const baseMonth = 11; // 12月（0-indexed）
                            const baseDay = 1;
                            
                            // 基準日を2024年12月1日に設定（1ヶ月分のデータを作成）
                            const baseDate = new Date(baseYear, baseMonth, baseDay, 8, 0, 0);
                            
                            // houseNamesを再定義（スコープの問題を回避）
                            const houseNamesMap = new Map([
                                ["001", { minutes: 480 }],
                                ["002", { minutes: 720 }],
                                ["003", { minutes: 360 }],
                                ["004", { minutes: 600 }],
                                ["005", { minutes: 240 }],
                            ]);
                            
                            // 各ユーザー（管理者とスタッフ）に対して、1ヶ月分（30日間）の作業記録を作成
                            for (let userIdx = 0; userIdx < Math.min(allUsers.length, 21); userIdx++) {
                                const userId = allUsers[userIdx].id;
                                
                                // 各日付に対して作業記録を作成（30日間分）
                                for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                                    const workDate = new Date(baseDate);
                                    workDate.setDate(workDate.getDate() + dayOffset);
                                    
                                    // 各日付に2-3件の作業記録を作成
                                    const numRecordsPerDay = 2 + (dayOffset % 2); // 2件または3件
                                    
                                    for (let recordIdx = 0; recordIdx < numRecordsPerDay; recordIdx++) {
                                        // 車両と工程を選択
                                        const vehicle = vehicles[dayOffset % vehicles.length];
                                        const process = processes[recordIdx % Math.min(processes.length, 8)];
                                        
                                        // 作業時間を設定（60分〜180分）
                                        const workMinutes = 60 + (recordIdx * 60) + (dayOffset * 20);
                                        
                                        const startTime = new Date(workDate);
                                        startTime.setHours(8 + recordIdx * 4, 0, 0, 0); // 8時、12時など
                                        
                                        const endTime = new Date(startTime);
                                        endTime.setMinutes(endTime.getMinutes() + workMinutes);
                                        
                                        workRecords.push({
                                            userId,
                                            vehicleId: vehicle.id,
                                            processId: process.id,
                                            startTime,
                                            endTime,
                                            workDescription: `${process.name}作業（${vehicle.customerName || vehicle.vehicleNumber}）`,
                                        });
                                    }
                                }
                            }
                            
                            // 既存の作業記録も追加（車両ごとの作業記録）
                            for (let vehicleIdx = 0; vehicleIdx < vehicles.length; vehicleIdx++) {
                                const vehicle = vehicles[vehicleIdx];
                                const vehicleNumber = vehicle.vehicleNumber.split("-")[1];
                                const houseData = houseNamesMap.get(vehicleNumber);
                                const totalMinutes = houseData?.minutes || 480;
                                
                                // 各工程に作業時間を分散
                                const processMinutes = [
                                    Math.floor(totalMinutes * 0.3), // 基礎工事: 30%
                                    Math.floor(totalMinutes * 0.2), // 下地工事: 20%
                                    Math.floor(totalMinutes * 0.2), // 電気工事: 20%
                                    Math.floor(totalMinutes * 0.2), // 水道工事: 20%
                                    Math.floor(totalMinutes * 0.1), // その他: 10%
                                ];
                                
                                // 各案件ごとに開始日時を少しずらす（基準日を使用）
                                const vehicleWorkDate = new Date(baseDate);
                                vehicleWorkDate.setDate(vehicleWorkDate.getDate() + vehicleIdx);
                                
                                // 各工程に対して複数の作業記録を作成
                                for (let i = 0; i < Math.min(processes.length, 8); i++) {
                                    const process = processes[i];
                                    const totalMinutes = processMinutes[i] || 60;
                                    const userId = allUsers[i % allUsers.length].id;
                                    
                                    // 1つの工程を複数の作業記録に分割（2-3回に分けて作業）
                                    const numRecords = Math.max(1, Math.floor(totalMinutes / 120)); // 2時間ごとに分割
                                    const minutesPerRecord = Math.floor(totalMinutes / numRecords);
                                    
                                    for (let j = 0; j < numRecords; j++) {
                                        const startTime = new Date(vehicleWorkDate);
                                        startTime.setHours(8 + i * 2 + j, 0, 0, 0); // 8時、9時、10時...など
                                        
                                        const endTime = new Date(startTime);
                                        endTime.setMinutes(endTime.getMinutes() + minutesPerRecord);
                                        
                                        workRecords.push({
                                            userId,
                                            vehicleId: vehicle.id,
                                            processId: process.id,
                                            startTime,
                                            endTime,
                                            workDescription: `${process.name}作業${j > 0 ? `（${j + 1}回目）` : ''}`,
                                        });
                                    }
                                }
                            }
                            
                            if (workRecords.length > 0) {
                                await db.insert(schema.workRecords).values(workRecords);
                                console.log(`[Init] ✅ Created ${workRecords.length} sample work records`);
            } else {
                                console.warn("[Init] No work records to insert");
                            }
                        }
                    } catch (error) {
                        console.warn("[Init] Failed to initialize sample work records:", error);
                    }
            }
        } catch (error) {
            console.warn("[Init] Failed to initialize sample vehicles:", error);
        }

        // 4. チェック項目サンプル（大工が家を作る際の実際のチェック項目）
        try {
            // 既存のサンプルチェック項目を削除
            const existingSampleCheckItems = await db
                .select({ id: schema.checkItems.id })
                .from(schema.checkItems)
                .where(like(schema.checkItems.name, "基礎%"));
            
            if (existingSampleCheckItems.length > 0) {
                const checkItemIds = existingSampleCheckItems.map(item => item.id);
                const { inArray } = await import("drizzle-orm");
                // チェック項目に関連するデータを削除（必要に応じて）
                await db.delete(schema.checkItems).where(inArray(schema.checkItems.id, checkItemIds));
                console.log(`[Init] Deleted ${existingSampleCheckItems.length} existing sample check items`);
            }
                const sampleCheckItems = [
                    // 基礎・下地関連
                    { category: "一般" as const, majorCategory: "基礎・下地", minorCategory: "基礎", name: "基礎の水平確認", description: "基礎が水平になっているか確認します", displayOrder: 1 },
                    { category: "一般" as const, majorCategory: "基礎・下地", minorCategory: "基礎", name: "基礎の強度確認", description: "基礎のコンクリート強度を確認します", displayOrder: 2 },
                    { category: "一般" as const, majorCategory: "基礎・下地", minorCategory: "断熱", name: "断熱材の施工確認", description: "断熱材が正しく施工されているか確認します", displayOrder: 3 },
                    { category: "一般" as const, majorCategory: "基礎・下地", minorCategory: "根太", name: "根太の取り付け確認", description: "根太が正しく取り付けられているか確認します", displayOrder: 4 },
                    { category: "一般" as const, majorCategory: "基礎・下地", minorCategory: "床下", name: "床下換気の確認", description: "床下換気口が適切に設置されているか確認します", displayOrder: 5 },
                    
                    // 電気関連
                    { category: "一般" as const, majorCategory: "電気", minorCategory: "配線", name: "屋内配線の確認", description: "屋内配線が正しく施工されているか確認します", displayOrder: 6 },
                    { category: "一般" as const, majorCategory: "電気", minorCategory: "コンセント", name: "コンセントの設置確認", description: "コンセントが適切な位置に設置されているか確認します", displayOrder: 7 },
                    { category: "一般" as const, majorCategory: "電気", minorCategory: "スイッチ", name: "スイッチの動作確認", description: "すべてのスイッチが正常に動作するか確認します", displayOrder: 8 },
                    { category: "一般" as const, majorCategory: "電気", minorCategory: "分電盤", name: "分電盤の設置確認", description: "分電盤が正しく設置されているか確認します", displayOrder: 9 },
                    { category: "一般" as const, majorCategory: "電気", minorCategory: "照明", name: "照明器具の設置確認", description: "照明器具が正しく設置されているか確認します", displayOrder: 10 },
                    
                    // 水道関連
                    { category: "一般" as const, majorCategory: "水道", minorCategory: "給水", name: "給水管の接続確認", description: "給水管が正しく接続されているか確認します", displayOrder: 11 },
                    { category: "一般" as const, majorCategory: "水道", minorCategory: "排水", name: "排水管の勾配確認", description: "排水管の勾配が適切か確認します", displayOrder: 12 },
                    { category: "一般" as const, majorCategory: "水道", minorCategory: "水回り", name: "キッチンの水回り確認", description: "キッチンの給排水が正常に動作するか確認します", displayOrder: 13 },
                    { category: "一般" as const, majorCategory: "水道", minorCategory: "水回り", name: "洗面所の水回り確認", description: "洗面所の給排水が正常に動作するか確認します", displayOrder: 14 },
                    { category: "一般" as const, majorCategory: "水道", minorCategory: "水回り", name: "お風呂の水回り確認", description: "お風呂の給排水が正常に動作するか確認します", displayOrder: 15 },
                    
                    // 内装関連
                    { category: "一般" as const, majorCategory: "内装", minorCategory: "壁", name: "壁紙の貼り付け確認", description: "壁紙が正しく貼り付けられているか確認します", displayOrder: 16 },
                    { category: "一般" as const, majorCategory: "内装", minorCategory: "床", name: "床材の施工確認", description: "床材が正しく施工されているか確認します", displayOrder: 17 },
                    { category: "一般" as const, majorCategory: "内装", minorCategory: "天井", name: "天井の施工確認", description: "天井が正しく施工されているか確認します", displayOrder: 18 },
                    { category: "一般" as const, majorCategory: "内装", minorCategory: "建具", name: "ドアの取り付け確認", description: "ドアが正しく取り付けられているか確認します", displayOrder: 19 },
                    { category: "一般" as const, majorCategory: "内装", minorCategory: "建具", name: "窓の取り付け確認", description: "窓が正しく取り付けられているか確認します", displayOrder: 20 },
                    
                    // 外装関連
                    { category: "一般" as const, majorCategory: "外装", minorCategory: "外壁", name: "外壁の施工確認", description: "外壁が正しく施工されているか確認します", displayOrder: 21 },
                    { category: "一般" as const, majorCategory: "外装", minorCategory: "屋根", name: "屋根の施工確認", description: "屋根が正しく施工されているか確認します", displayOrder: 22 },
                    { category: "一般" as const, majorCategory: "外装", minorCategory: "雨樋", name: "雨樋の取り付け確認", description: "雨樋が正しく取り付けられているか確認します", displayOrder: 23 },
                    { category: "一般" as const, majorCategory: "外装", minorCategory: "玄関", name: "玄関ドアの確認", description: "玄関ドアが正しく取り付けられているか確認します", displayOrder: 24 },
                    { category: "一般" as const, majorCategory: "外装", minorCategory: "外構", name: "外構工事の確認", description: "外構工事が完了しているか確認します", displayOrder: 25 },
                    
                    // 設備関連
                    { category: "一般" as const, majorCategory: "設備", minorCategory: "空調", name: "エアコンの設置確認", description: "エアコンが正しく設置されているか確認します", displayOrder: 26 },
                    { category: "一般" as const, majorCategory: "設備", minorCategory: "換気", name: "換気扇の動作確認", description: "換気扇が正常に動作するか確認します", displayOrder: 27 },
                    { category: "一般" as const, majorCategory: "設備", minorCategory: "給湯", name: "給湯器の設置確認", description: "給湯器が正しく設置されているか確認します", displayOrder: 28 },
                    { category: "一般" as const, majorCategory: "設備", minorCategory: "ガス", name: "ガス配管の確認", description: "ガス配管が正しく施工されているか確認します", displayOrder: 29 },
                    { category: "一般" as const, majorCategory: "設備", minorCategory: "その他", name: "最終清掃の確認", description: "最終清掃が完了しているか確認します", displayOrder: 30 },
                ];
                
            await db.insert(schema.checkItems).values(sampleCheckItems);
            console.log("[Init] ✅ Created 30 realistic check items for house construction");
        } catch (error) {
            console.warn("[Init] Failed to initialize sample check items:", error);
        }

        // 5. 車両チェック記録のサンプルデータ
        try {
            // 既存のサンプルチェック記録を削除
            const sampleVehicles = await db
                .select({ id: schema.vehicles.id })
                .from(schema.vehicles)
                .where(like(schema.vehicles.vehicleNumber, "家-%"));
            
            if (sampleVehicles.length > 0) {
                const vehicleIds = sampleVehicles.map(v => v.id);
                const { inArray } = await import("drizzle-orm");
                const existingChecks = await db
                    .select({ id: schema.vehicleChecks.id })
                    .from(schema.vehicleChecks)
                    .where(inArray(schema.vehicleChecks.vehicleId, vehicleIds));
                
                if (existingChecks.length > 0) {
                    const checkIds = existingChecks.map(c => c.id);
                    await db.delete(schema.vehicleChecks).where(inArray(schema.vehicleChecks.id, checkIds));
                    console.log(`[Init] Deleted ${existingChecks.length} existing sample vehicle checks`);
                }

                // チェック項目を取得
                const checkItems = await db
                    .select({ id: schema.checkItems.id })
                    .from(schema.checkItems)
                    .where(eq(schema.checkItems.category, "一般"))
                    .orderBy(schema.checkItems.displayOrder)
                    .limit(15); // 各車両に対して15項目をチェック

                // ユーザーを取得（チェック実施者）
                const users = await db
                    .select({ id: schema.users.id })
                    .from(schema.users)
                    .where(eq(schema.users.role, "field_worker"))
                    .limit(5);

                if (checkItems.length > 0 && users.length > 0) {
                    const vehicleChecks = [];
                    const baseDate = new Date("2024-12-01T09:00:00+09:00");

                    for (let vIdx = 0; vIdx < sampleVehicles.length; vIdx++) {
                        const vehicle = sampleVehicles[vIdx];
                        const checkedBy = users[vIdx % users.length].id;
                        
                        // 各車両に対して、チェック項目の一部をチェック済みにする
                        for (let cIdx = 0; cIdx < Math.min(checkItems.length, 10); cIdx++) {
                            const checkItem = checkItems[cIdx];
                            const checkedAt = new Date(baseDate);
                            checkedAt.setDate(checkedAt.getDate() + vIdx);
                            checkedAt.setHours(9 + cIdx, 0, 0, 0); // 9時から順番に

                            // チェック状態をランダムに設定（80%がchecked、15%がneeds_recheck、5%がunchecked）
                            const rand = Math.random();
                            let status: "checked" | "needs_recheck" | "unchecked" = "checked";
                            if (rand < 0.15) {
                                status = "needs_recheck";
                            } else if (rand < 0.20) {
                                status = "unchecked";
                            }

                            vehicleChecks.push({
                                vehicleId: vehicle.id,
                                checkItemId: checkItem.id,
                                checkedBy,
                                checkedAt,
                                status,
                                notes: status === "needs_recheck" ? "再確認が必要です" : status === "checked" ? "問題ありません" : null,
                            });
                        }
                    }

                    if (vehicleChecks.length > 0) {
                        await db.insert(schema.vehicleChecks).values(vehicleChecks);
                        console.log(`[Init] ✅ Created ${vehicleChecks.length} sample vehicle checks`);
                    } else {
                        console.warn("[Init] No vehicle checks to insert");
                    }
                }
            }
        } catch (error) {
            console.warn("[Init] Failed to initialize sample vehicle checks:", error);
        }

        // 5. ユーザー管理の表示名・ロールを一括更新（ID 2〜32）
        try {
            const userUpdates: { id: number; name: string; role: "field_worker" | "sales_office" | "sub_admin" | "admin" }[] = [
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

            for (const u of userUpdates) {
                await db
                    .update(schema.users)
                    .set({ name: u.name, role: u.role })
                    .where(eq(schema.users.id, u.id));
            }
            console.log("[Init] Updated display names and roles for users id 2-32");
        } catch (error) {
            console.warn("[Init] Failed to update user display names:", error);
        }

        // 6. ユーザー名を ID に合わせてリネーム（ID1→admin, ID2→user001, ..., ID21→user020）
        try {
            for (let id = 1; id <= 21; id++) {
                const username = id === 1 ? "admin" : `user${String(id - 1).padStart(3, "0")}`;
                await db
                    .update(schema.users)
                    .set({ username })
                    .where(eq(schema.users.id, id));
            }
            console.log("[Init] Updated usernames for users id 1-21 (admin, user001-user020)");
        } catch (error) {
            console.warn("[Init] Failed to update usernames:", error);
        }

        // 7. 出退勤記録のサンプルデータを追加（1ヶ月分、20人規模）
        try {
            // 既存の出退勤記録を削除
            const existingAttendanceRecords = await db
                .select({ id: schema.attendanceRecords.id })
                .from(schema.attendanceRecords)
                .limit(10000);

            if (existingAttendanceRecords.length > 0) {
                const { inArray } = await import("drizzle-orm");
                const recordIds = existingAttendanceRecords.map(r => r.id);
                await db.delete(schema.attendanceRecords).where(inArray(schema.attendanceRecords.id, recordIds));
                console.log(`[Init] Deleted ${existingAttendanceRecords.length} existing attendance records`);
            }

            // スタッフユーザーを取得（20人）
            const staffUsers = await db
                .select({ id: schema.users.id, name: schema.users.name })
                .from(schema.users)
                .where(eq(schema.users.role, "field_worker"))
                .limit(20);

            if (staffUsers.length > 0) {
                const attendanceRecords = [];
                // 固定日付：2024年12月1日から30日間
                const baseYear = 2024;
                const baseMonth = 11; // 12月（0-indexed）
                const baseDay = 1;

                // 各スタッフに対して、1ヶ月分（30日間）の出退勤記録を作成
                for (const user of staffUsers) {
                    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                        const workDate = new Date(baseYear, baseMonth, baseDay + dayOffset);
                        const workDateStr = `${workDate.getFullYear()}-${String(workDate.getMonth() + 1).padStart(2, "0")}-${String(workDate.getDate()).padStart(2, "0")}`;
                        
                        // 土日は出勤しない（簡易的な実装）
                        const dayOfWeek = workDate.getDay();
                        if (dayOfWeek === 0 || dayOfWeek === 6) {
                            continue; // 土日はスキップ
                        }

                        // 出勤時刻：8:00〜9:00の間でランダム
                        const clockInHour = 8 + Math.floor(Math.random() * 2); // 8時または9時
                        const clockInMinute = Math.floor(Math.random() * 60); // 0〜59分
                        const clockInTime = `${String(clockInHour).padStart(2, "0")}:${String(clockInMinute).padStart(2, "0")}`;

                        // 退勤時刻：17:00〜18:00の間でランダム
                        const clockOutHour = 17 + Math.floor(Math.random() * 2); // 17時または18時
                        const clockOutMinute = Math.floor(Math.random() * 60); // 0〜59分
                        const clockOutTime = `${String(clockOutHour).padStart(2, "0")}:${String(clockOutMinute).padStart(2, "0")}`;

                        // 勤務時間を計算（分）
                        const clockInTotalMinutes = clockInHour * 60 + clockInMinute;
                        const clockOutTotalMinutes = clockOutHour * 60 + clockOutMinute;
                        const workMinutes = clockOutTotalMinutes - clockInTotalMinutes - 80; // 80分の休憩時間を差し引く

                        attendanceRecords.push({
                            userId: user.id,
                            workDate: workDateStr as any,
                            clockInTime,
                            clockOutTime,
                            workMinutes: Math.max(0, workMinutes),
                            clockInDevice: "pc" as const,
                            clockOutDevice: "pc" as const,
                        });
                    }
                }

                if (attendanceRecords.length > 0) {
                    // バッチで挿入（1000件ずつ）
                    for (let i = 0; i < attendanceRecords.length; i += 1000) {
                        const batch = attendanceRecords.slice(i, i + 1000);
                        await db.insert(schema.attendanceRecords).values(batch);
                    }
                    console.log(`[Init] ✅ Created ${attendanceRecords.length} sample attendance records (1 month, 20 staff)`);
                }
            }
        } catch (error) {
            console.warn("[Init] Failed to initialize sample attendance records:", error);
        }

        console.log("[Init] Sample data initialization completed");
    } catch (error) {
        console.warn("[Init] Failed to initialize sample data:", error);
    }
}

