import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure, subAdminProcedure } from "../_core/trpc";
import { getDb, getPool, schema } from "../db";
import { eq, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

export const vehiclesRouter = createTRPCRouter({
    // 車両一覧を取得
    list: protectedProcedure
        .input(
            z.object({
                status: z.enum(["in_progress", "completed", "archived"]).optional(),
                sinceYesterday: z.boolean().optional().default(false),
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                console.warn("[vehicles.list] Database connection failed, returning sample data");
                // サンプルデータを返す
                const { SAMPLE_VEHICLES } = await import("./sampleData");
                let vehicles = SAMPLE_VEHICLES;
                if (input.status) {
                    vehicles = vehicles.filter(v => v.status === input.status);
                }
                return vehicles.map((v: any) => ({
                    ...v,
                    outsourcing: [],
                }));
            }

            let vehicles;
            if (input.status) {
                vehicles = await db
                    .select()
                    .from(schema.vehicles)
                    .where(eq(schema.vehicles.status, input.status));
            } else {
                vehicles = await db.select().from(schema.vehicles);
            }

            // すべての車両IDを取得
            const vehicleIds = vehicles.map((v) => v.id);

            // すべての車両の外注先を一度に取得
            let allOutsourcing: any[] = [];
            // すべての車両の作業記録を一度に取得
            let allWorkRecords: any[] = [];

            if (vehicleIds.length > 0) {
                const { inArray } = await import("drizzle-orm");

                allOutsourcing = await db
                    .select()
                    .from(schema.vehicleOutsourcing)
                    .where(inArray(schema.vehicleOutsourcing.vehicleId, vehicleIds))
                    .orderBy(schema.vehicleOutsourcing.displayOrder);

                allWorkRecords = await db
                    .select()
                    .from(schema.workRecords)
                    .where(inArray(schema.workRecords.vehicleId, vehicleIds));
            }

            // 車両IDごとに外注先をマッピング
            const outsourcingMap = new Map<number, any[]>();
            allOutsourcing.forEach((o) => {
                const existing = outsourcingMap.get(o.vehicleId) || [];
                existing.push({
                    id: o.id,
                    destination: o.destination,
                    startDate: o.startDate,
                    endDate: o.endDate,
                    displayOrder: o.displayOrder,
                });
                outsourcingMap.set(o.vehicleId, existing);
            });

            // 車両IDごとに合計作業時間（分）を集計
            const totalMinutesMap = new Map<number, number>();
            allWorkRecords.forEach((wr) => {
                if (!wr.endTime) return;
                const minutes = Math.floor(
                    (wr.endTime.getTime() - wr.startTime.getTime()) / 1000 / 60
                );
                const current = totalMinutesMap.get(wr.vehicleId) || 0;
                totalMinutesMap.set(wr.vehicleId, current + minutes);
            });

            return vehicles.map((v: any) => ({
                id: v.id,
                vehicleNumber: v.vehicleNumber,
                vehicleTypeId: v.vehicleTypeId,
                category: v.category,
                customerName: v.customerName,
                desiredDeliveryDate: v.desiredDeliveryDate,
                checkDueDate: v.checkDueDate,
                reserveDate: v.reserveDate,
                reserveRound: v.reserveRound,
                hasCoating: v.hasCoating,
                hasLine: v.hasLine,
                hasPreferredNumber: v.hasPreferredNumber,
                hasTireReplacement: v.hasTireReplacement,
                instructionSheetUrl: v.instructionSheetUrl,
                outsourcingDestination: v.outsourcingDestination, // 後方互換性のため残す
                outsourcingStartDate: v.outsourcingStartDate, // 後方互換性のため残す
                outsourcingEndDate: v.outsourcingEndDate, // 後方互換性のため残す
                outsourcing: outsourcingMap.get(v.id) || [], // 新しい外注先配列
                completionDate: v.completionDate,
                status: v.status,
                targetTotalMinutes: v.targetTotalMinutes,
                totalWorkMinutes: totalMinutesMap.get(v.id) || 0,
                processTime: [],
                processTargets: [],
            }));
        }),

    // 車両を作成（全ユーザー可）
    create: protectedProcedure
        .input(
            z.object({
                vehicleNumber: z.string().optional(),
                vehicleTypeId: z.number(),
                category: z.enum(["一般", "キャンパー", "中古", "修理", "クレーム"]).default("一般"),
                customerName: z.string().optional(),
                desiredDeliveryDate: z.date().optional(),
                checkDueDate: z.date().optional(),
                reserveDate: z.date().optional(),
                reserveRound: z.string().optional(),
                hasCoating: z.enum(["yes", "no"]).optional(),
                hasLine: z.enum(["yes", "no"]).optional(),
                hasPreferredNumber: z.enum(["yes", "no"]).optional(),
                hasTireReplacement: z.enum(["summer", "winter", "no"]).optional(),
                instructionSheetUrl: z.string().optional(),
                outsourcingDestination: z.string().optional(),
                outsourcingStartDate: z.date().optional(),
                outsourcingEndDate: z.date().optional(),
                targetTotalMinutes: z.number().optional(),
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

            // vehicleNumberが指定されていない場合、自動生成する
            let vehicleNumber = input.vehicleNumber;

            try {
                if (!vehicleNumber || vehicleNumber.trim() === "") {
                    const currentYear = new Date().getFullYear();
                    const yearPrefix = `${currentYear}-`;

                    // その年の車両番号を取得（YYYY-N形式）
                    const pool = getPool();
                    if (!pool) {
                        throw new TRPCError({
                            code: "INTERNAL_SERVER_ERROR",
                            message: "データベースプールに接続できません",
                        });
                    }

                    const query = `
                        SELECT vehicleNumber
                        FROM \`vehicles\`
                        WHERE vehicleNumber LIKE ?
                        ORDER BY vehicleNumber DESC
                    `;
                    const [rows]: any = await pool.execute(query, [`${yearPrefix}%`]);

                    // 最大の番号を取得
                    let maxNumber = 0;
                    for (const row of rows as any[]) {
                        const vehicleNumber = row.vehicleNumber;
                        const match = vehicleNumber.match(new RegExp(`^${currentYear}-(\\d+)$`));
                        if (match) {
                            const num = parseInt(match[1], 10);
                            if (num > maxNumber) {
                                maxNumber = num;
                            }
                        }
                    }

                    // 次の番号を生成
                    const nextNumber = maxNumber + 1;
                    vehicleNumber = `${currentYear}-${nextNumber}`;

                    console.log(`[vehicles.create] 車両番号を自動生成しました: ${vehicleNumber} (現在の最大番号: ${maxNumber})`);
                }

                await db.insert(schema.vehicles).values({
                    vehicleNumber: vehicleNumber,
                    vehicleTypeId: input.vehicleTypeId,
                    category: input.category,
                    customerName: input.customerName,
                    desiredDeliveryDate: input.desiredDeliveryDate,
                    checkDueDate: input.checkDueDate,
                    reserveDate: input.reserveDate,
                    reserveRound: input.reserveRound,
                    hasCoating: input.hasCoating,
                    hasLine: input.hasLine,
                    hasPreferredNumber: input.hasPreferredNumber,
                    hasTireReplacement: input.hasTireReplacement,
                    instructionSheetUrl: input.instructionSheetUrl,
                    outsourcingDestination: input.outsourcingDestination,
                    outsourcingStartDate: input.outsourcingStartDate,
                    outsourcingEndDate: input.outsourcingEndDate,
                    targetTotalMinutes: input.targetTotalMinutes,
                });

                // 挿入されたレコードを取得（車両番号で検索）
                const [inserted] = await db
                    .select()
                    .from(schema.vehicles)
                    .where(eq(schema.vehicles.vehicleNumber, vehicleNumber))
                    .orderBy(desc(schema.vehicles.id))
                    .limit(1);

                if (!inserted) {
                    console.error(`[vehicles.create] 警告: 挿入した車両が見つかりません: ${vehicleNumber}`);
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "車両の作成に成功しましたが、データの確認に失敗しました",
                    });
                }

                console.log(`[vehicles.create] 車両を作成しました: ${vehicleNumber} (ID: ${inserted.id})`);

                return {
                    id: inserted.id,
                };
            } catch (error: any) {
                console.error(`[vehicles.create] エラー: 車両作成に失敗しました: ${vehicleNumber || "自動生成"}`, error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error.message || "車両の作成に失敗しました",
                });
            }
        }),

    // 車両を更新（準管理者以上）
    update: subAdminProcedure
        .input(
            z.object({
                id: z.number(),
                vehicleNumber: z.string().optional(),
                vehicleTypeId: z.number().optional(),
                category: z.enum(["一般", "キャンパー", "中古", "修理", "クレーム"]).optional(),
                customerName: z.string().optional(),
                desiredDeliveryDate: z.date().optional(),
                checkDueDate: z.date().optional(),
                reserveDate: z.date().optional(),
                reserveRound: z.string().optional(),
                hasCoating: z.enum(["yes", "no"]).optional(),
                hasLine: z.enum(["yes", "no"]).optional(),
                hasPreferredNumber: z.enum(["yes", "no"]).optional(),
                hasTireReplacement: z.enum(["summer", "winter", "no"]).optional(),
                instructionSheetUrl: z.string().optional(),
                outsourcingDestination: z.string().optional(),
                outsourcingStartDate: z.date().optional(),
                outsourcingEndDate: z.date().optional(),
                targetTotalMinutes: z.number().optional(),
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

            try {
                const updateData: any = {};
                if (input.vehicleNumber !== undefined) updateData.vehicleNumber = input.vehicleNumber;
                if (input.vehicleTypeId !== undefined) updateData.vehicleTypeId = input.vehicleTypeId;
                if (input.category !== undefined) updateData.category = input.category;
                if (input.customerName !== undefined) updateData.customerName = input.customerName;
                if (input.desiredDeliveryDate !== undefined) {
                    // 日付が有効か確認
                    if (input.desiredDeliveryDate instanceof Date && !isNaN(input.desiredDeliveryDate.getTime())) {
                        updateData.desiredDeliveryDate = input.desiredDeliveryDate;
                    }
                }
                if (input.checkDueDate !== undefined) {
                    // 日付が有効か確認
                    if (input.checkDueDate instanceof Date && !isNaN(input.checkDueDate.getTime())) {
                        updateData.checkDueDate = input.checkDueDate;
                    }
                }
                if (input.reserveDate !== undefined) {
                    if (input.reserveDate instanceof Date && !isNaN(input.reserveDate.getTime())) {
                        updateData.reserveDate = input.reserveDate;
                    }
                }
                if (input.reserveRound !== undefined) updateData.reserveRound = input.reserveRound;
                if (input.hasCoating !== undefined) updateData.hasCoating = input.hasCoating;
                if (input.hasLine !== undefined) updateData.hasLine = input.hasLine;
                if (input.hasPreferredNumber !== undefined) updateData.hasPreferredNumber = input.hasPreferredNumber;
                if (input.hasTireReplacement !== undefined) updateData.hasTireReplacement = input.hasTireReplacement;
                if (input.instructionSheetUrl !== undefined) updateData.instructionSheetUrl = input.instructionSheetUrl;
                if (input.outsourcingDestination !== undefined) updateData.outsourcingDestination = input.outsourcingDestination;
                if (input.outsourcingStartDate !== undefined) {
                    if (input.outsourcingStartDate instanceof Date && !isNaN(input.outsourcingStartDate.getTime())) {
                        updateData.outsourcingStartDate = input.outsourcingStartDate;
                    }
                }
                if (input.outsourcingEndDate !== undefined) {
                    if (input.outsourcingEndDate instanceof Date && !isNaN(input.outsourcingEndDate.getTime())) {
                        updateData.outsourcingEndDate = input.outsourcingEndDate;
                    }
                }
                if (input.targetTotalMinutes !== undefined)
                    updateData.targetTotalMinutes = input.targetTotalMinutes;

                // 更新データが空の場合はエラー
                if (Object.keys(updateData).length === 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "更新するデータがありません",
                    });
                }

                await db.update(schema.vehicles).set(updateData).where(eq(schema.vehicles.id, input.id));

                console.log(`[vehicles.update] 車両を更新しました: ID=${input.id}, 更新項目=${Object.keys(updateData).join(", ")}`);

                // 更新後のデータを確認
                const [updated] = await db
                    .select()
                    .from(schema.vehicles)
                    .where(eq(schema.vehicles.id, input.id))
                    .limit(1);

                if (!updated) {
                    console.error(`[vehicles.update] 警告: 更新した車両が見つかりません: ID=${input.id}`);
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "車両の更新に成功しましたが、データの確認に失敗しました",
                    });
                }

                return { success: true };
            } catch (error: any) {
                console.error("[vehicles.update] Error:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error.message || "車両の更新に失敗しました",
                });
            }
        }),

    // 車両詳細を取得
    get: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            const [vehicle] = await db
                .select()
                .from(schema.vehicles)
                .where(eq(schema.vehicles.id, input.id))
                .limit(1);

            if (!vehicle) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "車両が見つかりません",
                });
            }

            // 作業記録を取得
            const workRecords = await db
                .select()
                .from(schema.workRecords)
                .where(eq(schema.workRecords.vehicleId, input.id))
                .orderBy(schema.workRecords.startTime);

            // ユーザー、工程情報を取得（nameやcategoryカラムが存在しない場合に対応）
            const { selectUsersSafely } = await import("../db");
            const users = await selectUsersSafely(db);
            const processes = await db.select().from(schema.processes);
            const userMap = new Map(users.map((u) => [u.id, u]));
            const processMap = new Map(processes.map((p) => [p.id, p]));

            // メモを取得
            const memos = await db
                .select()
                .from(schema.vehicleMemos)
                .where(eq(schema.vehicleMemos.vehicleId, input.id))
                .orderBy(schema.vehicleMemos.createdAt);

            // 外注先を取得
            const outsourcing = await db
                .select()
                .from(schema.vehicleOutsourcing)
                .where(eq(schema.vehicleOutsourcing.vehicleId, input.id))
                .orderBy(schema.vehicleOutsourcing.displayOrder);

            // 工程別作業時間を集計
            const processTimeMap = new Map<number, number>();
            workRecords.forEach((wr) => {
                if (wr.endTime) {
                    const minutes = Math.floor(
                        (wr.endTime.getTime() - wr.startTime.getTime()) / 1000 / 60
                    );
                    const current = processTimeMap.get(wr.processId) || 0;
                    processTimeMap.set(wr.processId, current + minutes);
                }
            });

            const processTime = Array.from(processTimeMap.entries()).map(([processId, minutes]) => ({
                processId,
                processName: processMap.get(processId)?.name || "不明",
                minutes,
            }));

            return {
                ...vehicle,
                workRecords: workRecords.map((wr) => ({
                    id: wr.id,
                    userId: wr.userId,
                    userName: userMap.get(wr.userId)?.name || userMap.get(wr.userId)?.username || "不明",
                    processId: wr.processId,
                    processName: processMap.get(wr.processId)?.name || "不明",
                    startTime: wr.startTime,
                    endTime: wr.endTime,
                    durationMinutes: wr.endTime
                        ? Math.floor((wr.endTime.getTime() - wr.startTime.getTime()) / 1000 / 60)
                        : null,
                    workDescription: wr.workDescription,
                })),
                memos: memos.map((m) => ({
                    id: m.id,
                    userId: m.userId,
                    userName: userMap.get(m.userId)?.name || userMap.get(m.userId)?.username || "不明",
                    content: m.content,
                    createdAt: m.createdAt,
                })),
                outsourcing: outsourcing.map((o) => ({
                    id: o.id,
                    destination: o.destination,
                    startDate: o.startDate,
                    endDate: o.endDate,
                    displayOrder: o.displayOrder,
                })),
                processTime,
            };
        }),

    // 車両を削除（準管理者以上）
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

            // 削除前にデータを確認
            const [vehicle] = await db
                .select()
                .from(schema.vehicles)
                .where(eq(schema.vehicles.id, input.id))
                .limit(1);

            if (!vehicle) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "車両が見つかりません",
                });
            }

            console.log(`[vehicles.delete] 車両を削除します: ID=${input.id}, 車両番号=${vehicle.vehicleNumber}`);

            await db.delete(schema.vehicles).where(eq(schema.vehicles.id, input.id));

            console.log(`[vehicles.delete] 車両を削除しました: ID=${input.id}, 車両番号=${vehicle.vehicleNumber}`);

            return { success: true };
        }),

    // 車両を完成にする（準管理者以上）
    complete: subAdminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await db
                .update(schema.vehicles)
                .set({
                    status: "completed",
                    completionDate: new Date(),
                })
                .where(eq(schema.vehicles.id, input.id));

            return { success: true };
        }),

    // 車両を保管する（準管理者以上）
    archive: subAdminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await db
                .update(schema.vehicles)
                .set({
                    status: "archived",
                })
                .where(eq(schema.vehicles.id, input.id));

            return { success: true };
        }),

    // 車両を作業中に戻す（準管理者以上）
    uncomplete: subAdminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await db
                .update(schema.vehicles)
                .set({
                    status: "in_progress",
                    completionDate: null,
                })
                .where(eq(schema.vehicles.id, input.id));

            return { success: true };
        }),

    // 車両を完成に戻す（準管理者以上）
    unarchive: subAdminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await db
                .update(schema.vehicles)
                .set({
                    status: "completed",
                })
                .where(eq(schema.vehicles.id, input.id));

            return { success: true };
        }),

    // 指示書ファイルをアップロード（準管理者以上）
    uploadInstructionSheet: subAdminProcedure
        .input(
            z.object({
                vehicleId: z.number(),
                fileData: z.string(), // base64エンコードされたファイルデータ
                fileName: z.string(),
                fileType: z.enum(["image/jpeg", "image/jpg", "application/pdf"]),
            })
        )
        .mutation(async ({ input }) => {
            try {
                // アップロードディレクトリを作成
                const uploadDir = path.resolve(process.cwd(), "uploads", "instruction-sheets");
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                // ファイル拡張子を決定
                const extension = input.fileType === "application/pdf" ? "pdf" : "jpg";
                const fileName = `${input.vehicleId}_${nanoid()}.${extension}`;
                const filePath = path.join(uploadDir, fileName);

                // base64データをデコードしてファイルに保存
                const base64Data = input.fileData.replace(/^data:.*,/, "");
                const buffer = Buffer.from(base64Data, "base64");
                fs.writeFileSync(filePath, buffer);

                // ファイルURLを生成（/uploads/instruction-sheets/ファイル名）
                const fileUrl = `/uploads/instruction-sheets/${fileName}`;

                // データベースを更新
                const db = await getDb();
                if (!db) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "データベースに接続できません",
                    });
                }

                await db
                    .update(schema.vehicles)
                    .set({ instructionSheetUrl: fileUrl })
                    .where(eq(schema.vehicles.id, input.vehicleId));

                return { success: true, fileUrl };
            } catch (error: any) {
                console.error("[vehicles.uploadInstructionSheet] Error:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error.message || "ファイルのアップロードに失敗しました",
                });
            }
        }),

    // 注意ポイントを追加（全ユーザー可、ただし基本的に管理ページから）
    addAttentionPoint: protectedProcedure
        .input(
            z.object({
                vehicleId: z.number(),
                content: z.string().min(1),
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

            await db.insert(schema.vehicleAttentionPoints).values({
                vehicleId: input.vehicleId,
                userId: ctx.user!.id,
                content: input.content,
            });

            return { success: true };
        }),

    // 注意ポイントを更新（準管理者以上）
    updateAttentionPoint: subAdminProcedure
        .input(
            z.object({
                id: z.number(),
                content: z.string().min(1),
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

            await db
                .update(schema.vehicleAttentionPoints)
                .set({
                    content: input.content,
                    updatedAt: new Date(),
                } as any)
                .where(eq(schema.vehicleAttentionPoints.id, input.id));

            return { success: true };
        }),

    // メモを追加（全ユーザー可）
    addMemo: protectedProcedure
        .input(
            z.object({
                vehicleId: z.number(),
                content: z.string().min(1),
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

            await db.insert(schema.vehicleMemos).values({
                vehicleId: input.vehicleId,
                userId: ctx.user!.id,
                content: input.content,
            });

            return { success: true };
        }),

    // 注意ポイントを取得
    getAttentionPoints: protectedProcedure
        .input(z.object({ vehicleId: z.number() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            const attentionPoints = await db
                .select()
                .from(schema.vehicleAttentionPoints)
                .where(eq(schema.vehicleAttentionPoints.vehicleId, input.vehicleId));

            // ユーザー情報を取得（nameやcategoryカラムが存在しない場合に対応）
            const userIds = [...new Set(attentionPoints.map((ap) => ap.userId))];
            let users: any[] = [];
            if (userIds.length > 0) {
                const { inArray } = await import("drizzle-orm");
                const { selectUsersSafely } = await import("../db");
                users = await selectUsersSafely(db, inArray(schema.users.id, userIds));
            }

            const userMap = new Map(users.map((u) => [u.id, u]));

            return attentionPoints.map((ap) => ({
                id: ap.id,
                vehicleId: ap.vehicleId,
                content: ap.content,
                userId: ap.userId,
                userName: userMap.get(ap.userId)?.name || userMap.get(ap.userId)?.username || "不明",
                createdAt: ap.createdAt,
            }));
        }),

    // 注意ポイントを削除（準管理者以上）
    deleteAttentionPoint: subAdminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await db.delete(schema.vehicleAttentionPoints).where(eq(schema.vehicleAttentionPoints.id, input.id));

            return { success: true };
        }),

    // 車両の外注先を取得
    getVehicleOutsourcing: protectedProcedure
        .input(z.object({ vehicleId: z.number() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            const outsourcing = await db
                .select()
                .from(schema.vehicleOutsourcing)
                .where(eq(schema.vehicleOutsourcing.vehicleId, input.vehicleId))
                .orderBy(schema.vehicleOutsourcing.displayOrder);

            return outsourcing;
        }),

    // 車両の外注先を設定（最大2個、準管理者以上）
    setVehicleOutsourcing: subAdminProcedure
        .input(
            z.object({
                vehicleId: z.number(),
                outsourcing: z
                    .array(
                        z.object({
                            destination: z.string(),
                            startDate: z.date().optional(),
                            endDate: z.date().optional(),
                        })
                    )
                    .max(2), // 最大2個
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

            // 既存の外注先を削除
            await db
                .delete(schema.vehicleOutsourcing)
                .where(eq(schema.vehicleOutsourcing.vehicleId, input.vehicleId));

            // 新しい外注先を追加
            if (input.outsourcing.length > 0) {
                await db.insert(schema.vehicleOutsourcing).values(
                    input.outsourcing.map((o, index) => ({
                        vehicleId: input.vehicleId,
                        destination: o.destination,
                        startDate: o.startDate,
                        endDate: o.endDate,
                        displayOrder: index + 1,
                    }))
                );
            }

            return { success: true };
        }),

    // 車両の外注先を削除（準管理者以上）
    deleteVehicleOutsourcing: subAdminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "データベースに接続できません",
                });
            }

            await db.delete(schema.vehicleOutsourcing).where(eq(schema.vehicleOutsourcing.id, input.id));

            return { success: true };
        }),
});

