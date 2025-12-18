var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t, createTRPCRouter, publicProcedure, protectedProcedure, subAdminProcedure, adminProcedure;
var init_trpc = __esm({
  "server/_core/trpc.ts"() {
    "use strict";
    t = initTRPC.context().create({
      transformer: superjson
    });
    createTRPCRouter = t.router;
    publicProcedure = t.procedure;
    protectedProcedure = publicProcedure.use(({ ctx, next }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      return next({ ctx: { ...ctx, user: ctx.user } });
    });
    subAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
      if (ctx.user.role !== "sub_admin" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return next({ ctx });
    });
    adminProcedure = protectedProcedure.use(({ ctx, next }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return next({ ctx });
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      // RailwayではMYSQL_URLを優先的に使用（内部接続用）
      // MYSQL_URLがない場合はDATABASE_URLを使用
      databaseUrl: process.env.MYSQL_URL ?? process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      // AWS S3 バックアップ設定
      awsS3Enabled: process.env.AWS_S3_BACKUP_ENABLED === "true",
      awsS3Region: process.env.AWS_S3_REGION ?? "ap-northeast-1",
      awsS3Bucket: process.env.AWS_S3_BACKUP_BUCKET ?? "",
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? ""
    };
    console.log("[ENV] MYSQL_URL:", process.env.MYSQL_URL ? "set (length: " + process.env.MYSQL_URL.length + ")" : "not set");
    console.log("[ENV] DATABASE_URL:", process.env.DATABASE_URL ? "set (length: " + process.env.DATABASE_URL.length + ")" : "not set");
    if (ENV.databaseUrl) {
      const maskedUrl = ENV.databaseUrl.replace(/:([^:@]+)@/, ":****@");
      console.log("[ENV] Using databaseUrl:", maskedUrl);
    } else {
      console.log("[ENV] Using databaseUrl: not set");
    }
  }
});

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  attendanceEditLogs: () => attendanceEditLogs,
  attendanceRecords: () => attendanceRecords,
  breakTimes: () => breakTimes,
  bulletinMessages: () => bulletinMessages,
  checkItems: () => checkItems,
  checkRequests: () => checkRequests,
  deliveryScheduleChatReads: () => deliveryScheduleChatReads,
  deliveryScheduleChats: () => deliveryScheduleChats,
  deliverySchedules: () => deliverySchedules,
  feedbackComments: () => feedbackComments,
  notifications: () => notifications,
  processes: () => processes,
  salesBroadcastReads: () => salesBroadcastReads,
  salesBroadcasts: () => salesBroadcasts,
  staffScheduleDisplayOrder: () => staffScheduleDisplayOrder,
  staffScheduleEditLogs: () => staffScheduleEditLogs,
  staffScheduleEntries: () => staffScheduleEntries,
  staffSchedulePublished: () => staffSchedulePublished,
  users: () => users,
  vehicleAttentionPoints: () => vehicleAttentionPoints,
  vehicleChecks: () => vehicleChecks,
  vehicleMemos: () => vehicleMemos,
  vehicleOutsourcing: () => vehicleOutsourcing,
  vehicleProcessTargets: () => vehicleProcessTargets,
  vehicleTypeProcessStandards: () => vehicleTypeProcessStandards,
  vehicleTypes: () => vehicleTypes,
  vehicles: () => vehicles,
  workRecordIssueClears: () => workRecordIssueClears,
  workRecords: () => workRecords
});
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date } from "drizzle-orm/mysql-core";
var users, attendanceRecords, attendanceEditLogs, workRecords, vehicles, deliverySchedules, vehicleTypes, processes, vehicleProcessTargets, vehicleTypeProcessStandards, breakTimes, vehicleMemos, feedbackComments, notifications, checkItems, vehicleChecks, checkRequests, salesBroadcasts, salesBroadcastReads, vehicleAttentionPoints, vehicleOutsourcing, bulletinMessages, staffScheduleEntries, staffSchedulePublished, staffScheduleDisplayOrder, staffScheduleEditLogs, deliveryScheduleChats, deliveryScheduleChatReads, workRecordIssueClears;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      username: varchar("username", { length: 64 }).notNull().unique(),
      password: text("password").notNull(),
      name: text("name"),
      role: mysqlEnum("role", ["field_worker", "sales_office", "sub_admin", "admin", "external"]).default("field_worker").notNull(),
      category: mysqlEnum("category", ["elephant", "squirrel"]),
      // 分類: ゾウ、リス
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    attendanceRecords = mysqlTable("attendanceRecords", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      // 新しい正規フィールド（JST 前提のその日の勤務情報）
      workDate: date("workDate"),
      // その日のカレンダー日付 (YYYY-MM-DD)
      clockInTime: varchar("clockInTime", { length: 5 }),
      // "HH:MM"
      clockOutTime: varchar("clockOutTime", { length: 5 }),
      // "HH:MM"
      workMinutes: int("workMinutes"),
      // 勤務時間（分）
      // 旧フィールド（ログ・過去互換用。今後のロジックでは使用しない想定）
      clockIn: timestamp("clockIn"),
      clockOut: timestamp("clockOut"),
      workDuration: int("workDuration"),
      clockInDevice: varchar("clockInDevice", { length: 50 }),
      clockOutDevice: varchar("clockOutDevice", { length: 50 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    attendanceEditLogs = mysqlTable("attendanceEditLogs", {
      id: int("id").autoincrement().primaryKey(),
      attendanceId: int("attendanceId").notNull(),
      editorId: int("editorId").notNull(),
      fieldName: varchar("fieldName", { length: 50 }).notNull(),
      oldValue: timestamp("oldValue"),
      newValue: timestamp("newValue"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    workRecords = mysqlTable("workRecords", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      vehicleId: int("vehicleId").notNull(),
      processId: int("processId").notNull(),
      startTime: timestamp("startTime").notNull(),
      endTime: timestamp("endTime"),
      workDescription: text("workDescription"),
      photoUrls: text("photoUrls"),
      videoUrls: text("videoUrls"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    vehicles = mysqlTable("vehicles", {
      id: int("id").autoincrement().primaryKey(),
      vehicleNumber: varchar("vehicleNumber", { length: 100 }).notNull(),
      vehicleTypeId: int("vehicleTypeId").notNull(),
      category: mysqlEnum("category", ["\u4E00\u822C", "\u30AD\u30E3\u30F3\u30D1\u30FC", "\u4E2D\u53E4", "\u4FEE\u7406", "\u30AF\u30EC\u30FC\u30E0"]).default("\u4E00\u822C").notNull(),
      customerName: varchar("customerName", { length: 255 }),
      desiredDeliveryDate: date("desiredDeliveryDate"),
      checkDueDate: date("checkDueDate"),
      // チェック期限日
      reserveDate: date("reserveDate"),
      // 予備権の日付
      reserveRound: varchar("reserveRound", { length: 50 }),
      // 予備権のR（例: "1R", "2R"）
      hasCoating: mysqlEnum("hasCoating", ["yes", "no"]),
      // コーティングありなし
      hasLine: mysqlEnum("hasLine", ["yes", "no"]),
      // ラインありなし
      hasPreferredNumber: mysqlEnum("hasPreferredNumber", ["yes", "no"]),
      // 希望ナンバーありなし
      hasTireReplacement: mysqlEnum("hasTireReplacement", ["summer", "winter", "no"]),
      // タイヤ交換: 夏タイヤ納車/冬タイヤ納車/なし
      instructionSheetUrl: text("instructionSheetUrl"),
      // 指示書ファイルURL（PDF/JPG）
      outsourcingDestination: varchar("outsourcingDestination", { length: 255 }),
      // 外注先
      outsourcingStartDate: date("outsourcingStartDate"),
      // 外注開始日
      outsourcingEndDate: date("outsourcingEndDate"),
      // 外注終了日
      completionDate: date("completionDate"),
      status: mysqlEnum("status", ["in_progress", "completed", "archived"]).default("in_progress").notNull(),
      targetTotalMinutes: int("targetTotalMinutes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    deliverySchedules = mysqlTable("deliverySchedules", {
      id: int("id").autoincrement().primaryKey(),
      vehicleName: varchar("vehicleName", { length: 255 }).notNull(),
      // 車両の名前
      vehicleType: varchar("vehicleType", { length: 255 }),
      // 車両の種類
      customerName: varchar("customerName", { length: 255 }),
      // お客様名
      optionName: varchar("optionName", { length: 255 }),
      // オプション名
      optionCategory: varchar("optionCategory", { length: 255 }),
      // オプションの種類（その他／補足）
      prefecture: varchar("prefecture", { length: 100 }),
      // 納車県
      baseCarReady: mysqlEnum("baseCarReady", ["yes", "no"]),
      // ベース車◯✕
      furnitureReady: mysqlEnum("furnitureReady", ["yes", "no"]),
      // 家具◯✕
      inCharge: varchar("inCharge", { length: 100 }),
      // 担当
      productionMonth: varchar("productionMonth", { length: 100 }),
      // ワングラム制作分（例: "11月ワングラム制作分"）
      // 日付系
      dueDate: date("dueDate"),
      // ワングラム入庫予定（遅れ日数計算の基準日）
      desiredIncomingPlannedDate: date("desiredIncomingPlannedDate"),
      // 希望ワングラム完成予定日（katomo入力）
      incomingPlannedDate: date("incomingPlannedDate"),
      // ワングラム完成予定
      shippingPlannedDate: date("shippingPlannedDate"),
      // 引き取り予定日
      deliveryPlannedDate: date("deliveryPlannedDate"),
      // 納車予定
      // コメント・クレーム・共有事項
      comment: text("comment"),
      // 一般的なコメント
      claimComment: text("claimComment"),
      // 納車チェック後のクレーム・傷など
      photosJson: text("photosJson"),
      // 写真URLのJSON配列文字列
      oemComment: text("oemComment"),
      // ワングラム側メモ（任意）
      status: mysqlEnum("status", ["katomo_stock", "wg_storage", "wg_production", "wg_wait_pickup", "katomo_picked_up", "katomo_checked", "completed"]).default("katomo_stock"),
      // 車両状態
      completionStatus: mysqlEnum("completionStatus", ["ok", "checked", "revision_requested"]),
      // 完成後の状態（OK、チェック済み、修正依頼）
      pickupConfirmed: mysqlEnum("pickupConfirmed", ["true", "false"]).default("false"),
      // 引き取り予定日の確定フラグ
      incomingPlannedDateConfirmed: mysqlEnum("incomingPlannedDateConfirmed", ["true", "false"]).default("false"),
      // ワングラム完成予定日の確定フラグ
      specSheetUrl: text("specSheetUrl"),
      // 製造注意仕様書（PDF/JPG）のURL
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    vehicleTypes = mysqlTable("vehicleTypes", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 100 }).notNull(),
      description: text("description"),
      standardTotalMinutes: int("standardTotalMinutes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    processes = mysqlTable("processes", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 100 }).notNull(),
      description: text("description"),
      majorCategory: varchar("majorCategory", { length: 100 }),
      minorCategory: varchar("minorCategory", { length: 100 }),
      displayOrder: int("displayOrder").default(0),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    vehicleProcessTargets = mysqlTable("vehicleProcessTargets", {
      id: int("id").autoincrement().primaryKey(),
      vehicleId: int("vehicleId").notNull(),
      processId: int("processId").notNull(),
      targetMinutes: int("targetMinutes").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    vehicleTypeProcessStandards = mysqlTable("vehicleTypeProcessStandards", {
      id: int("id").autoincrement().primaryKey(),
      vehicleTypeId: int("vehicleTypeId").notNull(),
      processId: int("processId").notNull(),
      standardMinutes: int("standardMinutes").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    breakTimes = mysqlTable("breakTimes", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 100 }).notNull(),
      startTime: varchar("startTime", { length: 10 }).notNull(),
      // "HH:MM"
      endTime: varchar("endTime", { length: 10 }).notNull(),
      // "HH:MM"
      durationMinutes: int("durationMinutes").notNull(),
      isActive: mysqlEnum("isActive", ["true", "false"]).default("true").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    vehicleMemos = mysqlTable("vehicleMemos", {
      id: int("id").autoincrement().primaryKey(),
      vehicleId: int("vehicleId").notNull(),
      userId: int("userId").notNull(),
      content: text("content").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    feedbackComments = mysqlTable("feedbackComments", {
      id: int("id").autoincrement().primaryKey(),
      workRecordId: int("workRecordId").notNull(),
      userId: int("userId").notNull(),
      content: text("content").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    notifications = mysqlTable("notifications", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      title: varchar("title", { length: 255 }).notNull(),
      message: text("message").notNull(),
      type: mysqlEnum("type", ["info", "warning", "error"]).default("info").notNull(),
      isRead: mysqlEnum("isRead", ["true", "false"]).default("false").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    checkItems = mysqlTable("checkItems", {
      id: int("id").autoincrement().primaryKey(),
      category: mysqlEnum("category", ["\u4E00\u822C", "\u30AD\u30E3\u30F3\u30D1\u30FC", "\u4E2D\u53E4", "\u4FEE\u7406", "\u30AF\u30EC\u30FC\u30E0"]).notNull(),
      majorCategory: varchar("majorCategory", { length: 255 }),
      // 大カテゴリ
      minorCategory: varchar("minorCategory", { length: 255 }),
      // 小カテゴリ
      name: varchar("name", { length: 255 }).notNull(),
      description: text("description"),
      displayOrder: int("displayOrder").default(0),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    vehicleChecks = mysqlTable("vehicleChecks", {
      id: int("id").autoincrement().primaryKey(),
      vehicleId: int("vehicleId").notNull(),
      checkItemId: int("checkItemId").notNull(),
      checkedBy: int("checkedBy").notNull(),
      // チェックしたユーザーID
      checkedAt: timestamp("checkedAt").defaultNow().notNull(),
      status: mysqlEnum("status", ["checked", "needs_recheck", "unchecked"]).default("checked").notNull(),
      // チェック状態
      notes: text("notes"),
      // チェック時のメモ
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    checkRequests = mysqlTable("checkRequests", {
      id: int("id").autoincrement().primaryKey(),
      vehicleId: int("vehicleId").notNull(),
      checkItemId: int("checkItemId").notNull(),
      // 依頼するチェック項目ID
      requestedBy: int("requestedBy").notNull(),
      // 依頼したユーザーID
      requestedTo: int("requestedTo").notNull(),
      // 依頼されたユーザーID
      dueDate: date("dueDate"),
      // 期限日
      status: mysqlEnum("status", ["pending", "completed", "cancelled"]).default("pending").notNull(),
      message: text("message"),
      // 依頼メッセージ
      completedAt: timestamp("completedAt"),
      // 完了日時
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    salesBroadcasts = mysqlTable("salesBroadcasts", {
      id: int("id").autoincrement().primaryKey(),
      vehicleId: int("vehicleId").notNull(),
      createdBy: int("createdBy").notNull(),
      // 作成者（営業）のユーザーID
      message: text("message").notNull(),
      // コメント
      expiresAt: timestamp("expiresAt").notNull(),
      // 有効期限（7日後）
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    salesBroadcastReads = mysqlTable("salesBroadcastReads", {
      id: int("id").autoincrement().primaryKey(),
      broadcastId: int("broadcastId").notNull(),
      // 拡散ID
      userId: int("userId").notNull(),
      // 読んだユーザーID
      readAt: timestamp("readAt").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    vehicleAttentionPoints = mysqlTable("vehicleAttentionPoints", {
      id: int("id").autoincrement().primaryKey(),
      vehicleId: int("vehicleId").notNull(),
      userId: int("userId").notNull(),
      // 注意ポイントを追加したユーザーID
      content: text("content").notNull(),
      // 注意ポイントの内容
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    vehicleOutsourcing = mysqlTable("vehicleOutsourcing", {
      id: int("id").autoincrement().primaryKey(),
      vehicleId: int("vehicleId").notNull(),
      destination: varchar("destination", { length: 255 }).notNull(),
      // 外注先
      startDate: date("startDate"),
      // 外注開始日
      endDate: date("endDate"),
      // 外注終了日
      displayOrder: int("displayOrder").default(0),
      // 表示順（1番目、2番目）
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    bulletinMessages = mysqlTable("bulletinMessages", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      // 投稿者ID
      message: text("message").notNull(),
      // メッセージ本文
      expireDays: int("expireDays").default(5).notNull(),
      // 掲載日数（1/3/5日）
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    staffScheduleEntries = mysqlTable("staffScheduleEntries", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      // スタッフID
      scheduleDate: date("scheduleDate").notNull(),
      // スケジュール日付
      status: mysqlEnum("status", ["work", "rest", "request", "exhibition", "other", "morning", "afternoon"]).default("work").notNull(),
      // 状態: 出勤、休み、希望休、展示会、その他、午前出、午後出
      comment: varchar("comment", { length: 100 }),
      // コメント（支払日、買い付け、外出など）
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    staffSchedulePublished = mysqlTable("staffSchedulePublished", {
      id: int("id").autoincrement().primaryKey(),
      periodStart: date("periodStart").notNull(),
      // 期間開始日（20日始まり）
      periodEnd: date("periodEnd").notNull(),
      // 期間終了日（19日終わり）
      isPublished: mysqlEnum("isPublished", ["true", "false"]).default("false").notNull(),
      // 公開フラグ
      publishedAt: timestamp("publishedAt"),
      // 公開日時
      publishedBy: int("publishedBy"),
      // 公開者ID
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    staffScheduleDisplayOrder = mysqlTable("staffScheduleDisplayOrder", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().unique(),
      // スタッフID（一意）
      displayOrder: int("displayOrder").notNull(),
      // 表示順（0から始まる）
      displayName: varchar("displayName", { length: 100 }),
      // 表示名（管理者が変更可能、nullの場合はusers.nameを使用）
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    staffScheduleEditLogs = mysqlTable("staffScheduleEditLogs", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      // 変更されたスタッフID
      editorId: int("editorId").notNull(),
      // 編集者ID
      fieldName: varchar("fieldName", { length: 50 }).notNull(),
      // 変更されたフィールド名（例: "displayOrder"）
      oldValue: text("oldValue"),
      // 変更前の値
      newValue: text("newValue"),
      // 変更後の値
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    deliveryScheduleChats = mysqlTable("deliveryScheduleChats", {
      id: int("id").autoincrement().primaryKey(),
      deliveryScheduleId: int("deliveryScheduleId").notNull(),
      // 納車スケジュールID（nullの場合は全体チャット）
      userId: int("userId").notNull(),
      // コメントしたユーザーID
      message: text("message").notNull(),
      // コメント内容
      parentId: int("parentId"),
      // 返信先のコメントID（nullの場合は通常のコメント）
      imageUrl: text("imageUrl"),
      // 画像URL（JSON配列で複数画像を保存可能）
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    deliveryScheduleChatReads = mysqlTable("deliveryScheduleChatReads", {
      id: int("id").autoincrement().primaryKey(),
      chatId: int("chatId").notNull(),
      // チャットID
      userId: int("userId").notNull(),
      // 読んだユーザーID
      readAt: timestamp("readAt").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    workRecordIssueClears = mysqlTable("workRecordIssueClears", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      // 不備があったユーザーID
      workDate: date("workDate").notNull(),
      // 不備があった日付
      clearedBy: int("clearedBy").notNull(),
      // クリアしたユーザーID（ふみかさんなど）
      clearedAt: timestamp("clearedAt").defaultNow().notNull(),
      // クリア日時
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  getDb: () => getDb,
  getPool: () => getPool,
  getUserById: () => getUserById,
  getUserByOpenId: () => getUserByOpenId,
  getUserByUsername: () => getUserByUsername,
  initializeDefaultBreakTimes: () => initializeDefaultBreakTimes,
  schema: () => schema_exports,
  selectUsersSafely: () => selectUsersSafely
});
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { eq } from "drizzle-orm";
async function getDb() {
  if (!ENV.databaseUrl) {
    console.warn("[Database] DATABASE_URL is not set");
    console.warn("[Database] MYSQL_URL:", process.env.MYSQL_URL ? "set" : "not set");
    console.warn("[Database] DATABASE_URL:", process.env.DATABASE_URL ? "set" : "not set");
    return null;
  }
  const maskedUrl = ENV.databaseUrl.replace(/:([^:@]+)@/, ":****@");
  console.log("[Database] Using connection string:", maskedUrl);
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
      _db = drizzle(_pool, { schema: schema_exports, mode: "default" });
      console.log("[Database] Database connection pool created");
      try {
        await _pool.execute("SELECT 1");
        console.log("[Database] \u2705 Connection test successful");
      } catch (testError) {
        console.error("[Database] \u274C Connection test failed:", testError.message);
        console.error("[Database] Error code:", testError.code);
        console.error("[Database] Error errno:", testError.errno);
        throw testError;
      }
    } catch (error) {
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
function getPool() {
  return _pool;
}
async function selectUsersSafely(db, where) {
  if (!db) return [];
  try {
    const baseSelect = {
      id: users.id,
      username: users.username,
      password: users.password,
      name: users.name,
      role: users.role,
      category: users.category
    };
    let query = db.select(baseSelect).from(users);
    if (where) {
      query = query.where(where);
    }
    const result = await query;
    return result;
  } catch (error) {
    console.error("[selectUsersSafely] Error:", error);
    if (error?.message?.includes("category") || error?.message?.includes("name") || error?.code === "ER_BAD_FIELD_ERROR") {
      try {
        const baseSelect = {
          id: users.id,
          username: users.username,
          password: users.password,
          role: users.role
        };
        let query = db.select(baseSelect).from(users);
        if (where) {
          query = query.where(where);
        }
        const result = await query;
        return result.map((u) => ({
          ...u,
          name: null,
          category: null
        }));
      } catch (innerError) {
        console.error("[selectUsersSafely] Fallback also failed:", innerError);
        return [];
      }
    }
    return [];
  }
}
async function getUserByUsername(username) {
  console.log("[getUserByUsername] Searching ONLY by username:", username);
  const pool = getPool();
  if (!pool) {
    console.error("[getUserByUsername] \u274C Pool is null - database not connected");
    return void 0;
  }
  try {
    const [rows] = await pool.execute(
      `SELECT id, username, password, name, role, category
             FROM users
             WHERE username = ?
             LIMIT 1`,
      [username]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log("[getUserByUsername] \u274C User not found:", username);
      return void 0;
    }
    const user = rows[0];
    return {
      id: user.id,
      username: user.username,
      password: user.password,
      name: user.name ?? null,
      role: user.role ?? "field_worker",
      category: user.category ?? null
    };
  } catch (error) {
    console.error("[getUserByUsername] \u274C Error:", error);
    console.error("[getUserByUsername] Error message:", error?.message);
    console.error("[getUserByUsername] Error code:", error?.code);
    console.error("[getUserByUsername] Error errno:", error?.errno);
    return void 0;
  }
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) {
    console.warn("[getUserById] Database not available for userId:", id);
    return void 0;
  }
  try {
    const users2 = await selectUsersSafely(db, eq(users.id, id));
    return users2[0];
  } catch (error) {
    console.error("[getUserById] Error:", error);
    return void 0;
  }
}
async function getUserByOpenId(openId) {
  return getUserByUsername(openId);
}
async function initializeDefaultBreakTimes() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot initialize break times: database not available");
    return;
  }
  try {
    const existing = await db.select().from(breakTimes).limit(1);
    if (existing.length > 0) {
      console.log("[Database] Break times already initialized");
      return;
    }
    await db.insert(breakTimes).values({
      name: "\u663C\u4F11\u61A9",
      startTime: "12:00",
      endTime: "13:20",
      durationMinutes: 80,
      isActive: "true"
    });
    console.log("[Database] Default break times initialized");
  } catch (error) {
    console.warn("[Database] Failed to initialize break times:", error);
  }
}
var _db, _pool;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_env();
    init_schema();
    _db = null;
    _pool = null;
  }
});

// server/routers/attendance.ts
var attendance_exports = {};
__export(attendance_exports, {
  attendanceRouter: () => attendanceRouter
});
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";
import { eq as eq2, and, isNull, inArray, sql } from "drizzle-orm";
function getJSTNow() {
  const now = /* @__PURE__ */ new Date();
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const parts = formatter.formatToParts(now);
  return {
    year: parseInt(parts.find((p) => p.type === "year")?.value || "0"),
    month: parseInt(parts.find((p) => p.type === "month")?.value || "1"),
    day: parseInt(parts.find((p) => p.type === "day")?.value || "1"),
    hour: parseInt(parts.find((p) => p.type === "hour")?.value || "0"),
    minute: parseInt(parts.find((p) => p.type === "minute")?.value || "0")
  };
}
function timeToMinutes(t2) {
  if (!t2) return null;
  const [hh2, mm2] = t2.split(":");
  const h = Number(hh2);
  const m = Number(mm2);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total = h * 60 + m;
  if (total < 0 || total > 23 * 60 + 59) return null;
  return total;
}
function minutesToTime(mins) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = String(Math.floor(clamped / 60)).padStart(2, "0");
  const m = String(clamped % 60).padStart(2, "0");
  return `${h}:${m}`;
}
function normalizeWorkTimes(inStr, outStr) {
  let inMin = timeToMinutes(inStr);
  let outMin = timeToMinutes(outStr);
  if (inMin == null && outMin == null) {
    inMin = 8 * 60 + 30;
    outMin = 17 * 60 + 30;
  }
  if (inMin == null && outMin != null) inMin = outMin;
  if (outMin == null && inMin != null) outMin = inMin;
  const start = Math.min(inMin, outMin);
  const end = Math.max(inMin, outMin);
  const rawMinutes = Math.max(0, end - start);
  return {
    clockInTime: minutesToTime(start),
    clockOutTime: minutesToTime(end),
    rawMinutes
  };
}
async function getActiveBreakTimes(db) {
  if (!db) return [];
  try {
    const all = await db.select().from(schema_exports.breakTimes);
    return all.filter((bt) => bt.isActive === "true");
  } catch (error) {
    console.warn("[attendance] Failed to fetch breakTimes:", error);
    return [];
  }
}
async function calculateWorkMinutes(clockInTime, clockOutTime, db) {
  const startMin = timeToMinutes(clockInTime);
  const endMin = timeToMinutes(clockOutTime);
  if (startMin == null || endMin == null) return 0;
  if (!db) return Math.max(0, endMin - startMin);
  const baseMinutes = Math.max(0, endMin - startMin);
  const breakTimes2 = await getActiveBreakTimes(db);
  let breakTotal = 0;
  for (const bt of breakTimes2) {
    const s = timeToMinutes(bt.startTime);
    const eRaw = timeToMinutes(bt.endTime);
    if (s == null || eRaw == null) continue;
    let e = eRaw;
    if (e < s) {
      e += 24 * 60;
    }
    const overlapStart = Math.max(startMin, s);
    const overlapEnd = Math.min(endMin, e);
    if (overlapEnd > overlapStart) {
      breakTotal += overlapEnd - overlapStart;
    }
  }
  const result = Math.max(0, baseMinutes - breakTotal);
  return result;
}
var attendanceRouter;
var init_attendance = __esm({
  "server/routers/attendance.ts"() {
    "use strict";
    init_trpc();
    init_db();
    attendanceRouter = createTRPCRouter({
      // 指定日の出退勤状況を取得（workDate + HH:MM ベース）
      getTodayStatus: protectedProcedure.input(
        z2.object({
          workDate: z2.string()
          // "YYYY-MM-DD"（フロントで決めた日付）
        })
      ).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        const workDateStr = input.workDate;
        const { desc: desc5 } = await import("drizzle-orm");
        const [record] = await db.select().from(schema_exports.attendanceRecords).where(
          and(
            eq2(schema_exports.attendanceRecords.userId, ctx.user.id),
            // workDate は "YYYY-MM-DD" の文字列として扱う
            eq2(schema_exports.attendanceRecords.workDate, workDateStr)
          )
        ).orderBy(desc5(schema_exports.attendanceRecords.id)).limit(1);
        if (!record) {
          return null;
        }
        const workMinutes = record.clockInTime && record.clockOutTime ? await calculateWorkMinutes(record.clockInTime, record.clockOutTime, db) : record.workMinutes ?? null;
        return {
          id: record.id,
          workDate: record.workDate,
          clockInTime: record.clockInTime,
          clockOutTime: record.clockOutTime,
          workMinutes
        };
      }),
      // 出勤打刻（管理アカウント専用）
      clockIn: subAdminProcedure.input(
        z2.object({
          workDate: z2.string().optional(),
          // "YYYY-MM-DD"
          deviceType: z2.enum(["pc", "mobile"]).optional().default("pc")
        })
      ).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        const jstNow = getJSTNow();
        const todayStr = input.workDate ?? `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
        const timeStr = `${String(jstNow.hour).padStart(2, "0")}:${String(jstNow.minute).padStart(2, "0")}`;
        const [existing] = await db.select().from(schema_exports.attendanceRecords).where(
          and(
            eq2(schema_exports.attendanceRecords.userId, ctx.user.id),
            eq2(schema_exports.attendanceRecords.workDate, todayStr)
          )
        ).limit(1);
        if (existing) {
          throw new TRPCError3({
            code: "BAD_REQUEST",
            message: "\u4ECA\u65E5\u306F\u65E2\u306B\u51FA\u52E4\u3057\u3066\u3044\u307E\u3059"
          });
        }
        await db.insert(schema_exports.attendanceRecords).values({
          userId: ctx.user.id,
          workDate: todayStr,
          clockInTime: timeStr,
          clockInDevice: input.deviceType
        });
        const { desc: desc5 } = await import("drizzle-orm");
        const [inserted] = await db.select().from(schema_exports.attendanceRecords).where(eq2(schema_exports.attendanceRecords.userId, ctx.user.id)).orderBy(desc5(schema_exports.attendanceRecords.id)).limit(1);
        if (!inserted) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u51FA\u52E4\u8A18\u9332\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
          });
        }
        return {
          id: inserted.id,
          workDate: inserted.workDate,
          clockInTime: inserted.clockInTime
        };
      }),
      // 退勤打刻
      // 退勤打刻（管理アカウント専用）
      clockOut: subAdminProcedure.input(z2.object({ workDate: z2.string().optional() }).optional()).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        const jstNow = getJSTNow();
        const todayStr = input?.workDate ?? `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
        const timeStr = `${String(jstNow.hour).padStart(2, "0")}:${String(jstNow.minute).padStart(2, "0")}`;
        const [record] = await db.select().from(schema_exports.attendanceRecords).where(
          and(
            eq2(schema_exports.attendanceRecords.userId, ctx.user.id),
            eq2(schema_exports.attendanceRecords.workDate, todayStr)
          )
        ).limit(1);
        if (!record) {
          throw new TRPCError3({
            code: "BAD_REQUEST",
            message: "\u51FA\u52E4\u8A18\u9332\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
          });
        }
        const norm = normalizeWorkTimes(record.clockInTime, timeStr);
        const workMinutes = await calculateWorkMinutes(norm.clockInTime, norm.clockOutTime, db);
        await db.update(schema_exports.attendanceRecords).set({
          workDate: todayStr,
          clockInTime: norm.clockInTime,
          clockOutTime: norm.clockOutTime,
          workMinutes,
          clockOutDevice: "pc"
        }).where(eq2(schema_exports.attendanceRecords.id, record.id));
        return {
          id: record.id,
          workDate: todayStr,
          clockInTime: norm.clockInTime,
          clockOutTime: norm.clockOutTime,
          workMinutes
        };
      }),
      // 全スタッフの「今日」の出退勤状況を取得（準管理者以上・workDate ベース）
      // ※現在は管理画面からは使用せず、getAllStaffByDate で日付指定する運用
      getAllStaffToday: subAdminProcedure.query(async () => {
        try {
          const db = await getDb();
          if (!db) {
            throw new TRPCError3({
              code: "INTERNAL_SERVER_ERROR",
              message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
            });
          }
          const jstNow = getJSTNow();
          const todayStr = `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
          const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
          const allUsers = await selectUsersSafely2(db);
          const staffUsers = allUsers.filter((u) => u.role !== "external");
          const result = await Promise.all(
            staffUsers.map(async (user) => {
              try {
                const attendanceRecords2 = await db.select().from(schema_exports.attendanceRecords).where(
                  and(
                    eq2(schema_exports.attendanceRecords.userId, user.id),
                    eq2(schema_exports.attendanceRecords.workDate, todayStr)
                  )
                ).limit(1);
                const attendance = attendanceRecords2[0] || null;
                const workMinutes = attendance?.clockInTime && attendance?.clockOutTime ? await calculateWorkMinutes(attendance.clockInTime, attendance.clockOutTime, db) : attendance?.workMinutes ?? null;
                return {
                  userId: user.id,
                  userName: user.name || user.username,
                  attendance: attendance ? {
                    id: attendance.id,
                    workDate: attendance.workDate,
                    clockInTime: attendance.clockInTime,
                    clockOutTime: attendance.clockOutTime,
                    workMinutes,
                    clockInDevice: attendance.clockInDevice,
                    clockOutDevice: attendance.clockOutDevice
                  } : null
                };
              } catch (error) {
                console.error(`Error processing user ${user.id}:`, error);
                return {
                  userId: user.id,
                  userName: user.name || user.username,
                  attendance: null
                };
              }
            })
          );
          return result;
        } catch (error) {
          console.error("Error in getAllStaffToday:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "\u30B9\u30BF\u30C3\u30D5\u60C5\u5831\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
          });
        }
      }),
      // 特定日の全スタッフの出退勤状況を取得（準管理者以上・workDate ベース）
      getAllStaffByDate: subAdminProcedure.input(z2.object({ date: z2.string() })).query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) {
            throw new TRPCError3({
              code: "INTERNAL_SERVER_ERROR",
              message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
            });
          }
          const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
          const allUsers = await selectUsersSafely2(db);
          const staffUsers = allUsers.filter((u) => u.role !== "external");
          const result = await Promise.all(
            staffUsers.map(async (user) => {
              try {
                const [attendance] = await db.select().from(schema_exports.attendanceRecords).where(
                  and(
                    eq2(schema_exports.attendanceRecords.userId, user.id),
                    eq2(schema_exports.attendanceRecords.workDate, input.date)
                  )
                ).limit(1);
                const workMinutes = attendance?.clockInTime && attendance?.clockOutTime ? await calculateWorkMinutes(attendance.clockInTime, attendance.clockOutTime, db) : attendance?.workMinutes ?? null;
                return {
                  userId: user.id,
                  userName: user.name || user.username,
                  attendance: attendance ? {
                    id: attendance.id,
                    workDate: attendance.workDate,
                    clockInTime: attendance.clockInTime,
                    clockOutTime: attendance.clockOutTime,
                    workMinutes,
                    clockInDevice: attendance.clockInDevice,
                    clockOutDevice: attendance.clockOutDevice
                  } : null
                };
              } catch (error) {
                console.error(`Error processing user ${user.id}:`, error);
                return {
                  userId: user.id,
                  userName: user.name || user.username,
                  attendance: null
                };
              }
            })
          );
          return result;
        } catch (error) {
          console.error("Error in getAllStaffByDate:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "\u30B9\u30BF\u30C3\u30D5\u60C5\u5831\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
          });
        }
      }),
      // 管理者が代理で出勤打刻（準管理者以上）
      adminClockIn: subAdminProcedure.input(
        z2.object({
          userId: z2.number(),
          // フロントがまだ古い形（clockInだけ）で呼んでいる場合もあるので、workDate/time は任意にしてサーバー側で補完する
          workDate: z2.string().optional(),
          // "YYYY-MM-DD"
          time: z2.string().optional(),
          // "HH:MM"
          deviceType: z2.enum(["pc", "mobile"]).optional().default("pc")
        })
      ).mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        const jstNow = getJSTNow();
        const workDateStr = input.workDate ?? `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
        const timeStr = input.time ?? `${hh}:${mm}`;
        await db.insert(schema_exports.attendanceRecords).values({
          userId: input.userId,
          workDate: workDateStr,
          clockInTime: timeStr,
          clockInDevice: input.deviceType
        });
        const [user] = await db.select().from(schema_exports.users).where(eq2(schema_exports.users.id, input.userId)).limit(1);
        return {
          id: input.userId,
          userName: user?.name || user?.username || "\u4E0D\u660E"
        };
      }),
      // 管理者が代理で退勤打刻（準管理者以上）
      adminClockOut: subAdminProcedure.input(
        z2.object({
          userId: z2.number(),
          workDate: z2.string(),
          // "YYYY-MM-DD" - 必ずこの日のレコードだけを対象にする
          time: z2.string()
          // "HH:MM"
        })
      ).mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        const [record] = await db.select().from(schema_exports.attendanceRecords).where(
          and(
            eq2(schema_exports.attendanceRecords.userId, input.userId),
            eq2(schema_exports.attendanceRecords.workDate, input.workDate)
          )
        ).limit(1);
        if (!record) {
          throw new TRPCError3({
            code: "BAD_REQUEST",
            message: "\u51FA\u52E4\u8A18\u9332\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
          });
        }
        const norm = normalizeWorkTimes(record.clockInTime, input.time);
        const workMinutes = await calculateWorkMinutes(norm.clockInTime, norm.clockOutTime, db);
        await db.update(schema_exports.attendanceRecords).set({
          workDate: input.workDate,
          clockInTime: norm.clockInTime,
          clockOutTime: norm.clockOutTime,
          workMinutes,
          clockOutDevice: "pc"
        }).where(eq2(schema_exports.attendanceRecords.id, record.id));
        const [user] = await db.select().from(schema_exports.users).where(eq2(schema_exports.users.id, input.userId)).limit(1);
        return {
          id: input.userId,
          userName: user?.name || user?.username || "\u4E0D\u660E"
        };
      }),
      // 出退勤記録を更新（準管理者以上）
      updateAttendance: subAdminProcedure.input(
        z2.object({
          attendanceId: z2.number(),
          workDate: z2.string(),
          // "YYYY-MM-DD" - 必ずこの日の中で正規化する
          clockInTime: z2.string().nullable().optional(),
          // "HH:MM"
          clockOutTime: z2.string().nullable().optional()
          // "HH:MM"
        })
      ).mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        const [record] = await db.select().from(schema_exports.attendanceRecords).where(eq2(schema_exports.attendanceRecords.id, input.attendanceId)).limit(1);
        if (!record) {
          throw new TRPCError3({
            code: "NOT_FOUND",
            message: "\u51FA\u9000\u52E4\u8A18\u9332\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
          });
        }
        const newClockInTime = input.clockInTime !== void 0 ? input.clockInTime === "" ? null : input.clockInTime : record.clockInTime;
        const newClockOutTime = input.clockOutTime !== void 0 ? input.clockOutTime === "" ? null : input.clockOutTime : record.clockOutTime;
        let finalClockInTime;
        let finalClockOutTime;
        let workMinutes;
        if (newClockOutTime === null) {
          if (newClockInTime) {
            const norm = normalizeWorkTimes(newClockInTime, newClockInTime);
            finalClockInTime = norm.clockInTime;
            finalClockOutTime = null;
            workMinutes = null;
          } else {
            finalClockInTime = record.clockInTime || "";
            finalClockOutTime = null;
            workMinutes = null;
          }
        } else {
          const norm = normalizeWorkTimes(newClockInTime, newClockOutTime);
          finalClockInTime = norm.clockInTime;
          finalClockOutTime = norm.clockOutTime;
          workMinutes = await calculateWorkMinutes(finalClockInTime, finalClockOutTime, db);
        }
        const updateData = {
          workDate: new Date(input.workDate),
          clockInTime: finalClockInTime,
          clockOutTime: finalClockOutTime,
          workMinutes
        };
        await db.update(schema_exports.attendanceRecords).set(updateData).where(eq2(schema_exports.attendanceRecords.id, input.attendanceId));
        const [updatedRecord] = await db.select().from(schema_exports.attendanceRecords).where(eq2(schema_exports.attendanceRecords.id, input.attendanceId)).limit(1);
        if (!updatedRecord) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u66F4\u65B0\u5F8C\u306E\u30C7\u30FC\u30BF\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F"
          });
        }
        return {
          success: true,
          attendance: {
            id: updatedRecord.id,
            workDate: updatedRecord.workDate,
            clockInTime: updatedRecord.clockInTime,
            clockOutTime: updatedRecord.clockOutTime,
            workMinutes: updatedRecord.workMinutes
          }
        };
      }),
      // 今日の未退勤記録を23:59に自動退勤（自動実行用、publicProcedureで実行可能）
      autoCloseTodayAt2359: publicProcedure.mutation(async () => {
        try {
          const db = await getDb();
          if (!db) {
            throw new TRPCError3({
              code: "INTERNAL_SERVER_ERROR",
              message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
            });
          }
          const jstNow = getJSTNow();
          const todayStr = `${jstNow.year}-${String(jstNow.month).padStart(2, "0")}-${String(jstNow.day).padStart(2, "0")}`;
          const unclosedRecords = await db.select().from(schema_exports.attendanceRecords).where(
            and(
              eq2(schema_exports.attendanceRecords.workDate, new Date(todayStr)),
              isNull(schema_exports.attendanceRecords.clockOutTime)
            )
          );
          let count = 0;
          for (const record of unclosedRecords) {
            const norm = normalizeWorkTimes(record.clockInTime, "23:59");
            const workMinutes = await calculateWorkMinutes(norm.clockInTime, norm.clockOutTime, db);
            await db.update(schema_exports.attendanceRecords).set({
              clockOutTime: norm.clockOutTime,
              clockOutDevice: "auto-23:59",
              workMinutes
            }).where(eq2(schema_exports.attendanceRecords.id, record.id));
            count++;
          }
          if (count > 0) {
            console.log(`[\u81EA\u52D5\u9000\u52E4] ${count}\u4EF6\u306E\u672A\u9000\u52E4\u8A18\u9332\u309223:59\u306B\u81EA\u52D5\u9000\u52E4\u51E6\u7406\u3057\u307E\u3057\u305F`);
          }
          return { count };
        } catch (error) {
          console.error("Error in autoCloseTodayAt2359:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "\u81EA\u52D5\u9000\u52E4\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
          });
        }
      }),
      // 出退勤記録を削除（準管理者以上）
      deleteAttendance: subAdminProcedure.input(z2.object({ attendanceId: z2.number() })).mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        await db.delete(schema_exports.attendanceRecords).where(eq2(schema_exports.attendanceRecords.id, input.attendanceId));
        return { success: true };
      }),
      // 編集履歴を取得（準管理者以上）
      getEditLogs: subAdminProcedure.input(
        z2.object({
          attendanceId: z2.number().optional(),
          startDate: z2.string().optional(),
          endDate: z2.string().optional()
        })
      ).query(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        let logs;
        if (input.attendanceId) {
          logs = await db.select().from(schema_exports.attendanceEditLogs).where(eq2(schema_exports.attendanceEditLogs.attendanceId, input.attendanceId)).orderBy(schema_exports.attendanceEditLogs.createdAt);
        } else {
          logs = await db.select().from(schema_exports.attendanceEditLogs).orderBy(schema_exports.attendanceEditLogs.createdAt);
        }
        const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const users2 = await selectUsersSafely2(db);
        const userMap = new Map(users2.map((u) => [u.id, u]));
        const attendanceIds = [...new Set(logs.map((log) => log.attendanceId))];
        let attendances = [];
        if (attendanceIds.length > 0) {
          attendances = await db.select().from(schema_exports.attendanceRecords).where(inArray(schema_exports.attendanceRecords.id, attendanceIds));
        }
        return logs.map((log) => {
          const editor = userMap.get(log.editorId);
          const attendance = attendances.find((a) => a.id === log.attendanceId);
          const attendanceUser = attendance ? userMap.get(attendance.userId) : null;
          return {
            id: log.id,
            attendanceId: log.attendanceId,
            editorId: log.editorId,
            editorName: editor?.name || editor?.username || "\u4E0D\u660E",
            editorUsername: editor?.username || "\u4E0D\u660E",
            userName: attendanceUser?.name || attendanceUser?.username || "\u4E0D\u660E",
            fieldName: log.fieldName,
            oldValue: log.oldValue,
            newValue: log.newValue,
            createdAt: log.createdAt
          };
        });
      }),
      // 過去の出勤記録のworkMinutesを再計算（準管理者以上・バッチ処理）
      recalculateAllWorkMinutes: subAdminProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        const allRecords = await db.select().from(schema_exports.attendanceRecords).where(
          and(
            sql`${schema_exports.attendanceRecords.clockInTime} IS NOT NULL`,
            sql`${schema_exports.attendanceRecords.clockOutTime} IS NOT NULL`
          )
        );
        console.log(`[recalculateAllWorkMinutes] \u5BFE\u8C61\u30EC\u30B3\u30FC\u30C9\u6570: ${allRecords.length}`);
        let updatedCount = 0;
        let errorCount = 0;
        const errors = [];
        for (const record of allRecords) {
          try {
            if (!record.clockInTime || !record.clockOutTime) {
              continue;
            }
            const norm = normalizeWorkTimes(record.clockInTime, record.clockOutTime);
            const newWorkMinutes = await calculateWorkMinutes(norm.clockInTime, norm.clockOutTime, db);
            if (record.workMinutes !== newWorkMinutes) {
              await db.update(schema_exports.attendanceRecords).set({
                workMinutes: newWorkMinutes
              }).where(eq2(schema_exports.attendanceRecords.id, record.id));
              updatedCount++;
              if (updatedCount % 100 === 0) {
                console.log(`[recalculateAllWorkMinutes] ${updatedCount}\u4EF6\u66F4\u65B0\u6E08\u307F...`);
              }
            }
          } catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push({
              id: record.id,
              error: errorMessage
            });
            console.error(`[recalculateAllWorkMinutes] \u30EC\u30B3\u30FC\u30C9ID ${record.id} \u306E\u66F4\u65B0\u306B\u5931\u6557:`, errorMessage);
          }
        }
        console.log(`[recalculateAllWorkMinutes] \u5B8C\u4E86: \u66F4\u65B0 ${updatedCount}\u4EF6, \u30A8\u30E9\u30FC ${errorCount}\u4EF6`);
        return {
          total: allRecords.length,
          updated: updatedCount,
          errors: errorCount,
          errorDetails: errors.slice(0, 10)
          // 最初の10件のエラーのみ返す
        };
      })
    });
  }
});

// server/routers/backup.ts
var backup_exports = {};
__export(backup_exports, {
  backupRouter: () => backupRouter,
  createBackup: () => createBackup
});
import { TRPCError as TRPCError15 } from "@trpc/server";
import { z as z15 } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { sql as sql5 } from "drizzle-orm";
import fs2 from "fs";
import path2 from "path";
import { format as format3 } from "date-fns";
async function uploadToS3(filePath, fileName) {
  if (!ENV.awsS3Enabled) {
    console.log("[Backup] AWS S3\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306F\u7121\u52B9\u306B\u306A\u3063\u3066\u3044\u307E\u3059");
    return false;
  }
  if (!ENV.awsS3Bucket || !ENV.awsAccessKeyId || !ENV.awsSecretAccessKey) {
    console.warn("[Backup] AWS S3\u306E\u8A2D\u5B9A\u304C\u4E0D\u5B8C\u5168\u3067\u3059\u3002\u30AF\u30E9\u30A6\u30C9\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3059");
    return false;
  }
  try {
    const s3Client = new S3Client({
      region: ENV.awsS3Region,
      credentials: {
        accessKeyId: ENV.awsAccessKeyId,
        secretAccessKey: ENV.awsSecretAccessKey
      }
    });
    const fileContent = fs2.readFileSync(filePath);
    const s3Key = `backups/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: ENV.awsS3Bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: "application/json"
    });
    await s3Client.send(command);
    console.log(`[Backup] \u2705 \u30AF\u30E9\u30A6\u30C9\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u6210\u529F: s3://${ENV.awsS3Bucket}/${s3Key}`);
    return true;
  } catch (error) {
    console.error("[Backup] \u274C \u30AF\u30E9\u30A6\u30C9\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u30A8\u30E9\u30FC:", error.message);
    return false;
  }
}
async function createBackup() {
  const db = await getDb();
  if (!db) {
    throw new Error("\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093");
  }
  const backupDir = path2.resolve(process.cwd(), "backups");
  if (!fs2.existsSync(backupDir)) {
    fs2.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp2 = format3(/* @__PURE__ */ new Date(), "yyyyMMdd_HHmmss");
  const backupData = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: "1.0.0",
    data: {}
  };
  try {
    let vehicles2 = [];
    try {
      const columnsResult = await db.execute(sql5`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'vehicles'
                AND COLUMN_NAME NOT IN ('outsourcingDestination', 'outsourcingStartDate', 'outsourcingEndDate')
                ORDER BY ORDINAL_POSITION
            `);
      const columns = columnsResult.map((row) => row.COLUMN_NAME);
      if (columns.length === 0) {
        vehicles2 = await db.select({
          id: schema_exports.vehicles.id,
          vehicleNumber: schema_exports.vehicles.vehicleNumber,
          vehicleTypeId: schema_exports.vehicles.vehicleTypeId,
          category: schema_exports.vehicles.category,
          customerName: schema_exports.vehicles.customerName,
          desiredDeliveryDate: schema_exports.vehicles.desiredDeliveryDate,
          status: schema_exports.vehicles.status,
          createdAt: schema_exports.vehicles.createdAt,
          updatedAt: schema_exports.vehicles.updatedAt
        }).from(schema_exports.vehicles);
      } else {
        const columnList = columns.map((col) => `\`${col}\``).join(", ");
        const rawQuery = sql5.raw(`SELECT ${columnList} FROM \`vehicles\``);
        const result = await db.execute(rawQuery);
        vehicles2 = result.map((row) => {
          const obj = {};
          columns.forEach((col) => {
            obj[col] = row[col];
          });
          return obj;
        });
      }
    } catch (error) {
      console.error("[Backup] Error fetching vehicles:", error.message);
      try {
        vehicles2 = await db.select({
          id: schema_exports.vehicles.id,
          vehicleNumber: schema_exports.vehicles.vehicleNumber,
          vehicleTypeId: schema_exports.vehicles.vehicleTypeId,
          category: schema_exports.vehicles.category,
          customerName: schema_exports.vehicles.customerName,
          desiredDeliveryDate: schema_exports.vehicles.desiredDeliveryDate,
          status: schema_exports.vehicles.status,
          createdAt: schema_exports.vehicles.createdAt,
          updatedAt: schema_exports.vehicles.updatedAt
        }).from(schema_exports.vehicles);
      } catch (fallbackError) {
        console.error("[Backup] Fallback also failed:", fallbackError.message);
        vehicles2 = [];
      }
    }
    backupData.data.vehicles = vehicles2;
    let checkItems2 = [];
    try {
      const checkItemsColumnsResult = await db.execute(sql5`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'checkItems'
                ORDER BY ORDINAL_POSITION
            `);
      const checkItemsColumns = checkItemsColumnsResult.map((row) => row.COLUMN_NAME);
      if (checkItemsColumns.length === 0) {
        checkItems2 = await db.select({
          id: schema_exports.checkItems.id,
          category: schema_exports.checkItems.category,
          name: schema_exports.checkItems.name,
          description: schema_exports.checkItems.description,
          createdAt: schema_exports.checkItems.createdAt,
          updatedAt: schema_exports.checkItems.updatedAt
        }).from(schema_exports.checkItems);
      } else {
        const columnList = checkItemsColumns.map((col) => `\`${col}\``).join(", ");
        const rawQuery = sql5.raw(`SELECT ${columnList} FROM \`checkItems\``);
        const result = await db.execute(rawQuery);
        checkItems2 = result.map((row) => {
          const obj = {};
          checkItemsColumns.forEach((col) => {
            obj[col] = row[col];
          });
          return obj;
        });
      }
    } catch (error) {
      console.error("[Backup] Error fetching checkItems:", error.message);
      try {
        checkItems2 = await db.select({
          id: schema_exports.checkItems.id,
          category: schema_exports.checkItems.category,
          name: schema_exports.checkItems.name,
          description: schema_exports.checkItems.description,
          createdAt: schema_exports.checkItems.createdAt,
          updatedAt: schema_exports.checkItems.updatedAt
        }).from(schema_exports.checkItems);
      } catch (fallbackError) {
        console.error("[Backup] Fallback also failed for checkItems:", fallbackError.message);
        checkItems2 = [];
      }
    }
    backupData.data.checkItems = checkItems2;
    let users2 = [];
    try {
      const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      users2 = await selectUsersSafely2(db);
    } catch (error) {
      console.error("[Backup] Error fetching users:", error.message);
      try {
        const usersColumnsResult = await db.execute(sql5`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'users'
                    ORDER BY ORDINAL_POSITION
                `);
        const usersColumns = usersColumnsResult.map((row) => row.COLUMN_NAME);
        if (usersColumns.length > 0) {
          const columnList = usersColumns.map((col) => `\`${col}\``).join(", ");
          const rawQuery = sql5.raw(`SELECT ${columnList} FROM \`users\``);
          const result = await db.execute(rawQuery);
          users2 = result.map((row) => {
            const obj = {};
            usersColumns.forEach((col) => {
              obj[col] = row[col];
            });
            return obj;
          });
        } else {
          users2 = await db.select({
            id: schema_exports.users.id,
            username: schema_exports.users.username,
            role: schema_exports.users.role
          }).from(schema_exports.users);
        }
      } catch (fallbackError) {
        console.error("[Backup] Fallback also failed for users:", fallbackError.message);
        users2 = [];
      }
    }
    backupData.data.users = users2;
    try {
      const displayOrder = await db.select().from(schema_exports.staffScheduleDisplayOrder);
      backupData.data.staffScheduleDisplayOrder = displayOrder;
    } catch (error) {
      console.warn("[Backup] staffScheduleDisplayOrder not available:", error);
    }
    const vehicleTypes2 = await db.select().from(schema_exports.vehicleTypes);
    backupData.data.vehicleTypes = vehicleTypes2;
    const processes2 = await db.select().from(schema_exports.processes);
    backupData.data.processes = processes2;
    let breakTimes2 = [];
    try {
      const breakTimesColumnsResult = await db.execute(sql5`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'breakTimes'
                ORDER BY ORDINAL_POSITION
            `);
      const breakTimesColumns = breakTimesColumnsResult.map((row) => row.COLUMN_NAME);
      if (breakTimesColumns.length === 0) {
        breakTimes2 = await db.select({
          id: schema_exports.breakTimes.id,
          name: schema_exports.breakTimes.name,
          startTime: schema_exports.breakTimes.startTime,
          endTime: schema_exports.breakTimes.endTime,
          durationMinutes: schema_exports.breakTimes.durationMinutes,
          isActive: schema_exports.breakTimes.isActive,
          createdAt: schema_exports.breakTimes.createdAt,
          updatedAt: schema_exports.breakTimes.updatedAt
        }).from(schema_exports.breakTimes);
      } else {
        const columnList = breakTimesColumns.map((col) => `\`${col}\``).join(", ");
        const rawQuery = sql5.raw(`SELECT ${columnList} FROM \`breakTimes\``);
        const result = await db.execute(rawQuery);
        breakTimes2 = result.map((row) => {
          const obj = {};
          breakTimesColumns.forEach((col) => {
            obj[col] = row[col];
          });
          return obj;
        });
      }
    } catch (error) {
      console.error("[Backup] Error fetching breakTimes:", error.message);
      try {
        breakTimes2 = await db.select({
          id: schema_exports.breakTimes.id,
          name: schema_exports.breakTimes.name,
          startTime: schema_exports.breakTimes.startTime,
          endTime: schema_exports.breakTimes.endTime,
          durationMinutes: schema_exports.breakTimes.durationMinutes,
          isActive: schema_exports.breakTimes.isActive,
          createdAt: schema_exports.breakTimes.createdAt,
          updatedAt: schema_exports.breakTimes.updatedAt
        }).from(schema_exports.breakTimes);
      } catch (fallbackError) {
        console.error("[Backup] Fallback also failed for breakTimes:", fallbackError.message);
        breakTimes2 = [];
      }
    }
    backupData.data.breakTimes = breakTimes2;
    try {
      const attendanceRecords2 = await db.select().from(schema_exports.attendanceRecords);
      backupData.data.attendanceRecords = attendanceRecords2;
    } catch (error) {
      console.warn("[Backup] attendanceRecords not available:", error);
    }
    try {
      const attendanceEditLogs2 = await db.select().from(schema_exports.attendanceEditLogs);
      backupData.data.attendanceEditLogs = attendanceEditLogs2;
    } catch (error) {
      console.warn("[Backup] attendanceEditLogs not available:", error);
    }
    try {
      const workRecords2 = await db.select().from(schema_exports.workRecords);
      backupData.data.workRecords = workRecords2;
    } catch (error) {
      console.warn("[Backup] workRecords not available:", error);
    }
    try {
      const vehicleProcessTargets2 = await db.select().from(schema_exports.vehicleProcessTargets);
      backupData.data.vehicleProcessTargets = vehicleProcessTargets2;
    } catch (error) {
      console.warn("[Backup] vehicleProcessTargets not available:", error);
    }
    try {
      const vehicleTypeProcessStandards2 = await db.select().from(schema_exports.vehicleTypeProcessStandards);
      backupData.data.vehicleTypeProcessStandards = vehicleTypeProcessStandards2;
    } catch (error) {
      console.warn("[Backup] vehicleTypeProcessStandards not available:", error);
    }
    try {
      const vehicleMemos2 = await db.select().from(schema_exports.vehicleMemos);
      backupData.data.vehicleMemos = vehicleMemos2;
    } catch (error) {
      console.warn("[Backup] vehicleMemos not available:", error);
    }
    try {
      const vehicleChecks2 = await db.select().from(schema_exports.vehicleChecks);
      backupData.data.vehicleChecks = vehicleChecks2;
    } catch (error) {
      console.warn("[Backup] vehicleChecks not available:", error);
    }
    try {
      const checkRequests2 = await db.select().from(schema_exports.checkRequests);
      backupData.data.checkRequests = checkRequests2;
    } catch (error) {
      console.warn("[Backup] checkRequests not available:", error);
    }
    try {
      const staffScheduleEntries2 = await db.select().from(schema_exports.staffScheduleEntries);
      backupData.data.staffScheduleEntries = staffScheduleEntries2;
    } catch (error) {
      console.warn("[Backup] staffScheduleEntries not available:", error);
    }
    try {
      const staffScheduleEditLogs2 = await db.select().from(schema_exports.staffScheduleEditLogs);
      backupData.data.staffScheduleEditLogs = staffScheduleEditLogs2;
    } catch (error) {
      console.warn("[Backup] staffScheduleEditLogs not available:", error);
    }
    try {
      const vehicleOutsourcing2 = await db.select().from(schema_exports.vehicleOutsourcing);
      backupData.data.vehicleOutsourcing = vehicleOutsourcing2;
    } catch (error) {
      console.warn("[Backup] vehicleOutsourcing not available:", error);
    }
    try {
      const vehicleAttentionPoints2 = await db.select().from(schema_exports.vehicleAttentionPoints);
      backupData.data.vehicleAttentionPoints = vehicleAttentionPoints2;
    } catch (error) {
      console.warn("[Backup] vehicleAttentionPoints not available:", error);
    }
    const backupFileName = `backup_${timestamp2}.json`;
    const backupFilePath = path2.join(backupDir, backupFileName);
    fs2.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), "utf-8");
    const files = fs2.readdirSync(backupDir);
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1e3;
    let deletedCount = 0;
    for (const file of files) {
      if (file.startsWith("backup_") && file.endsWith(".json")) {
        const filePath = path2.join(backupDir, file);
        const stats = fs2.statSync(filePath);
        if (stats.mtime.getTime() < thirtyDaysAgo) {
          fs2.unlinkSync(filePath);
          deletedCount++;
          console.log(`[Backup] \u53E4\u3044\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u524A\u9664: ${file}`);
        }
      }
    }
    if (deletedCount > 0) {
      console.log(`[Backup] ${deletedCount}\u4EF6\u306E\u53E4\u3044\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u524A\u9664\u3057\u307E\u3057\u305F\uFF0830\u65E5\u4EE5\u4E0A\u524D\uFF09`);
    }
    const recordCount = {
      vehicles: vehicles2.length,
      checkItems: checkItems2.length,
      users: users2.length,
      vehicleTypes: vehicleTypes2.length,
      processes: processes2.length,
      breakTimes: breakTimes2.length,
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
      vehicleAttentionPoints: backupData.data.vehicleAttentionPoints?.length || 0
    };
    console.log(`[Backup] \u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u4F5C\u6210\u5B8C\u4E86: ${backupFileName}`);
    console.log(`[Backup] \u8A18\u9332\u6570:`, recordCount);
    let cloudUploadSuccess = false;
    try {
      cloudUploadSuccess = await uploadToS3(backupFilePath, backupFileName);
    } catch (error) {
      console.error("[Backup] \u30AF\u30E9\u30A6\u30C9\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\uFF08\u7121\u8996\uFF09:", error.message);
    }
    return {
      success: true,
      fileName: backupFileName,
      filePath: backupFilePath,
      recordCount,
      cloudUploaded: cloudUploadSuccess
    };
  } catch (error) {
    console.error("[Backup] \u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u4F5C\u6210\u30A8\u30E9\u30FC:", error);
    throw new TRPCError15({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message || "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
    });
  }
}
var backupRouter;
var init_backup = __esm({
  "server/routers/backup.ts"() {
    "use strict";
    init_trpc();
    init_db();
    init_env();
    backupRouter = createTRPCRouter({
      // 手動バックアップ作成（管理者のみ）
      createBackup: adminProcedure.mutation(async () => {
        return await createBackup();
      }),
      // バックアップ一覧取得（管理者のみ）
      listBackups: adminProcedure.query(async () => {
        const backupDir = path2.resolve(process.cwd(), "backups");
        if (!fs2.existsSync(backupDir)) {
          return [];
        }
        const files = fs2.readdirSync(backupDir).filter((file) => file.startsWith("backup_") && file.endsWith(".json")).map((file) => {
          const filePath = path2.join(backupDir, file);
          const stats = fs2.statSync(filePath);
          return {
            fileName: file,
            filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        }).sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
        return files;
      }),
      // バックアップから復元（管理者のみ）
      restoreBackup: adminProcedure.input(z15.object({ fileName: z15.string() })).mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError15({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        const backupDir = path2.resolve(process.cwd(), "backups");
        const backupFilePath = path2.join(backupDir, input.fileName);
        if (!fs2.existsSync(backupFilePath)) {
          throw new TRPCError15({
            code: "NOT_FOUND",
            message: "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
          });
        }
        try {
          const backupContent = fs2.readFileSync(backupFilePath, "utf-8");
          const backupData = JSON.parse(backupContent);
          await createBackup();
          const { eq: eq16, inArray: inArray4 } = await import("drizzle-orm");
          if (backupData.data.vehicles) {
            const existingVehicles = await db.select({ id: schema_exports.vehicles.id }).from(schema_exports.vehicles);
            const existingIds = new Set(existingVehicles.map((v) => v.id));
            const newVehicles = backupData.data.vehicles.filter((v) => !existingIds.has(v.id));
            if (newVehicles.length > 0) {
              await db.insert(schema_exports.vehicles).values(newVehicles);
            }
          }
          if (backupData.data.checkItems) {
            const existingCheckItems = await db.select({ id: schema_exports.checkItems.id }).from(schema_exports.checkItems);
            const existingIds = new Set(existingCheckItems.map((c) => c.id));
            const newCheckItems = backupData.data.checkItems.filter((c) => !existingIds.has(c.id));
            if (newCheckItems.length > 0) {
              await db.insert(schema_exports.checkItems).values(newCheckItems);
            }
          }
          if (backupData.data.users) {
            for (const user of backupData.data.users) {
              await db.update(schema_exports.users).set({
                name: user.name,
                category: user.category
              }).where(eq16(schema_exports.users.id, user.id));
            }
          }
          if (backupData.data.staffScheduleDisplayOrder) {
            try {
              for (const order of backupData.data.staffScheduleDisplayOrder) {
                const existing = await db.select().from(schema_exports.staffScheduleDisplayOrder).where(eq16(schema_exports.staffScheduleDisplayOrder.userId, order.userId)).limit(1);
                if (existing.length > 0) {
                  await db.update(schema_exports.staffScheduleDisplayOrder).set({ displayOrder: order.displayOrder }).where(eq16(schema_exports.staffScheduleDisplayOrder.userId, order.userId));
                } else {
                  await db.insert(schema_exports.staffScheduleDisplayOrder).values(order);
                }
              }
            } catch (error) {
              console.warn("[Backup] staffScheduleDisplayOrder\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.vehicleTypes) {
            const existingTypes = await db.select({ id: schema_exports.vehicleTypes.id }).from(schema_exports.vehicleTypes);
            const existingIds = new Set(existingTypes.map((t2) => t2.id));
            const newTypes = backupData.data.vehicleTypes.filter((t2) => !existingIds.has(t2.id));
            if (newTypes.length > 0) {
              await db.insert(schema_exports.vehicleTypes).values(newTypes);
            }
          }
          if (backupData.data.processes) {
            const existingProcesses = await db.select({ id: schema_exports.processes.id }).from(schema_exports.processes);
            const existingIds = new Set(existingProcesses.map((p) => p.id));
            const newProcesses = backupData.data.processes.filter((p) => !existingIds.has(p.id));
            if (newProcesses.length > 0) {
              await db.insert(schema_exports.processes).values(newProcesses);
            }
          }
          if (backupData.data.breakTimes) {
            const existingBreakTimes = await db.select({ id: schema_exports.breakTimes.id }).from(schema_exports.breakTimes);
            const existingIds = new Set(existingBreakTimes.map((b) => b.id));
            const newBreakTimes = backupData.data.breakTimes.filter((b) => !existingIds.has(b.id));
            if (newBreakTimes.length > 0) {
              await db.insert(schema_exports.breakTimes).values(newBreakTimes);
            }
          }
          if (backupData.data.attendanceRecords) {
            try {
              const existingRecords = await db.select({ id: schema_exports.attendanceRecords.id }).from(schema_exports.attendanceRecords);
              const existingIds = new Set(existingRecords.map((r) => r.id));
              const newRecords = backupData.data.attendanceRecords.filter((r) => !existingIds.has(r.id));
              if (newRecords.length > 0) {
                await db.insert(schema_exports.attendanceRecords).values(newRecords);
                console.log(`[Backup] ${newRecords.length}\u4EF6\u306E\u51FA\u52E4\u8A18\u9332\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] attendanceRecords\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.attendanceEditLogs) {
            try {
              const existingLogs = await db.select({ id: schema_exports.attendanceEditLogs.id }).from(schema_exports.attendanceEditLogs);
              const existingIds = new Set(existingLogs.map((l) => l.id));
              const newLogs = backupData.data.attendanceEditLogs.filter((l) => !existingIds.has(l.id));
              if (newLogs.length > 0) {
                await db.insert(schema_exports.attendanceEditLogs).values(newLogs);
                console.log(`[Backup] ${newLogs.length}\u4EF6\u306E\u51FA\u52E4\u7DE8\u96C6\u5C65\u6B74\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] attendanceEditLogs\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.workRecords) {
            try {
              const existingRecords = await db.select({ id: schema_exports.workRecords.id }).from(schema_exports.workRecords);
              const existingIds = new Set(existingRecords.map((r) => r.id));
              const newRecords = backupData.data.workRecords.filter((r) => !existingIds.has(r.id));
              if (newRecords.length > 0) {
                await db.insert(schema_exports.workRecords).values(newRecords);
                console.log(`[Backup] ${newRecords.length}\u4EF6\u306E\u4F5C\u696D\u8A18\u9332\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] workRecords\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.vehicleProcessTargets) {
            try {
              const existingTargets = await db.select({ id: schema_exports.vehicleProcessTargets.id }).from(schema_exports.vehicleProcessTargets);
              const existingIds = new Set(existingTargets.map((t2) => t2.id));
              const newTargets = backupData.data.vehicleProcessTargets.filter((t2) => !existingIds.has(t2.id));
              if (newTargets.length > 0) {
                await db.insert(schema_exports.vehicleProcessTargets).values(newTargets);
                console.log(`[Backup] ${newTargets.length}\u4EF6\u306E\u8ECA\u4E21\u5DE5\u7A0B\u30BF\u30FC\u30B2\u30C3\u30C8\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] vehicleProcessTargets\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.vehicleTypeProcessStandards) {
            try {
              const existingStandards = await db.select({ id: schema_exports.vehicleTypeProcessStandards.id }).from(schema_exports.vehicleTypeProcessStandards);
              const existingIds = new Set(existingStandards.map((s) => s.id));
              const newStandards = backupData.data.vehicleTypeProcessStandards.filter((s) => !existingIds.has(s.id));
              if (newStandards.length > 0) {
                await db.insert(schema_exports.vehicleTypeProcessStandards).values(newStandards);
                console.log(`[Backup] ${newStandards.length}\u4EF6\u306E\u8ECA\u7A2E\u5DE5\u7A0B\u57FA\u6E96\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] vehicleTypeProcessStandards\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.vehicleMemos) {
            try {
              const existingMemos = await db.select({ id: schema_exports.vehicleMemos.id }).from(schema_exports.vehicleMemos);
              const existingIds = new Set(existingMemos.map((m) => m.id));
              const newMemos = backupData.data.vehicleMemos.filter((m) => !existingIds.has(m.id));
              if (newMemos.length > 0) {
                await db.insert(schema_exports.vehicleMemos).values(newMemos);
                console.log(`[Backup] ${newMemos.length}\u4EF6\u306E\u8ECA\u4E21\u30E1\u30E2\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] vehicleMemos\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.vehicleChecks) {
            try {
              const existingChecks = await db.select({ id: schema_exports.vehicleChecks.id }).from(schema_exports.vehicleChecks);
              const existingIds = new Set(existingChecks.map((c) => c.id));
              const newChecks = backupData.data.vehicleChecks.filter((c) => !existingIds.has(c.id));
              if (newChecks.length > 0) {
                await db.insert(schema_exports.vehicleChecks).values(newChecks);
                console.log(`[Backup] ${newChecks.length}\u4EF6\u306E\u8ECA\u4E21\u30C1\u30A7\u30C3\u30AF\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] vehicleChecks\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.checkRequests) {
            try {
              const existingRequests = await db.select({ id: schema_exports.checkRequests.id }).from(schema_exports.checkRequests);
              const existingIds = new Set(existingRequests.map((r) => r.id));
              const newRequests = backupData.data.checkRequests.filter((r) => !existingIds.has(r.id));
              if (newRequests.length > 0) {
                await db.insert(schema_exports.checkRequests).values(newRequests);
                console.log(`[Backup] ${newRequests.length}\u4EF6\u306E\u30C1\u30A7\u30C3\u30AF\u4F9D\u983C\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] checkRequests\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.staffScheduleEntries) {
            try {
              const existingEntries = await db.select({ id: schema_exports.staffScheduleEntries.id }).from(schema_exports.staffScheduleEntries);
              const existingIds = new Set(existingEntries.map((e) => e.id));
              const newEntries = backupData.data.staffScheduleEntries.filter((e) => !existingIds.has(e.id));
              if (newEntries.length > 0) {
                await db.insert(schema_exports.staffScheduleEntries).values(newEntries);
                console.log(`[Backup] ${newEntries.length}\u4EF6\u306E\u30B9\u30BF\u30C3\u30D5\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] staffScheduleEntries\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.staffScheduleEditLogs) {
            try {
              const existingLogs = await db.select({ id: schema_exports.staffScheduleEditLogs.id }).from(schema_exports.staffScheduleEditLogs);
              const existingIds = new Set(existingLogs.map((l) => l.id));
              const newLogs = backupData.data.staffScheduleEditLogs.filter((l) => !existingIds.has(l.id));
              if (newLogs.length > 0) {
                await db.insert(schema_exports.staffScheduleEditLogs).values(newLogs);
                console.log(`[Backup] ${newLogs.length}\u4EF6\u306E\u30B9\u30BF\u30C3\u30D5\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u7DE8\u96C6\u5C65\u6B74\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] staffScheduleEditLogs\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.vehicleOutsourcing) {
            try {
              const existingOutsourcing = await db.select({ id: schema_exports.vehicleOutsourcing.id }).from(schema_exports.vehicleOutsourcing);
              const existingIds = new Set(existingOutsourcing.map((o) => o.id));
              const newOutsourcing = backupData.data.vehicleOutsourcing.filter((o) => !existingIds.has(o.id));
              if (newOutsourcing.length > 0) {
                await db.insert(schema_exports.vehicleOutsourcing).values(newOutsourcing);
                console.log(`[Backup] ${newOutsourcing.length}\u4EF6\u306E\u8ECA\u4E21\u5916\u6CE8\u60C5\u5831\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] vehicleOutsourcing\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          if (backupData.data.vehicleAttentionPoints) {
            try {
              const existingPoints = await db.select({ id: schema_exports.vehicleAttentionPoints.id }).from(schema_exports.vehicleAttentionPoints);
              const existingIds = new Set(existingPoints.map((p) => p.id));
              const newPoints = backupData.data.vehicleAttentionPoints.filter((p) => !existingIds.has(p.id));
              if (newPoints.length > 0) {
                await db.insert(schema_exports.vehicleAttentionPoints).values(newPoints);
                console.log(`[Backup] ${newPoints.length}\u4EF6\u306E\u8ECA\u4E21\u6CE8\u610F\u30DD\u30A4\u30F3\u30C8\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F`);
              }
            } catch (error) {
              console.warn("[Backup] vehicleAttentionPoints\u5FA9\u5143\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error);
            }
          }
          return { success: true, message: "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u304B\u3089\u5FA9\u5143\u3057\u307E\u3057\u305F" };
        } catch (error) {
          console.error("[Backup] \u5FA9\u5143\u30A8\u30E9\u30FC:", error);
          throw new TRPCError15({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306E\u5FA9\u5143\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
          });
        }
      }),
      // バックアップファイルをダウンロード（管理者のみ）
      downloadBackup: adminProcedure.input(z15.object({ fileName: z15.string() })).mutation(async ({ input }) => {
        const backupDir = path2.resolve(process.cwd(), "backups");
        const backupFilePath = path2.join(backupDir, input.fileName);
        if (!fs2.existsSync(backupFilePath)) {
          throw new TRPCError15({
            code: "NOT_FOUND",
            message: "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
          });
        }
        const content = fs2.readFileSync(backupFilePath, "utf-8");
        return {
          fileName: input.fileName,
          content
        };
      })
    });
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import fs5 from "fs";
import path6 from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/oauth.ts
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", (_req, res) => {
    res.status(501).json({ error: "OAuth not implemented" });
  });
}

// server/routers.ts
init_trpc();

// server/routers/auth.ts
init_trpc();
init_db();
import { TRPCError as TRPCError2 } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

// server/_core/cookies.ts
init_env();
import { parse } from "cookie";
import { jwtVerify, SignJWT } from "jose";
var COOKIE_NAME = "campervan_session";
async function getUserIdFromCookie(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    return payload.sub;
  } catch {
    return null;
  }
}
async function setAuthCookie(res, userId) {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  const token = await new SignJWT({ sub: userId.toString() }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(secret);
  const isProduction = ENV.isProduction;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; ${isProduction ? "Secure; SameSite=Strict" : "SameSite=Lax"}`
  );
}
function clearAuthCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

// server/routers/auth.ts
var authRouter = createTRPCRouter({
  login: publicProcedure.input(
    z.object({
      username: z.string(),
      password: z.string()
    })
  ).mutation(async ({ input, ctx }) => {
    try {
      console.log("[Auth] ========== Login attempt ==========");
      console.log("[Auth] Username:", input.username);
      console.log("[Auth] Password length:", input.password?.length || 0);
      const user = await getUserByUsername(input.username);
      console.log(
        "[Auth] getUserByUsername result:",
        user ? { id: user.id, username: user.username, hasPassword: !!user.password } : "null"
      );
      if (!user) {
        console.log("[Auth] \u274C User not found:", input.username);
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "\u30E6\u30FC\u30B6\u30FC\u540D\u307E\u305F\u306F\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093"
        });
      }
      console.log("[Auth] User found:", {
        id: user.id,
        username: user.username,
        role: user.role
      });
      if (!user.password) {
        console.log("[Auth] \u274C User has no password set:", user.username);
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "\u30E6\u30FC\u30B6\u30FC\u540D\u307E\u305F\u306F\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093"
        });
      }
      const isPasswordValid = await bcrypt.compare(input.password, user.password);
      if (!isPasswordValid) {
        console.log("[Auth] \u274C Invalid password for user:", user.username);
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "\u30E6\u30FC\u30B6\u30FC\u540D\u307E\u305F\u306F\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093"
        });
      }
      console.log("[Auth] \u2705 Password verified for user:", user.username);
      await setAuthCookie(ctx.res, user.id);
      console.log("[Auth] Login successful for user:", user.username);
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      };
    } catch (error) {
      if (error instanceof TRPCError2) {
        throw error;
      }
      console.error("[Auth] Login error:", error);
      throw new TRPCError2({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "\u30ED\u30B0\u30A4\u30F3\u51E6\u7406\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F"
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
      role: ctx.user.role
    };
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    clearAuthCookie(ctx.res);
    return { success: true };
  }),
  // サンプル用：パスワードなしでログイン（roleを指定）
  loginAs: publicProcedure.input(
    z.object({
      role: z.enum(["admin", "field_worker"])
    })
  ).mutation(async ({ input, ctx }) => {
    try {
      console.log("[Auth] ========== LoginAs attempt ==========");
      console.log("[Auth] Role:", input.role);
      console.log("[Auth] Attempting to initialize database connection...");
      console.log("[Auth] MYSQL_URL:", process.env.MYSQL_URL ? "set" : "not set");
      console.log("[Auth] DATABASE_URL:", process.env.DATABASE_URL ? "set" : "not set");
      if (process.env.DATABASE_URL) {
        const maskedDbUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@");
        console.log("[Auth] DATABASE_URL value:", maskedDbUrl);
      }
      const db = await getDb();
      let user = null;
      if (!db) {
        console.warn("[Auth] \u26A0\uFE0F Database connection failed, using fallback mock user");
        user = {
          id: input.role === "admin" ? 1 : 2,
          username: input.role === "admin" ? "admin" : "user001",
          name: input.role === "admin" ? "\u7BA1\u7406\u8005" : "\u4E00\u822C\u30E6\u30FC\u30B6\u30FC",
          role: input.role,
          category: null
        };
        console.log("[Auth] \u2705 Using fallback mock user:", user);
      } else {
        const pool = getPool();
        if (!pool) {
          console.warn("[Auth] \u26A0\uFE0F Pool is null, using fallback mock user");
          user = {
            id: input.role === "admin" ? 1 : 2,
            username: input.role === "admin" ? "admin" : "user001",
            name: input.role === "admin" ? "\u7BA1\u7406\u8005" : "\u4E00\u822C\u30E6\u30FC\u30B6\u30FC",
            role: input.role,
            category: null
          };
          console.log("[Auth] \u2705 Using fallback mock user:", user);
        } else {
          try {
            const [rows] = await pool.execute(
              `SELECT id, username, password, name, role, category
                                 FROM users
                                 WHERE role = ?
                                 LIMIT 1`,
              [input.role]
            );
            if (!Array.isArray(rows) || rows.length === 0) {
              console.log("[Auth] \u26A0\uFE0F User not found with role, using fallback mock user:", input.role);
              user = {
                id: input.role === "admin" ? 1 : 2,
                username: input.role === "admin" ? "admin" : "user001",
                name: input.role === "admin" ? "\u7BA1\u7406\u8005" : "\u4E00\u822C\u30E6\u30FC\u30B6\u30FC",
                role: input.role,
                category: null
              };
            } else {
              user = rows[0];
            }
          } catch (dbError) {
            console.warn("[Auth] \u26A0\uFE0F Database query failed, using fallback mock user:", dbError.message);
            user = {
              id: input.role === "admin" ? 1 : 2,
              username: input.role === "admin" ? "admin" : "user001",
              name: input.role === "admin" ? "\u7BA1\u7406\u8005" : "\u4E00\u822C\u30E6\u30FC\u30B6\u30FC",
              role: input.role,
              category: null
            };
          }
        }
      }
      if (!user) {
        console.log("[Auth] \u274C User not found with role:", input.role);
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: `${input.role === "admin" ? "\u7BA1\u7406\u8005" : "\u4E00\u822C"}\u30E6\u30FC\u30B6\u30FC\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093`
        });
      }
      console.log("[Auth] \u2705 User found:", {
        id: user.id,
        username: user.username,
        role: user.role
      });
      await setAuthCookie(ctx.res, user.id);
      console.log("[Auth] LoginAs successful for role:", input.role);
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name ?? null,
          role: user.role
        }
      };
    } catch (error) {
      if (error instanceof TRPCError2) {
        throw error;
      }
      console.error("[Auth] LoginAs error:", error);
      throw new TRPCError2({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "\u30ED\u30B0\u30A4\u30F3\u51E6\u7406\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F"
      });
    }
  })
});

// server/routers.ts
init_attendance();

// server/routers/workRecords.ts
init_trpc();
init_db();
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z3 } from "zod";
import { eq as eq3, and as and2, isNull as isNull2, gte, lte, desc } from "drizzle-orm";
import { startOfDay, endOfDay } from "date-fns";
function getJSTNow2() {
  const now = /* @__PURE__ */ new Date();
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(now);
  return {
    year: parseInt(parts.find((p) => p.type === "year")?.value || "0"),
    month: parseInt(parts.find((p) => p.type === "month")?.value || "1"),
    day: parseInt(parts.find((p) => p.type === "day")?.value || "1")
  };
}
var workRecordsRouter = createTRPCRouter({
  // 作業中の記録を取得
  getActive: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const records = await db.select({
      id: schema_exports.workRecords.id,
      vehicleId: schema_exports.workRecords.vehicleId,
      processId: schema_exports.workRecords.processId,
      startTime: schema_exports.workRecords.startTime
    }).from(schema_exports.workRecords).where(
      and2(
        eq3(schema_exports.workRecords.userId, ctx.user.id),
        isNull2(schema_exports.workRecords.endTime)
      )
    );
    return records.map((r) => {
      return {
        id: r.id,
        vehicleId: r.vehicleId,
        vehicleNumber: "\u672A\u53D6\u5F97",
        vehicleType: "\u672A\u53D6\u5F97",
        processId: r.processId,
        processName: "\u672A\u53D6\u5F97",
        startTime: r.startTime
      };
    });
  }),
  // 1週間分の作業記録を取得（今日から7日前まで）
  getTodayRecords: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const jstNow = getJSTNow2();
    const today = new Date(jstNow.year, jstNow.month - 1, jstNow.day);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const start = startOfDay(weekAgo);
    const end = endOfDay(today);
    const records = await db.select().from(schema_exports.workRecords).where(
      and2(
        eq3(schema_exports.workRecords.userId, ctx.user.id),
        gte(schema_exports.workRecords.startTime, start),
        lte(schema_exports.workRecords.startTime, end)
      )
    ).orderBy(schema_exports.workRecords.startTime);
    const vehicles2 = await db.select().from(schema_exports.vehicles);
    const processes2 = await db.select().from(schema_exports.processes);
    const vehicleMap = new Map(vehicles2.map((v) => [v.id, v]));
    const processMap = new Map(processes2.map((p) => [p.id, p]));
    return records.map((r) => {
      const vehicle = vehicleMap.get(r.vehicleId);
      const process2 = processMap.get(r.processId);
      return {
        id: r.id,
        vehicleId: r.vehicleId,
        vehicleNumber: vehicle?.vehicleNumber || "\u4E0D\u660E",
        processId: r.processId,
        processName: process2?.name || "\u4E0D\u660E",
        startTime: r.startTime,
        endTime: r.endTime,
        durationMinutes: r.endTime ? Math.floor((r.endTime.getTime() - r.startTime.getTime()) / 1e3 / 60) : null,
        workDescription: r.workDescription
      };
    });
  }),
  // 作業記録を作成
  create: protectedProcedure.input(
    z3.object({
      userId: z3.number(),
      vehicleId: z3.number(),
      processId: z3.number(),
      startTime: z3.string(),
      endTime: z3.string().optional(),
      workDescription: z3.string().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    if (input.userId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "sub_admin") {
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "\u6A29\u9650\u304C\u3042\u308A\u307E\u305B\u3093"
      });
    }
    try {
      const startTimeDate = new Date(input.startTime);
      const endTimeDate = input.endTime ? new Date(input.endTime) : null;
      const startTimeJST = startTimeDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      const endTimeJST = endTimeDate ? endTimeDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : null;
      console.log("[workRecords.create] \u4F5C\u696D\u8A18\u9332\u3092\u8FFD\u52A0:", {
        userId: input.userId,
        vehicleId: input.vehicleId,
        processId: input.processId,
        startTimeInput: input.startTime,
        startTimeDate: startTimeDate.toISOString(),
        startTimeDateUTC: startTimeDate.toUTCString(),
        startTimeJST,
        endTimeInput: input.endTime,
        endTimeDate: endTimeDate?.toISOString(),
        endTimeDateUTC: endTimeDate?.toUTCString(),
        endTimeJST
      });
      await db.insert(schema_exports.workRecords).values({
        userId: input.userId,
        vehicleId: input.vehicleId,
        processId: input.processId,
        startTime: startTimeDate,
        endTime: endTimeDate,
        workDescription: input.workDescription
      });
      const [inserted] = await db.select().from(schema_exports.workRecords).where(
        and2(
          eq3(schema_exports.workRecords.userId, input.userId),
          eq3(schema_exports.workRecords.vehicleId, input.vehicleId),
          eq3(schema_exports.workRecords.processId, input.processId)
        )
      ).orderBy(desc(schema_exports.workRecords.id)).limit(1);
      if (!inserted) {
        console.error(`[workRecords.create] \u8B66\u544A: \u633F\u5165\u3057\u305F\u4F5C\u696D\u8A18\u9332\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093`);
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: "\u4F5C\u696D\u8A18\u9332\u306E\u4F5C\u6210\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u304C\u3001\u30C7\u30FC\u30BF\u306E\u78BA\u8A8D\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
        });
      }
      console.log(`[workRecords.create] \u4F5C\u696D\u8A18\u9332\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F: \u30E6\u30FC\u30B6\u30FCID=${input.userId}, \u8ECA\u4E21ID=${input.vehicleId}, \u8A18\u9332ID=${inserted.id}`);
      console.log(`[workRecords.create] \u4FDD\u5B58\u3055\u308C\u305FstartTime:`, {
        id: inserted.id,
        startTime: inserted.startTime,
        startTimeISO: inserted.startTime?.toISOString(),
        startTimeJST: inserted.startTime?.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
        startDate: inserted.startTime ? new Date(inserted.startTime).toISOString().split("T")[0] : null
      });
      const vehicles2 = await db.select().from(schema_exports.vehicles);
      const processes2 = await db.select().from(schema_exports.processes);
      const vehicle = vehicles2.find((v) => v.id === inserted.vehicleId);
      const process2 = processes2.find((p) => p.id === inserted.processId);
      return {
        id: inserted.id,
        startTime: inserted.startTime,
        endTime: inserted.endTime,
        vehicleId: inserted.vehicleId,
        processId: inserted.processId,
        vehicleNumber: vehicle?.vehicleNumber || "\u4E0D\u660E",
        customerName: vehicle?.customerName || null,
        processName: process2?.name || "\u4E0D\u660E",
        workDescription: inserted.workDescription || null,
        durationMinutes: inserted.endTime ? Math.floor((new Date(inserted.endTime).getTime() - new Date(inserted.startTime).getTime()) / (1e3 * 60)) : 0
      };
    } catch (error) {
      console.error(`[workRecords.create] \u30A8\u30E9\u30FC: \u4F5C\u696D\u8A18\u9332\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F`, {
        error,
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        input: {
          userId: input.userId,
          vehicleId: input.vehicleId,
          processId: input.processId,
          startTime: input.startTime,
          endTime: input.endTime
        }
      });
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: error?.message || "\u4F5C\u696D\u8A18\u9332\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
        cause: error
      });
    }
  }),
  // 全スタッフの作業記録を取得（準管理者以上）
  getAllRecords: subAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const records = await db.select().from(schema_exports.workRecords).orderBy(schema_exports.workRecords.startTime);
    const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const users2 = await selectUsersSafely2(db);
    const vehicles2 = await db.select().from(schema_exports.vehicles);
    const processes2 = await db.select().from(schema_exports.processes);
    const userMap = new Map(users2.map((u) => [u.id, u]));
    const vehicleMap = new Map(vehicles2.map((v) => [v.id, v]));
    const processMap = new Map(processes2.map((p) => [p.id, p]));
    return records.map((r) => {
      const user = userMap.get(r.userId);
      const vehicle = vehicleMap.get(r.vehicleId);
      const process2 = processMap.get(r.processId);
      return {
        id: r.id,
        userId: r.userId,
        userName: user?.name || user?.username || "\u4E0D\u660E",
        vehicleId: r.vehicleId,
        vehicleNumber: vehicle?.vehicleNumber || "\u4E0D\u660E",
        processId: r.processId,
        processName: process2?.name || "\u4E0D\u660E",
        startTime: r.startTime,
        endTime: r.endTime,
        durationMinutes: r.endTime ? Math.floor((r.endTime.getTime() - r.startTime.getTime()) / 1e3 / 60) : null,
        workDescription: r.workDescription
      };
    });
  }),
  // 作業記録を更新（準管理者以上）
  update: subAdminProcedure.input(
    z3.object({
      id: z3.number(),
      vehicleId: z3.number().optional(),
      processId: z3.number().optional(),
      startTime: z3.string().optional(),
      endTime: z3.string().optional(),
      workDescription: z3.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const updateData = {};
    if (input.vehicleId !== void 0) updateData.vehicleId = input.vehicleId;
    if (input.processId !== void 0) updateData.processId = input.processId;
    if (input.startTime !== void 0) updateData.startTime = new Date(input.startTime);
    if (input.endTime !== void 0) updateData.endTime = input.endTime ? new Date(input.endTime) : null;
    if (input.workDescription !== void 0) updateData.workDescription = input.workDescription;
    await db.update(schema_exports.workRecords).set(updateData).where(eq3(schema_exports.workRecords.id, input.id));
    return { success: true };
  }),
  // 自分の作業記録を更新（一般ユーザー用）
  updateMyRecord: protectedProcedure.input(
    z3.object({
      id: z3.number(),
      vehicleId: z3.number().optional(),
      processId: z3.number().optional(),
      startTime: z3.string().optional(),
      endTime: z3.string().optional(),
      workDescription: z3.string().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const [record] = await db.select().from(schema_exports.workRecords).where(eq3(schema_exports.workRecords.id, input.id)).limit(1);
    if (!record) {
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "\u4F5C\u696D\u8A18\u9332\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    if (record.userId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "sub_admin") {
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "\u81EA\u5206\u306E\u8A18\u9332\u306E\u307F\u7DE8\u96C6\u3067\u304D\u307E\u3059"
      });
    }
    if (record.userId === ctx.user.id && ctx.user.role === "field_worker") {
      const jstNow = getJSTNow2();
      const today = new Date(jstNow.year, jstNow.month - 1, jstNow.day);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const limit = startOfDay(weekAgo);
      if (record.startTime < limit) {
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "\u81EA\u5206\u306E\u4F5C\u696D\u8A18\u9332\u306F\u300C1\u9031\u9593\u4EE5\u5185\u300D\u306E\u5206\u306E\u307F\u7DE8\u96C6\u3067\u304D\u307E\u3059"
        });
      }
    }
    const updateData = {};
    if (input.vehicleId !== void 0) updateData.vehicleId = input.vehicleId;
    if (input.processId !== void 0) updateData.processId = input.processId;
    if (input.startTime !== void 0) updateData.startTime = new Date(input.startTime);
    if (input.endTime !== void 0) updateData.endTime = input.endTime ? new Date(input.endTime) : null;
    if (input.workDescription !== void 0) updateData.workDescription = input.workDescription;
    await db.update(schema_exports.workRecords).set(updateData).where(eq3(schema_exports.workRecords.id, input.id));
    console.log(`[workRecords.updateMyRecord] \u4F5C\u696D\u8A18\u9332\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F: ID=${input.id}, \u66F4\u65B0\u9805\u76EE=${Object.keys(updateData).join(", ")}`);
    const [updated] = await db.select().from(schema_exports.workRecords).where(eq3(schema_exports.workRecords.id, input.id)).limit(1);
    if (!updated) {
      console.error(`[workRecords.updateMyRecord] \u8B66\u544A: \u66F4\u65B0\u3057\u305F\u4F5C\u696D\u8A18\u9332\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ID=${input.id}`);
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u4F5C\u696D\u8A18\u9332\u306E\u66F4\u65B0\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u304C\u3001\u30C7\u30FC\u30BF\u306E\u78BA\u8A8D\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
      });
    }
    return { success: true };
  }),
  // 作業記録を削除（準管理者以上）
  delete: subAdminProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const [record] = await db.select().from(schema_exports.workRecords).where(eq3(schema_exports.workRecords.id, input.id)).limit(1);
    if (!record) {
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "\u4F5C\u696D\u8A18\u9332\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    console.log(`[workRecords.delete] \u4F5C\u696D\u8A18\u9332\u3092\u524A\u9664\u3057\u307E\u3059: ID=${input.id}, \u30E6\u30FC\u30B6\u30FCID=${record.userId}, \u8ECA\u4E21ID=${record.vehicleId}`);
    await db.delete(schema_exports.workRecords).where(eq3(schema_exports.workRecords.id, input.id));
    console.log(`[workRecords.delete] \u4F5C\u696D\u8A18\u9332\u3092\u524A\u9664\u3057\u307E\u3057\u305F: ID=${input.id}`);
    return { success: true };
  }),
  // 自分の作業記録を削除（一般ユーザー用）
  deleteMyRecord: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const [record] = await db.select().from(schema_exports.workRecords).where(eq3(schema_exports.workRecords.id, input.id)).limit(1);
    if (!record) {
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "\u4F5C\u696D\u8A18\u9332\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    if (record.userId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "sub_admin") {
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "\u81EA\u5206\u306E\u8A18\u9332\u306E\u307F\u524A\u9664\u3067\u304D\u307E\u3059"
      });
    }
    if (record.userId === ctx.user.id && ctx.user.role === "field_worker") {
      const jstNow = getJSTNow2();
      const today = new Date(jstNow.year, jstNow.month - 1, jstNow.day);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const limit = startOfDay(weekAgo);
      if (record.startTime < limit) {
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "\u81EA\u5206\u306E\u4F5C\u696D\u8A18\u9332\u306F\u300C1\u9031\u9593\u4EE5\u5185\u300D\u306E\u5206\u306E\u307F\u524A\u9664\u3067\u304D\u307E\u3059"
        });
      }
    }
    console.log(`[workRecords.deleteMyRecord] \u4F5C\u696D\u8A18\u9332\u3092\u524A\u9664\u3057\u307E\u3059: ID=${input.id}, \u30E6\u30FC\u30B6\u30FCID=${record.userId}, \u8ECA\u4E21ID=${record.vehicleId}`);
    await db.delete(schema_exports.workRecords).where(eq3(schema_exports.workRecords.id, input.id));
    console.log(`[workRecords.deleteMyRecord] \u4F5C\u696D\u8A18\u9332\u3092\u524A\u9664\u3057\u307E\u3057\u305F: ID=${input.id}`);
    return { success: true };
  }),
  // 作業を開始
  start: protectedProcedure.input(
    z3.object({
      vehicleId: z3.number(),
      processId: z3.number(),
      workDescription: z3.string().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const activeRecords = await db.select().from(schema_exports.workRecords).where(
      and2(
        eq3(schema_exports.workRecords.userId, ctx.user.id),
        isNull2(schema_exports.workRecords.endTime)
      )
    );
    if (activeRecords.length > 0) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "\u65E2\u306B\u4F5C\u696D\u4E2D\u306E\u8A18\u9332\u304C\u3042\u308A\u307E\u3059\u3002\u5148\u306B\u4F5C\u696D\u3092\u7D42\u4E86\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      });
    }
    await db.insert(schema_exports.workRecords).values({
      userId: ctx.user.id,
      vehicleId: input.vehicleId,
      processId: input.processId,
      startTime: /* @__PURE__ */ new Date(),
      endTime: null,
      workDescription: input.workDescription
    });
    const [inserted] = await db.select().from(schema_exports.workRecords).where(
      and2(
        eq3(schema_exports.workRecords.userId, ctx.user.id),
        eq3(schema_exports.workRecords.vehicleId, input.vehicleId),
        eq3(schema_exports.workRecords.processId, input.processId),
        isNull2(schema_exports.workRecords.endTime)
      )
    ).orderBy(schema_exports.workRecords.id).limit(1);
    if (!inserted) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u4F5C\u696D\u8A18\u9332\u306E\u4F5C\u6210\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u304C\u3001\u30C7\u30FC\u30BF\u306E\u78BA\u8A8D\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
      });
    }
    return {
      id: inserted.id,
      startTime: inserted.startTime
    };
  }),
  // 作業を終了
  stop: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const [record] = await db.select().from(schema_exports.workRecords).where(eq3(schema_exports.workRecords.id, input.id)).limit(1);
    if (!record) {
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "\u4F5C\u696D\u8A18\u9332\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    if (record.userId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "sub_admin") {
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "\u6A29\u9650\u304C\u3042\u308A\u307E\u305B\u3093"
      });
    }
    const endTime = /* @__PURE__ */ new Date();
    const durationMinutes = Math.floor(
      (endTime.getTime() - record.startTime.getTime()) / 1e3 / 60
    );
    await db.update(schema_exports.workRecords).set({
      endTime
    }).where(eq3(schema_exports.workRecords.id, input.id));
    return {
      id: input.id,
      endTime,
      durationMinutes
    };
  })
});

// server/routers/vehicles.ts
init_trpc();
init_db();
import { TRPCError as TRPCError5 } from "@trpc/server";
import { z as z4 } from "zod";
import { eq as eq4, desc as desc2 } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
var vehiclesRouter = createTRPCRouter({
  // 車両一覧を取得
  list: protectedProcedure.input(
    z4.object({
      status: z4.enum(["in_progress", "completed", "archived"]).optional(),
      sinceYesterday: z4.boolean().optional().default(false)
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    let vehicles2;
    if (input.status) {
      vehicles2 = await db.select().from(schema_exports.vehicles).where(eq4(schema_exports.vehicles.status, input.status));
    } else {
      vehicles2 = await db.select().from(schema_exports.vehicles);
    }
    const vehicleIds = vehicles2.map((v) => v.id);
    let allOutsourcing = [];
    let allWorkRecords = [];
    if (vehicleIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      allOutsourcing = await db.select().from(schema_exports.vehicleOutsourcing).where(inArray4(schema_exports.vehicleOutsourcing.vehicleId, vehicleIds)).orderBy(schema_exports.vehicleOutsourcing.displayOrder);
      allWorkRecords = await db.select().from(schema_exports.workRecords).where(inArray4(schema_exports.workRecords.vehicleId, vehicleIds));
    }
    const outsourcingMap = /* @__PURE__ */ new Map();
    allOutsourcing.forEach((o) => {
      const existing = outsourcingMap.get(o.vehicleId) || [];
      existing.push({
        id: o.id,
        destination: o.destination,
        startDate: o.startDate,
        endDate: o.endDate,
        displayOrder: o.displayOrder
      });
      outsourcingMap.set(o.vehicleId, existing);
    });
    const totalMinutesMap = /* @__PURE__ */ new Map();
    allWorkRecords.forEach((wr) => {
      if (!wr.endTime) return;
      const minutes = Math.floor(
        (wr.endTime.getTime() - wr.startTime.getTime()) / 1e3 / 60
      );
      const current = totalMinutesMap.get(wr.vehicleId) || 0;
      totalMinutesMap.set(wr.vehicleId, current + minutes);
    });
    return vehicles2.map((v) => ({
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
      outsourcingDestination: v.outsourcingDestination,
      // 後方互換性のため残す
      outsourcingStartDate: v.outsourcingStartDate,
      // 後方互換性のため残す
      outsourcingEndDate: v.outsourcingEndDate,
      // 後方互換性のため残す
      outsourcing: outsourcingMap.get(v.id) || [],
      // 新しい外注先配列
      completionDate: v.completionDate,
      status: v.status,
      targetTotalMinutes: v.targetTotalMinutes,
      totalWorkMinutes: totalMinutesMap.get(v.id) || 0,
      processTime: [],
      processTargets: []
    }));
  }),
  // 車両を作成（全ユーザー可）
  create: protectedProcedure.input(
    z4.object({
      vehicleNumber: z4.string().optional(),
      vehicleTypeId: z4.number(),
      category: z4.enum(["\u4E00\u822C", "\u30AD\u30E3\u30F3\u30D1\u30FC", "\u4E2D\u53E4", "\u4FEE\u7406", "\u30AF\u30EC\u30FC\u30E0"]).default("\u4E00\u822C"),
      customerName: z4.string().optional(),
      desiredDeliveryDate: z4.date().optional(),
      checkDueDate: z4.date().optional(),
      reserveDate: z4.date().optional(),
      reserveRound: z4.string().optional(),
      hasCoating: z4.enum(["yes", "no"]).optional(),
      hasLine: z4.enum(["yes", "no"]).optional(),
      hasPreferredNumber: z4.enum(["yes", "no"]).optional(),
      hasTireReplacement: z4.enum(["summer", "winter", "no"]).optional(),
      instructionSheetUrl: z4.string().optional(),
      outsourcingDestination: z4.string().optional(),
      outsourcingStartDate: z4.date().optional(),
      outsourcingEndDate: z4.date().optional(),
      targetTotalMinutes: z4.number().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    let vehicleNumber = input.vehicleNumber;
    try {
      if (!vehicleNumber || vehicleNumber.trim() === "") {
        const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
        const yearPrefix = `${currentYear}-`;
        const pool = getPool();
        if (!pool) {
          throw new TRPCError5({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u30D7\u30FC\u30EB\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
          });
        }
        const query = `
                        SELECT vehicleNumber
                        FROM \`vehicles\`
                        WHERE vehicleNumber LIKE ?
                        ORDER BY vehicleNumber DESC
                    `;
        const [rows] = await pool.execute(query, [`${yearPrefix}%`]);
        let maxNumber = 0;
        for (const row of rows) {
          const vehicleNumber2 = row.vehicleNumber;
          const match = vehicleNumber2.match(new RegExp(`^${currentYear}-(\\d+)$`));
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        }
        const nextNumber = maxNumber + 1;
        vehicleNumber = `${currentYear}-${nextNumber}`;
        console.log(`[vehicles.create] \u8ECA\u4E21\u756A\u53F7\u3092\u81EA\u52D5\u751F\u6210\u3057\u307E\u3057\u305F: ${vehicleNumber} (\u73FE\u5728\u306E\u6700\u5927\u756A\u53F7: ${maxNumber})`);
      }
      await db.insert(schema_exports.vehicles).values({
        vehicleNumber,
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
        targetTotalMinutes: input.targetTotalMinutes
      });
      const [inserted] = await db.select().from(schema_exports.vehicles).where(eq4(schema_exports.vehicles.vehicleNumber, vehicleNumber)).orderBy(desc2(schema_exports.vehicles.id)).limit(1);
      if (!inserted) {
        console.error(`[vehicles.create] \u8B66\u544A: \u633F\u5165\u3057\u305F\u8ECA\u4E21\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ${vehicleNumber}`);
        throw new TRPCError5({
          code: "INTERNAL_SERVER_ERROR",
          message: "\u8ECA\u4E21\u306E\u4F5C\u6210\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u304C\u3001\u30C7\u30FC\u30BF\u306E\u78BA\u8A8D\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
        });
      }
      console.log(`[vehicles.create] \u8ECA\u4E21\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F: ${vehicleNumber} (ID: ${inserted.id})`);
      return {
        id: inserted.id
      };
    } catch (error) {
      console.error(`[vehicles.create] \u30A8\u30E9\u30FC: \u8ECA\u4E21\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${vehicleNumber || "\u81EA\u52D5\u751F\u6210"}`, error);
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "\u8ECA\u4E21\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
      });
    }
  }),
  // 車両を更新（準管理者以上）
  update: subAdminProcedure.input(
    z4.object({
      id: z4.number(),
      vehicleNumber: z4.string().optional(),
      vehicleTypeId: z4.number().optional(),
      category: z4.enum(["\u4E00\u822C", "\u30AD\u30E3\u30F3\u30D1\u30FC", "\u4E2D\u53E4", "\u4FEE\u7406", "\u30AF\u30EC\u30FC\u30E0"]).optional(),
      customerName: z4.string().optional(),
      desiredDeliveryDate: z4.date().optional(),
      checkDueDate: z4.date().optional(),
      reserveDate: z4.date().optional(),
      reserveRound: z4.string().optional(),
      hasCoating: z4.enum(["yes", "no"]).optional(),
      hasLine: z4.enum(["yes", "no"]).optional(),
      hasPreferredNumber: z4.enum(["yes", "no"]).optional(),
      hasTireReplacement: z4.enum(["summer", "winter", "no"]).optional(),
      instructionSheetUrl: z4.string().optional(),
      outsourcingDestination: z4.string().optional(),
      outsourcingStartDate: z4.date().optional(),
      outsourcingEndDate: z4.date().optional(),
      targetTotalMinutes: z4.number().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    try {
      const updateData = {};
      if (input.vehicleNumber !== void 0) updateData.vehicleNumber = input.vehicleNumber;
      if (input.vehicleTypeId !== void 0) updateData.vehicleTypeId = input.vehicleTypeId;
      if (input.category !== void 0) updateData.category = input.category;
      if (input.customerName !== void 0) updateData.customerName = input.customerName;
      if (input.desiredDeliveryDate !== void 0) {
        if (input.desiredDeliveryDate instanceof Date && !isNaN(input.desiredDeliveryDate.getTime())) {
          updateData.desiredDeliveryDate = input.desiredDeliveryDate;
        }
      }
      if (input.checkDueDate !== void 0) {
        if (input.checkDueDate instanceof Date && !isNaN(input.checkDueDate.getTime())) {
          updateData.checkDueDate = input.checkDueDate;
        }
      }
      if (input.reserveDate !== void 0) {
        if (input.reserveDate instanceof Date && !isNaN(input.reserveDate.getTime())) {
          updateData.reserveDate = input.reserveDate;
        }
      }
      if (input.reserveRound !== void 0) updateData.reserveRound = input.reserveRound;
      if (input.hasCoating !== void 0) updateData.hasCoating = input.hasCoating;
      if (input.hasLine !== void 0) updateData.hasLine = input.hasLine;
      if (input.hasPreferredNumber !== void 0) updateData.hasPreferredNumber = input.hasPreferredNumber;
      if (input.hasTireReplacement !== void 0) updateData.hasTireReplacement = input.hasTireReplacement;
      if (input.instructionSheetUrl !== void 0) updateData.instructionSheetUrl = input.instructionSheetUrl;
      if (input.outsourcingDestination !== void 0) updateData.outsourcingDestination = input.outsourcingDestination;
      if (input.outsourcingStartDate !== void 0) {
        if (input.outsourcingStartDate instanceof Date && !isNaN(input.outsourcingStartDate.getTime())) {
          updateData.outsourcingStartDate = input.outsourcingStartDate;
        }
      }
      if (input.outsourcingEndDate !== void 0) {
        if (input.outsourcingEndDate instanceof Date && !isNaN(input.outsourcingEndDate.getTime())) {
          updateData.outsourcingEndDate = input.outsourcingEndDate;
        }
      }
      if (input.targetTotalMinutes !== void 0)
        updateData.targetTotalMinutes = input.targetTotalMinutes;
      if (Object.keys(updateData).length === 0) {
        throw new TRPCError5({
          code: "BAD_REQUEST",
          message: "\u66F4\u65B0\u3059\u308B\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093"
        });
      }
      await db.update(schema_exports.vehicles).set(updateData).where(eq4(schema_exports.vehicles.id, input.id));
      console.log(`[vehicles.update] \u8ECA\u4E21\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F: ID=${input.id}, \u66F4\u65B0\u9805\u76EE=${Object.keys(updateData).join(", ")}`);
      const [updated] = await db.select().from(schema_exports.vehicles).where(eq4(schema_exports.vehicles.id, input.id)).limit(1);
      if (!updated) {
        console.error(`[vehicles.update] \u8B66\u544A: \u66F4\u65B0\u3057\u305F\u8ECA\u4E21\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ID=${input.id}`);
        throw new TRPCError5({
          code: "INTERNAL_SERVER_ERROR",
          message: "\u8ECA\u4E21\u306E\u66F4\u65B0\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u304C\u3001\u30C7\u30FC\u30BF\u306E\u78BA\u8A8D\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
        });
      }
      return { success: true };
    } catch (error) {
      console.error("[vehicles.update] Error:", error);
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "\u8ECA\u4E21\u306E\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
      });
    }
  }),
  // 車両詳細を取得
  get: protectedProcedure.input(z4.object({ id: z4.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const [vehicle] = await db.select().from(schema_exports.vehicles).where(eq4(schema_exports.vehicles.id, input.id)).limit(1);
    if (!vehicle) {
      throw new TRPCError5({
        code: "NOT_FOUND",
        message: "\u8ECA\u4E21\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    const workRecords2 = await db.select().from(schema_exports.workRecords).where(eq4(schema_exports.workRecords.vehicleId, input.id)).orderBy(schema_exports.workRecords.startTime);
    const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const users2 = await selectUsersSafely2(db);
    const processes2 = await db.select().from(schema_exports.processes);
    const userMap = new Map(users2.map((u) => [u.id, u]));
    const processMap = new Map(processes2.map((p) => [p.id, p]));
    const memos = await db.select().from(schema_exports.vehicleMemos).where(eq4(schema_exports.vehicleMemos.vehicleId, input.id)).orderBy(schema_exports.vehicleMemos.createdAt);
    const outsourcing = await db.select().from(schema_exports.vehicleOutsourcing).where(eq4(schema_exports.vehicleOutsourcing.vehicleId, input.id)).orderBy(schema_exports.vehicleOutsourcing.displayOrder);
    const processTimeMap = /* @__PURE__ */ new Map();
    workRecords2.forEach((wr) => {
      if (wr.endTime) {
        const minutes = Math.floor(
          (wr.endTime.getTime() - wr.startTime.getTime()) / 1e3 / 60
        );
        const current = processTimeMap.get(wr.processId) || 0;
        processTimeMap.set(wr.processId, current + minutes);
      }
    });
    const processTime = Array.from(processTimeMap.entries()).map(([processId, minutes]) => ({
      processId,
      processName: processMap.get(processId)?.name || "\u4E0D\u660E",
      minutes
    }));
    return {
      ...vehicle,
      workRecords: workRecords2.map((wr) => ({
        id: wr.id,
        userId: wr.userId,
        userName: userMap.get(wr.userId)?.name || userMap.get(wr.userId)?.username || "\u4E0D\u660E",
        processId: wr.processId,
        processName: processMap.get(wr.processId)?.name || "\u4E0D\u660E",
        startTime: wr.startTime,
        endTime: wr.endTime,
        durationMinutes: wr.endTime ? Math.floor((wr.endTime.getTime() - wr.startTime.getTime()) / 1e3 / 60) : null,
        workDescription: wr.workDescription
      })),
      memos: memos.map((m) => ({
        id: m.id,
        userId: m.userId,
        userName: userMap.get(m.userId)?.name || userMap.get(m.userId)?.username || "\u4E0D\u660E",
        content: m.content,
        createdAt: m.createdAt
      })),
      outsourcing: outsourcing.map((o) => ({
        id: o.id,
        destination: o.destination,
        startDate: o.startDate,
        endDate: o.endDate,
        displayOrder: o.displayOrder
      })),
      processTime
    };
  }),
  // 車両を削除（準管理者以上）
  delete: subAdminProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const [vehicle] = await db.select().from(schema_exports.vehicles).where(eq4(schema_exports.vehicles.id, input.id)).limit(1);
    if (!vehicle) {
      throw new TRPCError5({
        code: "NOT_FOUND",
        message: "\u8ECA\u4E21\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    console.log(`[vehicles.delete] \u8ECA\u4E21\u3092\u524A\u9664\u3057\u307E\u3059: ID=${input.id}, \u8ECA\u4E21\u756A\u53F7=${vehicle.vehicleNumber}`);
    await db.delete(schema_exports.vehicles).where(eq4(schema_exports.vehicles.id, input.id));
    console.log(`[vehicles.delete] \u8ECA\u4E21\u3092\u524A\u9664\u3057\u307E\u3057\u305F: ID=${input.id}, \u8ECA\u4E21\u756A\u53F7=${vehicle.vehicleNumber}`);
    return { success: true };
  }),
  // 車両を完成にする（準管理者以上）
  complete: subAdminProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.update(schema_exports.vehicles).set({
      status: "completed",
      completionDate: /* @__PURE__ */ new Date()
    }).where(eq4(schema_exports.vehicles.id, input.id));
    return { success: true };
  }),
  // 車両を保管する（準管理者以上）
  archive: subAdminProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.update(schema_exports.vehicles).set({
      status: "archived"
    }).where(eq4(schema_exports.vehicles.id, input.id));
    return { success: true };
  }),
  // 車両を作業中に戻す（準管理者以上）
  uncomplete: subAdminProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.update(schema_exports.vehicles).set({
      status: "in_progress",
      completionDate: null
    }).where(eq4(schema_exports.vehicles.id, input.id));
    return { success: true };
  }),
  // 車両を完成に戻す（準管理者以上）
  unarchive: subAdminProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.update(schema_exports.vehicles).set({
      status: "completed"
    }).where(eq4(schema_exports.vehicles.id, input.id));
    return { success: true };
  }),
  // 指示書ファイルをアップロード（準管理者以上）
  uploadInstructionSheet: subAdminProcedure.input(
    z4.object({
      vehicleId: z4.number(),
      fileData: z4.string(),
      // base64エンコードされたファイルデータ
      fileName: z4.string(),
      fileType: z4.enum(["image/jpeg", "image/jpg", "application/pdf"])
    })
  ).mutation(async ({ input }) => {
    try {
      const uploadDir = path.resolve(process.cwd(), "uploads", "instruction-sheets");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const extension = input.fileType === "application/pdf" ? "pdf" : "jpg";
      const fileName = `${input.vehicleId}_${nanoid()}.${extension}`;
      const filePath = path.join(uploadDir, fileName);
      const base64Data = input.fileData.replace(/^data:.*,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filePath, buffer);
      const fileUrl = `/uploads/instruction-sheets/${fileName}`;
      const db = await getDb();
      if (!db) {
        throw new TRPCError5({
          code: "INTERNAL_SERVER_ERROR",
          message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
        });
      }
      await db.update(schema_exports.vehicles).set({ instructionSheetUrl: fileUrl }).where(eq4(schema_exports.vehicles.id, input.vehicleId));
      return { success: true, fileUrl };
    } catch (error) {
      console.error("[vehicles.uploadInstructionSheet] Error:", error);
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "\u30D5\u30A1\u30A4\u30EB\u306E\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
      });
    }
  }),
  // 注意ポイントを追加（全ユーザー可、ただし基本的に管理ページから）
  addAttentionPoint: protectedProcedure.input(
    z4.object({
      vehicleId: z4.number(),
      content: z4.string().min(1)
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.insert(schema_exports.vehicleAttentionPoints).values({
      vehicleId: input.vehicleId,
      userId: ctx.user.id,
      content: input.content
    });
    return { success: true };
  }),
  // 注意ポイントを更新（準管理者以上）
  updateAttentionPoint: subAdminProcedure.input(
    z4.object({
      id: z4.number(),
      content: z4.string().min(1)
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.update(schema_exports.vehicleAttentionPoints).set({
      content: input.content,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(schema_exports.vehicleAttentionPoints.id, input.id));
    return { success: true };
  }),
  // メモを追加（全ユーザー可）
  addMemo: protectedProcedure.input(
    z4.object({
      vehicleId: z4.number(),
      content: z4.string().min(1)
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.insert(schema_exports.vehicleMemos).values({
      vehicleId: input.vehicleId,
      userId: ctx.user.id,
      content: input.content
    });
    return { success: true };
  }),
  // 注意ポイントを取得
  getAttentionPoints: protectedProcedure.input(z4.object({ vehicleId: z4.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const attentionPoints = await db.select().from(schema_exports.vehicleAttentionPoints).where(eq4(schema_exports.vehicleAttentionPoints.vehicleId, input.vehicleId));
    const userIds = [...new Set(attentionPoints.map((ap) => ap.userId))];
    let users2 = [];
    if (userIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      users2 = await selectUsersSafely2(db, inArray4(schema_exports.users.id, userIds));
    }
    const userMap = new Map(users2.map((u) => [u.id, u]));
    return attentionPoints.map((ap) => ({
      id: ap.id,
      vehicleId: ap.vehicleId,
      content: ap.content,
      userId: ap.userId,
      userName: userMap.get(ap.userId)?.name || userMap.get(ap.userId)?.username || "\u4E0D\u660E",
      createdAt: ap.createdAt
    }));
  }),
  // 注意ポイントを削除（準管理者以上）
  deleteAttentionPoint: subAdminProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.delete(schema_exports.vehicleAttentionPoints).where(eq4(schema_exports.vehicleAttentionPoints.id, input.id));
    return { success: true };
  }),
  // 車両の外注先を取得
  getVehicleOutsourcing: protectedProcedure.input(z4.object({ vehicleId: z4.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const outsourcing = await db.select().from(schema_exports.vehicleOutsourcing).where(eq4(schema_exports.vehicleOutsourcing.vehicleId, input.vehicleId)).orderBy(schema_exports.vehicleOutsourcing.displayOrder);
    return outsourcing;
  }),
  // 車両の外注先を設定（最大2個、準管理者以上）
  setVehicleOutsourcing: subAdminProcedure.input(
    z4.object({
      vehicleId: z4.number(),
      outsourcing: z4.array(
        z4.object({
          destination: z4.string(),
          startDate: z4.date().optional(),
          endDate: z4.date().optional()
        })
      ).max(2)
      // 最大2個
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.delete(schema_exports.vehicleOutsourcing).where(eq4(schema_exports.vehicleOutsourcing.vehicleId, input.vehicleId));
    if (input.outsourcing.length > 0) {
      await db.insert(schema_exports.vehicleOutsourcing).values(
        input.outsourcing.map((o, index) => ({
          vehicleId: input.vehicleId,
          destination: o.destination,
          startDate: o.startDate,
          endDate: o.endDate,
          displayOrder: index + 1
        }))
      );
    }
    return { success: true };
  }),
  // 車両の外注先を削除（準管理者以上）
  deleteVehicleOutsourcing: subAdminProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.delete(schema_exports.vehicleOutsourcing).where(eq4(schema_exports.vehicleOutsourcing.id, input.id));
    return { success: true };
  })
});

// server/routers/processes.ts
init_trpc();
init_db();
import { TRPCError as TRPCError6 } from "@trpc/server";
import { z as z5 } from "zod";
import { eq as eq5 } from "drizzle-orm";
var processesRouter = createTRPCRouter({
  // 工程一覧を取得
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const processes2 = await db.select().from(schema_exports.processes).orderBy(schema_exports.processes.displayOrder);
    return processes2;
  }),
  // 工程を作成（管理者専用）
  create: subAdminProcedure.input(
    z5.object({
      name: z5.string(),
      description: z5.string().optional(),
      majorCategory: z5.string().optional(),
      minorCategory: z5.string().optional(),
      displayOrder: z5.number().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.insert(schema_exports.processes).values({
      name: input.name,
      description: input.description,
      majorCategory: input.majorCategory,
      minorCategory: input.minorCategory,
      displayOrder: input.displayOrder || 0
    });
    return { success: true };
  }),
  // 工程を更新（管理者専用）
  update: subAdminProcedure.input(
    z5.object({
      id: z5.number(),
      name: z5.string().optional(),
      description: z5.string().optional(),
      majorCategory: z5.string().optional(),
      minorCategory: z5.string().optional(),
      displayOrder: z5.number().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const updateData = {};
    if (input.name !== void 0) updateData.name = input.name;
    if (input.description !== void 0) updateData.description = input.description;
    if (input.majorCategory !== void 0) updateData.majorCategory = input.majorCategory;
    if (input.minorCategory !== void 0) updateData.minorCategory = input.minorCategory;
    if (input.displayOrder !== void 0) updateData.displayOrder = input.displayOrder;
    await db.update(schema_exports.processes).set(updateData).where(eq5(schema_exports.processes.id, input.id));
    return { success: true };
  }),
  // 工程を削除（管理者専用）
  delete: subAdminProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.delete(schema_exports.processes).where(eq5(schema_exports.processes.id, input.id));
    return { success: true };
  }),
  // 表示順をまとめて更新（管理者専用）
  reorder: subAdminProcedure.input(
    z5.object({
      items: z5.array(
        z5.object({
          id: z5.number(),
          displayOrder: z5.number()
        })
      )
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    for (const item of input.items) {
      await db.update(schema_exports.processes).set({ displayOrder: item.displayOrder }).where(eq5(schema_exports.processes.id, item.id));
    }
    return { success: true };
  })
});

// server/routers/vehicleTypes.ts
init_trpc();
init_db();
import { TRPCError as TRPCError7 } from "@trpc/server";
import { z as z6 } from "zod";
import { eq as eq6 } from "drizzle-orm";
var vehicleTypesRouter = createTRPCRouter({
  // 車種一覧を取得
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const vehicleTypes2 = await db.select().from(schema_exports.vehicleTypes);
    return vehicleTypes2;
  }),
  // 車種を作成（管理者専用）
  create: subAdminProcedure.input(
    z6.object({
      name: z6.string(),
      description: z6.string().optional(),
      standardTotalMinutes: z6.number().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError7({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.insert(schema_exports.vehicleTypes).values({
      name: input.name,
      description: input.description,
      standardTotalMinutes: input.standardTotalMinutes
    });
    return { success: true };
  }),
  // 車種を更新（管理者専用）
  update: subAdminProcedure.input(
    z6.object({
      id: z6.number(),
      name: z6.string().optional(),
      description: z6.string().optional(),
      standardTotalMinutes: z6.number().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError7({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const updateData = {};
    if (input.name !== void 0) updateData.name = input.name;
    if (input.description !== void 0) updateData.description = input.description;
    if (input.standardTotalMinutes !== void 0)
      updateData.standardTotalMinutes = input.standardTotalMinutes;
    await db.update(schema_exports.vehicleTypes).set(updateData).where(eq6(schema_exports.vehicleTypes.id, input.id));
    return { success: true };
  }),
  // 車種を削除（管理者専用）
  delete: subAdminProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError7({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.delete(schema_exports.vehicleTypes).where(eq6(schema_exports.vehicleTypes.id, input.id));
    return { success: true };
  })
});

// server/routers/users.ts
init_trpc();
init_db();
import { TRPCError as TRPCError8 } from "@trpc/server";
import { z as z7 } from "zod";
import bcrypt2 from "bcryptjs";
import { eq as eq7 } from "drizzle-orm";
var usersRouter = createTRPCRouter({
  // 全ユーザー一覧を取得（管理者専用）
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[users.list] DB is null");
      return [];
    }
    try {
      const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const users2 = await selectUsersSafely2(db);
      console.log("[users.list] Loaded users from DB:", users2.length);
      return users2.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name ?? null,
        role: u.role ?? "field_worker",
        category: u.category ?? null
      }));
    } catch (error) {
      console.error("[users.list] List error:", error);
      return [];
    }
  }),
  // ユーザーを作成（管理者専用）
  create: adminProcedure.input(
    z7.object({
      username: z7.string(),
      password: z7.string(),
      name: z7.string().optional(),
      // 表示名（社員名）
      role: z7.enum(["field_worker", "sales_office", "sub_admin", "admin", "external"]).default("field_worker"),
      category: z7.preprocess(
        (val) => {
          if (!val || val === "" || val !== "elephant" && val !== "squirrel") {
            return null;
          }
          return val;
        },
        z7.enum(["elephant", "squirrel"]).nullable().optional()
      )
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError8({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const pool = getPool();
    if (pool) {
      try {
        const [columns] = await pool.execute(
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
      } catch (alterError) {
        console.log(
          "[users.create] Role ENUM update may have been skipped:",
          alterError?.message
        );
      }
    }
    const existing = await db.select().from(schema_exports.users).where(eq7(schema_exports.users.username, input.username)).limit(1);
    if (existing.length > 0) {
      throw new TRPCError8({
        code: "BAD_REQUEST",
        message: "\u3053\u306E\u30E6\u30FC\u30B6\u30FC\u540D\u306F\u65E2\u306B\u4F7F\u7528\u3055\u308C\u3066\u3044\u307E\u3059"
      });
    }
    const hashedPassword = await bcrypt2.hash(input.password, 10);
    let categoryValue = void 0;
    if (input.role !== "external") {
      const category = input.category;
      if (category === "elephant" || category === "squirrel") {
        categoryValue = category;
      }
    }
    if (input.role === "external" || categoryValue === void 0) {
      const pool2 = getPool();
      if (pool2) {
        await pool2.execute(
          `INSERT INTO \`users\` (\`username\`, \`password\`, \`name\`, \`role\`, \`createdAt\`, \`updatedAt\`) VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [input.username, hashedPassword, input.name || null, input.role]
        );
      } else {
        await db.insert(schema_exports.users).values({
          username: input.username,
          password: hashedPassword,
          name: input.name || null,
          role: input.role,
          category: null
        });
      }
    } else {
      await db.insert(schema_exports.users).values({
        username: input.username,
        password: hashedPassword,
        name: input.name || null,
        role: input.role,
        category: categoryValue
      });
    }
    return { success: true };
  }),
  // ユーザーを更新（管理者専用）
  update: adminProcedure.input(
    z7.object({
      id: z7.number(),
      username: z7.string().optional(),
      password: z7.preprocess(
        (val) => {
          if (val === "" || val === null) {
            return void 0;
          }
          return val;
        },
        z7.string().min(1, "\u30D1\u30B9\u30EF\u30FC\u30C9\u306F1\u6587\u5B57\u4EE5\u4E0A\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059").optional()
      ),
      name: z7.string().optional(),
      // 表示名（社員名）
      role: z7.enum(["field_worker", "sales_office", "sub_admin", "admin", "external"]).optional(),
      category: z7.preprocess(
        (val) => {
          if (!val || val === "" || val !== "elephant" && val !== "squirrel") {
            return null;
          }
          return val;
        },
        z7.enum(["elephant", "squirrel"]).nullable().optional()
      )
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError8({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    if (input.username !== void 0) {
      const existing = await db.select({ id: schema_exports.users.id, username: schema_exports.users.username }).from(schema_exports.users).where(eq7(schema_exports.users.username, input.username)).limit(1);
      if (existing.length > 0 && existing[0].id !== input.id) {
        throw new TRPCError8({
          code: "BAD_REQUEST",
          message: "\u3053\u306E\u30E6\u30FC\u30B6\u30FC\u540D\u306F\u65E2\u306B\u4F7F\u7528\u3055\u308C\u3066\u3044\u307E\u3059"
        });
      }
    }
    const updateData = {};
    if (input.username !== void 0) updateData.username = input.username;
    if (input.password !== void 0 && input.password.trim() !== "") {
      console.log(`[users.update] \u30D1\u30B9\u30EF\u30FC\u30C9\u3092\u66F4\u65B0\u3057\u307E\u3059: userId=${input.id}`);
      updateData.password = await bcrypt2.hash(input.password.trim(), 10);
    } else if (input.password !== void 0) {
      console.log(`[users.update] \u30D1\u30B9\u30EF\u30FC\u30C9\u306F\u7A7A\u6587\u5B57\u5217\u306E\u305F\u3081\u66F4\u65B0\u3057\u307E\u305B\u3093: userId=${input.id}`);
    }
    if (input.name !== void 0) updateData.name = input.name;
    if (input.role !== void 0) updateData.role = input.role;
    if (input.category !== void 0) {
      if (input.role === "external") {
      } else {
        if (input.category === "elephant" || input.category === "squirrel") {
          updateData.category = input.category;
        }
      }
    }
    if (Object.keys(updateData).length > 0) {
      console.log(`[users.update] \u66F4\u65B0\u30C7\u30FC\u30BF:`, Object.keys(updateData));
      await db.update(schema_exports.users).set(updateData).where(eq7(schema_exports.users.id, input.id));
      console.log(`[users.update] \u2705 \u30E6\u30FC\u30B6\u30FC\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F: userId=${input.id}`);
    } else {
      console.log(`[users.update] \u26A0\uFE0F \u66F4\u65B0\u3059\u308B\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093: userId=${input.id}`);
    }
    return { success: true };
  }),
  // ユーザーを削除（管理者専用）
  delete: adminProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError8({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.delete(schema_exports.users).where(eq7(schema_exports.users.id, input.id));
    return { success: true };
  })
});

// server/routers/analytics.ts
init_trpc();
init_db();
import { eq as eq8, sql as sql2, inArray as inArray2, and as and3, isNotNull } from "drizzle-orm";
import { z as z8 } from "zod";
import { TRPCError as TRPCError9 } from "@trpc/server";
function parseJSTDateTime(mysqlDateTime) {
  if (!mysqlDateTime) return null;
  try {
    let dateStr;
    if (typeof mysqlDateTime === "string") {
      dateStr = mysqlDateTime;
    } else if (mysqlDateTime instanceof Date) {
      const jstDate = new Date(mysqlDateTime.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
      if (isNaN(jstDate.getTime())) return null;
      return jstDate;
    } else if (mysqlDateTime.toISOString) {
      dateStr = mysqlDateTime.toISOString();
      const date3 = new Date(dateStr);
      if (isNaN(date3.getTime())) return null;
      return date3;
    } else {
      dateStr = String(mysqlDateTime);
    }
    let jstISOString;
    if (dateStr.includes("T")) {
      jstISOString = dateStr;
    } else {
      jstISOString = dateStr.replace(" ", "T") + "+09:00";
    }
    const date2 = new Date(jstISOString);
    if (isNaN(date2.getTime())) {
      console.warn(`[parseJSTDateTime] \u7121\u52B9\u306A\u65E5\u4ED8\u6587\u5B57\u5217: ${mysqlDateTime} (\u5909\u63DB\u5F8C: ${jstISOString})`);
      return null;
    }
    return date2;
  } catch (error) {
    console.error(`[parseJSTDateTime] \u30A8\u30E9\u30FC:`, error, `\u5165\u529B\u5024:`, mysqlDateTime);
    return null;
  }
}
var analyticsRouter = createTRPCRouter({
  getVehicleTypeStats: protectedProcedure.input(
    z8.object({
      vehicleIds: z8.array(z8.number()).optional()
    }).optional()
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const conditions = [isNotNull(schema_exports.workRecords.endTime)];
    if (input?.vehicleIds && input.vehicleIds.length > 0) {
      conditions.push(inArray2(schema_exports.vehicles.id, input.vehicleIds));
    }
    const stats = await db.select({
      vehicleTypeId: schema_exports.vehicles.vehicleTypeId,
      vehicleCount: sql2`COUNT(DISTINCT ${schema_exports.vehicles.id})`.as("vehicleCount"),
      totalMinutes: sql2`COALESCE(SUM(TIMESTAMPDIFF(MINUTE, ${schema_exports.workRecords.startTime}, ${schema_exports.workRecords.endTime})), 0)`.as("totalMinutes")
    }).from(schema_exports.vehicles).leftJoin(schema_exports.workRecords, eq8(schema_exports.vehicles.id, schema_exports.workRecords.vehicleId)).where(conditions.length === 1 ? conditions[0] : and3(...conditions)).groupBy(schema_exports.vehicles.vehicleTypeId);
    const vehicleTypes2 = await db.select().from(schema_exports.vehicleTypes);
    const vehicleTypeMap = new Map(vehicleTypes2.map((vt) => [vt.id, vt.name]));
    return stats.map((stat) => {
      const vehicleCount = Number(stat.vehicleCount) || 0;
      const totalMinutes = Number(stat.totalMinutes) || 0;
      const averageMinutes = vehicleCount > 0 ? Math.round(totalMinutes / vehicleCount) : 0;
      return {
        vehicleTypeId: stat.vehicleTypeId,
        vehicleTypeName: vehicleTypeMap.get(stat.vehicleTypeId) || "\u4E0D\u660E",
        vehicleCount,
        totalMinutes,
        averageMinutes
      };
    });
  }),
  getProcessStats: protectedProcedure.input(
    z8.object({
      vehicleIds: z8.array(z8.number()).optional()
    }).optional()
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const conditions = [isNotNull(schema_exports.workRecords.endTime)];
    if (input?.vehicleIds && input.vehicleIds.length > 0) {
      conditions.push(inArray2(schema_exports.workRecords.vehicleId, input.vehicleIds));
    }
    const stats = await db.select({
      processId: schema_exports.workRecords.processId,
      workCount: sql2`COUNT(*)`.as("workCount"),
      totalMinutes: sql2`COALESCE(SUM(TIMESTAMPDIFF(MINUTE, ${schema_exports.workRecords.startTime}, ${schema_exports.workRecords.endTime})), 0)`.as("totalMinutes")
    }).from(schema_exports.workRecords).where(conditions.length === 1 ? conditions[0] : and3(...conditions)).groupBy(schema_exports.workRecords.processId);
    const processes2 = await db.select().from(schema_exports.processes);
    const processMap = new Map(processes2.map((p) => [p.id, p.name]));
    return stats.map((stat) => {
      const workCount = Number(stat.workCount) || 0;
      const totalMinutes = Number(stat.totalMinutes) || 0;
      const averageMinutes = workCount > 0 ? Math.round(totalMinutes / workCount) : 0;
      return {
        processId: stat.processId,
        processName: processMap.get(stat.processId) || "\u4E0D\u660E",
        workCount,
        totalMinutes,
        averageMinutes
      };
    });
  }),
  getVehicleTypeProcessStats: protectedProcedure.input(
    z8.object({
      vehicleIds: z8.array(z8.number()).optional()
    }).optional()
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const conditions = [isNotNull(schema_exports.workRecords.endTime)];
    if (input?.vehicleIds && input.vehicleIds.length > 0) {
      conditions.push(inArray2(schema_exports.vehicles.id, input.vehicleIds));
    }
    const stats = await db.select({
      vehicleTypeId: schema_exports.vehicles.vehicleTypeId,
      processId: schema_exports.workRecords.processId,
      workCount: sql2`COUNT(*)`.as("workCount"),
      totalMinutes: sql2`COALESCE(SUM(TIMESTAMPDIFF(MINUTE, ${schema_exports.workRecords.startTime}, ${schema_exports.workRecords.endTime})), 0)`.as("totalMinutes")
    }).from(schema_exports.workRecords).innerJoin(schema_exports.vehicles, eq8(schema_exports.workRecords.vehicleId, schema_exports.vehicles.id)).where(conditions.length === 1 ? conditions[0] : and3(...conditions)).groupBy(schema_exports.vehicles.vehicleTypeId, schema_exports.workRecords.processId);
    const vehicleTypes2 = await db.select().from(schema_exports.vehicleTypes);
    const processes2 = await db.select().from(schema_exports.processes);
    const vehicleTypeMap = new Map(vehicleTypes2.map((vt) => [vt.id, vt.name]));
    const processMap = new Map(processes2.map((p) => [p.id, p.name]));
    const standards = await db.select().from(schema_exports.vehicleTypeProcessStandards);
    const standardMap = new Map(
      standards.map((s) => [`${s.vehicleTypeId}-${s.processId}`, s.standardMinutes])
    );
    return stats.map((stat) => {
      const workCount = Number(stat.workCount) || 0;
      const totalMinutes = Number(stat.totalMinutes) || 0;
      const averageMinutes = workCount > 0 ? Math.round(totalMinutes / workCount) : 0;
      const standardMinutes = standardMap.get(`${stat.vehicleTypeId}-${stat.processId}`) || null;
      return {
        vehicleTypeId: stat.vehicleTypeId,
        vehicleTypeName: vehicleTypeMap.get(stat.vehicleTypeId) || "\u4E0D\u660E",
        processId: stat.processId,
        processName: processMap.get(stat.processId) || "\u4E0D\u660E",
        workCount,
        totalMinutes,
        averageMinutes,
        standardMinutes
      };
    });
  }),
  /**
   * 営業日を計算するヘルパー関数（土日を除く）
   * 今日から過去に遡って、指定された営業日数分の日付を返す
   */
  getBusinessDaysAgo: protectedProcedure.input(z8.object({ days: z8.number() })).query(async ({ input }) => {
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const dates = [];
    let currentDate = new Date(now);
    currentDate.setDate(currentDate.getDate() - 1);
    while (dates.length < input.days) {
      const jstParts = jstFormatter.formatToParts(currentDate);
      const y = jstParts.find((p) => p.type === "year")?.value || "0";
      const m = jstParts.find((p) => p.type === "month")?.value || "01";
      const d = jstParts.find((p) => p.type === "day")?.value || "01";
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = currentDate.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }
    return dates;
  }),
  /**
   * 現場スタッフ（field_worker）で、
   * - 前日（当日は除外）に出勤していて
   * - 出勤記録がある人だけを対象
   * - 「出勤時間（休憩時間を引いた数） - 作業記録時間（休憩時間を引いた数）」が±1時間をはみ出した場合のみ警告
   */
  getRecentLowWorkUsers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const jstParts = jstFormatter.formatToParts(now);
    const y = parseInt(jstParts.find((p) => p.type === "year")?.value || "0");
    const m = parseInt(jstParts.find((p) => p.type === "month")?.value || "1");
    const d = parseInt(jstParts.find((p) => p.type === "day")?.value || "1");
    const today = new Date(y, m - 1, d);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const businessDates = [yesterdayStr];
    const pool = getPool();
    if (!pool) {
      return [];
    }
    const datePlaceholders = businessDates.map(() => "?").join(",");
    const query = `
            SELECT DISTINCT
                ar.userId AS userId,
                COALESCE(u.name, u.username) AS userName,
                ar.workDate AS workDate
            FROM \`attendanceRecords\` ar
            INNER JOIN \`users\` u ON u.id = ar.userId
            WHERE
                ar.workDate IN (${datePlaceholders})
                AND ar.clockInTime IS NOT NULL
                AND u.role = 'field_worker'
        `;
    const [rows] = await pool.execute(query, businessDates);
    const map = /* @__PURE__ */ new Map();
    for (const r of rows) {
      const userId = Number(r.userId);
      const userName = r.userName;
      const workDate = typeof r.workDate === "string" ? r.workDate : r.workDate.toISOString().slice(0, 10);
      try {
        const attendanceQuery = `
                    SELECT
                        ar.id AS attendanceId,
                        ar.workDate,
                        ar.clockInTime,
                        ar.clockOutTime,
                        ar.workMinutes AS attendanceWorkMinutes,
                        COALESCE(
                            ar.workMinutes,
                            TIMESTAMPDIFF(
                                MINUTE,
                                STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockInTime), '%Y-%m-%d %H:%i'),
                                STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockOutTime), '%Y-%m-%d %H:%i')
                            ),
                            0
                        ) AS attendanceMinutes
                    FROM \`attendanceRecords\` ar
                    WHERE
                        ar.userId = ?
                        AND ar.workDate = ?
                        AND ar.clockInTime IS NOT NULL
                    LIMIT 1
                `;
        const [attendanceRows] = await pool.execute(attendanceQuery, [
          userId,
          workDate
        ]);
        if (!attendanceRows || attendanceRows.length === 0) {
          continue;
        }
        const attendance = attendanceRows[0];
        const breakTimesForAttendance = await db.select().from(schema_exports.breakTimes).then(
          (times) => times.filter((bt) => bt.isActive === "true")
        );
        const timeToMinutesForAttendance = (t2) => {
          if (!t2) return null;
          const [hh2, mm2] = t2.split(":");
          const h = Number(hh2);
          const m2 = Number(mm2);
          if (!Number.isFinite(h) || !Number.isFinite(m2)) return null;
          const total = h * 60 + m2;
          if (total < 0 || total > 23 * 60 + 59) return null;
          return total;
        };
        let attendanceMinutes;
        if (attendance.attendanceWorkMinutes !== null && attendance.attendanceWorkMinutes !== void 0) {
          attendanceMinutes = Number(attendance.attendanceWorkMinutes);
        } else if (attendance.clockInTime && attendance.clockOutTime) {
          const startMin = timeToMinutesForAttendance(attendance.clockInTime);
          const endMin = timeToMinutesForAttendance(attendance.clockOutTime);
          if (startMin !== null && endMin !== null) {
            const baseMinutes = Math.max(0, endMin - startMin);
            let breakTotal = 0;
            for (const bt of breakTimesForAttendance) {
              const s = timeToMinutesForAttendance(bt.startTime);
              const eRaw = timeToMinutesForAttendance(bt.endTime);
              if (s === null || eRaw === null) continue;
              let e = eRaw;
              if (e < s) {
                e += 24 * 60;
              }
              const overlapStart = Math.max(startMin, s);
              const overlapEnd = Math.min(endMin, e);
              if (overlapEnd > overlapStart) {
                breakTotal += overlapEnd - overlapStart;
              }
            }
            attendanceMinutes = Math.max(0, baseMinutes - breakTotal);
          } else {
            attendanceMinutes = 0;
          }
        } else {
          attendanceMinutes = 0;
        }
        const workRecordsQuery = `
                    SELECT DISTINCT
                        wr.id,
                        wr.startTime,
                        wr.endTime
                    FROM \`workRecords\` wr
                    WHERE
                        wr.userId = ?
                        AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                `;
        const [workRecordsRows] = await pool.execute(workRecordsQuery, [
          userId,
          workDate
        ]);
        const breakTimes2 = await db.select().from(schema_exports.breakTimes).then(
          (times) => times.filter((bt) => bt.isActive === "true")
        );
        const timeToMinutes2 = (t2) => {
          if (!t2) return null;
          const [hh2, mm2] = t2.split(":");
          const h = Number(hh2);
          const m2 = Number(mm2);
          if (!Number.isFinite(h) || !Number.isFinite(m2)) return null;
          const total = h * 60 + m2;
          if (total < 0 || total > 23 * 60 + 59) return null;
          return total;
        };
        const dateToTimeString = (date2) => {
          const formatter = new Intl.DateTimeFormat("ja-JP", {
            timeZone: "Asia/Tokyo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          });
          const parts = formatter.formatToParts(date2);
          const hours = parts.find((p) => p.type === "hour")?.value || "00";
          const minutes = parts.find((p) => p.type === "minute")?.value || "00";
          return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
        };
        const sortedRecords = (workRecordsRows || []).filter((r2) => r2.startTime).sort((a, b) => {
          const startA = new Date(a.startTime).getTime();
          const startB = new Date(b.startTime).getTime();
          return startA - startB;
        });
        const mergedIntervals = [];
        for (const record of sortedRecords) {
          if (!record.startTime) continue;
          const start = new Date(record.startTime);
          const end = record.endTime ? new Date(record.endTime) : /* @__PURE__ */ new Date();
          let merged = false;
          for (let i = 0; i < mergedIntervals.length; i++) {
            const interval = mergedIntervals[i];
            if (!(end.getTime() < interval.start.getTime() - 6e4 || start.getTime() > interval.end.getTime() + 6e4)) {
              interval.start = start.getTime() < interval.start.getTime() ? start : interval.start;
              interval.end = end.getTime() > interval.end.getTime() ? end : interval.end;
              merged = true;
              break;
            }
          }
          if (!merged) {
            mergedIntervals.push({ start, end });
          }
        }
        let totalWorkMinutes = 0;
        for (let i = 0; i < mergedIntervals.length; i++) {
          const interval = mergedIntervals[i];
          const startDate = interval.start;
          const endDate = interval.end;
          const startTimeStr = dateToTimeString(startDate);
          const endTimeStr = dateToTimeString(endDate);
          const startMin = timeToMinutes2(startTimeStr);
          const endMin = timeToMinutes2(endTimeStr);
          if (startMin === null || endMin === null) {
            continue;
          }
          const baseMinutes = Math.max(0, endMin - startMin);
          let breakTotal = 0;
          for (const bt of breakTimes2) {
            const s = timeToMinutes2(bt.startTime);
            const e = timeToMinutes2(bt.endTime);
            if (s === null || e === null) continue;
            const overlapStart = Math.max(startMin, s);
            const overlapEnd = Math.min(endMin, e);
            if (overlapEnd > overlapStart) {
              breakTotal += overlapEnd - overlapStart;
            }
          }
          const duration = Math.max(0, baseMinutes - breakTotal);
          totalWorkMinutes += duration;
        }
        const differenceMinutes = Math.abs(attendanceMinutes - totalWorkMinutes);
        if (differenceMinutes > 60) {
          if (!map.has(userId)) {
            map.set(userId, { userId, userName, dates: [] });
          }
          const entry = map.get(userId);
          if (!entry.dates.includes(workDate)) {
            entry.dates.push(workDate);
          }
        }
      } catch (error) {
        console.error(`[getRecentLowWorkUsers] \u30A8\u30E9\u30FC (userId: ${userId}, workDate: ${workDate}):`, error);
      }
    }
    const result = Array.from(map.values()).map((v) => ({
      ...v,
      dates: v.dates.sort((a, b) => a < b ? 1 : a > b ? -1 : 0)
    }));
    return result;
  }),
  /**
   * 過去3営業日以内で出勤記録が入力されていない現場スタッフを取得
   * - 過去3営業日のいずれかの日に出勤記録がないユーザーを取得
   */
  getMissingAttendanceUsers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const businessDates = [];
    let currentDate = new Date(now);
    currentDate.setDate(currentDate.getDate() - 1);
    while (businessDates.length < 3) {
      const jstParts = jstFormatter.formatToParts(currentDate);
      const y = jstParts.find((p) => p.type === "year")?.value || "0";
      const m = jstParts.find((p) => p.type === "month")?.value || "01";
      const d = jstParts.find((p) => p.type === "day")?.value || "01";
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = currentDate.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDates.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }
    if (businessDates.length === 0) {
      return [];
    }
    const pool = getPool();
    if (!pool) {
      return [];
    }
    const users2 = await db.select().from(schema_exports.users);
    const fieldWorkers = users2.filter((u) => u.role === "field_worker");
    if (fieldWorkers.length === 0) {
      return [];
    }
    const userIds = fieldWorkers.map((u) => u.id);
    const userIdPlaceholders = userIds.map(() => "?").join(",");
    const datePlaceholders = businessDates.map(() => "?").join(",");
    const query = `
            SELECT DISTINCT
                ar.userId AS userId,
                ar.workDate AS workDate
            FROM \`attendanceRecords\` ar
            WHERE
                ar.userId IN (${userIdPlaceholders})
                AND ar.workDate IN (${datePlaceholders})
                AND ar.clockInTime IS NOT NULL
        `;
    const [rows] = await pool.execute(query, [...userIds, ...businessDates]);
    const existingAttendanceSet = /* @__PURE__ */ new Set();
    rows.forEach((row) => {
      const userId = Number(row.userId);
      const workDate = typeof row.workDate === "string" ? row.workDate : row.workDate.toISOString().slice(0, 10);
      existingAttendanceSet.add(`${userId}_${workDate}`);
    });
    const map = /* @__PURE__ */ new Map();
    fieldWorkers.forEach((user) => {
      const missingDates = [];
      businessDates.forEach((dateStr) => {
        const key = `${user.id}_${dateStr}`;
        if (!existingAttendanceSet.has(key)) {
          missingDates.push(dateStr);
        }
      });
      if (missingDates.length > 0) {
        map.set(user.id, {
          userId: user.id,
          userName: user.name || user.username || "\u4E0D\u660E",
          dates: missingDates
        });
      }
    });
    const result = Array.from(map.values()).map((v) => ({
      ...v,
      dates: v.dates.sort((a, b) => a < b ? 1 : a > b ? -1 : 0)
    }));
    return result;
  }),
  /**
   * 作業報告が出勤時間を超えている可能性があるユーザーを取得
   * - 過去3営業日のいずれかの日に出勤していて
   * - その日の作業記録の合計が、出勤記録の勤務時間（両方とも休憩時間を引いた後の値）を30分以上超えているユーザーを取得
   * - ±30分以内の差異は許容範囲として警告を出さない
   */
  getExcessiveWorkUsers: protectedProcedure.query(async () => {
    console.log("[getExcessiveWorkUsers] \u958B\u59CB");
    const db = await getDb();
    if (!db) {
      console.log("[getExcessiveWorkUsers] \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093");
      return [];
    }
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const businessDates = [];
    let currentDate = new Date(now);
    currentDate.setDate(currentDate.getDate() - 1);
    while (businessDates.length < 3) {
      const jstParts = jstFormatter.formatToParts(currentDate);
      const y = jstParts.find((p) => p.type === "year")?.value || "0";
      const m = jstParts.find((p) => p.type === "month")?.value || "01";
      const d = jstParts.find((p) => p.type === "day")?.value || "01";
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = currentDate.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDates.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }
    console.log("[getExcessiveWorkUsers] \u904E\u53BB3\u55B6\u696D\u65E5:", businessDates);
    if (businessDates.length === 0) {
      console.log("[getExcessiveWorkUsers] \u55B6\u696D\u65E5\u304C\u3042\u308A\u307E\u305B\u3093");
      return [];
    }
    const pool = getPool();
    if (!pool) {
      console.log("[getExcessiveWorkUsers] \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u30D7\u30FC\u30EB\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093");
      return [];
    }
    const datePlaceholders = businessDates.map(() => "?").join(",");
    const query = `
            SELECT DISTINCT
                ar.userId AS userId,
                COALESCE(u.name, u.username) AS userName,
                ar.workDate AS workDate
            FROM \`attendanceRecords\` ar
            INNER JOIN \`users\` u ON u.id = ar.userId
            WHERE
                ar.workDate IN (${datePlaceholders})
                AND ar.clockInTime IS NOT NULL
                AND u.role = 'field_worker'
        `;
    const [rows] = await pool.execute(query, businessDates);
    console.log(`[getExcessiveWorkUsers] \u51FA\u52E4\u8A18\u9332\u304C\u3042\u308B\u30E6\u30FC\u30B6\u30FC\u30FB\u65E5\u4ED8\u306E\u7D44\u307F\u5408\u308F\u305B\u6570: ${rows?.length || 0}`);
    const map = /* @__PURE__ */ new Map();
    for (const r of rows) {
      const userId = Number(r.userId);
      const userName = r.userName;
      const workDate = typeof r.workDate === "string" ? r.workDate : r.workDate.toISOString().slice(0, 10);
      try {
        const attendanceQuery = `
                    SELECT
                        ar.id AS attendanceId,
                        ar.workDate,
                        ar.clockInTime,
                        ar.clockOutTime,
                        ar.workMinutes AS attendanceWorkMinutes,
                        COALESCE(
                            ar.workMinutes,
                            TIMESTAMPDIFF(
                                MINUTE,
                                STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockInTime), '%Y-%m-%d %H:%i'),
                                STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockOutTime), '%Y-%m-%d %H:%i')
                            ),
                            0
                        ) AS attendanceMinutes
                    FROM \`attendanceRecords\` ar
                    WHERE
                        ar.userId = ?
                        AND ar.workDate = ?
                        AND ar.clockInTime IS NOT NULL
                    LIMIT 1
                `;
        const [attendanceRows] = await pool.execute(attendanceQuery, [
          userId,
          workDate
        ]);
        if (!attendanceRows || attendanceRows.length === 0) {
          continue;
        }
        const attendance = attendanceRows[0];
        const breakTimesForAttendance = await db.select().from(schema_exports.breakTimes).then(
          (times) => times.filter((bt) => bt.isActive === "true")
        );
        const timeToMinutesForAttendance = (t2) => {
          if (!t2) return null;
          const [hh2, mm2] = t2.split(":");
          const h = Number(hh2);
          const m = Number(mm2);
          if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
          const total = h * 60 + m;
          if (total < 0 || total > 23 * 60 + 59) return null;
          return total;
        };
        let attendanceMinutes;
        if (attendance.attendanceWorkMinutes !== null && attendance.attendanceWorkMinutes !== void 0) {
          attendanceMinutes = Number(attendance.attendanceWorkMinutes);
        } else if (attendance.clockInTime && attendance.clockOutTime) {
          const startMin = timeToMinutesForAttendance(attendance.clockInTime);
          const endMin = timeToMinutesForAttendance(attendance.clockOutTime);
          if (startMin !== null && endMin !== null) {
            const baseMinutes = Math.max(0, endMin - startMin);
            let breakTotal = 0;
            for (const bt of breakTimesForAttendance) {
              const s = timeToMinutesForAttendance(bt.startTime);
              const eRaw = timeToMinutesForAttendance(bt.endTime);
              if (s === null || eRaw === null) continue;
              let e = eRaw;
              if (e < s) {
                e += 24 * 60;
              }
              const overlapStart = Math.max(startMin, s);
              const overlapEnd = Math.min(endMin, e);
              if (overlapEnd > overlapStart) {
                breakTotal += overlapEnd - overlapStart;
              }
            }
            attendanceMinutes = Math.max(0, baseMinutes - breakTotal);
          } else {
            attendanceMinutes = 0;
          }
        } else {
          attendanceMinutes = 0;
        }
        const workRecordsQuery = `
                    SELECT DISTINCT
                        wr.id,
                        wr.startTime,
                        wr.endTime
                    FROM \`workRecords\` wr
                    WHERE
                        wr.userId = ?
                        AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                `;
        const [workRecordsRows] = await pool.execute(workRecordsQuery, [
          userId,
          workDate
        ]);
        const breakTimes2 = await db.select().from(schema_exports.breakTimes).then(
          (times) => times.filter((bt) => bt.isActive === "true")
        );
        const timeToMinutes2 = (t2) => {
          if (!t2) return null;
          const [hh2, mm2] = t2.split(":");
          const h = Number(hh2);
          const m = Number(mm2);
          if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
          const total = h * 60 + m;
          if (total < 0 || total > 23 * 60 + 59) return null;
          return total;
        };
        const dateToTimeString = (date2) => {
          const formatter = new Intl.DateTimeFormat("ja-JP", {
            timeZone: "Asia/Tokyo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          });
          const parts = formatter.formatToParts(date2);
          const hours = parts.find((p) => p.type === "hour")?.value || "00";
          const minutes = parts.find((p) => p.type === "minute")?.value || "00";
          return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
        };
        const sortedRecords = (workRecordsRows || []).filter((r2) => r2.startTime).sort((a, b) => {
          const startA = new Date(a.startTime).getTime();
          const startB = new Date(b.startTime).getTime();
          return startA - startB;
        });
        const mergedIntervals = [];
        for (const record of sortedRecords) {
          if (!record.startTime) continue;
          const start = new Date(record.startTime);
          const end = record.endTime ? new Date(record.endTime) : /* @__PURE__ */ new Date();
          let merged = false;
          for (let i = 0; i < mergedIntervals.length; i++) {
            const interval = mergedIntervals[i];
            if (!(end.getTime() < interval.start.getTime() - 6e4 || start.getTime() > interval.end.getTime() + 6e4)) {
              interval.start = start.getTime() < interval.start.getTime() ? start : interval.start;
              interval.end = end.getTime() > interval.end.getTime() ? end : interval.end;
              merged = true;
              break;
            }
          }
          if (!merged) {
            mergedIntervals.push({ start, end });
          }
        }
        console.log(`[getExcessiveWorkUsers] \u30DE\u30FC\u30B8\u3055\u308C\u305F\u30A4\u30F3\u30BF\u30FC\u30D0\u30EB\u6570 (userId: ${userId}, workDate: ${workDate}):`, mergedIntervals.length);
        let totalWorkMinutes = 0;
        for (let i = 0; i < mergedIntervals.length; i++) {
          const interval = mergedIntervals[i];
          const startDate = interval.start;
          const endDate = interval.end;
          const startTimeStr = dateToTimeString(startDate);
          const endTimeStr = dateToTimeString(endDate);
          console.log(`[getExcessiveWorkUsers] \u30A4\u30F3\u30BF\u30FC\u30D0\u30EB[${i}] (userId: ${userId}, workDate: ${workDate}): ${startTimeStr} - ${endTimeStr}`);
          let startMin = timeToMinutes2(startTimeStr);
          const endMin = timeToMinutes2(endTimeStr);
          if (startMin === null || endMin === null) {
            console.log(`[getExcessiveWorkUsers] \u6642\u523B\u306E\u5909\u63DB\u5931\u6557 (userId: ${userId}, workDate: ${workDate}):`, { startTimeStr, endTimeStr });
            continue;
          }
          const morningBreakStart = timeToMinutes2("06:00");
          const morningBreakEnd = timeToMinutes2("08:30");
          if (morningBreakStart !== null && morningBreakEnd !== null) {
            const hasMorningBreak = breakTimes2.some((bt) => {
              const btStart = timeToMinutes2(bt.startTime);
              const btEnd = timeToMinutes2(bt.endTime);
              return btStart === morningBreakStart && btEnd === morningBreakEnd;
            });
            if (hasMorningBreak && startMin < morningBreakStart) {
              startMin = morningBreakEnd;
              console.log(`[getExcessiveWorkUsers] \u671D\u4F11\u61A9\u9069\u7528 (userId: ${userId}, workDate: ${workDate}): \u958B\u59CB\u6642\u523B\u3092${startTimeStr}\u304B\u308908:30\u306B\u8ABF\u6574`);
            }
          }
          const baseMinutes = Math.max(0, endMin - startMin);
          console.log(`[getExcessiveWorkUsers] \u30A4\u30F3\u30BF\u30FC\u30D0\u30EB[${i}] \u57FA\u672C\u6642\u9593 (userId: ${userId}, workDate: ${workDate}): ${baseMinutes}\u5206 (${Math.floor(baseMinutes / 60)}\u6642\u9593${baseMinutes % 60}\u5206)`);
          let breakTotal = 0;
          for (const bt of breakTimes2) {
            const s = timeToMinutes2(bt.startTime);
            const e = timeToMinutes2(bt.endTime);
            if (s === null || e === null) continue;
            if (s === morningBreakStart && e === morningBreakEnd) {
              continue;
            }
            const overlapStart = Math.max(startMin, s);
            const overlapEnd = Math.min(endMin, e);
            if (overlapEnd > overlapStart) {
              const overlapMinutes = overlapEnd - overlapStart;
              breakTotal += overlapMinutes;
              console.log(`[getExcessiveWorkUsers] \u4F11\u61A9\u6642\u9593\u91CD\u8907 (userId: ${userId}, workDate: ${workDate}):`, {
                intervalIndex: i,
                workInterval: `${startMin}\u5206-${endMin}\u5206 (${startTimeStr}-${endTimeStr})`,
                breakInterval: `${s}\u5206-${e}\u5206 (${bt.startTime}-${bt.endTime})`,
                overlap: `${overlapStart}\u5206-${overlapEnd}\u5206 (${overlapMinutes}\u5206)`,
                breakTotal: `${breakTotal}\u5206`
              });
            }
          }
          const duration = Math.max(0, baseMinutes - breakTotal);
          console.log(`[getExcessiveWorkUsers] \u30A4\u30F3\u30BF\u30FC\u30D0\u30EB[${i}] \u6700\u7D42\u8A08\u7B97 (userId: ${userId}, workDate: ${workDate}):`, {
            baseMinutes: `${baseMinutes}\u5206 (${Math.floor(baseMinutes / 60)}\u6642\u9593${baseMinutes % 60}\u5206)`,
            breakTotal: `${breakTotal}\u5206 (${Math.floor(breakTotal / 60)}\u6642\u9593${breakTotal % 60}\u5206)`,
            duration: `${duration}\u5206 (${Math.floor(duration / 60)}\u6642\u9593${duration % 60}\u5206)`
          });
          totalWorkMinutes += duration;
        }
        const differenceMinutes = totalWorkMinutes - attendanceMinutes;
        const absDiff = Math.abs(differenceMinutes);
        const shouldWarn = differenceMinutes > 60;
        console.log(`[getExcessiveWorkUsers] \u8A08\u7B97\u7D50\u679C (userId: ${userId}, workDate: ${workDate}): attendanceMinutes=${attendanceMinutes}\u5206, totalWorkMinutes=${totalWorkMinutes}\u5206, differenceMinutes=${differenceMinutes}\u5206, absDifference=${absDiff}\u5206, shouldWarn=${shouldWarn}`);
        console.log(`[getExcessiveWorkUsers] \u30C7\u30D0\u30C3\u30B0\u8A73\u7D30 (userId: ${userId}, workDate: ${workDate}):`, {
          attendanceWorkMinutes: attendance.attendanceWorkMinutes,
          attendanceMinutesRaw: attendance.attendanceMinutes,
          clockInTime: attendance.clockInTime,
          clockOutTime: attendance.clockOutTime,
          calculatedAttendanceMinutes: attendanceMinutes,
          workRecordsCount: workRecordsRows?.length || 0,
          mergedIntervalsCount: mergedIntervals.length,
          totalWorkMinutes,
          differenceMinutes,
          absDiff,
          shouldWarn,
          threshold: 60
        });
        if (shouldWarn) {
          if (!map.has(userId)) {
            map.set(userId, { userId, userName, dates: [] });
          }
          const entry = map.get(userId);
          if (!entry.dates.includes(workDate)) {
            entry.dates.push(workDate);
          }
        }
      } catch (error) {
        console.error(`[getExcessiveWorkUsers] \u30A8\u30E9\u30FC (userId: ${userId}, workDate: ${workDate}):`, error);
      }
    }
    const result = Array.from(map.values()).map((v) => ({
      ...v,
      dates: v.dates.sort((a, b) => a < b ? 1 : a > b ? -1 : 0)
    }));
    console.log(`[getExcessiveWorkUsers] \u8B66\u544A\u5BFE\u8C61\u30E6\u30FC\u30B6\u30FC\u6570: ${result.length}`, result.map((r) => ({
      userId: r.userId,
      userName: r.userName,
      dates: r.dates
    })));
    return result;
  }),
  /**
   * 特定ユーザーの特定日の作業報告詳細を取得
   * - 出勤時間と作業時間の比較
   * - 各作業記録の詳細
   */
  getWorkReportDetail: protectedProcedure.input(
    z8.object({
      userId: z8.number(),
      workDate: z8.string()
      // "YYYY-MM-DD"
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093");
    }
    const pool = getPool();
    if (!pool) {
      throw new Error("\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u30D7\u30FC\u30EB\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093");
    }
    const attendanceQuery = `
                SELECT
                    ar.id AS attendanceId,
                    ar.workDate,
                    ar.clockInTime,
                    ar.clockOutTime,
                    ar.workMinutes AS attendanceWorkMinutes,
                    COALESCE(
                        ar.workMinutes,
                        TIMESTAMPDIFF(
                            MINUTE,
                            STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockInTime), '%Y-%m-%d %H:%i'),
                            STR_TO_DATE(CONCAT(ar.workDate, ' ', ar.clockOutTime), '%Y-%m-%d %H:%i')
                        ),
                        0
                    ) AS attendanceMinutes,
                    COALESCE(u.name, u.username) AS userName
                FROM \`attendanceRecords\` ar
                INNER JOIN \`users\` u ON u.id = ar.userId
                WHERE
                    ar.userId = ?
                    AND ar.workDate = ?
                    AND ar.clockInTime IS NOT NULL
                LIMIT 1
            `;
    const [attendanceRows] = await pool.execute(attendanceQuery, [
      input.userId,
      input.workDate
    ]);
    if (!attendanceRows || attendanceRows.length === 0) {
      return {
        userId: input.userId,
        workDate: input.workDate,
        userName: null,
        attendance: null,
        workRecords: [],
        summary: {
          attendanceMinutes: 0,
          workMinutes: 0,
          differenceMinutes: 0
        }
      };
    }
    const attendance = attendanceRows[0];
    const userName = attendance.userName;
    let attendanceMinutes = 0;
    if (attendance.clockInTime && attendance.clockOutTime) {
      const timeToMinutesForDetail = (t2) => {
        if (!t2) return null;
        const [hh2, mm2] = t2.split(":");
        const h = Number(hh2);
        const m = Number(mm2);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        const total = h * 60 + m;
        if (total < 0 || total > 23 * 60 + 59) return null;
        return total;
      };
      let startMin = timeToMinutesForDetail(attendance.clockInTime);
      const endMin = timeToMinutesForDetail(attendance.clockOutTime);
      if (startMin !== null && endMin !== null) {
        const workStartTime = timeToMinutesForDetail("08:30");
        if (workStartTime !== null && startMin < workStartTime) {
          startMin = workStartTime;
          console.log(`[getWorkReportDetail] \u4F5C\u696D\u958B\u59CB\u6642\u523B\u8ABF\u6574 (userId: ${input.userId}, workDate: ${input.workDate}): ${attendance.clockInTime} \u2192 08:30`);
        }
        const baseMinutes = Math.max(0, endMin - startMin);
        const breakTimesForDetail = await db.select().from(schema_exports.breakTimes).then(
          (times) => times.filter((bt) => bt.isActive === "true")
        );
        let breakTotal = 0;
        for (const bt of breakTimesForDetail) {
          const s = timeToMinutesForDetail(bt.startTime);
          const eRaw = timeToMinutesForDetail(bt.endTime);
          if (s === null || eRaw === null) continue;
          let e = eRaw;
          if (e < s) {
            e += 24 * 60;
          }
          const overlapStart = Math.max(startMin, s);
          const overlapEnd = Math.min(endMin, e);
          if (overlapEnd > overlapStart) {
            breakTotal += overlapEnd - overlapStart;
          }
        }
        attendanceMinutes = Math.max(0, baseMinutes - breakTotal);
      } else {
        attendanceMinutes = attendance.attendanceWorkMinutes !== null && attendance.attendanceWorkMinutes !== void 0 ? Number(attendance.attendanceWorkMinutes) : Math.max(0, (Number(attendance.attendanceMinutes) || 0) - 90);
      }
    } else {
      attendanceMinutes = attendance.attendanceWorkMinutes !== null && attendance.attendanceWorkMinutes !== void 0 ? Number(attendance.attendanceWorkMinutes) : Math.max(0, (Number(attendance.attendanceMinutes) || 0) - 90);
    }
    console.log("[getWorkReportDetail] \u51FA\u52E4\u6642\u9593\u306E\u8A08\u7B97:", {
      attendanceWorkMinutes: attendance.attendanceWorkMinutes,
      attendanceMinutesRaw: attendance.attendanceMinutes,
      calculatedAttendanceMinutes: attendanceMinutes,
      clockInTime: attendance.clockInTime,
      clockOutTime: attendance.clockOutTime,
      calculationNote: "8:30\u3088\u308A\u524D\u306E\u6642\u9593\u306F\u9664\u5916\u3055\u308C\u3066\u3044\u307E\u3059"
    });
    const workRecordsQuery = `
                SELECT DISTINCT
                    wr.id,
                    wr.vehicleId,
                    wr.processId,
                    wr.startTime,
                    wr.endTime,
                    TIMESTAMPDIFF(
                        MINUTE,
                        wr.startTime,
                        COALESCE(wr.endTime, NOW())
                    ) AS durationMinutes,
                    v.vehicleNumber,
                    v.customerName,
                    p.name AS processName,
                    wr.workDescription,
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) AS startDateJST,
                    CONVERT_TZ(wr.startTime, '+00:00', '+09:00') AS startTimeJST,
                    CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00') AS endTimeJST,
                    TIME(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) AS startTimeStr,
                    TIME(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) AS endTimeStr
                FROM \`workRecords\` wr
                LEFT JOIN \`vehicles\` v ON v.id = wr.vehicleId
                LEFT JOIN \`processes\` p ON p.id = wr.processId
                WHERE
                    wr.userId = ?
                    AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                ORDER BY wr.startTime ASC
            `;
    console.log("[getWorkReportDetail] \u4F5C\u696D\u8A18\u9332\u30AF\u30A8\u30EA\u5B9F\u884C:", {
      userId: input.userId,
      workDate: input.workDate
    });
    const [workRecordsRows] = await pool.execute(workRecordsQuery, [
      input.userId,
      input.workDate
    ]);
    console.log("[getWorkReportDetail] \u4F5C\u696D\u8A18\u9332\u53D6\u5F97\u7D50\u679C:", {
      count: workRecordsRows?.length || 0,
      records: workRecordsRows?.slice(0, 3).map((r) => ({
        id: r.id,
        startTime: r.startTime,
        startTimeJST: r.startTimeJST,
        startDateJST: r.startDateJST
      }))
    });
    const breakTimes2 = await db.select().from(schema_exports.breakTimes).then(
      (times) => times.filter((bt) => bt.isActive === "true")
    );
    const timeToMinutes2 = (t2) => {
      if (!t2) return null;
      const [hh2, mm2] = t2.split(":");
      const h = Number(hh2);
      const m = Number(mm2);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      const total = h * 60 + m;
      if (total < 0 || total > 23 * 60 + 59) return null;
      return total;
    };
    const dateToTimeString = (date2) => {
      const formatter = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const parts = formatter.formatToParts(date2);
      const hours = parts.find((p) => p.type === "hour")?.value || "00";
      const minutes = parts.find((p) => p.type === "minute")?.value || "00";
      return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    };
    const workRecordsWithBreakTime = await Promise.all(
      (workRecordsRows || []).map(async (row) => {
        if (!row.startTime) {
          return {
            id: row.id,
            vehicleId: Number(row.vehicleId) || 0,
            processId: Number(row.processId) || 0,
            startTime: row.startTime,
            endTime: row.endTime,
            durationMinutes: 0,
            vehicleNumber: row.vehicleNumber || "\u4E0D\u660E",
            customerName: row.customerName || null,
            processName: row.processName || "\u4E0D\u660E",
            workDescription: row.workDescription || null
          };
        }
        const startTimeStr = row.startTimeStr ? row.startTimeStr.substring(0, 5) : dateToTimeString(new Date(row.startTime));
        const endTimeStr = row.endTimeStr ? row.endTimeStr.substring(0, 5) : row.endTime ? dateToTimeString(new Date(row.endTime)) : dateToTimeString(/* @__PURE__ */ new Date());
        console.log(`[getWorkReportDetail] \u4F5C\u696D\u8A18\u9332[${row.id}] \u6642\u523B\u5909\u63DB:`, {
          startTimeRaw: row.startTime,
          startTimeStr: row.startTimeStr,
          startTimeStrParsed: startTimeStr,
          endTimeRaw: row.endTime,
          endTimeStr: row.endTimeStr,
          endTimeStrParsed: endTimeStr
        });
        const startTimeJST = row.startTimeJST ? parseJSTDateTime(row.startTimeJST) : new Date(row.startTime);
        const endTimeJST = row.endTimeJST ? parseJSTDateTime(row.endTimeJST) : row.endTime ? new Date(row.endTime) : null;
        const isValidStartTime = startTimeJST && !isNaN(startTimeJST.getTime());
        const isValidEndTime = endTimeJST && !isNaN(endTimeJST.getTime());
        let durationMs = 0;
        if (isValidStartTime && isValidEndTime) {
          durationMs = endTimeJST.getTime() - startTimeJST.getTime();
        } else if (isValidStartTime && !endTimeJST) {
          durationMs = (/* @__PURE__ */ new Date()).getTime() - startTimeJST.getTime();
        }
        const baseMinutes = Math.max(0, Math.floor(durationMs / (1e3 * 60)));
        let breakTotal = 0;
        const startMin = timeToMinutes2(startTimeStr);
        const endMin = timeToMinutes2(endTimeStr);
        if (startMin !== null && endMin !== null) {
          let actualEndMin = endMin;
          if (endMin < startMin) {
            actualEndMin = endMin + 24 * 60;
          }
          for (const bt of breakTimes2) {
            const s = timeToMinutes2(bt.startTime);
            const e = timeToMinutes2(bt.endTime);
            if (s === null || e === null) continue;
            let actualBreakEnd = e;
            if (e < s) {
              actualBreakEnd = e + 24 * 60;
            }
            const overlapStart = Math.max(startMin, s);
            const overlapEnd = Math.min(actualEndMin, actualBreakEnd);
            if (overlapEnd > overlapStart) {
              breakTotal += overlapEnd - overlapStart;
            }
          }
        }
        const baseMinutesNum = typeof baseMinutes === "number" && !isNaN(baseMinutes) ? baseMinutes : 0;
        const breakTotalNum = typeof breakTotal === "number" && !isNaN(breakTotal) ? breakTotal : 0;
        const duration = Math.max(0, baseMinutesNum - breakTotalNum);
        const finalDuration = typeof duration === "number" && !isNaN(duration) ? duration : 0;
        return {
          id: row.id,
          vehicleId: Number(row.vehicleId) || 0,
          processId: Number(row.processId) || 0,
          startTime: startTimeJST,
          endTime: endTimeJST,
          startTimeJST,
          // JST変換済みの時刻を追加
          endTimeJST,
          // JST変換済みの時刻を追加
          startTimeStr,
          // JST時刻文字列を保存
          endTimeStr,
          // JST時刻文字列を保存
          durationMinutes: finalDuration,
          vehicleNumber: row.vehicleNumber || "\u4E0D\u660E",
          customerName: row.customerName || null,
          processName: row.processName || "\u4E0D\u660E",
          workDescription: row.workDescription || null
        };
      })
    );
    const workRecords2 = workRecordsWithBreakTime;
    const sortedRecords = [...workRecords2].filter((r) => r.startTime).sort((a, b) => {
      const startA = a.startTimeStr || dateToTimeString(new Date(a.startTime));
      const startB = b.startTimeStr || dateToTimeString(new Date(b.startTime));
      return startA.localeCompare(startB);
    });
    const mergedIntervals = [];
    for (const record of sortedRecords) {
      if (!record.startTime) continue;
      const recordAny = record;
      const startTimeStr = recordAny.startTimeStr || dateToTimeString(new Date(record.startTime));
      const endTimeStr = recordAny.endTimeStr || (record.endTime ? dateToTimeString(new Date(record.endTime)) : dateToTimeString(/* @__PURE__ */ new Date()));
      const startMin = timeToMinutes2(startTimeStr);
      const endMin = timeToMinutes2(endTimeStr);
      if (startMin === null || endMin === null) continue;
      let actualEndMin = endMin;
      if (endMin < startMin) {
        actualEndMin = endMin + 24 * 60;
      }
      let merged = false;
      for (let i = 0; i < mergedIntervals.length; i++) {
        const interval = mergedIntervals[i];
        const intervalStartMin = timeToMinutes2(interval.startTimeStr);
        const intervalEndMin = timeToMinutes2(interval.endTimeStr);
        if (intervalStartMin === null || intervalEndMin === null) continue;
        let actualIntervalEndMin = intervalEndMin;
        if (intervalEndMin < intervalStartMin) {
          actualIntervalEndMin = intervalEndMin + 24 * 60;
        }
        if (!(actualEndMin < intervalStartMin - 1 || startMin > actualIntervalEndMin + 1)) {
          const newStartMin = Math.min(startMin, intervalStartMin);
          const newEndMin = Math.max(actualEndMin, actualIntervalEndMin);
          const newStartHours = Math.floor(newStartMin / 60) % 24;
          const newStartMins = newStartMin % 60;
          const newEndHours = Math.floor(newEndMin / 60) % 24;
          const newEndMins = newEndMin % 60;
          interval.startTimeStr = `${String(newStartHours).padStart(2, "0")}:${String(newStartMins).padStart(2, "0")}`;
          interval.endTimeStr = `${String(newEndHours).padStart(2, "0")}:${String(newEndMins).padStart(2, "0")}`;
          merged = true;
          break;
        }
      }
      if (!merged) {
        mergedIntervals.push({ startTimeStr, endTimeStr });
      }
    }
    const intervalDetails = [];
    let workMinutes = 0;
    console.log("[getWorkReportDetail] \u30DE\u30FC\u30B8\u3055\u308C\u305F\u30A4\u30F3\u30BF\u30FC\u30D0\u30EB\u6570:", mergedIntervals.length);
    for (let i = 0; i < mergedIntervals.length; i++) {
      const interval = mergedIntervals[i];
      const startTimeStr = interval.startTimeStr;
      const endTimeStr = interval.endTimeStr;
      console.log(`[getWorkReportDetail] \u30A4\u30F3\u30BF\u30FC\u30D0\u30EB[${i}]: ${startTimeStr} - ${endTimeStr}`);
      let startMin = timeToMinutes2(startTimeStr);
      const endMin = timeToMinutes2(endTimeStr);
      if (startMin === null || endMin === null) {
        console.log("[getWorkReportDetail] \u6642\u523B\u306E\u5909\u63DB\u5931\u6557:", { startTimeStr, endTimeStr });
        continue;
      }
      const morningBreakStart = timeToMinutes2("06:00");
      const morningBreakEnd = timeToMinutes2("08:30");
      if (morningBreakStart !== null && morningBreakEnd !== null) {
        const hasMorningBreak = breakTimes2.some((bt) => {
          const btStart = timeToMinutes2(bt.startTime);
          const btEnd = timeToMinutes2(bt.endTime);
          return btStart === morningBreakStart && btEnd === morningBreakEnd;
        });
        if (hasMorningBreak && startMin < morningBreakStart) {
          startMin = morningBreakEnd;
          console.log(`[getWorkReportDetail] \u671D\u4F11\u61A9\u9069\u7528: \u958B\u59CB\u6642\u523B\u3092${startTimeStr}\u304B\u308908:30\u306B\u8ABF\u6574`);
        }
      }
      let actualEndMin = endMin;
      if (endMin < startMin) {
        actualEndMin = endMin + 24 * 60;
        console.log(`[getWorkReportDetail] \u65E5\u3092\u307E\u305F\u3050\u4F5C\u696D\u8A18\u9332: ${startTimeStr} \u2192 ${endTimeStr} (${startMin}\u5206 \u2192 ${actualEndMin}\u5206)`);
      }
      const baseMinutes = actualEndMin - startMin;
      console.log(`[getWorkReportDetail] \u30A4\u30F3\u30BF\u30FC\u30D0\u30EB[${i}] \u57FA\u672C\u6642\u9593: ${baseMinutes}\u5206 (${Math.floor(baseMinutes / 60)}\u6642\u9593${baseMinutes % 60}\u5206)`);
      let breakTotal = 0;
      const breakDetails = [];
      for (const bt of breakTimes2) {
        const s = timeToMinutes2(bt.startTime);
        const e = timeToMinutes2(bt.endTime);
        if (s === null || e === null || startMin === null || actualEndMin === null) {
          console.log("[getWorkReportDetail] \u4F11\u61A9\u6642\u9593\u306E\u5909\u63DB\u5931\u6557:", { start: bt.startTime, end: bt.endTime });
          continue;
        }
        if (s === morningBreakStart && e === morningBreakEnd) {
          continue;
        }
        let actualBreakEnd = e;
        if (e < s) {
          actualBreakEnd = e + 24 * 60;
        }
        const workStart = startMin;
        const workEnd = actualEndMin;
        let overlapStart = Math.max(workStart, s);
        let overlapEnd = Math.min(workEnd, actualBreakEnd);
        if (actualEndMin > 24 * 60) {
          const day1End = 24 * 60;
          let overlap1 = 0;
          if (overlapStart < day1End) {
            overlap1 = Math.min(overlapEnd, day1End) - Math.max(overlapStart, workStart);
          }
          const day2Start = 24 * 60;
          const day2End = actualEndMin;
          let overlap2 = 0;
          if (overlapEnd > day2Start && overlapStart < day2End) {
            const day2WorkStart = Math.max(0, overlapStart - day2Start);
            const day2WorkEnd = Math.min(actualEndMin - day2Start, overlapEnd - day2Start);
            overlap2 = day2WorkEnd - day2WorkStart;
          }
          const overlapMinutes = Math.max(0, overlap1 + overlap2);
          if (overlapMinutes > 0) {
            breakTotal += overlapMinutes;
            breakDetails.push({
              breakTime: `${bt.startTime} - ${bt.endTime}`,
              overlap: overlapMinutes
            });
            console.log("[getWorkReportDetail] \u4F11\u61A9\u6642\u9593\u91CD\u8907\uFF08\u65E5\u3092\u307E\u305F\u3050\uFF09:", {
              intervalIndex: i,
              workInterval: `${startTimeStr}-${endTimeStr} (${startMin}\u5206-${actualEndMin}\u5206)`,
              breakInterval: `${bt.startTime}-${bt.endTime} (${s}\u5206-${actualBreakEnd}\u5206)`,
              overlap: `${overlapMinutes}\u5206 (day1: ${overlap1}\u5206, day2: ${overlap2}\u5206)`,
              breakTotal: `${breakTotal}\u5206`
            });
          }
        } else {
          if (overlapEnd > overlapStart) {
            const overlapMinutes = overlapEnd - overlapStart;
            breakTotal += overlapMinutes;
            breakDetails.push({
              breakTime: `${bt.startTime} - ${bt.endTime}`,
              overlap: overlapMinutes
            });
            console.log("[getWorkReportDetail] \u4F11\u61A9\u6642\u9593\u91CD\u8907:", {
              intervalIndex: i,
              workInterval: `${startMin}\u5206-${endMin}\u5206 (${startTimeStr}-${endTimeStr})`,
              breakInterval: `${s}\u5206-${e}\u5206 (${bt.startTime}-${bt.endTime})`,
              overlap: `${overlapStart}\u5206-${overlapEnd}\u5206 (${overlapMinutes}\u5206)`,
              breakTotal: `${breakTotal}\u5206`
            });
          }
        }
      }
      const duration = Math.max(0, baseMinutes - breakTotal);
      console.log(`[getWorkReportDetail] \u30A4\u30F3\u30BF\u30FC\u30D0\u30EB[${i}] \u6700\u7D42\u8A08\u7B97:`, {
        baseMinutes: `${baseMinutes}\u5206 (${Math.floor(baseMinutes / 60)}\u6642\u9593${baseMinutes % 60}\u5206)`,
        breakTotal: `${breakTotal}\u5206 (${Math.floor(breakTotal / 60)}\u6642\u9593${breakTotal % 60}\u5206)`,
        duration: `${duration}\u5206 (${Math.floor(duration / 60)}\u6642\u9593${duration % 60}\u5206)`
      });
      workMinutes += duration;
      intervalDetails.push({
        index: i,
        startTime: startTimeStr,
        endTime: endTimeStr,
        baseMinutes,
        breakTotal,
        duration,
        breakDetails
      });
    }
    const differenceMinutes = workMinutes - attendanceMinutes;
    return {
      userId: input.userId,
      workDate: input.workDate,
      userName,
      attendance: {
        id: attendance.attendanceId,
        workDate: attendance.workDate,
        clockInTime: attendance.clockInTime,
        clockOutTime: attendance.clockOutTime,
        attendanceMinutes
        // 休憩時間を差し引いた値
      },
      workRecords: workRecords2,
      summary: {
        attendanceMinutes,
        workMinutes,
        differenceMinutes
      },
      breakTimeDetails: {
        breakTimes: breakTimes2.map((bt) => ({ start: bt.startTime, end: bt.endTime })),
        intervals: intervalDetails
      }
    };
  }),
  /**
   * 車両ごとの制作時間を集計する
   * - 1台あたりの総作業時間（全期間）
   * - 工程ごとの総作業時間
   * - 工程をクリックしたときに表示する「誰が・いつ・何分」単位の明細
   */
  getVehicleProductionTimes: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const rows = await db.select({
      vehicleId: schema_exports.workRecords.vehicleId,
      vehicleNumber: schema_exports.vehicles.vehicleNumber,
      customerName: schema_exports.vehicles.customerName,
      desiredDeliveryDate: schema_exports.vehicles.desiredDeliveryDate,
      completionDate: schema_exports.vehicles.completionDate,
      processId: schema_exports.workRecords.processId,
      processName: schema_exports.processes.name,
      userId: schema_exports.workRecords.userId,
      userName: schema_exports.users.name,
      userUsername: schema_exports.users.username,
      workDate: sql2`DATE(${schema_exports.workRecords.startTime})`.as("workDate"),
      // 進行中の作業も含めて「今までにかかった時間」を見る
      minutes: sql2`COALESCE(TIMESTAMPDIFF(MINUTE, ${schema_exports.workRecords.startTime}, COALESCE(${schema_exports.workRecords.endTime}, NOW())), 0)`.as(
        "minutes"
      )
    }).from(schema_exports.workRecords).innerJoin(schema_exports.vehicles, eq8(schema_exports.workRecords.vehicleId, schema_exports.vehicles.id)).innerJoin(schema_exports.processes, eq8(schema_exports.workRecords.processId, schema_exports.processes.id)).innerJoin(schema_exports.users, eq8(schema_exports.workRecords.userId, schema_exports.users.id));
    const vehicleMap = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const minutes = Number(row.minutes) || 0;
      if (minutes <= 0) continue;
      let vehicle = vehicleMap.get(row.vehicleId);
      if (!vehicle) {
        vehicle = {
          vehicleId: row.vehicleId,
          vehicleNumber: row.vehicleNumber,
          customerName: row.customerName ?? null,
          desiredDeliveryDate: row.desiredDeliveryDate ?? null,
          completionDate: row.completionDate ?? null,
          totalMinutes: 0,
          processes: []
        };
        vehicleMap.set(row.vehicleId, vehicle);
      }
      vehicle.totalMinutes += minutes;
      let process2 = vehicle.processes.find((p) => p.processId === row.processId);
      if (!process2) {
        process2 = {
          processId: row.processId,
          processName: row.processName,
          totalMinutes: 0,
          details: []
        };
        vehicle.processes.push(process2);
      }
      process2.totalMinutes += minutes;
      process2.details.push({
        userId: row.userId,
        userName: row.userName || row.userUsername,
        workDate: row.workDate,
        minutes
      });
    }
    const vehicles2 = Array.from(vehicleMap.values()).map((v) => {
      const processes2 = [...v.processes].map((p) => ({
        ...p,
        details: [...p.details].sort((a, b) => {
          if (a.workDate === b.workDate) {
            return a.userId - b.userId;
          }
          return a.workDate < b.workDate ? -1 : 1;
        })
      })).sort((a, b) => b.totalMinutes - a.totalMinutes);
      return {
        ...v,
        processes: processes2
      };
    });
    vehicles2.sort((a, b) => b.totalMinutes - a.totalMinutes);
    return vehicles2;
  }),
  // 作業記録管理を入れていない人を取得（今日出勤しているが作業記録がない人）
  getUsersWithoutWorkRecords: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const jstParts = jstFormatter.formatToParts(now);
    const y = jstParts.find((p) => p.type === "year")?.value || "0";
    const m = jstParts.find((p) => p.type === "month")?.value || "01";
    const d = jstParts.find((p) => p.type === "day")?.value || "01";
    const jstTodayStr = `${y}-${m}-${d}`;
    const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const allUsers = await selectUsersSafely2(db);
    const staffUsers = allUsers.filter((u) => u.role !== "external");
    const attendanceRecords2 = await db.select({
      userId: schema_exports.attendanceRecords.userId,
      clockInTime: schema_exports.attendanceRecords.clockInTime,
      clockOutTime: schema_exports.attendanceRecords.clockOutTime
    }).from(schema_exports.attendanceRecords).where(eq8(schema_exports.attendanceRecords.workDate, jstTodayStr));
    const usersWithAttendance = new Set(attendanceRecords2.map((ar) => ar.userId));
    const pool = getPool();
    if (!pool) {
      return [];
    }
    const workRecordsQuery = `
            SELECT DISTINCT
                wr.userId AS userId
            FROM \`workRecords\` wr
            WHERE
                DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = ?
        `;
    const [workRecordsRows] = await pool.execute(workRecordsQuery, [jstTodayStr]);
    const usersWithWorkRecords = new Set(
      (workRecordsRows || []).map((row) => Number(row.userId))
    );
    const usersWithoutWorkRecords = staffUsers.filter((user) => {
      return usersWithAttendance.has(user.id) && !usersWithWorkRecords.has(user.id);
    }).map((user) => {
      const attendance = attendanceRecords2.find((ar) => ar.userId === user.id);
      return {
        userId: user.id,
        userName: user.name || user.username,
        clockInTime: attendance?.clockInTime || null,
        clockOutTime: attendance?.clockOutTime || null
      };
    });
    return usersWithoutWorkRecords;
  }),
  // 作業記録管理不備がある人を取得
  // 条件：
  // - 4日以内（当日は除く）に出勤した人
  // - 勤務時間 - 作業記録時間 = ±1時間を超えている
  // - または、出勤したけど作業報告を入れていない人
  // サンプルページのため無効化
  getWorkRecordIssues: protectedProcedure.query(async () => {
    console.log("[getWorkRecordIssues] \u30B5\u30F3\u30D7\u30EB\u30DA\u30FC\u30B8\u306E\u305F\u3081\u7121\u52B9\u5316\u3055\u308C\u3066\u3044\u307E\u3059");
    return [];
  }),
  /**
   * 大分類別の作業時間を集計
   * 昨日、今日、一週間、11月の各期間で大分類別の総合作業時間を返す
   */
  getWorkTimeByMajorCategory: protectedProcedure.query(async () => {
    const db = await getDb();
    const pool = getPool();
    if (!db || !pool) {
      return {
        yesterday: [],
        today: [],
        week: [],
        november: []
      };
    }
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const jstParts = jstFormatter.formatToParts(now);
    const y = parseInt(jstParts.find((p) => p.type === "year")?.value || "0");
    const m = parseInt(jstParts.find((p) => p.type === "month")?.value || "1");
    const d = parseInt(jstParts.find((p) => p.type === "day")?.value || "1");
    const today = new Date(y, m - 1, d);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const currentYear = y;
    const novemberStart = new Date(currentYear, 10, 1);
    const novemberEnd = new Date(currentYear, 10, 30, 23, 59, 59);
    const getWorkTimeByCategory = async (startDate, endDate) => {
      const query = `
                SELECT 
                    COALESCE(p.majorCategory, '\u672A\u5206\u985E') AS majorCategory,
                    SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))) AS totalMinutes
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                    AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d')
                    AND wr.endTime IS NOT NULL
                GROUP BY p.majorCategory
                ORDER BY totalMinutes DESC
            `;
      const [rows] = await pool.execute(query, [
        startDate.toISOString().slice(0, 10),
        endDate.toISOString().slice(0, 10)
      ]);
      return (rows || []).map((row) => ({
        majorCategory: row.majorCategory || "\u672A\u5206\u985E",
        totalMinutes: Number(row.totalMinutes) || 0
      }));
    };
    const yesterdayData = await getWorkTimeByCategory(yesterday, yesterday);
    const todayData = await getWorkTimeByCategory(today, today);
    const weekData = await getWorkTimeByCategory(weekAgo, today);
    const novemberData = await getWorkTimeByCategory(novemberStart, novemberEnd);
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const dayBeforeYesterdayData = await getWorkTimeByCategory(dayBeforeYesterday, dayBeforeYesterday);
    const threeDaysAgoData = await getWorkTimeByCategory(threeDaysAgo, threeDaysAgo);
    return {
      yesterday: yesterdayData,
      today: todayData,
      week: weekData,
      november: novemberData,
      dayBeforeYesterday: dayBeforeYesterdayData,
      threeDaysAgo: threeDaysAgoData
    };
  }),
  /**
   * 昨日と一昨日の大分類別の総合作業時間を取得
   */
  getWorkTimeByMajorCategoryTodayYesterday: protectedProcedure.query(async () => {
    const db = await getDb();
    const pool = getPool();
    if (!db || !pool) {
      return {
        yesterday: [],
        dayBeforeYesterday: []
      };
    }
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const jstParts = jstFormatter.formatToParts(now);
    const y = parseInt(jstParts.find((p) => p.type === "year")?.value || "0");
    const m = parseInt(jstParts.find((p) => p.type === "month")?.value || "1");
    const d = parseInt(jstParts.find((p) => p.type === "day")?.value || "1");
    const today = new Date(y, m - 1, d);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const getWorkTimeByCategory = async (targetDate) => {
      const query = `
                SELECT 
                    COALESCE(p.majorCategory, '\u672A\u5206\u985E') AS majorCategory,
                    SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))) AS totalMinutes
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                    AND wr.endTime IS NOT NULL
                GROUP BY p.majorCategory
                ORDER BY totalMinutes DESC
            `;
      const [rows] = await pool.execute(query, [
        targetDate.toISOString().slice(0, 10)
      ]);
      return (rows || []).map((row) => ({
        majorCategory: row.majorCategory || "\u672A\u5206\u985E",
        totalMinutes: Number(row.totalMinutes) || 0
      }));
    };
    const yesterdayData = await getWorkTimeByCategory(yesterday);
    const dayBeforeYesterdayData = await getWorkTimeByCategory(dayBeforeYesterday);
    return {
      yesterday: yesterdayData,
      dayBeforeYesterday: dayBeforeYesterdayData
    };
  }),
  /**
   * 作業中の車両とその作業時間を取得（作業掲載ページ用）
   * 5時間未満の車両は除外
   */
  getActiveVehiclesWithWorkTime: protectedProcedure.query(async () => {
    const db = await getDb();
    const pool = getPool();
    if (!db || !pool) {
      return [];
    }
    const vehicles2 = await db.select().from(schema_exports.vehicles).where(eq8(schema_exports.vehicles.status, "in_progress"));
    if (vehicles2.length === 0) {
      return [];
    }
    const vehicleIds = vehicles2.map((v) => v.id);
    const vehicleTypes2 = await db.select().from(schema_exports.vehicleTypes);
    const vehicleTypeMap = new Map(vehicleTypes2.map((vt) => [vt.id, vt.name]));
    const placeholders = vehicleIds.map(() => "?").join(",");
    const totalWorkTimeQuery = `
            SELECT 
                vehicleId,
                COALESCE(SUM(TIMESTAMPDIFF(MINUTE, startTime, COALESCE(endTime, NOW()))), 0) AS totalMinutes
            FROM \`workRecords\`
            WHERE vehicleId IN (${placeholders})
            GROUP BY vehicleId
        `;
    const [workTimeRows] = await pool.execute(totalWorkTimeQuery, vehicleIds);
    const workTimeMap = /* @__PURE__ */ new Map();
    if (workTimeRows) {
      workTimeRows.forEach((row) => {
        workTimeMap.set(row.vehicleId, Number(row.totalMinutes) || 0);
      });
    }
    const filteredVehicles = vehicles2.filter((vehicle) => {
      const totalMinutes = workTimeMap.get(vehicle.id) || 0;
      return totalMinutes >= 300;
    });
    if (filteredVehicles.length === 0) {
      return [];
    }
    const filteredVehicleIds = filteredVehicles.map((v) => v.id);
    const filteredPlaceholders = filteredVehicleIds.map(() => "?").join(",");
    const userWorkTimeQuery = `
            SELECT 
                wr.vehicleId,
                wr.userId,
                COALESCE(u.name, u.username) AS userName,
                COALESCE(SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))), 0) AS userMinutes
            FROM \`workRecords\` wr
            INNER JOIN \`users\` u ON u.id = wr.userId
            WHERE wr.vehicleId IN (${filteredPlaceholders})
            GROUP BY wr.vehicleId, wr.userId, u.name, u.username
            ORDER BY wr.vehicleId, userMinutes DESC
        `;
    const [userWorkTimeRows] = await pool.execute(userWorkTimeQuery, filteredVehicleIds);
    const userWorkTimeMap = /* @__PURE__ */ new Map();
    if (userWorkTimeRows) {
      userWorkTimeRows.forEach((row) => {
        const vehicleId = row.vehicleId;
        const existing = userWorkTimeMap.get(vehicleId) || [];
        existing.push({
          userName: row.userName,
          minutes: Number(row.userMinutes) || 0
        });
        userWorkTimeMap.set(vehicleId, existing);
      });
    }
    const memos = await db.select().from(schema_exports.vehicleMemos).where(inArray2(schema_exports.vehicleMemos.vehicleId, filteredVehicleIds));
    const attentionPoints = await db.select().from(schema_exports.vehicleAttentionPoints).where(inArray2(schema_exports.vehicleAttentionPoints.vehicleId, filteredVehicleIds));
    const memosMap = /* @__PURE__ */ new Map();
    memos.forEach((memo) => {
      const existing = memosMap.get(memo.vehicleId) || [];
      existing.push(memo.content);
      memosMap.set(memo.vehicleId, existing);
    });
    const attentionPointsMap = /* @__PURE__ */ new Map();
    attentionPoints.forEach((ap) => {
      const existing = attentionPointsMap.get(ap.vehicleId) || [];
      existing.push(ap.content);
      attentionPointsMap.set(ap.vehicleId, existing);
    });
    return filteredVehicles.map((vehicle) => {
      const totalMinutes = workTimeMap.get(vehicle.id) || 0;
      const userWorkTimes = userWorkTimeMap.get(vehicle.id) || [];
      return {
        id: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        customerName: vehicle.customerName,
        vehicleTypeName: vehicleTypeMap.get(vehicle.vehicleTypeId) || "\u4E0D\u660E",
        desiredDeliveryDate: vehicle.desiredDeliveryDate,
        totalMinutes,
        userWorkTimes,
        // 作業者ごとの作業時間
        memos: memosMap.get(vehicle.id) || [],
        // メモ
        attentionPoints: attentionPointsMap.get(vehicle.id) || []
        // 注意ポイント
      };
    }).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }),
  /**
   * 大分類別の作業記録詳細を取得（誰が何をしたか）
   */
  getWorkDetailsByMajorCategory: protectedProcedure.input(
    z8.object({
      majorCategory: z8.string(),
      date: z8.string()
      // "today" | "yesterday" | "2024-12-03" などの形式
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    const pool = getPool();
    if (!db || !pool) {
      return [];
    }
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const jstParts = jstFormatter.formatToParts(now);
    const y = parseInt(jstParts.find((p) => p.type === "year")?.value || "0");
    const m = parseInt(jstParts.find((p) => p.type === "month")?.value || "1");
    const d = parseInt(jstParts.find((p) => p.type === "day")?.value || "1");
    let targetDate;
    if (input.date === "today") {
      targetDate = new Date(y, m - 1, d);
    } else if (input.date === "yesterday") {
      const today = new Date(y, m - 1, d);
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - 1);
    } else {
      targetDate = new Date(input.date);
    }
    const query = `
                SELECT 
                    wr.id,
                    wr.userId,
                    wr.vehicleId,
                    wr.processId,
                    wr.startTime,
                    wr.endTime,
                    wr.workDescription,
                    COALESCE(u.name, u.username) AS userName,
                    v.vehicleNumber,
                    v.customerName,
                    p.name AS processName,
                    p.minorCategory,
                    TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW())) AS durationMinutes,
                    TIME(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) AS startTimeStr,
                    TIME(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) AS endTimeStr
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                INNER JOIN \`users\` u ON u.id = wr.userId
                LEFT JOIN \`vehicles\` v ON v.id = wr.vehicleId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                    AND COALESCE(p.majorCategory, '\u672A\u5206\u985E') = ?
                    AND wr.endTime IS NOT NULL
                ORDER BY wr.startTime ASC
            `;
    const [rows] = await pool.execute(query, [
      targetDate.toISOString().slice(0, 10),
      input.majorCategory
    ]);
    return (rows || []).map((row) => ({
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      vehicleId: row.vehicleId,
      vehicleNumber: row.vehicleNumber || "\u4E0D\u660E",
      customerName: row.customerName,
      processId: row.processId,
      processName: row.processName,
      minorCategory: row.minorCategory,
      workDescription: row.workDescription,
      startTime: row.startTime,
      endTime: row.endTime,
      startTimeStr: row.startTimeStr ? row.startTimeStr.substring(0, 5) : null,
      endTimeStr: row.endTimeStr ? row.endTimeStr.substring(0, 5) : null,
      durationMinutes: Number(row.durationMinutes) || 0
    }));
  }),
  // 作業記録管理不備をクリア（準管理者以上）
  clearWorkRecordIssue: protectedProcedure.input(
    z8.object({
      userId: z8.number(),
      workDate: z8.string()
      // "YYYY-MM-DD"形式
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError9({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    try {
      const existing = await db.select().from(schema_exports.workRecordIssueClears).where(
        and3(
          eq8(schema_exports.workRecordIssueClears.userId, input.userId),
          eq8(schema_exports.workRecordIssueClears.workDate, input.workDate)
        )
      ).limit(1);
      if (existing.length > 0) {
        return { success: true, message: "\u65E2\u306B\u30AF\u30EA\u30A2\u6E08\u307F\u3067\u3059" };
      }
      await db.insert(schema_exports.workRecordIssueClears).values({
        userId: input.userId,
        workDate: input.workDate,
        clearedBy: ctx.user.id
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code;
      const causeErrorCode = error?.cause?.code;
      const causeErrorMessage = error?.cause?.message || error?.cause?.sqlMessage || "";
      const isTableNotFound = errorCode === "ER_NO_SUCH_TABLE" || causeErrorCode === "ER_NO_SUCH_TABLE" || errorMessage.includes("doesn't exist") || causeErrorMessage.includes("doesn't exist") || errorMessage.includes("Unknown column") || causeErrorMessage.includes("Unknown column");
      if (isTableNotFound) {
        console.error("[clearWorkRecordIssue] \u30C6\u30FC\u30D6\u30EB\u307E\u305F\u306F\u30AB\u30E9\u30E0\u304C\u5B58\u5728\u3057\u307E\u305B\u3093:", errorMessage, causeErrorMessage);
        throw new TRPCError9({
          code: "INTERNAL_SERVER_ERROR",
          message: "workRecordIssueClears\u30C6\u30FC\u30D6\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093\u3002\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u30DE\u30A4\u30B0\u30EC\u30FC\u30B7\u30E7\u30F3\u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
        });
      }
      console.error("[clearWorkRecordIssue] \u30A8\u30E9\u30FC:", error);
      throw new TRPCError9({
        code: "INTERNAL_SERVER_ERROR",
        message: `\u4E0D\u5099\u306E\u30AF\u30EA\u30A2\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${errorMessage}`
      });
    }
  }),
  // ふみかチェック一覧を取得（管理者専用）
  getWorkRecordIssueClears: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin") {
      throw new TRPCError9({
        code: "FORBIDDEN",
        message: "\u30A2\u30AF\u30BB\u30B9\u6A29\u9650\u304C\u3042\u308A\u307E\u305B\u3093"
      });
    }
    const db = await getDb();
    if (!db) {
      throw new TRPCError9({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const pool = getPool();
    if (!pool) {
      throw new TRPCError9({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    try {
      const query = `
                SELECT 
                    wric.id,
                    wric.userId,
                    wric.workDate,
                    wric.clearedBy,
                    wric.clearedAt,
                    wric.createdAt,
                    u.name AS userName,
                    u.username AS userUsername,
                    clearedByUser.name AS clearedByName,
                    clearedByUser.username AS clearedByUsername
                FROM \`workRecordIssueClears\` wric
                INNER JOIN \`users\` u ON u.id = wric.userId
                INNER JOIN \`users\` clearedByUser ON clearedByUser.id = wric.clearedBy
                ORDER BY wric.clearedAt DESC
            `;
      const [rows] = await pool.execute(query);
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        workDate: row.workDate,
        clearedBy: row.clearedBy,
        clearedAt: row.clearedAt,
        createdAt: row.createdAt,
        userName: row.userName || row.userUsername,
        clearedByName: row.clearedByName || row.clearedByUsername
      }));
    } catch (error) {
      if (error?.code === "ER_NO_SUCH_TABLE" || error?.message?.includes("doesn't exist")) {
        console.log("[getWorkRecordIssueClears] workRecordIssueClears\u30C6\u30FC\u30D6\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093\u3002\u7A7A\u914D\u5217\u3092\u8FD4\u3057\u307E\u3059\u3002");
        return [];
      }
      throw error;
    }
  }),
  /**
   * 昨日と一昨日の大分類別作業時間を取得
   */
  getTotalWorkTimeTodayYesterday: protectedProcedure.query(async () => {
    const db = await getDb();
    const pool = getPool();
    if (!db || !pool) {
      return {
        yesterday: [],
        dayBeforeYesterday: []
      };
    }
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const jstParts = jstFormatter.formatToParts(now);
    const y = parseInt(jstParts.find((p) => p.type === "year")?.value || "0");
    const m = parseInt(jstParts.find((p) => p.type === "month")?.value || "1");
    const d = parseInt(jstParts.find((p) => p.type === "day")?.value || "1");
    const today = new Date(y, m - 1, d);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const getWorkTimeByCategory = async (targetDate) => {
      const query = `
                SELECT 
                    COALESCE(p.majorCategory, '\u672A\u5206\u985E') AS majorCategory,
                    SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))) AS totalMinutes
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                    AND wr.endTime IS NOT NULL
                GROUP BY p.majorCategory
                ORDER BY totalMinutes DESC
            `;
      const [rows] = await pool.execute(query, [
        targetDate.toISOString().slice(0, 10)
      ]);
      return (rows || []).map((row) => ({
        majorCategory: row.majorCategory || "\u672A\u5206\u985E",
        totalMinutes: Number(row.totalMinutes) || 0
      }));
    };
    const yesterdayData = await getWorkTimeByCategory(yesterday);
    const dayBeforeYesterdayData = await getWorkTimeByCategory(dayBeforeYesterday);
    return {
      yesterday: yesterdayData,
      dayBeforeYesterday: dayBeforeYesterdayData
    };
  }),
  /**
   * 昨日と一昨日の作業記録詳細を取得（誰がどの車でどんな作業をしたか）
   */
  getWorkDetailsYesterdayDayBefore: protectedProcedure.query(async () => {
    const db = await getDb();
    const pool = getPool();
    if (!db || !pool) {
      return {
        yesterday: [],
        dayBeforeYesterday: []
      };
    }
    const now = /* @__PURE__ */ new Date();
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const jstParts = jstFormatter.formatToParts(now);
    const y = parseInt(jstParts.find((p) => p.type === "year")?.value || "0");
    const m = parseInt(jstParts.find((p) => p.type === "month")?.value || "1");
    const d = parseInt(jstParts.find((p) => p.type === "day")?.value || "1");
    const today = new Date(y, m - 1, d);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const getWorkDetails = async (targetDate) => {
      const query = `
                SELECT 
                    wr.id,
                    wr.userId,
                    wr.vehicleId,
                    wr.processId,
                    wr.startTime,
                    wr.endTime,
                    wr.workDescription,
                    COALESCE(u.name, u.username) AS userName,
                    v.vehicleNumber,
                    v.customerName,
                    p.name AS processName,
                    p.minorCategory,
                    TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW())) AS durationMinutes,
                    TIME(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) AS startTimeStr,
                    TIME(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) AS endTimeStr
                FROM \`workRecords\` wr
                INNER JOIN \`processes\` p ON p.id = wr.processId
                INNER JOIN \`users\` u ON u.id = wr.userId
                LEFT JOIN \`vehicles\` v ON v.id = wr.vehicleId
                WHERE 
                    DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) = STR_TO_DATE(?, '%Y-%m-%d')
                    AND wr.endTime IS NOT NULL
                ORDER BY wr.startTime ASC
            `;
      const [rows] = await pool.execute(query, [
        targetDate.toISOString().slice(0, 10)
      ]);
      return (rows || []).map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        vehicleId: row.vehicleId,
        vehicleNumber: row.vehicleNumber || "\u4E0D\u660E",
        customerName: row.customerName,
        processId: row.processId,
        processName: row.processName,
        minorCategory: row.minorCategory,
        workDescription: row.workDescription,
        startTime: row.startTime,
        endTime: row.endTime,
        startTimeStr: row.startTimeStr ? row.startTimeStr.substring(0, 5) : null,
        endTimeStr: row.endTimeStr ? row.endTimeStr.substring(0, 5) : null,
        durationMinutes: Number(row.durationMinutes) || 0
      }));
    };
    const yesterdayDetails = await getWorkDetails(yesterday);
    const dayBeforeYesterdayDetails = await getWorkDetails(dayBeforeYesterday);
    return {
      yesterday: yesterdayDetails,
      dayBeforeYesterday: dayBeforeYesterdayDetails
    };
  }),
  /**
   * 12月の車両別作業時間一覧を取得（跨ぎ判定含む）
   */
  getVehicleWorkTimeByMonth: protectedProcedure.input(
    z8.object({
      year: z8.number(),
      month: z8.number()
      // 1-12
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    const pool = getPool();
    if (!db || !pool) {
      return [];
    }
    const { year, month } = input;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const query = `
                SELECT 
                    v.id AS vehicleId,
                    v.vehicleNumber,
                    v.customerName,
                    vt.name AS vehicleTypeName,
                    SUM(TIMESTAMPDIFF(MINUTE, wr.startTime, COALESCE(wr.endTime, NOW()))) AS totalMinutes,
                    MIN(DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00'))) AS firstWorkDate,
                    MAX(DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00'))) AS lastWorkDate,
                    MIN(DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00'))) AS firstEndDate,
                    MAX(DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00'))) AS lastEndDate
                FROM \`workRecords\` wr
                INNER JOIN \`vehicles\` v ON v.id = wr.vehicleId
                LEFT JOIN \`vehicleTypes\` vt ON vt.id = v.vehicleTypeId
                WHERE 
                    (
                        (DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                        AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d'))
                        OR
                        (DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                        AND DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d'))
                    )
                    AND wr.endTime IS NOT NULL
                GROUP BY v.id, v.vehicleNumber, v.customerName, vt.name
                ORDER BY totalMinutes DESC
            `;
    const [rows] = await pool.execute(query, [
      monthStart.toISOString().slice(0, 10),
      monthEnd.toISOString().slice(0, 10),
      monthStart.toISOString().slice(0, 10),
      monthEnd.toISOString().slice(0, 10)
    ]);
    const crossMonthCheckQuery = `
                SELECT DISTINCT
                    wr.vehicleId,
                    CASE 
                        WHEN MIN(DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00'))) < STR_TO_DATE(?, '%Y-%m-%d')
                        OR MAX(DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00'))) > STR_TO_DATE(?, '%Y-%m-%d')
                        THEN 1
                        ELSE 0
                    END AS isCrossMonth
                FROM \`workRecords\` wr
                WHERE 
                    (
                        (DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                        AND DATE(CONVERT_TZ(wr.startTime, '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d'))
                        OR
                        (DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) >= STR_TO_DATE(?, '%Y-%m-%d')
                        AND DATE(CONVERT_TZ(COALESCE(wr.endTime, NOW()), '+00:00', '+09:00')) <= STR_TO_DATE(?, '%Y-%m-%d'))
                    )
                    AND wr.endTime IS NOT NULL
                GROUP BY wr.vehicleId
            `;
    const [crossMonthRows] = await pool.execute(crossMonthCheckQuery, [
      monthStart.toISOString().slice(0, 10),
      // 12月開始日より前
      monthEnd.toISOString().slice(0, 10),
      // 12月終了日より後
      monthStart.toISOString().slice(0, 10),
      monthEnd.toISOString().slice(0, 10),
      monthStart.toISOString().slice(0, 10),
      monthEnd.toISOString().slice(0, 10)
    ]);
    const crossMonthMap = /* @__PURE__ */ new Map();
    (crossMonthRows || []).forEach((row) => {
      crossMonthMap.set(Number(row.vehicleId), Number(row.isCrossMonth) === 1);
    });
    const result = (rows || []).map((row) => {
      const vehicleId = Number(row.vehicleId);
      const isCrossMonth = crossMonthMap.get(vehicleId) || false;
      return {
        vehicleId: Number(row.vehicleId),
        vehicleNumber: row.vehicleNumber || "",
        customerName: row.customerName || "",
        vehicleTypeName: row.vehicleTypeName || "",
        totalMinutes: Number(row.totalMinutes) || 0,
        isCrossMonth
      };
    });
    return result;
  })
});

// server/routers/csv.ts
init_trpc();
init_db();
import { gte as gte2, lte as lte2, and as and4 } from "drizzle-orm";
import { startOfDay as startOfDay2, endOfDay as endOfDay2, format, eachDayOfInterval } from "date-fns";
import { z as z9 } from "zod";
function getMonthPeriod21st(date2) {
  const year = date2.getFullYear();
  const month = date2.getMonth();
  const day = date2.getDate();
  let startDate;
  let endDate;
  if (day >= 21) {
    startDate = new Date(year, month, 21);
    endDate = new Date(year, month + 1, 20);
  } else {
    startDate = new Date(year, month - 1, 21);
    endDate = new Date(year, month, 20);
  }
  return {
    start: startOfDay2(startDate),
    end: endOfDay2(endDate)
  };
}
var csvRouter = createTRPCRouter({
  exportAttendance: subAdminProcedure.input(
    z9.object({
      date: z9.string().optional()
      // 基準日（省略時は今日）
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093");
    }
    const baseDate = input.date ? new Date(input.date) : /* @__PURE__ */ new Date();
    const { start, end } = getMonthPeriod21st(baseDate);
    const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const users2 = await selectUsersSafely2(db);
    users2.sort((a, b) => a.id - b.id);
    const userMap = new Map(users2.map((u) => [u.id, u]));
    const startDateStr = format(start, "yyyy-MM-dd");
    const endDateStr = format(end, "yyyy-MM-dd");
    const pool = getPool();
    if (!pool) {
      throw new Error("\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u30D7\u30FC\u30EB\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093");
    }
    const query = `
                SELECT 
                    id,
                    userId,
                    workDate,
                    clockInTime,
                    clockOutTime,
                    workMinutes,
                    clockInDevice,
                    clockOutDevice
                FROM \`attendanceRecords\`
                WHERE 
                    workDate >= ?
                    AND workDate <= ?
                ORDER BY userId, workDate
            `;
    const [rows] = await pool.execute(query, [startDateStr, endDateStr]);
    console.log(`[CSV Export] \u671F\u9593: ${startDateStr} \uFF5E ${endDateStr}`);
    console.log(`[CSV Export] \u53D6\u5F97\u3057\u305F\u8A18\u9332\u6570: ${rows?.length || 0}`);
    const recordsByUserAndDate = /* @__PURE__ */ new Map();
    if (rows && rows.length > 0) {
      rows.forEach((record) => {
        const dateStr = record.workDate ? typeof record.workDate === "string" ? record.workDate : format(new Date(record.workDate), "yyyy-MM-dd") : "";
        if (dateStr) {
          const key = `${record.userId}_${dateStr}`;
          recordsByUserAndDate.set(key, record);
          console.log(`[CSV Export] \u30DE\u30C3\u30D7\u306B\u8FFD\u52A0: userId=${record.userId}, date=${dateStr}, clockInTime=${record.clockInTime}, clockOutTime=${record.clockOutTime}, workMinutes=${record.workMinutes}`);
        }
      });
    }
    console.log(`[CSV Export] \u30DE\u30C3\u30D7\u306B\u767B\u9332\u3055\u308C\u305F\u8A18\u9332\u6570: ${recordsByUserAndDate.size}`);
    const allDates = eachDayOfInterval({ start, end });
    const csvRows = [];
    users2.forEach((user) => {
      const userName = user.name || user.username || "\u4E0D\u660E";
      csvRows.push([`${userName} (${user.id})`]);
      const dateHeaderRow = ["\u9805\u76EE"];
      allDates.forEach((date2) => {
        dateHeaderRow.push(format(date2, "MM/dd"));
      });
      csvRows.push(dateHeaderRow);
      const clockInRow = ["\u51FA\u52E4\u6642\u523B"];
      allDates.forEach((date2) => {
        const dateStr = format(date2, "yyyy-MM-dd");
        const key = `${user.id}_${dateStr}`;
        const record = recordsByUserAndDate.get(key);
        if (record && record.clockInTime) {
          clockInRow.push(record.clockInTime);
        } else {
          clockInRow.push("");
        }
      });
      csvRows.push(clockInRow);
      const clockOutRow = ["\u9000\u52E4\u6642\u523B"];
      allDates.forEach((date2) => {
        const dateStr = format(date2, "yyyy-MM-dd");
        const key = `${user.id}_${dateStr}`;
        const record = recordsByUserAndDate.get(key);
        if (record && record.clockOutTime) {
          clockOutRow.push(record.clockOutTime);
        } else {
          clockOutRow.push("");
        }
      });
      csvRows.push(clockOutRow);
      const workDurationRow = ["\u52E4\u52D9\u6642\u9593\uFF08\u5206\uFF09"];
      allDates.forEach((date2) => {
        const dateStr = format(date2, "yyyy-MM-dd");
        const key = `${user.id}_${dateStr}`;
        const record = recordsByUserAndDate.get(key);
        if (record && record.workMinutes !== null && record.workMinutes !== void 0) {
          workDurationRow.push(record.workMinutes.toString());
        } else {
          workDurationRow.push("");
        }
      });
      csvRows.push(workDurationRow);
      const workDurationFormattedRow = ["\u51FA\u52E4\u6642\u9593"];
      allDates.forEach((date2) => {
        const dateStr = format(date2, "yyyy-MM-dd");
        const key = `${user.id}_${dateStr}`;
        const record = recordsByUserAndDate.get(key);
        if (record && record.workMinutes !== null && record.workMinutes !== void 0) {
          const hours = Math.floor(record.workMinutes / 60);
          const minutes = record.workMinutes % 60;
          workDurationFormattedRow.push(hours > 0 ? `${hours}\u6642\u9593${minutes}\u5206` : `${minutes}\u5206`);
        } else {
          workDurationFormattedRow.push("");
        }
      });
      csvRows.push(workDurationFormattedRow);
      const clockInDeviceRow = ["\u51FA\u52E4\u30C7\u30D0\u30A4\u30B9"];
      allDates.forEach((date2) => {
        const dateStr = format(date2, "yyyy-MM-dd");
        const key = `${user.id}_${dateStr}`;
        const record = recordsByUserAndDate.get(key);
        if (record) {
          clockInDeviceRow.push(record.clockInDevice || "");
        } else {
          clockInDeviceRow.push("");
        }
      });
      csvRows.push(clockInDeviceRow);
      const clockOutDeviceRow = ["\u9000\u52E4\u30C7\u30D0\u30A4\u30B9"];
      allDates.forEach((date2) => {
        const dateStr = format(date2, "yyyy-MM-dd");
        const key = `${user.id}_${dateStr}`;
        const record = recordsByUserAndDate.get(key);
        if (record) {
          clockOutDeviceRow.push(record.clockOutDevice || "");
        } else {
          clockOutDeviceRow.push("");
        }
      });
      csvRows.push(clockOutDeviceRow);
      csvRows.push([]);
    });
    const periodInfo = [
      [`\u671F\u9593: ${format(start, "yyyy\u5E74MM\u6708dd\u65E5")} \uFF5E ${format(end, "yyyy\u5E74MM\u6708dd\u65E5")}`],
      []
    ];
    const csv = [...periodInfo, ...csvRows].map((row) => {
      if (row.length === 0) return "";
      return row.map((cell) => `"${cell}"`).join(",");
    }).filter((row) => row !== "").join("\n");
    return { csv };
  }),
  exportWorkRecords: subAdminProcedure.input(
    z9.object({
      startDate: z9.string(),
      endDate: z9.string()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093");
    }
    const start = startOfDay2(new Date(input.startDate));
    const end = endOfDay2(new Date(input.endDate));
    const records = await db.select().from(schema_exports.workRecords).where(
      and4(gte2(schema_exports.workRecords.startTime, start), lte2(schema_exports.workRecords.startTime, end))
    );
    const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const users2 = await selectUsersSafely2(db);
    const vehicles2 = await db.select().from(schema_exports.vehicles);
    const processes2 = await db.select().from(schema_exports.processes);
    const vehicleTypes2 = await db.select().from(schema_exports.vehicleTypes);
    const userMap = new Map(users2.map((u) => [u.id, u]));
    const vehicleMap = new Map(vehicles2.map((v) => [v.id, v]));
    const processMap = new Map(processes2.map((p) => [p.id, p]));
    const vehicleTypeMap = new Map(vehicleTypes2.map((vt) => [vt.id, vt]));
    const csvRows = [
      ["\u30E6\u30FC\u30B6\u30FC\u540D", "\u8ECA\u4E21\u756A\u53F7", "\u8ECA\u7A2E", "\u5DE5\u7A0B", "\u958B\u59CB\u6642\u523B", "\u7D42\u4E86\u6642\u523B", "\u4F5C\u696D\u6642\u9593\uFF08\u5206\uFF09", "\u4F5C\u696D\u5185\u5BB9"]
    ];
    const recordsByUser = /* @__PURE__ */ new Map();
    records.forEach((record) => {
      if (!recordsByUser.has(record.userId)) {
        recordsByUser.set(record.userId, []);
      }
      recordsByUser.get(record.userId).push(record);
    });
    const sortedUserIds = Array.from(recordsByUser.keys()).sort();
    sortedUserIds.forEach((userId) => {
      const userRecords = recordsByUser.get(userId);
      userRecords.sort((a, b) => {
        const dateA = new Date(a.startTime).getTime();
        const dateB = new Date(b.startTime).getTime();
        return dateA - dateB;
      });
      userRecords.forEach((record) => {
        const user = userMap.get(record.userId);
        const vehicle = vehicleMap.get(record.vehicleId);
        const process2 = processMap.get(record.processId);
        const vehicleType = vehicle ? vehicleTypeMap.get(vehicle.vehicleTypeId) : null;
        const startTime = new Date(record.startTime);
        const endTime = record.endTime ? new Date(record.endTime) : null;
        const durationMinutes = endTime ? Math.floor((endTime.getTime() - startTime.getTime()) / 1e3 / 60) : null;
        csvRows.push([
          user?.name || user?.username || "\u4E0D\u660E",
          vehicle?.vehicleNumber || "\u4E0D\u660E",
          vehicleType?.name || "\u4E0D\u660E",
          process2?.name || "\u4E0D\u660E",
          startTime.toISOString().replace("T", " ").substring(0, 16),
          endTime ? endTime.toISOString().replace("T", " ").substring(0, 16) : "",
          durationMinutes?.toString() || "",
          record.workDescription || ""
        ]);
      });
    });
    const csv = csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    return { csv };
  }),
  exportVehicles: subAdminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093");
    }
    const vehicles2 = await db.select().from(schema_exports.vehicles);
    const vehicleTypes2 = await db.select().from(schema_exports.vehicleTypes);
    const vehicleTypeMap = new Map(vehicleTypes2.map((vt) => [vt.id, vt]));
    const csvRows = [
      ["\u8ECA\u4E21\u756A\u53F7", "\u8ECA\u7A2E", "\u304A\u5BA2\u69D8\u540D", "\u5E0C\u671B\u7D0D\u671F", "\u5B8C\u6210\u65E5", "\u30B9\u30C6\u30FC\u30BF\u30B9", "\u76EE\u6A19\u5408\u8A08\u6642\u9593\uFF08\u5206\uFF09"]
    ];
    vehicles2.forEach((vehicle) => {
      const vehicleType = vehicleTypeMap.get(vehicle.vehicleTypeId);
      csvRows.push([
        vehicle.vehicleNumber,
        vehicleType?.name || "\u4E0D\u660E",
        vehicle.customerName || "",
        vehicle.desiredDeliveryDate ? new Date(vehicle.desiredDeliveryDate).toISOString().split("T")[0] : "",
        vehicle.completionDate ? new Date(vehicle.completionDate).toISOString().split("T")[0] : "",
        vehicle.status,
        vehicle.targetTotalMinutes?.toString() || ""
      ]);
    });
    const csv = csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    return { csv };
  })
});

// server/routers/checks.ts
init_trpc();
init_db();
import { eq as eq9, and as and5 } from "drizzle-orm";
import { TRPCError as TRPCError10 } from "@trpc/server";
import { z as z10 } from "zod";
var checksRouter = createTRPCRouter({
  // チェック項目一覧取得（区分別）
  listCheckItems: protectedProcedure.input(
    z10.object({
      category: z10.enum(["\u4E00\u822C", "\u30AD\u30E3\u30F3\u30D1\u30FC", "\u4E2D\u53E4", "\u4FEE\u7406", "\u30AF\u30EC\u30FC\u30E0"]).optional()
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    let query = db.select().from(schema_exports.checkItems);
    if (input.category) {
      query = query.where(eq9(schema_exports.checkItems.category, input.category));
    }
    const items = await query;
    return items.sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      return orderA - orderB;
    });
  }),
  // チェック項目作成（管理者のみ）
  createCheckItem: subAdminProcedure.input(
    z10.object({
      category: z10.enum(["\u4E00\u822C", "\u30AD\u30E3\u30F3\u30D1\u30FC", "\u4E2D\u53E4", "\u4FEE\u7406", "\u30AF\u30EC\u30FC\u30E0"]),
      majorCategory: z10.string().optional(),
      minorCategory: z10.string().optional(),
      name: z10.string().min(1),
      description: z10.string().optional(),
      displayOrder: z10.number().default(0)
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const [result] = await db.insert(schema_exports.checkItems).values(input).$returningId();
    return { id: result };
  }),
  // チェック項目更新（管理者のみ）
  updateCheckItem: subAdminProcedure.input(
    z10.object({
      id: z10.number(),
      name: z10.string().min(1).optional(),
      majorCategory: z10.string().optional(),
      minorCategory: z10.string().optional(),
      description: z10.string().optional(),
      displayOrder: z10.number().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const { id, ...updateData } = input;
    await db.update(schema_exports.checkItems).set(updateData).where(eq9(schema_exports.checkItems.id, id));
    return { success: true };
  }),
  // CSVインポート（管理者のみ）
  importFromCSV: subAdminProcedure.input(
    z10.object({
      items: z10.array(
        z10.object({
          category: z10.enum(["\u4E00\u822C", "\u30AD\u30E3\u30F3\u30D1\u30FC", "\u4E2D\u53E4", "\u4FEE\u7406", "\u30AF\u30EC\u30FC\u30E0"]),
          majorCategory: z10.string().optional(),
          minorCategory: z10.string().optional(),
          name: z10.string().min(1),
          description: z10.string().optional(),
          displayOrder: z10.number().default(0)
        })
      )
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    try {
      const results = [];
      for (const item of input.items) {
        const [result] = await db.insert(schema_exports.checkItems).values(item).$returningId();
        results.push({ id: result, name: item.name });
      }
      return { success: true, count: results.length, items: results };
    } catch (error) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "CSV\u30A4\u30F3\u30DD\u30FC\u30C8\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
      });
    }
  }),
  // チェック項目削除（管理者のみ）
  deleteCheckItem: subAdminProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.delete(schema_exports.checkItems).where(eq9(schema_exports.checkItems.id, input.id));
    return { success: true };
  }),
  // 車両のチェック状況取得
  getVehicleChecks: protectedProcedure.input(z10.object({ vehicleId: z10.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const [vehicle] = await db.select().from(schema_exports.vehicles).where(eq9(schema_exports.vehicles.id, input.vehicleId)).limit(1);
    if (!vehicle) {
      throw new TRPCError10({
        code: "NOT_FOUND",
        message: "\u8ECA\u4E21\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    const checkItems2 = await db.select().from(schema_exports.checkItems).where(eq9(schema_exports.checkItems.category, vehicle.category));
    checkItems2.sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      return orderA - orderB;
    });
    const checks = await db.select().from(schema_exports.vehicleChecks).where(eq9(schema_exports.vehicleChecks.vehicleId, input.vehicleId));
    const userIds = [...new Set(checks.map((c) => c.checkedBy))];
    let users2 = [];
    if (userIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      users2 = await selectUsersSafely2(db, inArray4(schema_exports.users.id, userIds));
    }
    const userMap = new Map(users2.map((u) => [u.id, u]));
    const checkItemIds = [...new Set(checks.map((c) => c.checkItemId))];
    let checkItemsData = [];
    if (checkItemIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      checkItemsData = await db.select().from(schema_exports.checkItems).where(inArray4(schema_exports.checkItems.id, checkItemIds));
    }
    const checkItemMap = new Map(checkItemsData.map((ci) => [ci.id, ci]));
    const checkRequests2 = await db.select().from(schema_exports.checkRequests).where(eq9(schema_exports.checkRequests.vehicleId, input.vehicleId));
    const requestUserIds = [
      .../* @__PURE__ */ new Set([
        ...checkRequests2.map((r) => r.requestedBy),
        ...checkRequests2.map((r) => r.requestedTo)
      ])
    ];
    let requestUsers = [];
    if (requestUserIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      requestUsers = await selectUsersSafely2(
        db,
        inArray4(schema_exports.users.id, requestUserIds)
      );
    }
    const requestUserMap = new Map(requestUsers.map((u) => [u.id, u]));
    const checkStatus = checkItems2.map((item) => {
      const check = checks.find((c) => c.checkItemId === item.id);
      const pendingRequestsForItem = checkRequests2.filter(
        (r) => r.checkItemId === item.id && r.status === "pending"
      );
      return {
        checkItem: item,
        checked: !!check,
        status: check?.status || "unchecked",
        checkedBy: check ? userMap.get(check.checkedBy) : null,
        checkedAt: check ? check.checkedAt : null,
        notes: check ? check.notes : null,
        hasRequest: pendingRequestsForItem.length > 0,
        requestDueDate: pendingRequestsForItem.length > 0 ? pendingRequestsForItem[0].dueDate || null : null,
        // 全ユーザーが「誰が誰に依頼しているか」分かるよう、依頼詳細を返す
        requests: pendingRequestsForItem.map((r) => ({
          id: r.id,
          requestedBy: requestUserMap.get(r.requestedBy) || null,
          requestedTo: requestUserMap.get(r.requestedTo) || null,
          dueDate: r.dueDate,
          message: r.message,
          status: r.status
        }))
      };
    });
    return {
      vehicle,
      checkStatus
    };
  }),
  // チェック実行
  checkVehicle: protectedProcedure.input(
    z10.object({
      vehicleId: z10.number(),
      checkItemId: z10.number(),
      status: z10.enum(["checked", "needs_recheck", "unchecked"]).default("checked"),
      notes: z10.string().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const existingChecks = await db.select().from(schema_exports.vehicleChecks).where(
      and5(
        eq9(schema_exports.vehicleChecks.vehicleId, input.vehicleId),
        eq9(schema_exports.vehicleChecks.checkItemId, input.checkItemId)
      )
    );
    if (input.status === "unchecked") {
      if (existingChecks.length > 0) {
        await db.delete(schema_exports.vehicleChecks).where(eq9(schema_exports.vehicleChecks.id, existingChecks[0].id));
      }
    } else {
      if (existingChecks.length > 0) {
        await db.update(schema_exports.vehicleChecks).set({
          checkedBy: ctx.user.id,
          status: input.status,
          notes: input.notes || null,
          checkedAt: /* @__PURE__ */ new Date()
        }).where(eq9(schema_exports.vehicleChecks.id, existingChecks[0].id));
      } else {
        await db.insert(schema_exports.vehicleChecks).values({
          vehicleId: input.vehicleId,
          checkItemId: input.checkItemId,
          checkedBy: ctx.user.id,
          status: input.status,
          notes: input.notes || null,
          checkedAt: /* @__PURE__ */ new Date()
        });
      }
    }
    try {
      await db.update(schema_exports.checkRequests).set({
        status: "completed",
        completedAt: /* @__PURE__ */ new Date()
      }).where(
        and5(
          eq9(schema_exports.checkRequests.vehicleId, input.vehicleId),
          eq9(schema_exports.checkRequests.checkItemId, input.checkItemId),
          eq9(schema_exports.checkRequests.requestedTo, ctx.user.id),
          eq9(schema_exports.checkRequests.status, "pending")
        )
      );
    } catch (e) {
      console.error("[checks.checkVehicle] checkRequests update error:", e);
    }
    return { success: true };
  }),
  // チェック依頼作成
  requestCheck: protectedProcedure.input(
    z10.object({
      vehicleId: z10.number(),
      checkItemId: z10.number(),
      // 依頼するチェック項目ID
      requestedTo: z10.number(),
      // 依頼先ユーザーID
      dueDate: z10.date().optional(),
      // 期限日
      message: z10.string().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.insert(schema_exports.checkRequests).values({
      vehicleId: input.vehicleId,
      checkItemId: input.checkItemId,
      requestedBy: ctx.user.id,
      requestedTo: input.requestedTo,
      dueDate: input.dueDate || null,
      message: input.message || null,
      status: "pending"
    });
    return { success: true };
  }),
  // チェック依頼一覧取得（自分宛の依頼）
  // サンプルページのため、データベース接続エラー時は空配列を返す
  getMyCheckRequests: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      console.warn("[checks.getMyCheckRequests] \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3002\u7A7A\u914D\u5217\u3092\u8FD4\u3057\u307E\u3059\u3002");
      return [];
    }
    const requests = await db.select().from(schema_exports.checkRequests).where(eq9(schema_exports.checkRequests.requestedTo, ctx.user.id));
    const userIds = [.../* @__PURE__ */ new Set([...requests.map((r) => r.requestedBy), ...requests.map((r) => r.requestedTo)])];
    const vehicleIds = [...new Set(requests.map((r) => r.vehicleId))];
    const checkItemIds = [...new Set(requests.map((r) => r.checkItemId))];
    let users2 = [];
    let vehicles2 = [];
    let checkItems2 = [];
    if (userIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      users2 = await db.select().from(schema_exports.users).where(inArray4(schema_exports.users.id, userIds));
    }
    if (vehicleIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      vehicles2 = await db.select().from(schema_exports.vehicles).where(inArray4(schema_exports.vehicles.id, vehicleIds));
    }
    if (checkItemIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      checkItems2 = await db.select().from(schema_exports.checkItems).where(inArray4(schema_exports.checkItems.id, checkItemIds));
    }
    const userMap = new Map(users2.map((u) => [u.id, u]));
    const vehicleMap = new Map(vehicles2.map((v) => [v.id, v]));
    const checkItemMap = new Map(checkItems2.map((ci) => [ci.id, ci]));
    return requests.map((request) => ({
      ...request,
      requestedByUser: userMap.get(request.requestedBy),
      vehicle: vehicleMap.get(request.vehicleId),
      checkItem: checkItemMap.get(request.checkItemId)
    }));
  }),
  // チェック依頼完了
  completeCheckRequest: protectedProcedure.input(z10.object({ requestId: z10.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError10({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.update(schema_exports.checkRequests).set({
      status: "completed",
      completedAt: /* @__PURE__ */ new Date()
    }).where(eq9(schema_exports.checkRequests.id, input.requestId));
    return { success: true };
  })
});

// server/routers/salesBroadcasts.ts
init_trpc();
init_db();
import { eq as eq10, and as and6, gt } from "drizzle-orm";
import { TRPCError as TRPCError11 } from "@trpc/server";
import { z as z11 } from "zod";
import { addDays } from "date-fns";
var salesBroadcastsRouter = createTRPCRouter({
  // 営業（準管理者以上）からの拡散を作成（元の仕様に戻す）
  create: subAdminProcedure.input(
    z11.object({
      vehicleId: z11.number(),
      message: z11.string().min(1)
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError11({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const expiresAt = addDays(/* @__PURE__ */ new Date(), 7);
    const [result] = await db.insert(schema_exports.salesBroadcasts).values({
      vehicleId: input.vehicleId,
      createdBy: ctx.user.id,
      message: input.message,
      expiresAt
    }).$returningId();
    try {
      await db.insert(schema_exports.vehicleMemos).values({
        vehicleId: input.vehicleId,
        userId: ctx.user.id,
        content: `\u3010\u62E1\u6563\u9805\u76EE\u3011${input.message}`
      });
    } catch (error) {
      console.error("[salesBroadcasts.create] Failed to add memo from broadcast:", error);
    }
    return { id: result };
  }),
  // 未読の営業からの拡散を取得（自分が読んでいないもの）
  // サンプルページのため、データベース接続エラー時は空配列を返す
  getUnread: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      console.warn("[salesBroadcasts.getUnread] \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3002\u7A7A\u914D\u5217\u3092\u8FD4\u3057\u307E\u3059\u3002");
      return [];
    }
    const now = /* @__PURE__ */ new Date();
    const broadcasts = await db.select().from(schema_exports.salesBroadcasts).where(gt(schema_exports.salesBroadcasts.expiresAt, now));
    const readBroadcasts = await db.select().from(schema_exports.salesBroadcastReads).where(eq10(schema_exports.salesBroadcastReads.userId, ctx.user.id));
    const readBroadcastIds = new Set(readBroadcasts.map((r) => r.broadcastId));
    const unreadBroadcasts = broadcasts.filter((b) => !readBroadcastIds.has(b.id));
    const vehicleIds = [...new Set(unreadBroadcasts.map((b) => b.vehicleId))];
    const userIds = [...new Set(unreadBroadcasts.map((b) => b.createdBy))];
    let vehicles2 = [];
    let users2 = [];
    let vehicleTypes2 = [];
    if (vehicleIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      vehicles2 = await db.select().from(schema_exports.vehicles).where(inArray4(schema_exports.vehicles.id, vehicleIds));
      const vehicleTypeIds = [...new Set(vehicles2.map((v) => v.vehicleTypeId))];
      if (vehicleTypeIds.length > 0) {
        vehicleTypes2 = await db.select().from(schema_exports.vehicleTypes).where(inArray4(schema_exports.vehicleTypes.id, vehicleTypeIds));
      }
    }
    if (userIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      users2 = await selectUsersSafely2(db, inArray4(schema_exports.users.id, userIds));
    }
    const vehicleMap = new Map(vehicles2.map((v) => [v.id, v]));
    const userMap = new Map(users2.map((u) => [u.id, u]));
    const vehicleTypeMap = new Map(vehicleTypes2.map((vt) => [vt.id, vt]));
    return unreadBroadcasts.map((broadcast) => {
      const vehicle = vehicleMap.get(broadcast.vehicleId);
      const vehicleType = vehicle ? vehicleTypeMap.get(vehicle.vehicleTypeId) : null;
      return {
        ...broadcast,
        vehicle: vehicle ? { ...vehicle, vehicleType } : null,
        createdByUser: userMap.get(broadcast.createdBy)
      };
    });
  }),
  // 拡散を既読にする
  markAsRead: protectedProcedure.input(z11.object({ broadcastId: z11.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError11({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const existing = await db.select().from(schema_exports.salesBroadcastReads).where(
      and6(
        eq10(schema_exports.salesBroadcastReads.broadcastId, input.broadcastId),
        eq10(schema_exports.salesBroadcastReads.userId, ctx.user.id)
      )
    );
    if (existing.length === 0) {
      await db.insert(schema_exports.salesBroadcastReads).values({
        broadcastId: input.broadcastId,
        userId: ctx.user.id
      });
    }
    return { success: true };
  }),
  // 期限切れの拡散を削除（定期実行用、管理者のみ）
  deleteExpired: subAdminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError11({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const now = /* @__PURE__ */ new Date();
    const { lt } = await import("drizzle-orm");
    const expiredBroadcasts = await db.select().from(schema_exports.salesBroadcasts).where(lt(schema_exports.salesBroadcasts.expiresAt, now));
    if (expiredBroadcasts.length > 0) {
      const expiredIds = expiredBroadcasts.map((b) => b.id);
      const { inArray: inArray4 } = await import("drizzle-orm");
      await db.delete(schema_exports.salesBroadcastReads).where(inArray4(schema_exports.salesBroadcastReads.broadcastId, expiredIds));
      await db.delete(schema_exports.salesBroadcasts).where(inArray4(schema_exports.salesBroadcasts.id, expiredIds));
    }
    return { deleted: expiredBroadcasts.length };
  })
});

// server/routers/bulletin.ts
init_trpc();
init_db();
import { TRPCError as TRPCError12 } from "@trpc/server";
import { z as z12 } from "zod";
import { sql as sql3 } from "drizzle-orm";
async function ensureBulletinTable(db) {
  try {
    await db.execute(sql3`SELECT 1 FROM \`bulletinMessages\` LIMIT 1`);
  } catch (error) {
    const msg = String(error?.message || "");
    const causeMsg = String(error?.cause?.message || "");
    const code = error?.code || error?.cause?.code || "";
    const combinedMsg = `${msg} ${causeMsg}`;
    if (code === "ER_NO_SUCH_TABLE" || combinedMsg.includes("ER_NO_SUCH_TABLE") || combinedMsg.includes("doesn't exist") || combinedMsg.includes("does not exist")) {
      await db.execute(sql3`
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
    if (combinedMsg.includes("Unknown column 'expireDays'") || combinedMsg.includes("unknown column 'expireDays'")) {
      await db.execute(sql3`
                ALTER TABLE \`bulletinMessages\`
                ADD COLUMN \`expireDays\` int NOT NULL DEFAULT 5
            `);
      return;
    }
    if (combinedMsg.includes("Unknown column 'createdAt'") || combinedMsg.includes("unknown column 'createdAt'")) {
      await db.execute(sql3`
                ALTER TABLE \`bulletinMessages\`
                ADD COLUMN \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
            `);
      return;
    }
    throw error;
  }
}
var bulletinRouter = createTRPCRouter({
  // 掲示板メッセージ作成（全ユーザー利用可）
  create: protectedProcedure.input(
    z12.object({
      message: z12.string().min(1).max(500),
      // 掲載期間（日数）: 1 / 3 / 5（指定なしの場合は5日）
      expireDays: z12.number().int().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError12({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureBulletinTable(db);
    try {
      const expireDays = input.expireDays && [1, 3, 5].includes(input.expireDays) ? input.expireDays : 5;
      await db.execute(
        sql3`INSERT INTO \`bulletinMessages\` (\`userId\`, \`message\`, \`expireDays\`) VALUES (${ctx.user.id}, ${input.message}, ${expireDays})`
      );
      const [rows] = await db.execute(
        sql3`SELECT LAST_INSERT_ID() as id`
      );
      const id = rows && rows[0] ? rows[0].id : void 0;
      return { id };
    } catch (error) {
      console.error("[bulletin.create] insert error:", error);
      throw new TRPCError12({
        code: "INTERNAL_SERVER_ERROR",
        message: error?.message || "\u63B2\u793A\u677F\u30E1\u30C3\u30BB\u30FC\u30B8\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
      });
    }
  }),
  // 掲示板メッセージ削除（投稿者本人 or 管理者）
  delete: protectedProcedure.input(
    z12.object({
      id: z12.number().int()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError12({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureBulletinTable(db);
    const [rows] = await db.execute(
      sql3`SELECT * FROM \`bulletinMessages\` WHERE \`id\` = ${input.id} LIMIT 1`
    );
    const msg = rows && rows[0];
    if (!msg) {
      throw new TRPCError12({
        code: "NOT_FOUND",
        message: "\u30E1\u30C3\u30BB\u30FC\u30B8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    if (msg.userId !== ctx.user.id && ctx.user.role !== "admin") {
      throw new TRPCError12({
        code: "FORBIDDEN",
        message: "\u3053\u306E\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u524A\u9664\u3059\u308B\u6A29\u9650\u304C\u3042\u308A\u307E\u305B\u3093"
      });
    }
    await db.execute(
      sql3`DELETE FROM \`bulletinMessages\` WHERE \`id\` = ${input.id}`
    );
    return { success: true };
  }),
  // 最新の掲示板メッセージを取得（上位20件）
  // サンプルページのため、データベース接続エラー時は空配列を返す
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[bulletin.list] \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3002\u7A7A\u914D\u5217\u3092\u8FD4\u3057\u307E\u3059\u3002");
      return [];
    }
    await ensureBulletinTable(db);
    try {
      await db.execute(
        sql3`
                    DELETE FROM \`bulletinMessages\`
                    WHERE TIMESTAMPDIFF(DAY, \`createdAt\`, NOW()) >= \`expireDays\`
                `
      );
    } catch (error) {
      console.error("[bulletin.list] \u53E4\u3044\u30E1\u30C3\u30BB\u30FC\u30B8\u306E\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", error);
    }
    let messages = [];
    try {
      const [rows] = await db.execute(
        sql3`
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
    const userIds = [...new Set(messages.map((m) => m.userId))];
    let users2 = [];
    if (userIds.length > 0) {
      const { inArray: inArray4 } = await import("drizzle-orm");
      const { selectUsersSafely: selectUsersSafely2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      users2 = await selectUsersSafely2(db, inArray4(schema_exports.users.id, userIds));
    }
    const userMap = new Map(users2.map((u) => [u.id, u]));
    return messages.map((m) => ({
      ...m,
      user: userMap.get(m.userId) || null
    }));
  })
});

// server/routers/breakTimes.ts
init_trpc();
init_db();
import { TRPCError as TRPCError13 } from "@trpc/server";
import { z as z13 } from "zod";
import { eq as eq11 } from "drizzle-orm";
var breakTimesRouter = createTRPCRouter({
  // 休憩時間一覧を取得
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return [];
    }
    const breakTimes2 = await db.select().from(schema_exports.breakTimes).orderBy(schema_exports.breakTimes.startTime);
    return breakTimes2;
  }),
  // 休憩時間を作成（管理者専用）
  create: adminProcedure.input(
    z13.object({
      name: z13.string().min(1),
      startTime: z13.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
      // HH:MM形式
      endTime: z13.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
      // HH:MM形式
      durationMinutes: z13.number().int().min(0),
      isActive: z13.enum(["true", "false"]).default("true")
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError13({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.insert(schema_exports.breakTimes).values({
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: input.durationMinutes,
      isActive: input.isActive
    });
    return { success: true };
  }),
  // 休憩時間を更新（管理者専用）
  update: adminProcedure.input(
    z13.object({
      id: z13.number(),
      name: z13.string().min(1).optional(),
      startTime: z13.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      endTime: z13.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      durationMinutes: z13.number().int().min(0).optional(),
      isActive: z13.enum(["true", "false"]).optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError13({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    const updateData = {};
    if (input.name !== void 0) updateData.name = input.name;
    if (input.startTime !== void 0) updateData.startTime = input.startTime;
    if (input.endTime !== void 0) updateData.endTime = input.endTime;
    if (input.durationMinutes !== void 0) updateData.durationMinutes = input.durationMinutes;
    if (input.isActive !== void 0) updateData.isActive = input.isActive;
    await db.update(schema_exports.breakTimes).set(updateData).where(eq11(schema_exports.breakTimes.id, input.id));
    return { success: true };
  }),
  // 休憩時間を削除（管理者専用）
  delete: adminProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError13({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    try {
      const [breakTime] = await db.select().from(schema_exports.breakTimes).where(eq11(schema_exports.breakTimes.id, input.id)).limit(1);
      if (!breakTime) {
        throw new TRPCError13({
          code: "NOT_FOUND",
          message: "\u4F11\u61A9\u6642\u9593\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
        });
      }
      await db.delete(schema_exports.breakTimes).where(eq11(schema_exports.breakTimes.id, input.id));
      return { success: true };
    } catch (error) {
      console.error("[breakTimes.delete] \u30A8\u30E9\u30FC:", error);
      if (error instanceof TRPCError13) {
        throw error;
      }
      if (error?.code === "ER_ROW_IS_REFERENCED_2" || error?.code === "23000") {
        throw new TRPCError13({
          code: "INTERNAL_SERVER_ERROR",
          message: "\u3053\u306E\u4F11\u61A9\u6642\u9593\u306F\u4ED6\u306E\u30C7\u30FC\u30BF\u3067\u4F7F\u7528\u3055\u308C\u3066\u3044\u308B\u305F\u3081\u524A\u9664\u3067\u304D\u307E\u305B\u3093"
        });
      }
      throw new TRPCError13({
        code: "INTERNAL_SERVER_ERROR",
        message: `\u4F11\u61A9\u6642\u9593\u306E\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error?.message || String(error)}`
      });
    }
  })
});

// server/routers/staffSchedule.ts
init_trpc();
init_db();
import { TRPCError as TRPCError14 } from "@trpc/server";
import { z as z14 } from "zod";
import { eq as eq12, and as and7, gte as gte3, lte as lte3, sql as sql4 } from "drizzle-orm";
import { startOfDay as startOfDay3, endOfDay as endOfDay3, format as format2, eachDayOfInterval as eachDayOfInterval2, getDay } from "date-fns";
var FIXED_STAFF_NAMES = Array.from({ length: 20 }, (_, i) => `\u30B9\u30BF\u30C3\u30D5${i + 1}`);
function getMonthPeriod21st2(date2) {
  const year = date2.getFullYear();
  const month = date2.getMonth();
  const day = date2.getDate();
  let startDate;
  let endDate;
  if (day >= 21) {
    startDate = new Date(year, month, 21);
    endDate = new Date(year, month + 1, 20);
  } else {
    startDate = new Date(year, month - 1, 21);
    endDate = new Date(year, month, 20);
  }
  return {
    start: startOfDay3(startDate),
    end: endOfDay3(endDate)
  };
}
async function getScheduleQuery(db, baseDateStr) {
  try {
    try {
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffScheduleEntries\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`userId\` int NOT NULL,
                        \`scheduleDate\` date NOT NULL,
                        \`status\` enum('work','rest','request','exhibition','other','morning','afternoon','business_trip','exhibition_duty','paid_leave','delivery','payment_date') DEFAULT 'work' NOT NULL,
                        \`comment\` varchar(100),
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                    )`);
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffScheduleDisplayOrder\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`userId\` int NOT NULL UNIQUE,
                        \`displayOrder\` int NOT NULL,
                        \`displayName\` varchar(100),
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                    )`);
      try {
        await db.execute(sql4`ALTER TABLE \`staffScheduleDisplayOrder\` ADD COLUMN \`displayName\` varchar(100)`);
      } catch (error) {
        if (!error?.message?.includes("Duplicate column") && !error?.message?.includes("already exists")) {
        }
      }
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffScheduleEditLogs\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`userId\` int NOT NULL,
                        \`editorId\` int NOT NULL,
                        \`fieldName\` varchar(50) NOT NULL,
                        \`oldValue\` text,
                        \`newValue\` text,
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
            )`);
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffScheduleAdjustments\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`userId\` int NOT NULL,
                        \`periodStart\` date NOT NULL,
                        \`periodEnd\` date NOT NULL,
                        \`adjustment\` int NOT NULL DEFAULT 0,
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
            )`);
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffScheduleStatusColors\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`status\` varchar(50) NOT NULL UNIQUE,
                        \`colorClass\` varchar(100) NOT NULL,
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
            )`);
    } catch (error) {
      if (!error?.message?.includes("already exists")) {
        console.warn("[staffSchedule] \u30C6\u30FC\u30D6\u30EB\u4F5C\u6210\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error?.message);
      }
    }
    const baseDate = baseDateStr ? new Date(baseDateStr) : /* @__PURE__ */ new Date();
    const { start, end } = getMonthPeriod21st2(baseDate);
    let displayOrders = [];
    try {
      displayOrders = await db.select().from(schema_exports.staffScheduleDisplayOrder);
    } catch (error) {
      const errorMessage = error?.message || "";
      const errorCode = error?.code || error?.errno || "";
      const errorString = String(errorMessage) + String(errorCode);
      if (errorCode === "ER_NO_SUCH_TABLE" || errorCode === 1146 || errorString.includes("doesn't exist") || errorString.includes("Unknown table") || errorString.includes("Table") && errorString.includes("doesn't exist") || errorMessage.includes("staffScheduleDisplayOrder")) {
        console.warn("[staffSchedule] \u8868\u793A\u9806\u5E8F\u30C6\u30FC\u30D6\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093\u3002\u30DE\u30A4\u30B0\u30EC\u30FC\u30B7\u30E7\u30F3\u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        displayOrders = [];
      } else {
        console.error("[staffSchedule] \u8868\u793A\u9806\u5E8F\u53D6\u5F97\u30A8\u30E9\u30FC:", error);
        throw error;
      }
    }
    if (displayOrders.length === 0) {
      const defaultStaff = FIXED_STAFF_NAMES.map((name, index) => ({
        userId: index + 1,
        displayOrder: index + 1,
        displayName: name
      }));
      await db.insert(schema_exports.staffScheduleDisplayOrder).values(defaultStaff);
      displayOrders = await db.select().from(schema_exports.staffScheduleDisplayOrder);
    } else {
      const existingIds = new Set(displayOrders.map((o) => o.userId));
      const inserts = [];
      for (let i = 0; i < FIXED_STAFF_NAMES.length; i++) {
        const userId = i + 1;
        if (!existingIds.has(userId)) {
          inserts.push({
            userId,
            displayOrder: userId,
            displayName: FIXED_STAFF_NAMES[i]
          });
        }
      }
      if (inserts.length > 0) {
        await db.insert(schema_exports.staffScheduleDisplayOrder).values(inserts);
        displayOrders = await db.select().from(schema_exports.staffScheduleDisplayOrder);
      }
    }
    const displayOrderMap = new Map(displayOrders.map((o) => [o.userId, o.displayOrder]));
    const displayNameMap = new Map(displayOrders.map((o) => [o.userId, o.displayName]));
    const staffList = displayOrders.map((o) => ({
      id: o.userId,
      name: o.displayName || `\u30B9\u30BF\u30C3\u30D5${o.userId}`,
      displayOrder: o.displayOrder
    }));
    const limitedUsers = [...staffList].sort((a, b) => (a.displayOrder ?? a.id) - (b.displayOrder ?? b.id)).slice(0, 20);
    let entries = [];
    try {
      const startStr = format2(start, "yyyy-MM-dd");
      const endStr = format2(end, "yyyy-MM-dd");
      entries = await db.select().from(schema_exports.staffScheduleEntries).where(
        and7(
          gte3(schema_exports.staffScheduleEntries.scheduleDate, startStr),
          lte3(schema_exports.staffScheduleEntries.scheduleDate, endStr)
        )
      );
    } catch (error) {
      const errorMessage = error?.message || "";
      const errorCode = error?.code || error?.errno || "";
      const errorString = String(errorMessage) + String(errorCode);
      if (errorCode === "ER_NO_SUCH_TABLE" || errorCode === 1146 || errorString.includes("doesn't exist") || errorString.includes("Unknown table") || errorString.includes("Table") && errorString.includes("doesn't exist") || errorMessage.includes("staffScheduleEntries")) {
        console.warn("[staffSchedule] \u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u30A8\u30F3\u30C8\u30EA\u30C6\u30FC\u30D6\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093\u3002\u30DE\u30A4\u30B0\u30EC\u30FC\u30B7\u30E7\u30F3\u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        entries = [];
      } else {
        console.error("[staffSchedule] \u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u30A8\u30F3\u30C8\u30EA\u53D6\u5F97\u30A8\u30E9\u30FC:", error);
        throw error;
      }
    }
    const entryMap = /* @__PURE__ */ new Map();
    entries.forEach((entry) => {
      const dateStr = typeof entry.scheduleDate === "string" ? entry.scheduleDate : format2(new Date(entry.scheduleDate), "yyyy-MM-dd");
      const key = `${entry.userId}_${dateStr}`;
      entryMap.set(key, entry);
    });
    const allDates = eachDayOfInterval2({ start, end });
    const scheduleData = allDates.map((date2) => {
      const dateStr = format2(date2, "yyyy-MM-dd");
      const dayOfWeek = getDay(date2);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const userEntries = limitedUsers.map((user) => {
        const key = `${user.id}_${dateStr}`;
        const entry = entryMap.get(key);
        const defaultStatus = isWeekend ? "rest" : "work";
        const displayName = displayNameMap.get(user.id) || user.name || "\u4E0D\u660E";
        return {
          userId: user.id,
          userName: displayName,
          status: entry?.status || defaultStatus,
          comment: entry?.comment || null
        };
      });
      return {
        date: dateStr,
        dateObj: date2,
        dayOfWeek,
        isWeekend,
        userEntries
      };
    });
    const adjustmentMap = /* @__PURE__ */ new Map();
    try {
      const periodStartStr = format2(start, "yyyy-MM-dd");
      const periodEndStr = format2(end, "yyyy-MM-dd");
      const [rows] = await db.execute(
        sql4`SELECT \`userId\`, \`periodStart\`, \`periodEnd\`, \`adjustment\` FROM \`staffScheduleAdjustments\` WHERE \`periodStart\` = ${periodStartStr} AND \`periodEnd\` = ${periodEndStr}`
      );
      for (const row of rows || []) {
        const value = typeof row.adjustment === "number" ? row.adjustment : 0;
        adjustmentMap.set(row.userId, value);
      }
    } catch (error) {
      const msg = error?.message || "";
      if (!msg.includes("staffScheduleAdjustments")) {
        console.warn("[staffSchedule] \u8ABF\u6574\u4F11\u30C6\u30FC\u30D6\u30EB\u53D6\u5F97\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", msg);
      }
    }
    const summary = limitedUsers.map((user) => {
      const userEntries = entries.filter((e) => e.userId === user.id);
      const userEntryDates = new Set(
        userEntries.map((e) => {
          const dateStr = typeof e.scheduleDate === "string" ? e.scheduleDate : format2(new Date(e.scheduleDate), "yyyy-MM-dd");
          return dateStr;
        })
      );
      let workDays = 0;
      let restDays = 0;
      let requestDays = 0;
      let exhibitionDays = 0;
      let otherDays = 0;
      let businessTripDays = 0;
      allDates.forEach((date2) => {
        const dateStr = format2(date2, "yyyy-MM-dd");
        const dayOfWeek = getDay(date2);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (userEntryDates.has(dateStr)) {
          const entry = userEntries.find((e) => {
            const entryDateStr = typeof e.scheduleDate === "string" ? e.scheduleDate : format2(new Date(e.scheduleDate), "yyyy-MM-dd");
            return entryDateStr === dateStr;
          });
          if (entry) {
            if (entry.status === "work") workDays++;
            else if (entry.status === "rest") restDays++;
            else if (entry.status === "request") requestDays++;
            else if (entry.status === "exhibition") exhibitionDays++;
            else if (entry.status === "other") otherDays++;
            else if (entry.status === "morning") workDays += 0.5;
            else if (entry.status === "afternoon") workDays += 0.5;
            else if (entry.status === "business_trip") businessTripDays++;
          }
        } else {
          if (isWeekend) {
            restDays++;
          } else {
            workDays++;
          }
        }
      });
      const publicHolidays = allDates.filter((d) => {
        const dayOfWeek = getDay(d);
        return dayOfWeek === 0 || dayOfWeek === 6;
      }).length;
      const paidLeave = restDays + requestDays;
      const adjustment = adjustmentMap.get(user.id) ?? 0;
      const totalRest = publicHolidays + paidLeave;
      const actualRestDays = restDays;
      const displayName = displayNameMap.get(user.id) || user.name || "\u4E0D\u660E";
      return {
        userId: user.id,
        userName: displayName,
        workDays: Number(workDays.toFixed(1)),
        // 小数点第1位まで表示（0.5を含む）
        restDays: actualRestDays,
        // 実際に休みとして登録された日数
        publicHolidays,
        paidLeave,
        totalRest,
        adjustment,
        businessTripDays
        // 出張の日数
      };
    });
    return {
      period: {
        start: format2(start, "yyyy-MM-dd"),
        end: format2(end, "yyyy-MM-dd")
      },
      scheduleData,
      summary,
      users: limitedUsers.map((u) => ({
        id: u.id,
        name: displayNameMap.get(u.id) || u.name || "\u4E0D\u660E",
        displayOrder: displayOrderMap.get(u.id) ?? u.id
      }))
    };
  } catch (error) {
    console.error("[staffSchedule] getScheduleQuery \u30A8\u30E9\u30FC:", error);
    throw new TRPCError14({
      code: "INTERNAL_SERVER_ERROR",
      message: error?.message || "\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
      cause: error
    });
  }
}
var staffScheduleRouter = createTRPCRouter({
  // スケジュールを取得（閲覧用：一般・準管理者・管理者）
  getSchedule: protectedProcedure.input(
    z14.object({
      baseDate: z14.string().optional()
      // 基準日（YYYY-MM-DD形式、省略時は今日）
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    return await getScheduleQuery(db, input.baseDate);
  }),
  // スケジュールエントリを更新（管理者のみ）
  updateSchedule: subAdminProcedure.input(
    z14.object({
      userId: z14.number(),
      date: z14.string(),
      // YYYY-MM-DD形式
      status: z14.enum(["work", "rest", "request", "exhibition", "other", "morning", "afternoon", "business_trip", "exhibition_duty", "paid_leave", "delivery", "payment_date"]),
      comment: z14.string().optional().nullable()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    try {
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffScheduleEntries\` (
                    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    \`userId\` int NOT NULL,
                    \`scheduleDate\` date NOT NULL,
                    \`status\` enum('work','rest','request','exhibition','other','morning','afternoon') DEFAULT 'work' NOT NULL,
                    \`comment\` varchar(100),
                    \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                )`);
    } catch (error) {
      if (!error?.message?.includes("already exists")) {
        console.warn("[staffSchedule] \u30C6\u30FC\u30D6\u30EB\u4F5C\u6210\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error?.message);
      }
    }
    let dateStr;
    if (typeof input.date === "string") {
      dateStr = input.date.includes("T") ? input.date.split("T")[0] : input.date;
    } else if (input.date instanceof Date) {
      dateStr = format2(input.date, "yyyy-MM-dd");
    } else {
      const dateStrRaw = String(input.date);
      dateStr = dateStrRaw.includes("T") ? dateStrRaw.split("T")[0] : dateStrRaw;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      try {
        const parsedDate = new Date(input.date);
        if (!isNaN(parsedDate.getTime())) {
          dateStr = format2(parsedDate, "yyyy-MM-dd");
        } else {
          throw new TRPCError14({
            code: "BAD_REQUEST",
            message: `\u7121\u52B9\u306A\u65E5\u4ED8\u5F62\u5F0F\u3067\u3059: ${input.date}`
          });
        }
      } catch (error) {
        throw new TRPCError14({
          code: "BAD_REQUEST",
          message: `\u7121\u52B9\u306A\u65E5\u4ED8\u5F62\u5F0F\u3067\u3059: ${input.date}`
        });
      }
    }
    let existing = [];
    try {
      existing = await db.select().from(schema_exports.staffScheduleEntries).where(
        and7(
          eq12(schema_exports.staffScheduleEntries.userId, input.userId),
          sql4`CAST(${schema_exports.staffScheduleEntries.scheduleDate} AS CHAR) = ${dateStr}`
        )
      ).limit(1);
    } catch (error) {
      const errorMessage = error?.message || "";
      if (errorMessage.includes("staffScheduleEntries") || errorMessage.includes("doesn't exist")) {
        console.warn("[staffSchedule] \u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u30A8\u30F3\u30C8\u30EA\u30C6\u30FC\u30D6\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093\u3002");
        existing = [];
      } else {
        throw error;
      }
    }
    if (existing.length > 0) {
      const commentValue = input.comment && input.comment.trim() !== "" ? input.comment.trim() : null;
      await db.update(schema_exports.staffScheduleEntries).set({
        status: input.status,
        comment: commentValue
      }).where(eq12(schema_exports.staffScheduleEntries.id, existing[0].id));
    } else {
      try {
        const dateRegex2 = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex2.test(dateStr)) {
          throw new TRPCError14({
            code: "BAD_REQUEST",
            message: `\u7121\u52B9\u306A\u65E5\u4ED8\u5F62\u5F0F\u3067\u3059: ${dateStr}`
          });
        }
        const commentValue = input.comment && input.comment.trim() !== "" ? input.comment.trim() : null;
        await db.execute(
          sql4`INSERT INTO \`staffScheduleEntries\` (\`userId\`, \`scheduleDate\`, \`status\`, \`comment\`) VALUES (${input.userId}, ${dateStr}, ${input.status}, ${commentValue})`
        );
      } catch (error) {
        console.error("[staffSchedule] INSERT\u30A8\u30E9\u30FC:", error);
        console.error("[staffSchedule] \u30A8\u30E9\u30FC\u8A73\u7D30:", JSON.stringify(error, null, 2));
        console.error("[staffSchedule] \u30A8\u30E9\u30FC\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u5168\u4F53:", error);
        console.error("[staffSchedule] \u30A8\u30E9\u30FC\u306E\u578B:", typeof error);
        console.error("[staffSchedule] \u30A8\u30E9\u30FC\u306E\u30D7\u30ED\u30D1\u30C6\u30A3:", Object.keys(error || {}));
        console.error("[staffSchedule] \u65E5\u4ED8\u6587\u5B57\u5217:", dateStr);
        console.error("[staffSchedule] \u5165\u529B\u30C7\u30FC\u30BF:", input);
        const errorMessage = error?.message || error?.toString() || "\u4E0D\u660E\u306A\u30A8\u30E9\u30FC";
        const errorCode = error?.code || error?.errno || "";
        const sqlMessage = error?.sqlMessage || "";
        const sqlState = error?.sqlState || "";
        const sqlCode = error?.sqlCode || "";
        const cause = error?.cause;
        const causeMessage = cause?.message || "";
        const causeCode = cause?.code || cause?.errno || "";
        const causeSqlMessage = cause?.sqlMessage || "";
        const causeSqlState = cause?.sqlState || "";
        const fullErrorMessage = `\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u306E\u767B\u9332\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${errorMessage}${causeMessage ? ` (\u539F\u56E0: ${causeMessage})` : ""} (\u30B3\u30FC\u30C9: ${errorCode || causeCode}, SQL: ${sqlMessage || causeSqlMessage}, SQL\u72B6\u614B: ${sqlState || causeSqlState}, SQL\u30B3\u30FC\u30C9: ${sqlCode})`;
        console.error("[staffSchedule] \u5B8C\u5168\u306A\u30A8\u30E9\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8:", fullErrorMessage);
        throw new TRPCError14({
          code: "INTERNAL_SERVER_ERROR",
          message: fullErrorMessage
        });
      }
    }
    return { success: true };
  }),
  // 複数のスケジュールエントリを一括更新（管理者のみ）
  bulkUpdateSchedule: subAdminProcedure.input(
    z14.object({
      updates: z14.array(
        z14.object({
          userId: z14.number(),
          date: z14.string(),
          status: z14.enum(["work", "rest", "request", "exhibition", "other", "morning", "afternoon", "business_trip", "exhibition_duty", "paid_leave", "delivery", "payment_date"]),
          comment: z14.string().optional().nullable()
        })
      )
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    for (const update of input.updates) {
      let dateStr;
      if (typeof update.date === "string") {
        dateStr = update.date.includes("T") ? update.date.split("T")[0] : update.date;
      } else if (update.date instanceof Date) {
        dateStr = format2(update.date, "yyyy-MM-dd");
      } else {
        const dateStrRaw = String(update.date);
        dateStr = dateStrRaw.includes("T") ? dateStrRaw.split("T")[0] : dateStrRaw;
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        try {
          const parsedDate = new Date(update.date);
          if (!isNaN(parsedDate.getTime())) {
            dateStr = format2(parsedDate, "yyyy-MM-dd");
          } else {
            throw new TRPCError14({
              code: "BAD_REQUEST",
              message: `\u7121\u52B9\u306A\u65E5\u4ED8\u5F62\u5F0F\u3067\u3059: ${update.date}`
            });
          }
        } catch (error) {
          throw new TRPCError14({
            code: "BAD_REQUEST",
            message: `\u7121\u52B9\u306A\u65E5\u4ED8\u5F62\u5F0F\u3067\u3059: ${update.date}`
          });
        }
      }
      let existing = [];
      try {
        existing = await db.select().from(schema_exports.staffScheduleEntries).where(
          and7(
            eq12(schema_exports.staffScheduleEntries.userId, update.userId),
            sql4`CAST(${schema_exports.staffScheduleEntries.scheduleDate} AS CHAR) = ${dateStr}`
          )
        ).limit(1);
      } catch (error) {
        const errorMessage = error?.message || "";
        if (errorMessage.includes("staffScheduleEntries") || errorMessage.includes("doesn't exist")) {
          console.warn("[staffSchedule] \u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u30A8\u30F3\u30C8\u30EA\u30C6\u30FC\u30D6\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093\u3002");
          existing = [];
        } else {
          throw error;
        }
      }
      if (existing.length > 0) {
        const commentValue = update.comment && update.comment.trim() !== "" ? update.comment.trim() : null;
        await db.update(schema_exports.staffScheduleEntries).set({
          status: update.status,
          comment: commentValue
        }).where(eq12(schema_exports.staffScheduleEntries.id, existing[0].id));
      } else {
        try {
          const dateRegex2 = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex2.test(dateStr)) {
            throw new TRPCError14({
              code: "BAD_REQUEST",
              message: `\u7121\u52B9\u306A\u65E5\u4ED8\u5F62\u5F0F\u3067\u3059: ${dateStr}`
            });
          }
          const commentValue = update.comment && update.comment.trim() !== "" ? update.comment.trim() : null;
          await db.execute(
            sql4`INSERT INTO \`staffScheduleEntries\` (\`userId\`, \`scheduleDate\`, \`status\`, \`comment\`) VALUES (${update.userId}, ${dateStr}, ${update.status}, ${commentValue})`
          );
        } catch (error) {
          console.error("[staffSchedule] INSERT\u30A8\u30E9\u30FC:", error);
          console.error("[staffSchedule] \u30A8\u30E9\u30FC\u8A73\u7D30:", JSON.stringify(error, null, 2));
          console.error("[staffSchedule] \u30A8\u30E9\u30FC\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u5168\u4F53:", error);
          console.error("[staffSchedule] \u30A8\u30E9\u30FC\u306E\u578B:", typeof error);
          console.error("[staffSchedule] \u30A8\u30E9\u30FC\u306E\u30D7\u30ED\u30D1\u30C6\u30A3:", Object.keys(error || {}));
          console.error("[staffSchedule] \u65E5\u4ED8\u6587\u5B57\u5217:", dateStr);
          console.error("[staffSchedule] \u5165\u529B\u30C7\u30FC\u30BF:", update);
          const errorMessage = error?.message || error?.toString() || "\u4E0D\u660E\u306A\u30A8\u30E9\u30FC";
          const errorCode = error?.code || error?.errno || "";
          const sqlMessage = error?.sqlMessage || "";
          const sqlState = error?.sqlState || "";
          const sqlCode = error?.sqlCode || "";
          const cause = error?.cause;
          const causeMessage = cause?.message || "";
          const causeCode = cause?.code || cause?.errno || "";
          const causeSqlMessage = cause?.sqlMessage || "";
          const causeSqlState = cause?.sqlState || "";
          const fullErrorMessage = `\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u306E\u767B\u9332\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${errorMessage}${causeMessage ? ` (\u539F\u56E0: ${causeMessage})` : ""} (\u30B3\u30FC\u30C9: ${errorCode || causeCode}, SQL: ${sqlMessage || causeSqlMessage}, SQL\u72B6\u614B: ${sqlState || causeSqlState}, SQL\u30B3\u30FC\u30C9: ${sqlCode})`;
          console.error("[staffSchedule] \u5B8C\u5168\u306A\u30A8\u30E9\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8:", fullErrorMessage);
          throw new TRPCError14({
            code: "INTERNAL_SERVER_ERROR",
            message: fullErrorMessage
          });
        }
      }
    }
    return { success: true };
  }),
  // スタッフの表示順序を更新（管理者のみ）
  updateDisplayOrder: subAdminProcedure.input(
    z14.object({
      userId: z14.number(),
      displayOrder: z14.number()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    const existing = await db.select().from(schema_exports.staffScheduleDisplayOrder).where(eq12(schema_exports.staffScheduleDisplayOrder.userId, input.userId)).limit(1);
    const oldValue = existing.length > 0 ? existing[0].displayOrder.toString() : null;
    if (existing.length > 0) {
      await db.update(schema_exports.staffScheduleDisplayOrder).set({ displayOrder: input.displayOrder }).where(eq12(schema_exports.staffScheduleDisplayOrder.userId, input.userId));
    } else {
      await db.insert(schema_exports.staffScheduleDisplayOrder).values({
        userId: input.userId,
        displayOrder: input.displayOrder
      });
    }
    await db.insert(schema_exports.staffScheduleEditLogs).values({
      userId: input.userId,
      editorId: ctx.user.id,
      fieldName: "displayOrder",
      oldValue,
      newValue: input.displayOrder.toString()
    });
    return { success: true };
  }),
  // スタッフの表示名を更新（管理者のみ）
  updateDisplayName: subAdminProcedure.input(
    z14.object({
      userId: z14.number(),
      displayName: z14.string()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    const existing = await db.select().from(schema_exports.staffScheduleDisplayOrder).where(eq12(schema_exports.staffScheduleDisplayOrder.userId, input.userId)).limit(1);
    if (existing.length > 0) {
      await db.update(schema_exports.staffScheduleDisplayOrder).set({ displayName: input.displayName }).where(eq12(schema_exports.staffScheduleDisplayOrder.userId, input.userId));
    } else {
      await db.insert(schema_exports.staffScheduleDisplayOrder).values({
        userId: input.userId,
        displayOrder: input.userId,
        displayName: input.displayName
      });
    }
    return { success: true };
  }),
  // スタッフ名変更の履歴を取得（管理者のみ）
  getEditLogs: subAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    let logs = [];
    try {
      logs = await db.select().from(schema_exports.staffScheduleEditLogs).orderBy(schema_exports.staffScheduleEditLogs.createdAt);
    } catch (error) {
      const errorMessage = error?.message || "";
      const errorCode = error?.code || error?.errno || "";
      const errorString = String(errorMessage) + String(errorCode);
      if (errorCode === "ER_NO_SUCH_TABLE" || errorCode === 1146 || errorString.includes("doesn't exist") || errorString.includes("Unknown table") || errorMessage.includes("staffScheduleEditLogs")) {
        console.warn("[staffSchedule] \u7DE8\u96C6\u5C65\u6B74\u30C6\u30FC\u30D6\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093\u3002\u30DE\u30A4\u30B0\u30EC\u30FC\u30B7\u30E7\u30F3\u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        return [];
      } else {
        throw error;
      }
    }
    let users2 = [];
    try {
      users2 = await db.select({
        id: schema_exports.users.id,
        username: schema_exports.users.username,
        name: schema_exports.users.name,
        role: schema_exports.users.role,
        category: schema_exports.users.category
      }).from(schema_exports.users);
    } catch (error) {
      if (error?.message?.includes("category") || error?.message?.includes("name") || error?.code === "ER_BAD_FIELD_ERROR") {
        try {
          users2 = await db.select({
            id: schema_exports.users.id,
            username: schema_exports.users.username,
            role: schema_exports.users.role
          }).from(schema_exports.users);
          users2 = users2.map((u) => ({ ...u, name: null, category: null }));
        } catch (innerError) {
          console.warn("[staffSchedule] \u30E6\u30FC\u30B6\u30FC\u60C5\u5831\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", innerError);
          users2 = [];
        }
      } else {
        throw error;
      }
    }
    const userMap = new Map(users2.map((u) => [u.id, u]));
    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: userMap.get(log.userId)?.name || userMap.get(log.userId)?.username || "\u4E0D\u660E",
      editorId: log.editorId,
      editorName: userMap.get(log.editorId)?.name || userMap.get(log.editorId)?.username || "\u4E0D\u660E",
      fieldName: log.fieldName,
      oldValue: log.oldValue,
      newValue: log.newValue,
      createdAt: log.createdAt
    }));
  }),
  // スケジュールを公開（管理者のみ）
  publishSchedule: subAdminProcedure.input(
    z14.object({
      periodStart: z14.string(),
      // YYYY-MM-DD形式
      periodEnd: z14.string()
      // YYYY-MM-DD形式
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    try {
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffSchedulePublished\` (
                    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    \`periodStart\` date NOT NULL,
                    \`periodEnd\` date NOT NULL,
                    \`isPublished\` enum('true','false') DEFAULT 'false' NOT NULL,
                    \`publishedAt\` timestamp,
                    \`publishedBy\` int,
                    \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                )`);
    } catch (error) {
      if (!error?.message?.includes("already exists")) {
        console.warn("[staffSchedule] \u516C\u958B\u30C6\u30FC\u30D6\u30EB\u4F5C\u6210\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error?.message);
      }
    }
    const existing = await db.select().from(schema_exports.staffSchedulePublished).where(
      and7(
        sql4`CAST(${schema_exports.staffSchedulePublished.periodStart} AS CHAR) = ${input.periodStart}`,
        sql4`CAST(${schema_exports.staffSchedulePublished.periodEnd} AS CHAR) = ${input.periodEnd}`
      )
    ).limit(1);
    if (existing.length > 0) {
      await db.update(schema_exports.staffSchedulePublished).set({
        isPublished: "true",
        publishedAt: /* @__PURE__ */ new Date(),
        publishedBy: ctx.user.id
      }).where(eq12(schema_exports.staffSchedulePublished.id, existing[0].id));
    } else {
      await db.execute(
        sql4`INSERT INTO \`staffSchedulePublished\` (\`periodStart\`, \`periodEnd\`, \`isPublished\`, \`publishedAt\`, \`publishedBy\`) VALUES (${input.periodStart}, ${input.periodEnd}, 'true', NOW(), ${ctx.user.id})`
      );
    }
    return { success: true };
  }),
  // スケジュールを非公開にする（管理者のみ）
  unpublishSchedule: subAdminProcedure.input(
    z14.object({
      periodStart: z14.string(),
      // YYYY-MM-DD形式
      periodEnd: z14.string()
      // YYYY-MM-DD形式
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    try {
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffSchedulePublished\` (
                    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    \`periodStart\` date NOT NULL,
                    \`periodEnd\` date NOT NULL,
                    \`isPublished\` enum('true','false') DEFAULT 'false' NOT NULL,
                    \`publishedAt\` timestamp,
                    \`publishedBy\` int,
                    \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                )`);
    } catch (error) {
      if (!error?.message?.includes("already exists")) {
        console.warn("[staffSchedule] \u516C\u958B\u30C6\u30FC\u30D6\u30EB\u4F5C\u6210\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error?.message);
      }
    }
    const existing = await db.select().from(schema_exports.staffSchedulePublished).where(
      and7(
        sql4`CAST(${schema_exports.staffSchedulePublished.periodStart} AS CHAR) = ${input.periodStart}`,
        sql4`CAST(${schema_exports.staffSchedulePublished.periodEnd} AS CHAR) = ${input.periodEnd}`
      )
    ).limit(1);
    if (existing.length > 0) {
      await db.update(schema_exports.staffSchedulePublished).set({
        isPublished: "false",
        publishedAt: null,
        publishedBy: ctx.user.id
      }).where(eq12(schema_exports.staffSchedulePublished.id, existing[0].id));
    } else {
      await db.execute(
        sql4`INSERT INTO \`staffSchedulePublished\` (\`periodStart\`, \`periodEnd\`, \`isPublished\`, \`publishedAt\`, \`publishedBy\`) VALUES (${input.periodStart}, ${input.periodEnd}, 'false', NULL, ${ctx.user.id})`
      );
    }
    return { success: true };
  }),
  // 公開されたスケジュールを取得（一般ユーザー用）
  getPublishedSchedule: protectedProcedure.input(
    z14.object({
      baseDate: z14.string().optional()
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    let publishedPeriods = [];
    try {
      publishedPeriods = await db.select().from(schema_exports.staffSchedulePublished).where(eq12(schema_exports.staffSchedulePublished.isPublished, "true"));
    } catch (error) {
      if (error?.message?.includes("staffSchedulePublished") || error?.message?.includes("doesn't exist")) {
        return null;
      }
      throw error;
    }
    if (publishedPeriods.length === 0) {
      return null;
    }
    const latestPublished = publishedPeriods.sort((a, b) => {
      const dateA = new Date(a.periodStart);
      const dateB = new Date(b.periodStart);
      return dateB.getTime() - dateA.getTime();
    })[0];
    return await getScheduleQuery(db, latestPublished.periodStart);
  }),
  // 調整休を更新（管理者のみ）
  updateAdjustment: subAdminProcedure.input(
    z14.object({
      userId: z14.number(),
      periodStart: z14.string(),
      // YYYY-MM-DD
      periodEnd: z14.string(),
      // YYYY-MM-DD
      adjustment: z14.number()
      // マイナスも許可
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    try {
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffScheduleAdjustments\` (
                    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    \`userId\` int NOT NULL,
                    \`periodStart\` date NOT NULL,
                    \`periodEnd\` date NOT NULL,
                    \`adjustment\` int NOT NULL DEFAULT 0,
                    \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
                )`);
      await db.execute(sql4`CREATE TABLE IF NOT EXISTS \`staffScheduleStatusColors\` (
                        \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
                        \`status\` varchar(50) NOT NULL UNIQUE,
                        \`colorClass\` varchar(100) NOT NULL,
                        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
            )`);
      const defaultColors = {
        work: "bg-blue-100",
        rest: "bg-pink-200",
        request: "bg-pink-300",
        exhibition: "bg-green-100",
        other: "bg-green-50",
        morning: "bg-yellow-100",
        afternoon: "bg-orange-100",
        business_trip: "bg-purple-100",
        exhibition_duty: "bg-cyan-100",
        paid_leave: "bg-red-100",
        delivery: "bg-indigo-100",
        payment_date: "bg-amber-100"
      };
      for (const [status, colorClass] of Object.entries(defaultColors)) {
        try {
          await db.execute(
            sql4`INSERT IGNORE INTO \`staffScheduleStatusColors\` (\`status\`, \`colorClass\`) VALUES (${status}, ${colorClass})`
          );
        } catch (error) {
        }
      }
    } catch (error) {
      if (!error?.message?.includes("already exists")) {
        console.warn("[staffSchedule] \u8ABF\u6574\u4F11\u30C6\u30FC\u30D6\u30EB\u4F5C\u6210\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", error?.message);
      }
    }
    const [rows] = await db.execute(
      sql4`SELECT \`id\`, \`adjustment\` FROM \`staffScheduleAdjustments\` WHERE \`userId\` = ${input.userId} AND \`periodStart\` = ${input.periodStart} AND \`periodEnd\` = ${input.periodEnd} LIMIT 1`
    );
    const existing = rows && rows[0] ? rows[0] : null;
    if (existing) {
      await db.execute(
        sql4`UPDATE \`staffScheduleAdjustments\` SET \`adjustment\` = ${input.adjustment} WHERE \`id\` = ${existing.id}`
      );
    } else {
      await db.execute(
        sql4`INSERT INTO \`staffScheduleAdjustments\` (\`userId\`, \`periodStart\`, \`periodEnd\`, \`adjustment\`) VALUES (${input.userId}, ${input.periodStart}, ${input.periodEnd}, ${input.adjustment})`
      );
    }
    try {
      await db.insert(schema_exports.staffScheduleEditLogs).values({
        userId: input.userId,
        editorId: ctx.user.id,
        fieldName: "adjustment",
        oldValue: null,
        newValue: input.adjustment.toString()
      });
    } catch {
    }
    return { success: true };
  }),
  // 期間内のスケジュールを初期状態（平日=出勤、土日=休み）に戻す（管理者のみ）
  resetScheduleToDefault: subAdminProcedure.input(
    z14.object({
      periodStart: z14.string(),
      // YYYY-MM-DD
      periodEnd: z14.string()
      // YYYY-MM-DD
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    try {
      await db.execute(
        sql4`DELETE FROM \`staffScheduleEntries\` WHERE \`scheduleDate\` BETWEEN ${input.periodStart} AND ${input.periodEnd}`
      );
    } catch (error) {
      const msg = error?.message || "";
      if (!msg.includes("staffScheduleEntries")) {
        console.error("[staffSchedule] resetScheduleToDefault \u30A8\u30E9\u30FC:", msg);
        throw new TRPCError14({
          code: "INTERNAL_SERVER_ERROR",
          message: msg || "\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
        });
      }
    }
    try {
      await db.execute(
        sql4`DELETE FROM \`staffScheduleAdjustments\` WHERE \`periodStart\` = ${input.periodStart} AND \`periodEnd\` = ${input.periodEnd}`
      );
    } catch (error) {
      const msg = error?.message || "";
      if (!msg.includes("staffScheduleAdjustments")) {
        console.warn("[staffSchedule] \u8ABF\u6574\u4F11\u30EA\u30BB\u30C3\u30C8\u30A8\u30E9\u30FC\uFF08\u7121\u8996\uFF09:", msg);
      }
    }
    return { success: true };
  }),
  // ステータス色設定を取得
  getStatusColors: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    try {
      const pool = getPool();
      if (!pool) {
        throw new Error("\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u30D7\u30FC\u30EB\u304C\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093");
      }
      const [rows] = await pool.execute(
        sql4`SELECT \`status\`, \`colorClass\` FROM \`staffScheduleStatusColors\``
      );
      const colorMap = {};
      const defaultColors = {
        work: "bg-blue-100",
        rest: "bg-pink-200",
        request: "bg-pink-300",
        exhibition: "bg-green-100",
        other: "bg-green-50",
        morning: "bg-yellow-100",
        afternoon: "bg-orange-100",
        business_trip: "bg-purple-100",
        exhibition_duty: "bg-cyan-100",
        paid_leave: "bg-red-100",
        delivery: "bg-indigo-100",
        payment_date: "bg-amber-100"
      };
      if (Array.isArray(rows) && rows.length > 0) {
        for (const row of rows) {
          if (row.status && row.colorClass) {
            colorMap[row.status] = row.colorClass;
          }
        }
      }
      for (const [status, colorClass] of Object.entries(defaultColors)) {
        if (!colorMap[status]) {
          colorMap[status] = colorClass;
        }
      }
      return colorMap;
    } catch (error) {
      console.warn("[staffSchedule] \u8272\u8A2D\u5B9A\u53D6\u5F97\u30A8\u30E9\u30FC\uFF08\u30C7\u30D5\u30A9\u30EB\u30C8\u5024\u3092\u4F7F\u7528\uFF09:", error?.message);
      return {
        work: "bg-blue-100",
        rest: "bg-pink-200",
        request: "bg-pink-300",
        exhibition: "bg-green-100",
        other: "bg-green-50",
        morning: "bg-yellow-100",
        afternoon: "bg-orange-100",
        business_trip: "bg-purple-100",
        exhibition_duty: "bg-cyan-100",
        paid_leave: "bg-red-100",
        delivery: "bg-indigo-100",
        payment_date: "bg-amber-100"
      };
    }
  }),
  // ステータス色設定を更新（管理者のみ）
  updateStatusColor: adminProcedure.input(
    z14.object({
      status: z14.string(),
      colorClass: z14.string()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093" });
    }
    try {
      const pool = getPool();
      if (!pool) {
        throw new Error("\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u30D7\u30FC\u30EB\u304C\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093");
      }
      await pool.execute(
        sql4`INSERT INTO \`staffScheduleStatusColors\` (\`status\`, \`colorClass\`) 
                        VALUES (${input.status}, ${input.colorClass})
                        ON DUPLICATE KEY UPDATE \`colorClass\` = ${input.colorClass}, \`updatedAt\` = CURRENT_TIMESTAMP`
      );
      return { success: true };
    } catch (error) {
      console.error("[staffSchedule] \u8272\u8A2D\u5B9A\u66F4\u65B0\u30A8\u30E9\u30FC:", error?.message);
      throw new TRPCError14({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u8272\u8A2D\u5B9A\u306E\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
      });
    }
  })
});

// server/routers.ts
init_backup();

// server/routers/deliverySchedules.ts
init_trpc();
init_db();
import { TRPCError as TRPCError16 } from "@trpc/server";
import { z as z16 } from "zod";
import { eq as eq13, or, isNull as isNull3, desc as desc3, inArray as inArray3 } from "drizzle-orm";
import fs3 from "fs";
import path3 from "path";
import { nanoid as nanoid2 } from "nanoid";
function getMonthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}
function calcDelayDays(dueDate) {
  if (!dueDate) return 0;
  const today = /* @__PURE__ */ new Date();
  const d = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const t2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = t2.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}
async function ensureDeliverySchedulesTable(db) {
  try {
    await db.execute(
      `
            CREATE TABLE IF NOT EXISTS \`deliverySchedules\` (
              \`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
              \`vehicleName\` VARCHAR(255) NOT NULL,
              \`vehicleType\` VARCHAR(255),
              \`customerName\` VARCHAR(255),
              \`optionName\` VARCHAR(255),
              \`optionCategory\` VARCHAR(255),
              \`prefecture\` VARCHAR(100),
              \`baseCarReady\` ENUM('yes','no'),
              \`furnitureReady\` ENUM('yes','no'),
              \`inCharge\` VARCHAR(100),
              \`productionMonth\` VARCHAR(100),
              \`dueDate\` DATE,
              \`desiredIncomingPlannedDate\` DATE,
              \`incomingPlannedDate\` DATE,
              \`shippingPlannedDate\` DATE,
              \`deliveryPlannedDate\` DATE,
              \`comment\` TEXT,
              \`claimComment\` TEXT,
              \`photosJson\` TEXT,
              \`oemComment\` TEXT,
              \`status\` ENUM('katomo_stock','wg_storage','wg_production','wg_wait_pickup','katomo_picked_up','katomo_checked','completed') NOT NULL DEFAULT 'katomo_stock',
              \`completionStatus\` ENUM('ok','checked','revision_requested'),
              \`pickupConfirmed\` ENUM('true','false') NOT NULL DEFAULT 'false',
              \`incomingPlannedDateConfirmed\` ENUM('true','false') NOT NULL DEFAULT 'false',
              \`specSheetUrl\` TEXT,
              \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            `
    );
    const pool = getPool();
    if (pool) {
      const columnsToCheck = [
        { name: "status", type: "ENUM('katomo_stock','wg_storage','wg_production','wg_wait_pickup','katomo_picked_up','katomo_checked','completed') NOT NULL DEFAULT 'katomo_stock'", after: "oemComment" },
        { name: "productionMonth", type: "VARCHAR(100)", after: "inCharge" },
        { name: "desiredIncomingPlannedDate", type: "DATE", after: "dueDate" },
        { name: "completionStatus", type: "ENUM('ok','checked','revision_requested')", after: "status" },
        { name: "incomingPlannedDateConfirmed", type: "ENUM('true','false') NOT NULL DEFAULT 'false'", after: "pickupConfirmed" }
      ];
      for (const col of columnsToCheck) {
        try {
          const [columns] = await pool.execute(
            `SHOW COLUMNS FROM \`deliverySchedules\` LIKE '${col.name}'`
          );
          if (columns.length === 0) {
            await pool.execute(
              `ALTER TABLE \`deliverySchedules\` ADD COLUMN \`${col.name}\` ${col.type} AFTER \`${col.after}\``
            );
            console.log(`[deliverySchedules] Added ${col.name} column`);
          } else if (col.name === "status") {
            try {
              await pool.execute(
                `ALTER TABLE \`deliverySchedules\` MODIFY COLUMN \`status\` ${col.type}`
              );
              console.log(`[deliverySchedules] Updated ${col.name} ENUM values`);
            } catch (updateError) {
              console.log(`[deliverySchedules] ENUM update for ${col.name} may have been skipped:`, updateError?.message);
            }
          }
        } catch (alterError) {
          if (!alterError?.message?.includes("Duplicate column") && !alterError?.message?.includes("already exists")) {
            console.error(`[deliverySchedules] Failed to add ${col.name} column:`, alterError);
          }
        }
      }
    }
  } catch (e) {
    console.error("[deliverySchedules] ensureDeliverySchedulesTable failed:", e);
  }
}
var deliverySchedulesRouter = createTRPCRouter({
  // 公開（パスワードなし）用の一覧取得
  publicList: publicProcedure.input(
    z16.object({
      year: z16.number(),
      month: z16.number().min(1).max(12)
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureDeliverySchedulesTable(db);
    const { start, end } = getMonthRange(input.year, input.month);
    const startStr = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
    const endStr = `${input.year}-${String(input.month).padStart(2, "0")}-${new Date(input.year, input.month, 0).getDate()}`;
    try {
      console.log(`[deliverySchedules.publicList] Fetching records for ${input.year}-${input.month}`);
      let allRecords = [];
      try {
        const pool = getPool();
        if (pool) {
          const [tables] = await pool.execute(
            "SHOW TABLES LIKE 'deliverySchedules'"
          );
          if (tables.length === 0) {
            console.warn("[deliverySchedules.publicList] Table doesn't exist, returning empty array");
            return [];
          }
        }
        allRecords = await db.select().from(schema_exports.deliverySchedules);
        console.log(`[deliverySchedules.publicList] Fetched ${allRecords.length} total records`);
      } catch (selectError) {
        console.error("[deliverySchedules.publicList] Select error:", selectError);
        console.error("[deliverySchedules.publicList] Select error message:", selectError?.message);
        console.error("[deliverySchedules.publicList] Select error code:", selectError?.code);
        console.warn("[deliverySchedules.publicList] Error during select, returning empty array");
        return [];
      }
      const isDateInRange = (dateValue, startStr2, endStr2) => {
        if (!dateValue) return false;
        try {
          const date2 = dateValue instanceof Date ? dateValue : new Date(dateValue);
          if (isNaN(date2.getTime())) return false;
          const dateStr = `${date2.getFullYear()}-${String(date2.getMonth() + 1).padStart(2, "0")}-${String(date2.getDate()).padStart(2, "0")}`;
          return dateStr >= startStr2 && dateStr <= endStr2;
        } catch (e) {
          console.warn("[deliverySchedules.publicList] Date parsing error:", e, dateValue);
          return false;
        }
      };
      const records = allRecords.filter((r) => {
        try {
          if (r.status !== "completed" && r.status !== null) {
            return true;
          }
          if (r.deliveryPlannedDate && isDateInRange(r.deliveryPlannedDate, startStr, endStr)) {
            return true;
          }
          if ((!r.deliveryPlannedDate || r.deliveryPlannedDate === null) && r.dueDate && isDateInRange(r.dueDate, startStr, endStr)) {
            return true;
          }
          if ((!r.deliveryPlannedDate || r.deliveryPlannedDate === null) && (!r.dueDate || r.dueDate === null)) {
            return true;
          }
          const createdAt = r.createdAt ? new Date(r.createdAt) : null;
          if (createdAt && !isNaN(createdAt.getTime())) {
            const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1e3 * 60 * 60 * 24));
            if (daysSinceCreation <= 30) {
              return true;
            }
          }
          return false;
        } catch (e) {
          console.warn("[deliverySchedules.publicList] Filter error for record:", r.id, e);
          return true;
        }
      });
      console.log(`[deliverySchedules.publicList] Total records fetched: ${allRecords.length}`);
      console.log(`[deliverySchedules.publicList] Filtered to ${records.length} records`);
      console.log(`[deliverySchedules.publicList] Completed items: ${allRecords.filter((r) => r.status === "completed").length}`);
      console.log(`[deliverySchedules.publicList] Incomplete items: ${allRecords.filter((r) => r.status !== "completed").length}`);
      const finalRecords = records;
      console.log(`[deliverySchedules.publicList] Returning ${finalRecords.length} records`);
      return finalRecords.map((r) => {
        try {
          return {
            ...r,
            delayDays: calcDelayDays(r.dueDate)
          };
        } catch (e) {
          console.warn("[deliverySchedules.publicList] Mapping error for record:", r.id, e);
          return {
            ...r,
            delayDays: 0
          };
        }
      });
    } catch (error) {
      console.error("[deliverySchedules.publicList] Error:", error);
      console.error("[deliverySchedules.publicList] Error message:", error?.message);
      console.error("[deliverySchedules.publicList] Error stack:", error?.stack);
      console.warn("[deliverySchedules.publicList] Returning empty array due to error");
      return [];
    }
  }),
  // アプリ側（ログイン後）の一覧取得
  list: protectedProcedure.input(
    z16.object({
      year: z16.number(),
      month: z16.number().min(1).max(12)
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureDeliverySchedulesTable(db);
    const { start, end } = getMonthRange(input.year, input.month);
    const startStr = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
    const endStr = `${input.year}-${String(input.month).padStart(2, "0")}-${new Date(input.year, input.month, 0).getDate()}`;
    try {
      console.log(`[deliverySchedules.list] Fetching records for ${input.year}-${input.month}`);
      let allRecords = [];
      try {
        console.log("[deliverySchedules.list] Attempting to fetch records...");
        allRecords = await db.select().from(schema_exports.deliverySchedules);
        console.log(`[deliverySchedules.list] \u2705 Successfully fetched ${allRecords.length} total records`);
        if (allRecords.length > 0) {
          console.log("[deliverySchedules.list] First record sample:", JSON.stringify(allRecords[0], null, 2));
        }
      } catch (selectError) {
        console.error("[deliverySchedules.list] \u274C Select error:", selectError);
        console.error("[deliverySchedules.list] \u274C Select error message:", selectError?.message);
        console.error("[deliverySchedules.list] \u274C Select error code:", selectError?.code);
        console.error("[deliverySchedules.list] \u274C Select error stack:", selectError?.stack);
        try {
          console.log("[deliverySchedules.list] Attempting raw SQL query...");
          const pool = getPool();
          if (pool) {
            const [rows] = await pool.execute("SELECT * FROM deliverySchedules ORDER BY id DESC");
            allRecords = rows || [];
            console.log(`[deliverySchedules.list] \u2705 Raw SQL fetched ${allRecords.length} records`);
          }
        } catch (rawSqlError) {
          console.error("[deliverySchedules.list] \u274C Raw SQL error:", rawSqlError);
          return [];
        }
      }
      const isDateInRange = (dateValue, startStr2, endStr2) => {
        if (!dateValue) return false;
        try {
          const date2 = dateValue instanceof Date ? dateValue : new Date(dateValue);
          if (isNaN(date2.getTime())) return false;
          const dateStr = `${date2.getFullYear()}-${String(date2.getMonth() + 1).padStart(2, "0")}-${String(date2.getDate()).padStart(2, "0")}`;
          return dateStr >= startStr2 && dateStr <= endStr2;
        } catch (e) {
          console.warn("[deliverySchedules.list] Date parsing error:", e, dateValue);
          return false;
        }
      };
      const records = allRecords.filter((r) => {
        try {
          if (r.status !== "completed" && r.status !== null) {
            return true;
          }
          if (r.deliveryPlannedDate && isDateInRange(r.deliveryPlannedDate, startStr, endStr)) {
            return true;
          }
          if ((!r.deliveryPlannedDate || r.deliveryPlannedDate === null) && r.dueDate && isDateInRange(r.dueDate, startStr, endStr)) {
            return true;
          }
          if ((!r.deliveryPlannedDate || r.deliveryPlannedDate === null) && (!r.dueDate || r.dueDate === null)) {
            return true;
          }
          const createdAt = r.createdAt ? new Date(r.createdAt) : null;
          if (createdAt && !isNaN(createdAt.getTime())) {
            const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1e3 * 60 * 60 * 24));
            if (daysSinceCreation <= 30) {
              return true;
            }
          }
          return false;
        } catch (e) {
          console.warn("[deliverySchedules.list] Filter error for record:", r.id, e);
          return true;
        }
      });
      console.log(`[deliverySchedules.list] Total records fetched: ${allRecords.length}`);
      console.log(`[deliverySchedules.list] Filtered to ${records.length} records`);
      console.log(`[deliverySchedules.list] Completed items: ${allRecords.filter((r) => r.status === "completed").length}`);
      console.log(`[deliverySchedules.list] Incomplete items: ${allRecords.filter((r) => r.status !== "completed").length}`);
      const finalRecords = records;
      console.log(`[deliverySchedules.list] Returning ${finalRecords.length} records`);
      return finalRecords.map((r) => {
        try {
          return {
            ...r,
            delayDays: calcDelayDays(r.dueDate)
          };
        } catch (e) {
          console.warn("[deliverySchedules.list] Mapping error for record:", r.id, e);
          return {
            ...r,
            delayDays: 0
          };
        }
      });
    } catch (error) {
      console.error("[deliverySchedules.list] Error:", error);
      console.error("[deliverySchedules.list] Error message:", error?.message);
      console.error("[deliverySchedules.list] Error stack:", error?.stack);
      console.warn("[deliverySchedules.list] Returning empty array due to error");
      return [];
    }
  }),
  // 1件取得
  get: protectedProcedure.input(z16.object({ id: z16.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureDeliverySchedulesTable(db);
    const [record] = await db.select().from(schema_exports.deliverySchedules).where(eq13(schema_exports.deliverySchedules.id, input.id)).limit(1);
    if (!record) {
      throw new TRPCError16({
        code: "NOT_FOUND",
        message: "\u30EC\u30B3\u30FC\u30C9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    return {
      ...record,
      delayDays: calcDelayDays(record.dueDate)
    };
  }),
  // 作成（準管理者以上）
  create: subAdminProcedure.input(
    z16.object({
      vehicleName: z16.string(),
      vehicleType: z16.string().optional(),
      customerName: z16.string().optional(),
      optionName: z16.string().optional(),
      optionCategory: z16.string().optional(),
      prefecture: z16.string().optional(),
      baseCarReady: z16.enum(["yes", "no"]).optional(),
      furnitureReady: z16.enum(["yes", "no"]).optional(),
      inCharge: z16.string().optional(),
      productionMonth: z16.string().optional(),
      // ワングラム制作分（例: "11月ワングラム制作分"）
      dueDate: z16.string().optional(),
      // yyyy-MM-dd（ワングラム入庫予定）
      desiredIncomingPlannedDate: z16.string().optional(),
      // yyyy-MM-dd（希望ワングラム完成予定日・katomo入力）
      incomingPlannedDate: z16.string().optional(),
      shippingPlannedDate: z16.string().optional(),
      deliveryPlannedDate: z16.string().optional(),
      comment: z16.string().optional(),
      claimComment: z16.string().optional(),
      photosJson: z16.string().optional(),
      oemComment: z16.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureDeliverySchedulesTable(db);
    const parseDate = (value) => {
      if (!value) return void 0;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }
      const d = new Date(value);
      if (isNaN(d.getTime())) return void 0;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    try {
      const normalizeEnum = (value, validValues) => {
        if (!value || value === "" || value === "undefined" || value === void 0) return void 0;
        if (validValues && !validValues.includes(value)) return void 0;
        return value;
      };
      const normalizeString = (value) => {
        if (!value || value === "" || value === "undefined" || value === void 0) return void 0;
        return value;
      };
      console.log("[deliverySchedules.create] Raw input:", JSON.stringify(input, null, 2));
      const insertData = {
        vehicleName: input.vehicleName,
        vehicleType: normalizeString(input.vehicleType),
        customerName: normalizeString(input.customerName),
        optionName: normalizeString(input.optionName),
        optionCategory: normalizeString(input.optionCategory),
        prefecture: normalizeString(input.prefecture),
        baseCarReady: normalizeEnum(input.baseCarReady, ["yes", "no"]),
        furnitureReady: normalizeEnum(input.furnitureReady, ["yes", "no"]),
        inCharge: normalizeString(input.inCharge),
        productionMonth: normalizeString(input.productionMonth),
        dueDate: parseDate(input.dueDate),
        desiredIncomingPlannedDate: parseDate(input.desiredIncomingPlannedDate),
        incomingPlannedDate: parseDate(input.incomingPlannedDate),
        shippingPlannedDate: parseDate(input.shippingPlannedDate),
        deliveryPlannedDate: parseDate(input.deliveryPlannedDate),
        comment: normalizeString(input.comment),
        claimComment: normalizeString(input.claimComment),
        photosJson: normalizeString(input.photosJson),
        oemComment: normalizeString(input.oemComment)
        // status と pickupConfirmed はスキーマのデフォルト値を使用（明示的に設定しない）
      };
      console.log("[deliverySchedules.create] Insert data:", JSON.stringify(insertData, null, 2));
      const fields = ["vehicleName"];
      const values = [insertData.vehicleName];
      const placeholders = ["?"];
      if (insertData.vehicleType !== void 0) {
        fields.push("vehicleType");
        values.push(insertData.vehicleType);
        placeholders.push("?");
      }
      if (insertData.customerName !== void 0) {
        fields.push("customerName");
        values.push(insertData.customerName);
        placeholders.push("?");
      }
      if (insertData.optionName !== void 0) {
        fields.push("optionName");
        values.push(insertData.optionName);
        placeholders.push("?");
      }
      if (insertData.optionCategory !== void 0) {
        fields.push("optionCategory");
        values.push(insertData.optionCategory);
        placeholders.push("?");
      }
      if (insertData.prefecture !== void 0) {
        fields.push("prefecture");
        values.push(insertData.prefecture);
        placeholders.push("?");
      }
      if (insertData.baseCarReady !== void 0) {
        fields.push("baseCarReady");
        values.push(insertData.baseCarReady);
        placeholders.push("?");
      }
      if (insertData.furnitureReady !== void 0) {
        fields.push("furnitureReady");
        values.push(insertData.furnitureReady);
        placeholders.push("?");
      }
      if (insertData.inCharge !== void 0) {
        fields.push("inCharge");
        values.push(insertData.inCharge);
        placeholders.push("?");
      }
      if (insertData.productionMonth !== void 0) {
        fields.push("productionMonth");
        values.push(insertData.productionMonth);
        placeholders.push("?");
      }
      if (insertData.dueDate !== void 0) {
        fields.push("dueDate");
        values.push(insertData.dueDate);
        placeholders.push("?");
      }
      if (insertData.desiredIncomingPlannedDate !== void 0) {
        fields.push("desiredIncomingPlannedDate");
        values.push(insertData.desiredIncomingPlannedDate);
        placeholders.push("?");
      }
      if (insertData.incomingPlannedDate !== void 0) {
        fields.push("incomingPlannedDate");
        values.push(insertData.incomingPlannedDate);
        placeholders.push("?");
      }
      if (insertData.shippingPlannedDate !== void 0) {
        fields.push("shippingPlannedDate");
        values.push(insertData.shippingPlannedDate);
        placeholders.push("?");
      }
      if (insertData.deliveryPlannedDate !== void 0) {
        fields.push("deliveryPlannedDate");
        values.push(insertData.deliveryPlannedDate);
        placeholders.push("?");
      }
      if (insertData.comment !== void 0) {
        fields.push("comment");
        values.push(insertData.comment);
        placeholders.push("?");
      }
      if (insertData.claimComment !== void 0) {
        fields.push("claimComment");
        values.push(insertData.claimComment);
        placeholders.push("?");
      }
      if (insertData.photosJson !== void 0) {
        fields.push("photosJson");
        values.push(insertData.photosJson);
        placeholders.push("?");
      }
      if (insertData.oemComment !== void 0) {
        fields.push("oemComment");
        values.push(insertData.oemComment);
        placeholders.push("?");
      }
      const sql7 = `INSERT INTO \`deliverySchedules\` (\`${fields.join("`, `")}\`) VALUES (${placeholders.join(", ")})`;
      console.log("[deliverySchedules.create] SQL:", sql7);
      console.log("[deliverySchedules.create] Values:", values);
      const pool = getPool();
      if (!pool) {
        throw new TRPCError16({
          code: "INTERNAL_SERVER_ERROR",
          message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u30D7\u30FC\u30EB\u304C\u5229\u7528\u3067\u304D\u307E\u305B\u3093"
        });
      }
      await pool.execute(sql7, values);
      return { success: true };
    } catch (error) {
      console.error("[deliverySchedules.create] Error:", error);
      console.error("[deliverySchedules.create] Error stack:", error?.stack);
      console.error("[deliverySchedules.create] Input:", JSON.stringify(input, null, 2));
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: `\u767B\u9332\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${errorMessage} (\u30B3\u30FC\u30C9: ${errorCode})`
      });
    }
  }),
  // 更新（準管理者以上、またはワングラム側はincomingPlannedDateのみ）
  update: protectedProcedure.input(
    z16.object({
      id: z16.number(),
      vehicleName: z16.string().optional(),
      vehicleType: z16.string().optional(),
      customerName: z16.string().optional(),
      optionName: z16.string().optional(),
      optionCategory: z16.string().optional(),
      prefecture: z16.string().optional(),
      baseCarReady: z16.enum(["yes", "no"]).optional(),
      furnitureReady: z16.enum(["yes", "no"]).optional(),
      inCharge: z16.string().optional(),
      productionMonth: z16.string().optional(),
      // ワングラム制作分（例: "11月ワングラム制作分"）
      dueDate: z16.string().optional(),
      desiredIncomingPlannedDate: z16.string().optional(),
      // yyyy-MM-dd（希望ワングラム完成予定日・katomo入力）
      incomingPlannedDate: z16.string().optional(),
      shippingPlannedDate: z16.string().optional(),
      deliveryPlannedDate: z16.string().optional(),
      comment: z16.string().optional(),
      claimComment: z16.string().optional(),
      photosJson: z16.string().optional(),
      oemComment: z16.string().optional(),
      status: z16.enum(["katomo_stock", "wg_storage", "wg_production", "wg_wait_pickup", "katomo_picked_up", "katomo_checked", "completed"]).optional(),
      completionStatus: z16.enum(["ok", "checked", "revision_requested"]).optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureDeliverySchedulesTable(db);
    const userRole = ctx.user?.role;
    const isExternal = userRole === "external";
    const isSubAdminOrAdmin = userRole === "sub_admin" || userRole === "admin";
    if (isExternal) {
      const allowedFields = ["id", "incomingPlannedDate"];
      const restrictedFields = Object.keys(input).filter((key) => !allowedFields.includes(key));
      if (restrictedFields.length > 0) {
        throw new TRPCError16({
          code: "FORBIDDEN",
          message: `\u30EF\u30F3\u30B0\u30E9\u30E0\u5074\u306F\u300C\u30EF\u30F3\u30B0\u30E9\u30E0\u5B8C\u6210\u4E88\u5B9A\u65E5\uFF08\u30EF\u30F3\u30B0\u30E9\u30E0\u5165\u529B\uFF09\u300D\u306E\u307F\u7DE8\u96C6\u53EF\u80FD\u3067\u3059\u3002`
        });
      }
    } else if (!isSubAdminOrAdmin) {
      throw new TRPCError16({
        code: "FORBIDDEN",
        message: "\u3053\u306E\u64CD\u4F5C\u306F\u7BA1\u7406\u8005\u30FB\u6E96\u7BA1\u7406\u8005\u306E\u307F\u304C\u5B9F\u884C\u3067\u304D\u307E\u3059\u3002"
      });
    }
    let previousIncomingPlannedDate = null;
    if (isExternal && input.incomingPlannedDate !== void 0) {
      const [existing] = await db.select({ incomingPlannedDate: schema_exports.deliverySchedules.incomingPlannedDate }).from(schema_exports.deliverySchedules).where(eq13(schema_exports.deliverySchedules.id, input.id)).limit(1);
      if (existing?.incomingPlannedDate) {
        const date2 = existing.incomingPlannedDate instanceof Date ? existing.incomingPlannedDate : new Date(existing.incomingPlannedDate);
        if (!isNaN(date2.getTime())) {
          const year = date2.getFullYear();
          const month = String(date2.getMonth() + 1).padStart(2, "0");
          const day = String(date2.getDate()).padStart(2, "0");
          previousIncomingPlannedDate = `${year}-${month}-${day}`;
        }
      }
    }
    const pool = getPool();
    if (pool) {
      const columnsToCheck = [
        { name: "productionMonth", type: "VARCHAR(100)", after: "inCharge" },
        { name: "desiredIncomingPlannedDate", type: "DATE", after: "dueDate" },
        { name: "incomingPlannedDateConfirmed", type: "ENUM('true','false') NOT NULL DEFAULT 'false'", after: "pickupConfirmed" },
        { name: "completionStatus", type: "ENUM('ok','checked','revision_requested')", after: "status" }
      ];
      for (const col of columnsToCheck) {
        try {
          const [columns] = await pool.execute(
            `SHOW COLUMNS FROM \`deliverySchedules\` LIKE '${col.name}'`
          );
          if (columns.length === 0) {
            await pool.execute(
              `ALTER TABLE \`deliverySchedules\` ADD COLUMN \`${col.name}\` ${col.type} AFTER \`${col.after}\``
            );
            console.log(`[deliverySchedules.update] Added ${col.name} column`);
          }
        } catch (alterError) {
          if (!alterError?.message?.includes("Duplicate column") && !alterError?.message?.includes("already exists")) {
            console.error(`[deliverySchedules.update] Failed to ensure ${col.name} column:`, alterError);
          }
        }
      }
    }
    const parseDate = (value) => {
      if (value === null || value === "") return null;
      if (value === void 0) return void 0;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }
      const d = new Date(value);
      if (isNaN(d.getTime())) return void 0;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const updateData = {};
    if (input.vehicleName !== void 0) updateData.vehicleName = input.vehicleName;
    if (input.vehicleType !== void 0) updateData.vehicleType = input.vehicleType;
    if (input.customerName !== void 0) updateData.customerName = input.customerName;
    if (input.optionName !== void 0) updateData.optionName = input.optionName;
    if (input.optionCategory !== void 0) updateData.optionCategory = input.optionCategory;
    if (input.prefecture !== void 0) updateData.prefecture = input.prefecture;
    if (input.baseCarReady !== void 0) updateData.baseCarReady = input.baseCarReady;
    if (input.furnitureReady !== void 0) updateData.furnitureReady = input.furnitureReady;
    if (input.inCharge !== void 0) updateData.inCharge = input.inCharge;
    if (input.productionMonth !== void 0) {
      updateData.productionMonth = input.productionMonth === "" ? null : input.productionMonth;
    }
    const due = parseDate(input.dueDate);
    if (input.dueDate !== void 0) updateData.dueDate = due ?? null;
    const desiredIncoming = parseDate(input.desiredIncomingPlannedDate);
    if (input.desiredIncomingPlannedDate !== void 0)
      updateData.desiredIncomingPlannedDate = desiredIncoming ?? null;
    const incoming = parseDate(input.incomingPlannedDate);
    if (input.incomingPlannedDate !== void 0)
      updateData.incomingPlannedDate = incoming;
    const shipping = parseDate(input.shippingPlannedDate);
    if (input.shippingPlannedDate !== void 0)
      updateData.shippingPlannedDate = shipping;
    const delivery = parseDate(input.deliveryPlannedDate);
    if (input.deliveryPlannedDate !== void 0)
      updateData.deliveryPlannedDate = delivery ?? null;
    if (input.comment !== void 0) updateData.comment = input.comment;
    if (input.claimComment !== void 0) updateData.claimComment = input.claimComment;
    if (input.photosJson !== void 0) updateData.photosJson = input.photosJson;
    if (input.oemComment !== void 0) updateData.oemComment = input.oemComment;
    if (input.status !== void 0) updateData.status = input.status;
    if (input.completionStatus !== void 0) updateData.completionStatus = input.completionStatus;
    console.log("[deliverySchedules.update] Update data:", JSON.stringify(updateData, null, 2));
    console.log("[deliverySchedules.update] Updating record ID:", input.id);
    if (Object.keys(updateData).length === 0) {
      throw new TRPCError16({
        code: "BAD_REQUEST",
        message: "\u66F4\u65B0\u3059\u308B\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093"
      });
    }
    try {
      const pool2 = getPool();
      if (pool2) {
        const requiredColumns = [
          { name: "status", type: "ENUM('katomo_stock','wg_storage','wg_production','wg_wait_pickup','katomo_picked_up','katomo_checked','completed') NOT NULL DEFAULT 'katomo_stock'", after: "oemComment" },
          { name: "productionMonth", type: "VARCHAR(100)", after: "inCharge" },
          { name: "desiredIncomingPlannedDate", type: "DATE", after: "dueDate" },
          { name: "completionStatus", type: "ENUM('ok','checked','revision_requested')", after: "status" },
          { name: "incomingPlannedDateConfirmed", type: "ENUM('true','false') NOT NULL DEFAULT 'false'", after: "pickupConfirmed" }
        ];
        for (const col of requiredColumns) {
          try {
            const [columns] = await pool2.execute(
              `SHOW COLUMNS FROM \`deliverySchedules\` LIKE '${col.name}'`
            );
            if (columns.length === 0) {
              await pool2.execute(
                `ALTER TABLE \`deliverySchedules\` ADD COLUMN \`${col.name}\` ${col.type} AFTER \`${col.after}\``
              );
              console.log(`[deliverySchedules.update] Added missing ${col.name} column`);
            } else if (col.name === "status") {
              try {
                await pool2.execute(
                  `ALTER TABLE \`deliverySchedules\` MODIFY COLUMN \`status\` ${col.type}`
                );
                console.log(`[deliverySchedules.update] Updated ${col.name} ENUM values`);
              } catch (updateError) {
                console.log(`[deliverySchedules.update] ENUM update for ${col.name} may have been skipped:`, updateError?.message);
              }
            }
          } catch (alterError) {
            if (!alterError?.message?.includes("Duplicate column") && !alterError?.message?.includes("already exists")) {
              console.warn(`[deliverySchedules.update] Failed to add ${col.name} column:`, alterError?.message);
            }
          }
        }
        const validUpdateData = {};
        for (const [key, value] of Object.entries(updateData)) {
          if (value !== void 0) {
            validUpdateData[key] = value;
          }
        }
        if (Object.keys(validUpdateData).length === 0) {
          throw new TRPCError16({
            code: "BAD_REQUEST",
            message: "\u66F4\u65B0\u3059\u308B\u6709\u52B9\u306A\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093"
          });
        }
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(validUpdateData)) {
          fields.push(`\`${key}\` = ?`);
          values.push(value);
        }
        values.push(input.id);
        const updateQuery = `UPDATE \`deliverySchedules\` SET ${fields.join(", ")} WHERE \`id\` = ?`;
        console.log("[deliverySchedules.update] Executing SQL:", updateQuery);
        console.log("[deliverySchedules.update] Values:", values);
        console.log("[deliverySchedules.update] Valid update data keys:", Object.keys(validUpdateData));
        try {
          await pool2.execute(updateQuery, values);
          console.log("[deliverySchedules.update] \u2705 Fields updated using raw SQL");
        } catch (sqlError) {
          console.error("[deliverySchedules.update] \u274C SQL execution error:", sqlError);
          console.error("[deliverySchedules.update] \u274C SQL query:", updateQuery);
          console.error("[deliverySchedules.update] \u274C SQL values:", values);
          throw sqlError;
        }
      } else {
        const validUpdateData = {};
        for (const [key, value] of Object.entries(updateData)) {
          if (value !== void 0) {
            validUpdateData[key] = value;
          }
        }
        await db.update(schema_exports.deliverySchedules).set(validUpdateData).where(eq13(schema_exports.deliverySchedules.id, input.id));
      }
      console.log("[deliverySchedules.update] \u2705 Update successful");
      if (isExternal && input.incomingPlannedDate !== void 0) {
        const currentIncoming = parseDate(input.incomingPlannedDate);
        const previousValue = previousIncomingPlannedDate || "";
        const currentValue = currentIncoming || "";
        const shouldNotify = currentValue !== "" && previousValue !== currentValue;
        if (shouldNotify) {
          try {
            const admins = await db.select().from(schema_exports.users).where(
              or(
                eq13(schema_exports.users.role, "admin"),
                eq13(schema_exports.users.role, "sub_admin")
              )
            );
            const [schedule] = await db.select().from(schema_exports.deliverySchedules).where(eq13(schema_exports.deliverySchedules.id, input.id)).limit(1);
            const title = "\u30EF\u30F3\u30B0\u30E9\u30E0\u5B8C\u6210\u4E88\u5B9A\u65E5\u304C\u5165\u529B\u3055\u308C\u307E\u3057\u305F";
            const baseName = schedule?.vehicleName || "\u7D0D\u8ECA\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB";
            let dateStr = "";
            if (currentIncoming) {
              try {
                const dateObj = new Date(currentIncoming);
                if (!isNaN(dateObj.getTime())) {
                  dateStr = dateObj.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
                } else {
                  dateStr = currentIncoming;
                }
              } catch (e) {
                dateStr = currentIncoming;
              }
            }
            const message = `${baseName} \u306E\u30EF\u30F3\u30B0\u30E9\u30E0\u5B8C\u6210\u4E88\u5B9A\u65E5\uFF08\u30EF\u30F3\u30B0\u30E9\u30E0\u5165\u529B\uFF09\u304C ${dateStr} \u306B\u8A2D\u5B9A\u3055\u308C\u307E\u3057\u305F\u3002`;
            if (admins.length > 0) {
              await db.insert(schema_exports.notifications).values(
                admins.map((admin) => ({
                  userId: admin.id,
                  title,
                  message,
                  type: "info"
                }))
              );
              console.log(`[deliverySchedules.update] \u{1F4E7} Sent notifications to ${admins.length} admins/sub_admins`);
            }
          } catch (notificationError) {
            console.error("[deliverySchedules.update] \u274C Failed to send notifications:", notificationError);
          }
        }
      }
      return { success: true };
    } catch (updateError) {
      console.error("[deliverySchedules.update] \u274C Update error:", updateError);
      console.error("[deliverySchedules.update] \u274C Error message:", updateError?.message);
      console.error("[deliverySchedules.update] \u274C Error code:", updateError?.code);
      console.error("[deliverySchedules.update] \u274C Error stack:", updateError?.stack);
      console.error("[deliverySchedules.update] \u274C Update data was:", JSON.stringify(updateData, null, 2));
      const errorMessage = updateError?.message || String(updateError);
      if (errorMessage.includes("Unknown column") || errorMessage.includes("doesn't exist")) {
        throw new TRPCError16({
          code: "INTERNAL_SERVER_ERROR",
          message: `\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F: \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306E\u30AB\u30E9\u30E0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u30A8\u30E9\u30FC: ${errorMessage}`
        });
      }
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: `\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${errorMessage}`
      });
    }
  }),
  // 削除（準管理者以上）
  delete: subAdminProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureDeliverySchedulesTable(db);
    await db.delete(schema_exports.deliverySchedules).where(eq13(schema_exports.deliverySchedules.id, input.id));
    return { success: true };
  }),
  // 引き取り予定日を確定（準管理者以上）
  confirmPickup: subAdminProcedure.input(z16.object({ id: z16.number(), confirmed: z16.boolean() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureDeliverySchedulesTable(db);
    await db.update(schema_exports.deliverySchedules).set({ pickupConfirmed: input.confirmed ? "true" : "false" }).where(eq13(schema_exports.deliverySchedules.id, input.id));
    if (input.confirmed) {
      const admins = await db.select().from(schema_exports.users).where(
        or(
          eq13(schema_exports.users.role, "admin"),
          eq13(schema_exports.users.role, "sub_admin")
        )
      );
      const { like: like2 } = await import("drizzle-orm");
      const suzukiUsers = await db.select().from(schema_exports.users).where(like2(schema_exports.users.name, "%\u9234\u6728%")).limit(5);
      const targets = [...admins, ...suzukiUsers];
      const uniqueUserIds = Array.from(new Set(targets.map((u) => u.id)));
      const [schedule] = await db.select().from(schema_exports.deliverySchedules).where(eq13(schema_exports.deliverySchedules.id, input.id)).limit(1);
      const title = "\u5F15\u304D\u53D6\u308A\u4E88\u5B9A\u65E5\u304C\u78BA\u5B9A\u3057\u307E\u3057\u305F";
      const baseName = schedule?.vehicleName || "\u7D0D\u8ECA\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB";
      const message = `${baseName} \u306E\u5F15\u304D\u53D6\u308A\u4E88\u5B9A\u65E5\u304C\u78BA\u5B9A\u3057\u307E\u3057\u305F\u3002`;
      if (uniqueUserIds.length > 0) {
        await db.insert(schema_exports.notifications).values(
          uniqueUserIds.map((userId) => ({
            userId,
            title,
            message,
            type: "info"
          }))
        );
      }
    }
    return { success: true };
  }),
  // ワングラム完成予定日を確定（準管理者以上）
  confirmIncoming: subAdminProcedure.input(z16.object({ id: z16.number(), confirmed: z16.boolean() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureDeliverySchedulesTable(db);
    const pool = getPool();
    if (pool) {
      await pool.execute(
        "UPDATE deliverySchedules SET incomingPlannedDateConfirmed = ? WHERE id = ?",
        [input.confirmed ? "true" : "false", input.id]
      );
    } else {
      await db.update(schema_exports.deliverySchedules).set({ incomingPlannedDateConfirmed: input.confirmed ? "true" : "false" }).where(eq13(schema_exports.deliverySchedules.id, input.id));
    }
    if (input.confirmed) {
      const admins = await db.select().from(schema_exports.users).where(
        or(
          eq13(schema_exports.users.role, "admin"),
          eq13(schema_exports.users.role, "sub_admin")
        )
      );
      const { like: like2 } = await import("drizzle-orm");
      const suzukiUsers = await db.select().from(schema_exports.users).where(like2(schema_exports.users.name, "%\u9234\u6728%")).limit(5);
      const targets = [...admins, ...suzukiUsers];
      const uniqueUserIds = Array.from(new Set(targets.map((u) => u.id)));
      const [schedule] = await db.select().from(schema_exports.deliverySchedules).where(eq13(schema_exports.deliverySchedules.id, input.id)).limit(1);
      const title = "\u30EF\u30F3\u30B0\u30E9\u30E0\u5B8C\u6210\u4E88\u5B9A\u65E5\u304C\u78BA\u5B9A\u3057\u307E\u3057\u305F";
      const baseName = schedule?.vehicleName || "\u7D0D\u8ECA\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB";
      const message = `${baseName} \u306E\u30EF\u30F3\u30B0\u30E9\u30E0\u5B8C\u6210\u4E88\u5B9A\u65E5\u304C\u78BA\u5B9A\u3057\u307E\u3057\u305F\u3002`;
      if (uniqueUserIds.length > 0) {
        await db.insert(schema_exports.notifications).values(
          uniqueUserIds.map((userId) => ({
            userId,
            title,
            message,
            type: "info"
          }))
        );
      }
    }
    return { success: true };
  }),
  // 製造注意仕様書をアップロード（準管理者以上）
  uploadSpecSheet: subAdminProcedure.input(
    z16.object({
      id: z16.number(),
      fileData: z16.string(),
      // base64
      fileName: z16.string(),
      fileType: z16.enum(["image/jpeg", "image/jpg", "application/pdf"])
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await ensureDeliverySchedulesTable(db);
    const uploadDir = path3.resolve(process.cwd(), "uploads", "delivery-specs");
    if (!fs3.existsSync(uploadDir)) {
      fs3.mkdirSync(uploadDir, { recursive: true });
    }
    const extension = input.fileType === "application/pdf" ? "pdf" : "jpg";
    const fileName = `${input.id}_${nanoid2()}.${extension}`;
    const filePath = path3.join(uploadDir, fileName);
    const base64Data = input.fileData.replace(/^data:.*,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    fs3.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/delivery-specs/${fileName}`;
    await db.update(schema_exports.deliverySchedules).set({ specSheetUrl: fileUrl }).where(eq13(schema_exports.deliverySchedules.id, input.id));
    return { success: true, fileUrl };
  }),
  // チャット一覧取得（全員が閲覧可能）
  getChats: protectedProcedure.input(
    z16.object({
      deliveryScheduleId: z16.number().optional()
      // 指定されない場合は全体チャット
    })
  ).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    try {
      await db.execute(
        `
                    CREATE TABLE IF NOT EXISTS \`deliveryScheduleChats\` (
                      \`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                      \`deliveryScheduleId\` INT,
                      \`userId\` INT NOT NULL,
                      \`message\` TEXT NOT NULL,
                      \`parentId\` INT,
                      \`imageUrl\` TEXT,
                      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    `
      );
      try {
        await db.execute(
          `ALTER TABLE \`deliveryScheduleChats\` ADD COLUMN \`parentId\` INT`
        );
      } catch (e) {
        if (!e?.message?.includes("Duplicate column") && !e?.message?.includes("already exists")) {
          console.error("[deliverySchedules] add parentId column failed:", e);
        }
      }
      try {
        await db.execute(
          `ALTER TABLE \`deliveryScheduleChats\` ADD COLUMN \`imageUrl\` TEXT`
        );
      } catch (e) {
        if (!e?.message?.includes("Duplicate column") && !e?.message?.includes("already exists")) {
          console.error("[deliverySchedules] add imageUrl column failed:", e);
        }
      }
      await db.execute(
        `
                    CREATE TABLE IF NOT EXISTS \`deliveryScheduleChatReads\` (
                      \`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                      \`chatId\` INT NOT NULL,
                      \`userId\` INT NOT NULL,
                      \`readAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      UNIQUE KEY \`unique_read\` (\`chatId\`, \`userId\`)
                    )
                    `
      );
    } catch (e) {
      console.error("[deliverySchedules] ensureChatTable failed:", e);
    }
    const chats = await db.select({
      id: schema_exports.deliveryScheduleChats.id,
      deliveryScheduleId: schema_exports.deliveryScheduleChats.deliveryScheduleId,
      userId: schema_exports.deliveryScheduleChats.userId,
      message: schema_exports.deliveryScheduleChats.message,
      parentId: schema_exports.deliveryScheduleChats.parentId,
      imageUrl: schema_exports.deliveryScheduleChats.imageUrl,
      createdAt: schema_exports.deliveryScheduleChats.createdAt,
      userName: schema_exports.users.name
    }).from(schema_exports.deliveryScheduleChats).leftJoin(schema_exports.users, eq13(schema_exports.deliveryScheduleChats.userId, schema_exports.users.id)).where(
      input.deliveryScheduleId !== void 0 ? eq13(schema_exports.deliveryScheduleChats.deliveryScheduleId, input.deliveryScheduleId) : isNull3(schema_exports.deliveryScheduleChats.deliveryScheduleId)
    ).orderBy(desc3(schema_exports.deliveryScheduleChats.createdAt));
    let unreadChatIds = [];
    if (ctx.user?.id) {
      const readChats = await db.select({ chatId: schema_exports.deliveryScheduleChatReads.chatId }).from(schema_exports.deliveryScheduleChatReads).where(eq13(schema_exports.deliveryScheduleChatReads.userId, ctx.user.id));
      const readChatIdSet = new Set(readChats.map((r) => r.chatId));
      unreadChatIds = chats.filter((c) => !readChatIdSet.has(c.id) && c.userId !== ctx.user.id).map((c) => c.id);
    }
    const parentIds = chats.filter((c) => c.parentId).map((c) => Number(c.parentId)).filter((id) => !isNaN(id));
    let parentChatsMap = {};
    if (parentIds.length > 0) {
      const uniqueParentIds = Array.from(new Set(parentIds));
      const parentChats = await db.select({
        id: schema_exports.deliveryScheduleChats.id,
        message: schema_exports.deliveryScheduleChats.message,
        userName: schema_exports.users.name
      }).from(schema_exports.deliveryScheduleChats).leftJoin(schema_exports.users, eq13(schema_exports.deliveryScheduleChats.userId, schema_exports.users.id)).where(inArray3(schema_exports.deliveryScheduleChats.id, uniqueParentIds));
      parentChats.forEach((pc) => {
        parentChatsMap[pc.id] = {
          userName: pc.userName || null,
          message: pc.message || ""
        };
      });
    }
    const chatsWithReplies = chats.map((chat) => {
      const result = {
        ...chat,
        isUnread: unreadChatIds.includes(chat.id)
      };
      if (chat.parentId && parentChatsMap[chat.parentId]) {
        result.parentUserName = parentChatsMap[chat.parentId].userName;
        result.parentMessage = parentChatsMap[chat.parentId].message;
      }
      if (chat.imageUrl) {
        try {
          result.imageUrls = JSON.parse(chat.imageUrl);
        } catch {
          result.imageUrls = [chat.imageUrl];
        }
      } else {
        result.imageUrls = [];
      }
      return result;
    });
    return chatsWithReplies;
  }),
  // チャット投稿（全員が投稿可能）
  createChat: protectedProcedure.input(
    z16.object({
      deliveryScheduleId: z16.number().optional(),
      message: z16.string().min(1),
      parentId: z16.number().optional(),
      // 返信先のコメントID
      imageUrls: z16.array(z16.string()).optional()
      // 画像URL配列
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    if (!ctx.user?.id) {
      throw new TRPCError16({
        code: "UNAUTHORIZED",
        message: "\u30ED\u30B0\u30A4\u30F3\u304C\u5FC5\u8981\u3067\u3059"
      });
    }
    const imageUrlJson = input.imageUrls && input.imageUrls.length > 0 ? JSON.stringify(input.imageUrls) : null;
    await db.insert(schema_exports.deliveryScheduleChats).values({
      deliveryScheduleId: input.deliveryScheduleId || null,
      userId: ctx.user.id,
      message: input.message,
      parentId: input.parentId || null,
      imageUrl: imageUrlJson
    });
    return { success: true };
  }),
  // チャット画像アップロード（全員が投稿可能）
  uploadChatImage: protectedProcedure.input(
    z16.object({
      fileData: z16.string(),
      // base64
      fileType: z16.enum(["image/jpeg", "image/jpg", "image/png"])
    })
  ).mutation(async ({ input }) => {
    const uploadDir = path3.resolve(process.cwd(), "uploads", "delivery-chats");
    if (!fs3.existsSync(uploadDir)) {
      fs3.mkdirSync(uploadDir, { recursive: true });
    }
    const extension = input.fileType === "image/png" ? "png" : "jpg";
    const fileName = `${nanoid2()}.${extension}`;
    const filePath = path3.join(uploadDir, fileName);
    const base64Data = input.fileData.replace(/^data:.*,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    fs3.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/delivery-chats/${fileName}`;
    return { success: true, fileUrl };
  }),
  // チャット既読マーク（全員が利用可能）
  markChatAsRead: protectedProcedure.input(
    z16.object({
      chatId: z16.number()
    })
  ).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    if (!ctx.user?.id) {
      throw new TRPCError16({
        code: "UNAUTHORIZED",
        message: "\u30ED\u30B0\u30A4\u30F3\u304C\u5FC5\u8981\u3067\u3059"
      });
    }
    try {
      await db.execute(
        `
                    CREATE TABLE IF NOT EXISTS \`deliveryScheduleChatReads\` (
                      \`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                      \`chatId\` INT NOT NULL,
                      \`userId\` INT NOT NULL,
                      \`readAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      UNIQUE KEY \`unique_read\` (\`chatId\`, \`userId\`)
                    )
                    `
      );
    } catch (e) {
      console.error("[deliverySchedules] ensureChatReadsTable failed:", e);
    }
    try {
      await db.insert(schema_exports.deliveryScheduleChatReads).values({
        chatId: input.chatId,
        userId: ctx.user.id
      });
    } catch (e) {
      if (!e?.message?.includes("Duplicate entry")) {
        console.error("[deliverySchedules] markChatAsRead failed:", e);
      }
    }
    return { success: true };
  }),
  // チャット削除（管理者・準管理者のみ）
  deleteChat: subAdminProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError16({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.delete(schema_exports.deliveryScheduleChats).where(eq13(schema_exports.deliveryScheduleChats.id, input.id));
    return { success: true };
  })
});

// server/routers/notifications.ts
init_trpc();
init_db();
import { TRPCError as TRPCError17 } from "@trpc/server";
import { z as z17 } from "zod";
import { eq as eq14, desc as desc4 } from "drizzle-orm";
var notificationsRouter = createTRPCRouter({
  // 自分宛ての未読通知一覧
  // サンプルページのため、データベース接続エラー時は空配列を返す
  getMyUnread: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      console.warn("[notifications.getMyUnread] \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3002\u7A7A\u914D\u5217\u3092\u8FD4\u3057\u307E\u3059\u3002");
      return [];
    }
    const rows = await db.select().from(schema_exports.notifications).where(
      eq14(schema_exports.notifications.userId, ctx.user.id)
    ).orderBy(desc4(schema_exports.notifications.createdAt));
    return rows.filter((n) => n.isRead === "false");
  }),
  // 通知を既読にする
  markAsRead: protectedProcedure.input(z17.object({ id: z17.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError17({
        code: "INTERNAL_SERVER_ERROR",
        message: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093"
      });
    }
    await db.update(schema_exports.notifications).set({ isRead: "true" }).where(
      eq14(schema_exports.notifications.id, input.id)
    );
    return { success: true };
  })
});

// server/routers.ts
var appRouter = createTRPCRouter({
  auth: authRouter,
  attendance: attendanceRouter,
  workRecords: workRecordsRouter,
  vehicles: vehiclesRouter,
  processes: processesRouter,
  vehicleTypes: vehicleTypesRouter,
  users: usersRouter,
  analytics: analyticsRouter,
  csv: csvRouter,
  checks: checksRouter,
  salesBroadcasts: salesBroadcastsRouter,
  bulletin: bulletinRouter,
  breakTimes: breakTimesRouter,
  staffSchedule: staffScheduleRouter,
  backup: backupRouter,
  deliverySchedules: deliverySchedulesRouter,
  notifications: notificationsRouter
});

// server/_core/context.ts
init_db();
init_env();
async function createContext({ req, res }) {
  const userIdStr = await getUserIdFromCookie(req);
  let user = null;
  if (userIdStr) {
    const userId = parseInt(userIdStr);
    if (!isNaN(userId)) {
      try {
        user = await getUserById(userId);
      } catch (error) {
        console.warn("[Context] Failed to get user from database, using fallback:", error);
      }
      if (!user && userId) {
        console.log("[Context] Using fallback mock user for userId:", userId);
        if (userId === 1) {
          user = {
            id: 1,
            username: "admin",
            name: "\u7BA1\u7406\u8005",
            role: "admin",
            category: null
          };
        } else if (userId === 2) {
          user = {
            id: 2,
            username: "user001",
            name: "\u4E00\u822C\u30E6\u30FC\u30B6\u30FC",
            role: "field_worker",
            category: null
          };
        } else {
          user = {
            id: userId,
            username: `user${String(userId).padStart(3, "0")}`,
            name: "\u4E00\u822C\u30E6\u30FC\u30B6\u30FC",
            role: "field_worker",
            category: null
          };
        }
      }
    }
  }
  return {
    req,
    res,
    userId: user?.id,
    user,
    isAdmin: user?.role === "admin" || user?.role === "sub_admin" || user?.username === ENV.ownerOpenId,
    isSuperAdmin: user?.role === "admin" || user?.username === ENV.ownerOpenId
  };
}

// server/_core/vite.ts
import express from "express";
import fs4 from "fs";
import { nanoid as nanoid3 } from "nanoid";
import path5 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path4 from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path4.resolve(import.meta.dirname, "client", "src"),
      "@shared": path4.resolve(import.meta.dirname, "shared"),
      "@assets": path4.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path4.resolve(import.meta.dirname),
  root: path4.resolve(import.meta.dirname, "client"),
  publicDir: path4.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path4.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true
  },
  server: {
    port: 8700,
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    hmr: {
      protocol: "wss",
      clientPort: 443
    },
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith("/api/")) {
      return next();
    }
    try {
      const clientTemplate = path5.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs4.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid3()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      console.error("[vite] Error serving page:", e);
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = path5.resolve(import.meta.dirname, "../../dist");
  console.log(`Serving static files from: ${distPath}`);
  if (!fs4.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    app.get("*", (_req, res) => {
      res.status(500).send("Build directory not found. Please run 'pnpm build' first.");
    });
    return;
  }
  app.use(express.static(distPath, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) {
      return next();
    }
    const indexPath = path5.resolve(distPath, "index.html");
    if (fs4.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("index.html not found");
    }
  });
}

// server/_core/index.ts
init_db();

// server/init-data.ts
init_db();
init_env();
import bcrypt3 from "bcryptjs";
import { eq as eq15, like } from "drizzle-orm";
async function initializeInitialData() {
  console.log("[Init] ========== \u521D\u671F\u30C7\u30FC\u30BF\u521D\u671F\u5316\u958B\u59CB ==========");
  let db = await getDb();
  let retryCount = 0;
  const maxRetries = 5;
  while (!db && retryCount < maxRetries) {
    retryCount++;
    console.log(`[Init] \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u63A5\u7D9A\u8A66\u884C ${retryCount}/${maxRetries}...`);
    await new Promise((resolve) => setTimeout(resolve, 2e3));
    db = await getDb();
  }
  if (!db) {
    console.error("[Init] \u274C \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u63A5\u7D9A\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\u306F\u4F5C\u6210\u3055\u308C\u307E\u305B\u3093\u3002");
    console.error("[Init] \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u63A5\u7D9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    return;
  }
  console.log("[Init] \u2705 \u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u63A5\u7D9A\u6210\u529F");
  try {
    console.log("[Init] \u30B9\u30C6\u30C3\u30D71: \u521D\u671F\u30E6\u30FC\u30B6\u30FC\u306E\u4F5C\u6210...");
    try {
      await initializeUsers(db);
      console.log("[Init] \u2705 \u30B9\u30C6\u30C3\u30D71\u5B8C\u4E86: \u521D\u671F\u30E6\u30FC\u30B6\u30FC");
    } catch (error) {
      console.error("[Init] \u274C \u30B9\u30C6\u30C3\u30D71\u30A8\u30E9\u30FC:", error);
    }
    console.log("[Init] \u30B9\u30C6\u30C3\u30D72: \u521D\u671F\u5DE5\u7A0B\u306E\u4F5C\u6210...");
    try {
      await initializeProcesses(db);
      console.log("[Init] \u2705 \u30B9\u30C6\u30C3\u30D72\u5B8C\u4E86: \u521D\u671F\u5DE5\u7A0B");
    } catch (error) {
      console.error("[Init] \u274C \u30B9\u30C6\u30C3\u30D72\u30A8\u30E9\u30FC:", error);
    }
    console.log("[Init] \u30B9\u30C6\u30C3\u30D73: \u521D\u671F\u8ECA\u7A2E\u306E\u4F5C\u6210...");
    try {
      await initializeVehicleTypes(db);
      console.log("[Init] \u2705 \u30B9\u30C6\u30C3\u30D73\u5B8C\u4E86: \u521D\u671F\u8ECA\u7A2E");
    } catch (error) {
      console.error("[Init] \u274C \u30B9\u30C6\u30C3\u30D73\u30A8\u30E9\u30FC:", error);
    }
    console.log("[Init] \u30B9\u30C6\u30C3\u30D74: \u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\u306E\u4F5C\u6210...");
    const shouldInitSampleData = process.env.INIT_SAMPLE_DATA !== "false";
    console.log(`[Init] NODE_ENV: ${process.env.NODE_ENV}, isProduction: ${ENV.isProduction}, INIT_SAMPLE_DATA: ${process.env.INIT_SAMPLE_DATA ?? "undefined (default: true)"}`);
    if (shouldInitSampleData) {
      console.log("[Init] \u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\u3092\u521D\u671F\u5316\u3057\u307E\u3059...");
      try {
        await initializeSampleData(db);
        console.log("[Init] \u2705 \u30B9\u30C6\u30C3\u30D74\u5B8C\u4E86: \u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF");
      } catch (error) {
        console.error("[Init] \u274C \u30B9\u30C6\u30C3\u30D74\u30A8\u30E9\u30FC\uFF08\u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\uFF09:", error);
        if (error instanceof Error) {
          console.error("[Init] \u30A8\u30E9\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8:", error.message);
          console.error("[Init] \u30A8\u30E9\u30FC\u30B9\u30BF\u30C3\u30AF:", error.stack);
        }
      }
    } else {
      console.log("[Init] \u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\u306E\u521D\u671F\u5316\u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F (INIT_SAMPLE_DATA=false)");
    }
    console.log("[Init] ========== \u521D\u671F\u30C7\u30FC\u30BF\u521D\u671F\u5316\u5B8C\u4E86 ==========");
  } catch (error) {
    console.error("[Init] ========== \u521D\u671F\u30C7\u30FC\u30BF\u521D\u671F\u5316\u3067\u91CD\u5927\u306A\u30A8\u30E9\u30FC ==========");
    console.error("[Init] \u30A8\u30E9\u30FC\u8A73\u7D30:", error);
    if (error instanceof Error) {
      console.error("[Init] \u30A8\u30E9\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8:", error.message);
      console.error("[Init] \u30A8\u30E9\u30FC\u30B9\u30BF\u30C3\u30AF:", error.stack);
    }
  }
}
async function initializeUsers(db) {
  try {
    const existingUsers = await db.select().from(schema_exports.users).limit(1);
    if (existingUsers.length > 0) {
      console.log("[Init] Users already exist, skipping user initialization");
      return;
    }
  } catch (error) {
    console.warn("[Init] Failed to check existing users:", error);
    return;
  }
  const adminPassword = await bcrypt3.hash("admin123", 10);
  await db.insert(schema_exports.users).values({
    username: "admin",
    password: adminPassword,
    name: "\u7BA1\u7406\u8005",
    role: "admin"
  });
  const staffPassword = await bcrypt3.hash("password", 10);
  const staffUsers = [];
  const carpenterNames = [
    "\u5927\u5DE5\u592A\u90CE",
    "\u68DF\u6881\u4E00\u90CE",
    "\u8077\u4EBA\u4E8C\u90CE",
    "\u5320\u4E09\u90CE",
    "\u5DE5\u52D9\u56DB\u90CE",
    "\u5EFA\u7BC9\u4E94\u90CE",
    "\u73FE\u5834\u516D\u90CE",
    "\u65BD\u5DE5\u4E03\u90CE",
    "\u4F5C\u696D\u516B\u90CE",
    "\u5EFA\u8A2D\u4E5D\u90CE",
    "\u5927\u5DE5\u82B1\u5B50",
    "\u8077\u4EBA\u7F8E\u54B2",
    "\u73FE\u5834\u7531\u7F8E",
    "\u65BD\u5DE5\u3055\u304F\u3089",
    "\u4F5C\u696D\u307F\u3069\u308A",
    "\u5EFA\u7BC9\u3042\u304B\u308A",
    "\u5DE5\u52D9\u3072\u306A\u305F",
    "\u5320\u307E\u3086\u307F",
    "\u68DF\u6881\u3042\u3086\u307F",
    "\u5EFA\u8A2D\u306A\u3064\u304D"
  ];
  for (let i = 1; i <= 20; i++) {
    const username = `user${String(i).padStart(3, "0")}`;
    const name = carpenterNames[i - 1] || `\u5927\u5DE5${i}`;
    staffUsers.push({
      username,
      password: staffPassword,
      name,
      role: "field_worker"
    });
  }
  for (let i = 0; i < staffUsers.length; i += 1e3) {
    const batch = staffUsers.slice(i, i + 1e3);
    await db.insert(schema_exports.users).values(batch);
  }
  console.log("[Init] Created admin account (admin/admin123) and 20 staff accounts (user001-user020/password)");
}
async function initializeProcesses(db) {
  try {
    const existingProcesses = await db.select().from(schema_exports.processes).limit(1);
    if (existingProcesses.length > 0) {
      console.log("[Init] Processes already exist, skipping process initialization");
      return;
    }
  } catch (error) {
    console.warn("[Init] Failed to check existing processes:", error);
    return;
  }
  const processes2 = [
    { name: "\u57FA\u790E\u5DE5\u4E8B", description: "\u57FA\u790E\u306E\u30B3\u30F3\u30AF\u30EA\u30FC\u30C8\u6253\u8A2D\u3001\u578B\u67A0\u7D44\u307F", majorCategory: "\u57FA\u790E", minorCategory: "\u57FA\u790E\u5DE5\u4E8B", displayOrder: 1 },
    { name: "\u4E0B\u5730\u5DE5\u4E8B", description: "\u65AD\u71B1\u6750\u65BD\u5DE5\u3001\u6839\u592A\u53D6\u308A\u4ED8\u3051\u3001\u5E8A\u4E0B\u63DB\u6C17", majorCategory: "\u4E0B\u5730", minorCategory: "\u65AD\u71B1", displayOrder: 2 },
    { name: "\u96FB\u6C17\u5DE5\u4E8B", description: "\u5C4B\u5185\u914D\u7DDA\u3001\u30B3\u30F3\u30BB\u30F3\u30C8\u30FB\u30B9\u30A4\u30C3\u30C1\u8A2D\u7F6E\u3001\u5206\u96FB\u76E4\u8A2D\u7F6E", majorCategory: "\u96FB\u6C17", minorCategory: "\u914D\u7DDA", displayOrder: 3 },
    { name: "\u6C34\u9053\u5DE5\u4E8B", description: "\u7D66\u6392\u6C34\u7BA1\u306E\u63A5\u7D9A\u3001\u6C34\u56DE\u308A\u8A2D\u5099\u306E\u8A2D\u7F6E", majorCategory: "\u6C34\u9053", minorCategory: "\u7D66\u6392\u6C34", displayOrder: 4 },
    { name: "\u5185\u88C5\u5DE5\u4E8B", description: "\u58C1\u7D19\u8CBC\u308A\u3001\u5E8A\u6750\u65BD\u5DE5\u3001\u5929\u4E95\u65BD\u5DE5\u3001\u5EFA\u5177\u53D6\u308A\u4ED8\u3051", majorCategory: "\u5185\u88C5", minorCategory: "\u4ED5\u4E0A\u3052", displayOrder: 5 },
    { name: "\u5916\u88C5\u5DE5\u4E8B", description: "\u5916\u58C1\u65BD\u5DE5\u3001\u5C4B\u6839\u5DE5\u4E8B\u3001\u96E8\u6A0B\u53D6\u308A\u4ED8\u3051", majorCategory: "\u5916\u88C5", minorCategory: "\u5916\u58C1", displayOrder: 6 },
    { name: "\u8A2D\u5099\u5DE5\u4E8B", description: "\u30A8\u30A2\u30B3\u30F3\u8A2D\u7F6E\u3001\u63DB\u6C17\u6247\u8A2D\u7F6E\u3001\u7D66\u6E6F\u5668\u8A2D\u7F6E", majorCategory: "\u8A2D\u5099", minorCategory: "\u7A7A\u8ABF", displayOrder: 7 },
    { name: "\u6700\u7D42\u78BA\u8A8D", description: "\u6700\u7D42\u6E05\u6383\u3001\u6700\u7D42\u30C1\u30A7\u30C3\u30AF\u3001\u5B8C\u6210\u691C\u67FB", majorCategory: "\u78BA\u8A8D", minorCategory: "\u6700\u7D42", displayOrder: 8 }
  ];
  await db.insert(schema_exports.processes).values(processes2);
  console.log("[Init] Created 10 initial processes");
}
async function initializeVehicleTypes(db) {
  try {
    const existingVehicleTypes = await db.select().from(schema_exports.vehicleTypes).limit(1);
    if (existingVehicleTypes.length > 0) {
      console.log("[Init] VehicleTypes already exist, skipping vehicle type initialization");
      return;
    }
  } catch (error) {
    console.warn("[Init] Failed to check existing vehicle types:", error);
    return;
  }
  const vehicleTypes2 = [
    { name: "\u4E00\u822C\u8ECA\u4E21", description: "\u4E00\u822C\u7684\u306A\u8ECA\u4E21", standardTotalMinutes: 480 },
    { name: "\u30AD\u30E3\u30F3\u30D1\u30FC", description: "\u30AD\u30E3\u30F3\u30D4\u30F3\u30B0\u30AB\u30FC", standardTotalMinutes: 720 }
  ];
  await db.insert(schema_exports.vehicleTypes).values(vehicleTypes2);
  console.log("[Init] Created initial vehicle types");
}
async function initializeSampleData(db) {
  console.log("[Init] ========== \u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\u521D\u671F\u5316\u958B\u59CB ==========");
  console.log("[Init] Database connection:", db ? "OK" : "FAILED");
  if (!db) {
    console.error("[Init] \u274C Database connection failed, cannot initialize sample data");
    return;
  }
  try {
    console.log("[Init] \u65E2\u5B58\u306E\u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\u3092\u524A\u9664\u4E2D...");
    try {
      const { inArray: inArray4, or: or2 } = await import("drizzle-orm");
      const existingSampleVehicles = await db.select({ id: schema_exports.vehicles.id }).from(schema_exports.vehicles).where(
        or2(
          like(schema_exports.vehicles.vehicleNumber, "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB-%"),
          like(schema_exports.vehicles.vehicleNumber, "\u30DE\u30F3\u30B7\u30E7\u30F3-%"),
          like(schema_exports.vehicles.vehicleNumber, "\u5DE5\u5834-%")
        )
      );
      if (existingSampleVehicles.length > 0) {
        const vehicleIds = existingSampleVehicles.map((v) => v.id);
        console.log(`[Init] \u65E2\u5B58\u306E\u30B5\u30F3\u30D7\u30EB\u8ECA\u4E21 ${existingSampleVehicles.length}\u4EF6\u3092\u524A\u9664\u4E2D...`);
        await db.delete(schema_exports.workRecords).where(inArray4(schema_exports.workRecords.vehicleId, vehicleIds));
        await db.delete(schema_exports.vehicleChecks).where(inArray4(schema_exports.vehicleChecks.vehicleId, vehicleIds));
        await db.delete(schema_exports.vehicleMemos).where(inArray4(schema_exports.vehicleMemos.vehicleId, vehicleIds));
        await db.delete(schema_exports.checkRequests).where(inArray4(schema_exports.checkRequests.vehicleId, vehicleIds));
        await db.delete(schema_exports.vehicles).where(inArray4(schema_exports.vehicles.id, vehicleIds));
        console.log(`[Init] \u2705 \u65E2\u5B58\u306E\u30B5\u30F3\u30D7\u30EB\u8ECA\u4E21 ${existingSampleVehicles.length}\u4EF6\u3092\u524A\u9664\u3057\u307E\u3057\u305F`);
      }
      const existingWorkRecords = await db.select({ id: schema_exports.workRecords.id }).from(schema_exports.workRecords).limit(1e4);
      if (existingWorkRecords.length > 0) {
        const workRecordIds = existingWorkRecords.map((r) => r.id);
        await db.delete(schema_exports.workRecords).where(inArray4(schema_exports.workRecords.id, workRecordIds));
        console.log(`[Init] \u2705 \u65E2\u5B58\u306E\u4F5C\u696D\u8A18\u9332 ${existingWorkRecords.length}\u4EF6\u3092\u524A\u9664\u3057\u307E\u3057\u305F`);
      }
      const existingAttendanceRecords = await db.select({ id: schema_exports.attendanceRecords.id }).from(schema_exports.attendanceRecords).limit(1e4);
      if (existingAttendanceRecords.length > 0) {
        const attendanceIds = existingAttendanceRecords.map((r) => r.id);
        await db.delete(schema_exports.attendanceRecords).where(inArray4(schema_exports.attendanceRecords.id, attendanceIds));
        console.log(`[Init] \u2705 \u65E2\u5B58\u306E\u51FA\u9000\u52E4\u8A18\u9332 ${existingAttendanceRecords.length}\u4EF6\u3092\u524A\u9664\u3057\u307E\u3057\u305F`);
      }
      const existingSampleCheckItems = await db.select({ id: schema_exports.checkItems.id }).from(schema_exports.checkItems).where(like(schema_exports.checkItems.name, "\u57FA\u790E%"));
      if (existingSampleCheckItems.length > 0) {
        const checkItemIds = existingSampleCheckItems.map((item) => item.id);
        await db.delete(schema_exports.vehicleChecks).where(inArray4(schema_exports.vehicleChecks.checkItemId, checkItemIds));
        await db.delete(schema_exports.checkItems).where(inArray4(schema_exports.checkItems.id, checkItemIds));
        console.log(`[Init] \u2705 \u65E2\u5B58\u306E\u30B5\u30F3\u30D7\u30EB\u30C1\u30A7\u30C3\u30AF\u9805\u76EE ${existingSampleCheckItems.length}\u4EF6\u3092\u524A\u9664\u3057\u307E\u3057\u305F`);
      }
      const existingSalesBroadcasts = await db.select({ id: schema_exports.salesBroadcasts.id }).from(schema_exports.salesBroadcasts).limit(1e3);
      if (existingSalesBroadcasts.length > 0) {
        const broadcastIds = existingSalesBroadcasts.map((b) => b.id);
        await db.delete(schema_exports.salesBroadcastReads).where(inArray4(schema_exports.salesBroadcastReads.broadcastId, broadcastIds));
        await db.delete(schema_exports.salesBroadcasts).where(inArray4(schema_exports.salesBroadcasts.id, broadcastIds));
        console.log(`[Init] \u2705 \u65E2\u5B58\u306E\u55B6\u696D\u62E1\u6563 ${existingSalesBroadcasts.length}\u4EF6\u3092\u524A\u9664\u3057\u307E\u3057\u305F`);
      }
      const existingCheckRequests = await db.select({ id: schema_exports.checkRequests.id }).from(schema_exports.checkRequests).limit(1e3);
      if (existingCheckRequests.length > 0) {
        const requestIds = existingCheckRequests.map((r) => r.id);
        await db.delete(schema_exports.checkRequests).where(inArray4(schema_exports.checkRequests.id, requestIds));
        console.log(`[Init] \u2705 \u65E2\u5B58\u306E\u30C1\u30A7\u30C3\u30AF\u4F9D\u983C ${existingCheckRequests.length}\u4EF6\u3092\u524A\u9664\u3057\u307E\u3057\u305F`);
      }
    } catch (deleteError) {
      console.warn("[Init] \u65E2\u5B58\u30C7\u30FC\u30BF\u306E\u524A\u9664\u3067\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u304C\u3001\u7D9A\u884C\u3057\u307E\u3059:", deleteError);
    }
    console.log("[Init] ========== \u65B0\u3057\u3044\u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\u3092\u4F5C\u6210\u958B\u59CB ==========");
    try {
      const existingUsers = await db.select({ id: schema_exports.users.id, username: schema_exports.users.username }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(25);
      console.log(`[Init] \u65E2\u5B58\u306E\u30B9\u30BF\u30C3\u30D5\u30E6\u30FC\u30B6\u30FC: ${existingUsers.length}\u4EBA`);
      if (existingUsers.length < 20) {
        const needCount = 20 - existingUsers.length;
        console.log(`[Init] ${needCount}\u4EBA\u306E\u30B9\u30BF\u30C3\u30D5\u30E6\u30FC\u30B6\u30FC\u3092\u8FFD\u52A0\u3057\u307E\u3059`);
        const passwordHash = await bcrypt3.hash("password", 10);
        const newUsers = [];
        for (let i = existingUsers.length + 1; i <= 20; i++) {
          const no = String(i).padStart(3, "0");
          newUsers.push({
            username: `user${no}`,
            password: passwordHash,
            name: `\u30B9\u30BF\u30C3\u30D5${no}`,
            role: "field_worker"
          });
        }
        if (newUsers.length > 0) {
          await db.insert(schema_exports.users).values(newUsers);
          console.log(`[Init] \u2705 ${newUsers.length}\u4EBA\u306E\u30B9\u30BF\u30C3\u30D5\u30E6\u30FC\u30B6\u30FC\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F`);
        }
      } else {
        console.log(`[Init] \u2705 \u30B9\u30BF\u30C3\u30D5\u30E6\u30FC\u30B6\u30FC\u306F\u65E2\u306B20\u4EBA\u4EE5\u4E0A\u5B58\u5728\u3057\u307E\u3059`);
      }
    } catch (error) {
      console.error("[Init] \u274C \u30B9\u30BF\u30C3\u30D5\u30E6\u30FC\u30B6\u30FC\u306E\u521D\u671F\u5316\u3067\u30A8\u30E9\u30FC:", error);
    }
    try {
      console.log("[Init] Starting sample vehicle initialization...");
      const { or: or2 } = await import("drizzle-orm");
      const existingSampleVehicles = await db.select({ id: schema_exports.vehicles.id }).from(schema_exports.vehicles).where(
        or2(
          like(schema_exports.vehicles.vehicleNumber, "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB-%"),
          like(schema_exports.vehicles.vehicleNumber, "\u30DE\u30F3\u30B7\u30E7\u30F3-%"),
          like(schema_exports.vehicles.vehicleNumber, "\u5DE5\u5834-%")
        )
      );
      console.log(`[Init] Found ${existingSampleVehicles.length} existing sample vehicles`);
      if (existingSampleVehicles.length > 0) {
        const vehicleIds = existingSampleVehicles.map((v) => v.id);
        const { inArray: inArray4 } = await import("drizzle-orm");
        await db.delete(schema_exports.workRecords).where(inArray4(schema_exports.workRecords.vehicleId, vehicleIds));
        await db.delete(schema_exports.vehicleChecks).where(inArray4(schema_exports.vehicleChecks.vehicleId, vehicleIds));
        await db.delete(schema_exports.vehicles).where(inArray4(schema_exports.vehicles.id, vehicleIds));
        console.log(`[Init] Deleted ${existingSampleVehicles.length} existing sample vehicles and their related records`);
      }
      const vehicleTypes2 = await db.select({ id: schema_exports.vehicleTypes.id }).from(schema_exports.vehicleTypes).limit(1);
      console.log(`[Init] Found ${vehicleTypes2.length} vehicle types`);
      if (vehicleTypes2.length === 0) {
        console.error("[Init] ERROR: No vehicleTypes found! Cannot create sample vehicles.");
        console.error("[Init] Please ensure vehicle types are initialized before sample data.");
      } else {
        const vehicleTypeId = vehicleTypes2[0].id;
        const buildingProjects = [
          { type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB", number: "001", customer: "\u6771\u4EAC\u4E2D\u592E\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB", minutes: 4800, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-03-15"), checkDueDate: /* @__PURE__ */ new Date("2025-03-10"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "\u5916\u6CE8\u5148A" },
          { type: "\u30DE\u30F3\u30B7\u30E7\u30F3", number: "002", customer: "\u30B5\u30F3\u30E9\u30A4\u30BA\u30DE\u30F3\u30B7\u30E7\u30F3", minutes: 7200, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-04-20"), checkDueDate: /* @__PURE__ */ new Date("2025-04-15"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "no", hasTireReplacement: "summer", outsourcingDestination: "\u5916\u6CE8\u5148B" },
          { type: "\u5DE5\u5834", number: "003", customer: "\u95A2\u6771\u88FD\u9020\u5DE5\u5834", minutes: 3600, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-02-18"), checkDueDate: /* @__PURE__ */ new Date("2025-02-12"), hasCoating: "yes", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null },
          { type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB", number: "004", customer: "\u65B0\u5BBF\u30D3\u30B8\u30CD\u30B9\u30BF\u30EF\u30FC", minutes: 6e3, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-05-25"), checkDueDate: /* @__PURE__ */ new Date("2025-05-20"), hasCoating: "no", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: "\u5916\u6CE8\u5148C" },
          { type: "\u30DE\u30F3\u30B7\u30E7\u30F3", number: "005", customer: "\u30D1\u30FC\u30AF\u30B5\u30A4\u30C9\u30DE\u30F3\u30B7\u30E7\u30F3", minutes: 2400, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-01-12"), checkDueDate: /* @__PURE__ */ new Date("2025-01-08"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: null },
          { type: "\u5DE5\u5834", number: "006", customer: "\u6A2A\u6D5C\u7269\u6D41\u30BB\u30F3\u30BF\u30FC", minutes: 5400, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-04-22"), checkDueDate: /* @__PURE__ */ new Date("2025-04-17"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "\u5916\u6CE8\u5148A" },
          { type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB", number: "007", customer: "\u54C1\u5DDD\u30B0\u30E9\u30F3\u30C9\u30BF\u30EF\u30FC", minutes: 4200, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-03-16"), checkDueDate: /* @__PURE__ */ new Date("2025-03-11"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "summer", outsourcingDestination: "\u5916\u6CE8\u5148B" },
          { type: "\u30DE\u30F3\u30B7\u30E7\u30F3", number: "008", customer: "\u30EA\u30D0\u30FC\u30B5\u30A4\u30C9\u30DE\u30F3\u30B7\u30E7\u30F3", minutes: 6800, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-05-28"), checkDueDate: /* @__PURE__ */ new Date("2025-05-23"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null },
          { type: "\u5DE5\u5834", number: "009", customer: "\u5343\u8449\u98DF\u54C1\u5DE5\u5834", minutes: 3800, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-02-14"), checkDueDate: /* @__PURE__ */ new Date("2025-02-09"), hasCoating: "yes", hasLine: "yes", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: "\u5916\u6CE8\u5148C" },
          { type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB", number: "010", customer: "\u6E0B\u8C37\u30B9\u30AF\u30A8\u30A2\u30D3\u30EB", minutes: 5200, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-04-19"), checkDueDate: /* @__PURE__ */ new Date("2025-04-14"), hasCoating: "no", hasLine: "no", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "\u5916\u6CE8\u5148A" },
          { type: "\u30DE\u30F3\u30B7\u30E7\u30F3", number: "011", customer: "\u30B7\u30C6\u30A3\u30D1\u30FC\u30AF\u30DE\u30F3\u30B7\u30E7\u30F3", minutes: 4600, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-03-17"), checkDueDate: /* @__PURE__ */ new Date("2025-03-12"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "summer", outsourcingDestination: "\u5916\u6CE8\u5148B" },
          { type: "\u5DE5\u5834", number: "012", customer: "\u57FC\u7389\u81EA\u52D5\u8ECA\u90E8\u54C1\u5DE5\u5834", minutes: 6400, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-05-26"), checkDueDate: /* @__PURE__ */ new Date("2025-05-21"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null },
          { type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB", number: "013", customer: "\u4E38\u306E\u5185\u30D3\u30B8\u30CD\u30B9\u30BB\u30F3\u30BF\u30FC", minutes: 3400, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-02-13"), checkDueDate: /* @__PURE__ */ new Date("2025-02-08"), hasCoating: "yes", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "\u5916\u6CE8\u5148C" },
          { type: "\u30DE\u30F3\u30B7\u30E7\u30F3", number: "014", customer: "\u30D5\u30A9\u30EC\u30B9\u30C8\u30DE\u30F3\u30B7\u30E7\u30F3", minutes: 5800, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-04-24"), checkDueDate: /* @__PURE__ */ new Date("2025-04-19"), hasCoating: "no", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: "\u5916\u6CE8\u5148A" },
          { type: "\u5DE5\u5834", number: "015", customer: "\u795E\u5948\u5DDD\u5316\u5B66\u5DE5\u5834", minutes: 4e3, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-03-15"), checkDueDate: /* @__PURE__ */ new Date("2025-03-10"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "yes", hasTireReplacement: "summer", outsourcingDestination: "\u5916\u6CE8\u5148B" },
          { type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB", number: "016", customer: "\u516D\u672C\u6728\u30D2\u30EB\u30BA\u30AA\u30D5\u30A3\u30B9", minutes: 7e3, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-05-29"), checkDueDate: /* @__PURE__ */ new Date("2025-05-24"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null },
          { type: "\u30DE\u30F3\u30B7\u30E7\u30F3", number: "017", customer: "\u30AA\u30FC\u30B7\u30E3\u30F3\u30D3\u30E5\u30FC\u30DE\u30F3\u30B7\u30E7\u30F3", minutes: 3200, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-01-11"), checkDueDate: /* @__PURE__ */ new Date("2025-01-06"), hasCoating: "yes", hasLine: "yes", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: "\u5916\u6CE8\u5148C" },
          { type: "\u5DE5\u5834", number: "018", customer: "\u8328\u57CE\u96FB\u5B50\u90E8\u54C1\u5DE5\u5834", minutes: 5600, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-04-21"), checkDueDate: /* @__PURE__ */ new Date("2025-04-16"), hasCoating: "no", hasLine: "no", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "\u5916\u6CE8\u5148A" },
          { type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB", number: "019", customer: "\u9280\u5EA7\u30B3\u30DE\u30FC\u30B7\u30E3\u30EB\u30D3\u30EB", minutes: 4400, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-03-16"), checkDueDate: /* @__PURE__ */ new Date("2025-03-11"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "summer", outsourcingDestination: "\u5916\u6CE8\u5148B" },
          { type: "\u30DE\u30F3\u30B7\u30E7\u30F3", number: "020", customer: "\u30CF\u30A4\u30C4\u30B0\u30EA\u30FC\u30F3\u30DE\u30F3\u30B7\u30E7\u30F3", minutes: 6200, desiredDeliveryDate: /* @__PURE__ */ new Date("2025-05-27"), checkDueDate: /* @__PURE__ */ new Date("2025-05-22"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null }
        ];
        const sampleVehicles = [];
        for (const building of buildingProjects) {
          sampleVehicles.push({
            vehicleNumber: `${building.type}-${building.number}`,
            vehicleTypeId,
            category: "\u4E00\u822C",
            customerName: building.customer,
            status: "in_progress",
            targetTotalMinutes: building.minutes * 1.2,
            // 目標時間は実績の1.2倍
            desiredDeliveryDate: building.desiredDeliveryDate,
            checkDueDate: building.checkDueDate,
            hasCoating: building.hasCoating,
            hasLine: building.hasLine,
            hasPreferredNumber: building.hasPreferredNumber,
            hasTireReplacement: building.hasTireReplacement,
            outsourcingDestination: building.outsourcingDestination
          });
        }
        await db.insert(schema_exports.vehicles).values(sampleVehicles);
        console.log("[Init] \u2705 Created 20 sample vehicles (\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB/\u30DE\u30F3\u30B7\u30E7\u30F3/\u5DE5\u5834 \u8A0820\u4EF6)");
        try {
          const { or: or3 } = await import("drizzle-orm");
          const vehicles2 = await db.select({ id: schema_exports.vehicles.id, vehicleNumber: schema_exports.vehicles.vehicleNumber, customerName: schema_exports.vehicles.customerName }).from(schema_exports.vehicles).where(
            or3(
              like(schema_exports.vehicles.vehicleNumber, "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB-%"),
              like(schema_exports.vehicles.vehicleNumber, "\u30DE\u30F3\u30B7\u30E7\u30F3-%"),
              like(schema_exports.vehicles.vehicleNumber, "\u5DE5\u5834-%")
            )
          ).orderBy(schema_exports.vehicles.id);
          const processes2 = await db.select({ id: schema_exports.processes.id, name: schema_exports.processes.name }).from(schema_exports.processes).orderBy(schema_exports.processes.displayOrder);
          const adminUser = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "admin")).limit(1);
          const staffUsers = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(20);
          const allUsers = adminUser.length > 0 ? [...adminUser, ...staffUsers] : staffUsers;
          if (vehicles2.length > 0 && processes2.length > 0 && allUsers.length > 0) {
            const { inArray: inArray4 } = await import("drizzle-orm");
            const existingWorkRecords = await db.select({ id: schema_exports.workRecords.id }).from(schema_exports.workRecords).limit(1e4);
            if (existingWorkRecords.length > 0) {
              const workRecordIds = existingWorkRecords.map((r) => r.id);
              await db.delete(schema_exports.workRecords).where(inArray4(schema_exports.workRecords.id, workRecordIds));
              console.log(`[Init] Deleted ${existingWorkRecords.length} existing work records`);
            }
            const workRecords2 = [];
            const baseYear = 2024;
            const baseMonth = 11;
            const baseDay = 1;
            const baseDate = new Date(baseYear, baseMonth, baseDay, 8, 0, 0);
            const buildingProjectsMap = /* @__PURE__ */ new Map([
              ["001", { minutes: 4800, type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB" }],
              ["002", { minutes: 7200, type: "\u30DE\u30F3\u30B7\u30E7\u30F3" }],
              ["003", { minutes: 3600, type: "\u5DE5\u5834" }],
              ["004", { minutes: 6e3, type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB" }],
              ["005", { minutes: 2400, type: "\u30DE\u30F3\u30B7\u30E7\u30F3" }],
              ["006", { minutes: 5400, type: "\u5DE5\u5834" }],
              ["007", { minutes: 4200, type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB" }],
              ["008", { minutes: 6800, type: "\u30DE\u30F3\u30B7\u30E7\u30F3" }],
              ["009", { minutes: 3800, type: "\u5DE5\u5834" }],
              ["010", { minutes: 5200, type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB" }],
              ["011", { minutes: 4600, type: "\u30DE\u30F3\u30B7\u30E7\u30F3" }],
              ["012", { minutes: 6400, type: "\u5DE5\u5834" }],
              ["013", { minutes: 3400, type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB" }],
              ["014", { minutes: 5800, type: "\u30DE\u30F3\u30B7\u30E7\u30F3" }],
              ["015", { minutes: 4e3, type: "\u5DE5\u5834" }],
              ["016", { minutes: 7e3, type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB" }],
              ["017", { minutes: 3200, type: "\u30DE\u30F3\u30B7\u30E7\u30F3" }],
              ["018", { minutes: 5600, type: "\u5DE5\u5834" }],
              ["019", { minutes: 4400, type: "\u30AA\u30D5\u30A3\u30B9\u30D3\u30EB" }],
              ["020", { minutes: 6200, type: "\u30DE\u30F3\u30B7\u30E7\u30F3" }]
            ]);
            for (let userIdx = 0; userIdx < Math.min(allUsers.length, 21); userIdx++) {
              const userId = allUsers[userIdx].id;
              for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                const workDate = new Date(baseDate);
                workDate.setDate(workDate.getDate() + dayOffset);
                const numRecordsPerDay = 2 + dayOffset % 2;
                for (let recordIdx = 0; recordIdx < numRecordsPerDay; recordIdx++) {
                  const vehicle = vehicles2[dayOffset % vehicles2.length];
                  const process2 = processes2[recordIdx % Math.min(processes2.length, 8)];
                  const workMinutes = 120 + recordIdx * 120 + dayOffset * 30;
                  const startTime = new Date(workDate);
                  startTime.setHours(8 + recordIdx * 3, 0, 0, 0);
                  const endTime = new Date(startTime);
                  endTime.setMinutes(endTime.getMinutes() + workMinutes);
                  workRecords2.push({
                    userId,
                    vehicleId: vehicle.id,
                    processId: process2.id,
                    startTime,
                    endTime,
                    workDescription: `${process2.name}\u4F5C\u696D\uFF08${vehicle.customerName || vehicle.vehicleNumber}\uFF09`
                  });
                }
              }
            }
            for (let vehicleIdx = 0; vehicleIdx < vehicles2.length; vehicleIdx++) {
              const vehicle = vehicles2[vehicleIdx];
              const vehicleNumberParts = vehicle.vehicleNumber.split("-");
              const buildingNumber = vehicleNumberParts[vehicleNumberParts.length - 1];
              const buildingData = buildingProjectsMap.get(buildingNumber);
              const totalMinutes = buildingData?.minutes || 4800;
              const processMinutes = [
                Math.floor(totalMinutes * 0.25),
                // 基礎工事: 25%
                Math.floor(totalMinutes * 0.2),
                // 下地工事: 20%
                Math.floor(totalMinutes * 0.15),
                // 電気工事: 15%
                Math.floor(totalMinutes * 0.15),
                // 水道工事: 15%
                Math.floor(totalMinutes * 0.1),
                // 内装工事: 10%
                Math.floor(totalMinutes * 0.1),
                // 外装工事: 10%
                Math.floor(totalMinutes * 0.05)
                // その他: 5%
              ];
              const vehicleWorkDate = new Date(baseDate);
              vehicleWorkDate.setDate(vehicleWorkDate.getDate() + vehicleIdx);
              for (let i = 0; i < Math.min(processes2.length, 8); i++) {
                const process2 = processes2[i];
                const totalMinutes2 = processMinutes[i] || 60;
                const userId = allUsers[i % allUsers.length].id;
                const numRecords = Math.max(1, Math.floor(totalMinutes2 / 240));
                const minutesPerRecord = Math.floor(totalMinutes2 / numRecords);
                for (let j = 0; j < numRecords; j++) {
                  const startTime = new Date(vehicleWorkDate);
                  startTime.setHours(8 + i * 2 + j * 4, 0, 0, 0);
                  const endTime = new Date(startTime);
                  endTime.setMinutes(endTime.getMinutes() + minutesPerRecord);
                  workRecords2.push({
                    userId,
                    vehicleId: vehicle.id,
                    processId: process2.id,
                    startTime,
                    endTime,
                    workDescription: `${process2.name}\u4F5C\u696D${j > 0 ? `\uFF08${j + 1}\u56DE\u76EE\uFF09` : ""}`
                  });
                }
              }
            }
            if (workRecords2.length > 0) {
              await db.insert(schema_exports.workRecords).values(workRecords2);
              console.log(`[Init] \u2705 Created ${workRecords2.length} sample work records`);
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
    try {
      const existingSampleCheckItems = await db.select({ id: schema_exports.checkItems.id }).from(schema_exports.checkItems).where(like(schema_exports.checkItems.name, "\u57FA\u790E%"));
      if (existingSampleCheckItems.length > 0) {
        const checkItemIds = existingSampleCheckItems.map((item) => item.id);
        const { inArray: inArray4 } = await import("drizzle-orm");
        await db.delete(schema_exports.checkItems).where(inArray4(schema_exports.checkItems.id, checkItemIds));
        console.log(`[Init] Deleted ${existingSampleCheckItems.length} existing sample check items`);
      }
      const sampleCheckItems = [
        // 基礎・下地関連
        { category: "\u4E00\u822C", majorCategory: "\u57FA\u790E\u30FB\u4E0B\u5730", minorCategory: "\u57FA\u790E", name: "\u57FA\u790E\u306E\u6C34\u5E73\u78BA\u8A8D", description: "\u57FA\u790E\u304C\u6C34\u5E73\u306B\u306A\u3063\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 1 },
        { category: "\u4E00\u822C", majorCategory: "\u57FA\u790E\u30FB\u4E0B\u5730", minorCategory: "\u57FA\u790E", name: "\u57FA\u790E\u306E\u5F37\u5EA6\u78BA\u8A8D", description: "\u57FA\u790E\u306E\u30B3\u30F3\u30AF\u30EA\u30FC\u30C8\u5F37\u5EA6\u3092\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 2 },
        { category: "\u4E00\u822C", majorCategory: "\u57FA\u790E\u30FB\u4E0B\u5730", minorCategory: "\u65AD\u71B1", name: "\u65AD\u71B1\u6750\u306E\u65BD\u5DE5\u78BA\u8A8D", description: "\u65AD\u71B1\u6750\u304C\u6B63\u3057\u304F\u65BD\u5DE5\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 3 },
        { category: "\u4E00\u822C", majorCategory: "\u57FA\u790E\u30FB\u4E0B\u5730", minorCategory: "\u6839\u592A", name: "\u6839\u592A\u306E\u53D6\u308A\u4ED8\u3051\u78BA\u8A8D", description: "\u6839\u592A\u304C\u6B63\u3057\u304F\u53D6\u308A\u4ED8\u3051\u3089\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 4 },
        { category: "\u4E00\u822C", majorCategory: "\u57FA\u790E\u30FB\u4E0B\u5730", minorCategory: "\u5E8A\u4E0B", name: "\u5E8A\u4E0B\u63DB\u6C17\u306E\u78BA\u8A8D", description: "\u5E8A\u4E0B\u63DB\u6C17\u53E3\u304C\u9069\u5207\u306B\u8A2D\u7F6E\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 5 },
        // 電気関連
        { category: "\u4E00\u822C", majorCategory: "\u96FB\u6C17", minorCategory: "\u914D\u7DDA", name: "\u5C4B\u5185\u914D\u7DDA\u306E\u78BA\u8A8D", description: "\u5C4B\u5185\u914D\u7DDA\u304C\u6B63\u3057\u304F\u65BD\u5DE5\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 6 },
        { category: "\u4E00\u822C", majorCategory: "\u96FB\u6C17", minorCategory: "\u30B3\u30F3\u30BB\u30F3\u30C8", name: "\u30B3\u30F3\u30BB\u30F3\u30C8\u306E\u8A2D\u7F6E\u78BA\u8A8D", description: "\u30B3\u30F3\u30BB\u30F3\u30C8\u304C\u9069\u5207\u306A\u4F4D\u7F6E\u306B\u8A2D\u7F6E\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 7 },
        { category: "\u4E00\u822C", majorCategory: "\u96FB\u6C17", minorCategory: "\u30B9\u30A4\u30C3\u30C1", name: "\u30B9\u30A4\u30C3\u30C1\u306E\u52D5\u4F5C\u78BA\u8A8D", description: "\u3059\u3079\u3066\u306E\u30B9\u30A4\u30C3\u30C1\u304C\u6B63\u5E38\u306B\u52D5\u4F5C\u3059\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 8 },
        { category: "\u4E00\u822C", majorCategory: "\u96FB\u6C17", minorCategory: "\u5206\u96FB\u76E4", name: "\u5206\u96FB\u76E4\u306E\u8A2D\u7F6E\u78BA\u8A8D", description: "\u5206\u96FB\u76E4\u304C\u6B63\u3057\u304F\u8A2D\u7F6E\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 9 },
        { category: "\u4E00\u822C", majorCategory: "\u96FB\u6C17", minorCategory: "\u7167\u660E", name: "\u7167\u660E\u5668\u5177\u306E\u8A2D\u7F6E\u78BA\u8A8D", description: "\u7167\u660E\u5668\u5177\u304C\u6B63\u3057\u304F\u8A2D\u7F6E\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 10 },
        // 水道関連
        { category: "\u4E00\u822C", majorCategory: "\u6C34\u9053", minorCategory: "\u7D66\u6C34", name: "\u7D66\u6C34\u7BA1\u306E\u63A5\u7D9A\u78BA\u8A8D", description: "\u7D66\u6C34\u7BA1\u304C\u6B63\u3057\u304F\u63A5\u7D9A\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 11 },
        { category: "\u4E00\u822C", majorCategory: "\u6C34\u9053", minorCategory: "\u6392\u6C34", name: "\u6392\u6C34\u7BA1\u306E\u52FE\u914D\u78BA\u8A8D", description: "\u6392\u6C34\u7BA1\u306E\u52FE\u914D\u304C\u9069\u5207\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 12 },
        { category: "\u4E00\u822C", majorCategory: "\u6C34\u9053", minorCategory: "\u6C34\u56DE\u308A", name: "\u30AD\u30C3\u30C1\u30F3\u306E\u6C34\u56DE\u308A\u78BA\u8A8D", description: "\u30AD\u30C3\u30C1\u30F3\u306E\u7D66\u6392\u6C34\u304C\u6B63\u5E38\u306B\u52D5\u4F5C\u3059\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 13 },
        { category: "\u4E00\u822C", majorCategory: "\u6C34\u9053", minorCategory: "\u6C34\u56DE\u308A", name: "\u6D17\u9762\u6240\u306E\u6C34\u56DE\u308A\u78BA\u8A8D", description: "\u6D17\u9762\u6240\u306E\u7D66\u6392\u6C34\u304C\u6B63\u5E38\u306B\u52D5\u4F5C\u3059\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 14 },
        { category: "\u4E00\u822C", majorCategory: "\u6C34\u9053", minorCategory: "\u6C34\u56DE\u308A", name: "\u304A\u98A8\u5442\u306E\u6C34\u56DE\u308A\u78BA\u8A8D", description: "\u304A\u98A8\u5442\u306E\u7D66\u6392\u6C34\u304C\u6B63\u5E38\u306B\u52D5\u4F5C\u3059\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 15 },
        // 内装関連
        { category: "\u4E00\u822C", majorCategory: "\u5185\u88C5", minorCategory: "\u58C1", name: "\u58C1\u7D19\u306E\u8CBC\u308A\u4ED8\u3051\u78BA\u8A8D", description: "\u58C1\u7D19\u304C\u6B63\u3057\u304F\u8CBC\u308A\u4ED8\u3051\u3089\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 16 },
        { category: "\u4E00\u822C", majorCategory: "\u5185\u88C5", minorCategory: "\u5E8A", name: "\u5E8A\u6750\u306E\u65BD\u5DE5\u78BA\u8A8D", description: "\u5E8A\u6750\u304C\u6B63\u3057\u304F\u65BD\u5DE5\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 17 },
        { category: "\u4E00\u822C", majorCategory: "\u5185\u88C5", minorCategory: "\u5929\u4E95", name: "\u5929\u4E95\u306E\u65BD\u5DE5\u78BA\u8A8D", description: "\u5929\u4E95\u304C\u6B63\u3057\u304F\u65BD\u5DE5\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 18 },
        { category: "\u4E00\u822C", majorCategory: "\u5185\u88C5", minorCategory: "\u5EFA\u5177", name: "\u30C9\u30A2\u306E\u53D6\u308A\u4ED8\u3051\u78BA\u8A8D", description: "\u30C9\u30A2\u304C\u6B63\u3057\u304F\u53D6\u308A\u4ED8\u3051\u3089\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 19 },
        { category: "\u4E00\u822C", majorCategory: "\u5185\u88C5", minorCategory: "\u5EFA\u5177", name: "\u7A93\u306E\u53D6\u308A\u4ED8\u3051\u78BA\u8A8D", description: "\u7A93\u304C\u6B63\u3057\u304F\u53D6\u308A\u4ED8\u3051\u3089\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 20 },
        // 外装関連
        { category: "\u4E00\u822C", majorCategory: "\u5916\u88C5", minorCategory: "\u5916\u58C1", name: "\u5916\u58C1\u306E\u65BD\u5DE5\u78BA\u8A8D", description: "\u5916\u58C1\u304C\u6B63\u3057\u304F\u65BD\u5DE5\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 21 },
        { category: "\u4E00\u822C", majorCategory: "\u5916\u88C5", minorCategory: "\u5C4B\u6839", name: "\u5C4B\u6839\u306E\u65BD\u5DE5\u78BA\u8A8D", description: "\u5C4B\u6839\u304C\u6B63\u3057\u304F\u65BD\u5DE5\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 22 },
        { category: "\u4E00\u822C", majorCategory: "\u5916\u88C5", minorCategory: "\u96E8\u6A0B", name: "\u96E8\u6A0B\u306E\u53D6\u308A\u4ED8\u3051\u78BA\u8A8D", description: "\u96E8\u6A0B\u304C\u6B63\u3057\u304F\u53D6\u308A\u4ED8\u3051\u3089\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 23 },
        { category: "\u4E00\u822C", majorCategory: "\u5916\u88C5", minorCategory: "\u7384\u95A2", name: "\u7384\u95A2\u30C9\u30A2\u306E\u78BA\u8A8D", description: "\u7384\u95A2\u30C9\u30A2\u304C\u6B63\u3057\u304F\u53D6\u308A\u4ED8\u3051\u3089\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 24 },
        { category: "\u4E00\u822C", majorCategory: "\u5916\u88C5", minorCategory: "\u5916\u69CB", name: "\u5916\u69CB\u5DE5\u4E8B\u306E\u78BA\u8A8D", description: "\u5916\u69CB\u5DE5\u4E8B\u304C\u5B8C\u4E86\u3057\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 25 },
        // 設備関連
        { category: "\u4E00\u822C", majorCategory: "\u8A2D\u5099", minorCategory: "\u7A7A\u8ABF", name: "\u30A8\u30A2\u30B3\u30F3\u306E\u8A2D\u7F6E\u78BA\u8A8D", description: "\u30A8\u30A2\u30B3\u30F3\u304C\u6B63\u3057\u304F\u8A2D\u7F6E\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 26 },
        { category: "\u4E00\u822C", majorCategory: "\u8A2D\u5099", minorCategory: "\u63DB\u6C17", name: "\u63DB\u6C17\u6247\u306E\u52D5\u4F5C\u78BA\u8A8D", description: "\u63DB\u6C17\u6247\u304C\u6B63\u5E38\u306B\u52D5\u4F5C\u3059\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 27 },
        { category: "\u4E00\u822C", majorCategory: "\u8A2D\u5099", minorCategory: "\u7D66\u6E6F", name: "\u7D66\u6E6F\u5668\u306E\u8A2D\u7F6E\u78BA\u8A8D", description: "\u7D66\u6E6F\u5668\u304C\u6B63\u3057\u304F\u8A2D\u7F6E\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 28 },
        { category: "\u4E00\u822C", majorCategory: "\u8A2D\u5099", minorCategory: "\u30AC\u30B9", name: "\u30AC\u30B9\u914D\u7BA1\u306E\u78BA\u8A8D", description: "\u30AC\u30B9\u914D\u7BA1\u304C\u6B63\u3057\u304F\u65BD\u5DE5\u3055\u308C\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 29 },
        { category: "\u4E00\u822C", majorCategory: "\u8A2D\u5099", minorCategory: "\u305D\u306E\u4ED6", name: "\u6700\u7D42\u6E05\u6383\u306E\u78BA\u8A8D", description: "\u6700\u7D42\u6E05\u6383\u304C\u5B8C\u4E86\u3057\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u307E\u3059", displayOrder: 30 }
      ];
      await db.insert(schema_exports.checkItems).values(sampleCheckItems);
      console.log("[Init] \u2705 Created 30 realistic check items for house construction");
    } catch (error) {
      console.warn("[Init] Failed to initialize sample check items:", error);
    }
    try {
      const sampleVehicles = await db.select({ id: schema_exports.vehicles.id }).from(schema_exports.vehicles).where(like(schema_exports.vehicles.vehicleNumber, "\u5BB6-%"));
      if (sampleVehicles.length > 0) {
        const vehicleIds = sampleVehicles.map((v) => v.id);
        const { inArray: inArray4 } = await import("drizzle-orm");
        const existingChecks = await db.select({ id: schema_exports.vehicleChecks.id }).from(schema_exports.vehicleChecks).where(inArray4(schema_exports.vehicleChecks.vehicleId, vehicleIds));
        if (existingChecks.length > 0) {
          const checkIds = existingChecks.map((c) => c.id);
          await db.delete(schema_exports.vehicleChecks).where(inArray4(schema_exports.vehicleChecks.id, checkIds));
          console.log(`[Init] Deleted ${existingChecks.length} existing sample vehicle checks`);
        }
        const checkItems2 = await db.select({ id: schema_exports.checkItems.id }).from(schema_exports.checkItems).where(eq15(schema_exports.checkItems.category, "\u4E00\u822C")).orderBy(schema_exports.checkItems.displayOrder).limit(15);
        const users2 = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(5);
        if (checkItems2.length > 0 && users2.length > 0) {
          const vehicleChecks2 = [];
          const baseDate = /* @__PURE__ */ new Date("2024-12-01T09:00:00+09:00");
          for (let vIdx = 0; vIdx < sampleVehicles.length; vIdx++) {
            const vehicle = sampleVehicles[vIdx];
            const checkedBy = users2[vIdx % users2.length].id;
            for (let cIdx = 0; cIdx < Math.min(checkItems2.length, 10); cIdx++) {
              const checkItem = checkItems2[cIdx];
              const checkedAt = new Date(baseDate);
              checkedAt.setDate(checkedAt.getDate() + vIdx);
              checkedAt.setHours(9 + cIdx, 0, 0, 0);
              const rand = Math.random();
              let status = "checked";
              if (rand < 0.15) {
                status = "needs_recheck";
              } else if (rand < 0.2) {
                status = "unchecked";
              }
              vehicleChecks2.push({
                vehicleId: vehicle.id,
                checkItemId: checkItem.id,
                checkedBy,
                checkedAt,
                status,
                notes: status === "needs_recheck" ? "\u518D\u78BA\u8A8D\u304C\u5FC5\u8981\u3067\u3059" : status === "checked" ? "\u554F\u984C\u3042\u308A\u307E\u305B\u3093" : null
              });
            }
          }
          if (vehicleChecks2.length > 0) {
            await db.insert(schema_exports.vehicleChecks).values(vehicleChecks2);
            console.log(`[Init] \u2705 Created ${vehicleChecks2.length} sample vehicle checks`);
          } else {
            console.warn("[Init] No vehicle checks to insert");
          }
        }
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize sample vehicle checks:", error);
    }
    try {
      const userUpdates = [
        { id: 2, name: "\u52A0\u85E4\u5065\u8CC7", role: "admin" },
        { id: 3, name: "\u53E4\u6FA4\u6E05\u9686", role: "admin" },
        { id: 4, name: "\u91CE\u5CF6\u609F", role: "field_worker" },
        { id: 5, name: "\u76EE\u9ED2\u5F25\u9808\u5B50", role: "field_worker" },
        { id: 6, name: "\u9F4B\u85E4\u7950\u7F8E", role: "field_worker" },
        { id: 7, name: "\u9AD8\u91CE\u6674\u9999", role: "field_worker" },
        { id: 8, name: "\u6E21\u908A\u5343\u5C0B", role: "field_worker" },
        { id: 9, name: "\u91D1\u5B50\u771F\u7531\u7F8E", role: "field_worker" },
        { id: 10, name: "\u9AD8\u91CE\u6DBC\u9999", role: "field_worker" },
        { id: 11, name: "\u6F81\u6728\u82B3\u7F8E", role: "field_worker" },
        { id: 12, name: "\u6A0B\u53E3\u7FA9\u5247", role: "field_worker" },
        { id: 13, name: "\u592A\u7530\u5343\u660E", role: "field_worker" },
        { id: 14, name: "\u5C71\u5D0E\u6B63\u662D", role: "field_worker" },
        { id: 15, name: "\u843D\u5408\u5CB3\u6717", role: "field_worker" },
        { id: 16, name: "\u6F81\u6728\u5065\u6CBB\u90CE", role: "field_worker" },
        { id: 17, name: "\u8FD1\u85E4\u4E00\u6A39", role: "field_worker" },
        { id: 18, name: "\u677E\u6C38\u65ED\u751F", role: "field_worker" },
        { id: 19, name: "\u9234\u6728\u7ADC\u8F14", role: "field_worker" },
        { id: 20, name: "\u6589\u85E4\u653F\u6625", role: "field_worker" },
        { id: 21, name: "\u571F\u7530\u5B8F\u5B50", role: "field_worker" },
        { id: 22, name: "\u7B20\u4E95\u3000\u731B", role: "field_worker" },
        { id: 23, name: "\u9813\u6240\u3000\u6B69", role: "field_worker" },
        { id: 24, name: "\u6C38\u4E95\u5BCC\u7F8E\u83EF", role: "field_worker" },
        { id: 25, name: "\u95A2\u6839\u5149\u7E41", role: "field_worker" },
        { id: 26, name: "\u9752\u6C60\u548C\u78E8", role: "field_worker" },
        { id: 27, name: "\u661F\u3000\u82F1\u5B50", role: "field_worker" },
        { id: 28, name: "\u6D45\u898B\u9053\u5247", role: "field_worker" },
        { id: 29, name: "\u4E0D\u7834\u4FCA\u5178", role: "field_worker" },
        { id: 30, name: "\u670D\u90E8\u3000\u4EAE", role: "field_worker" },
        { id: 31, name: "\u6E21\u8FBA\u3086\u308A\u590F", role: "field_worker" },
        { id: 32, name: "\u5185\u7530\u3000\u967D", role: "field_worker" }
      ];
      for (const u of userUpdates) {
        await db.update(schema_exports.users).set({ name: u.name, role: u.role }).where(eq15(schema_exports.users.id, u.id));
      }
      console.log("[Init] Updated display names and roles for users id 2-32");
    } catch (error) {
      console.warn("[Init] Failed to update user display names:", error);
    }
    try {
      for (let id = 1; id <= 21; id++) {
        const username = id === 1 ? "admin" : `user${String(id - 1).padStart(3, "0")}`;
        await db.update(schema_exports.users).set({ username }).where(eq15(schema_exports.users.id, id));
      }
      console.log("[Init] Updated usernames for users id 1-21 (admin, user001-user020)");
    } catch (error) {
      console.warn("[Init] Failed to update usernames:", error);
    }
    try {
      const existingAttendanceRecords = await db.select({ id: schema_exports.attendanceRecords.id }).from(schema_exports.attendanceRecords).limit(1e4);
      if (existingAttendanceRecords.length > 0) {
        const { inArray: inArray4 } = await import("drizzle-orm");
        const recordIds = existingAttendanceRecords.map((r) => r.id);
        await db.delete(schema_exports.attendanceRecords).where(inArray4(schema_exports.attendanceRecords.id, recordIds));
        console.log(`[Init] Deleted ${existingAttendanceRecords.length} existing attendance records`);
      }
      const staffUsers = await db.select({ id: schema_exports.users.id, name: schema_exports.users.name }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(20);
      if (staffUsers.length > 0) {
        const attendanceRecords2 = [];
        const baseYear = 2024;
        const baseMonth = 11;
        const baseDay = 1;
        for (const user of staffUsers) {
          for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
            const workDate = new Date(baseYear, baseMonth, baseDay + dayOffset);
            const workDateStr = `${workDate.getFullYear()}-${String(workDate.getMonth() + 1).padStart(2, "0")}-${String(workDate.getDate()).padStart(2, "0")}`;
            const dayOfWeek = workDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              continue;
            }
            const clockInHour = 8 + Math.floor(Math.random() * 2);
            const clockInMinute = Math.floor(Math.random() * 60);
            const clockInTime = `${String(clockInHour).padStart(2, "0")}:${String(clockInMinute).padStart(2, "0")}`;
            const clockOutHour = 17 + Math.floor(Math.random() * 2);
            const clockOutMinute = Math.floor(Math.random() * 60);
            const clockOutTime = `${String(clockOutHour).padStart(2, "0")}:${String(clockOutMinute).padStart(2, "0")}`;
            const clockInTotalMinutes = clockInHour * 60 + clockInMinute;
            const clockOutTotalMinutes = clockOutHour * 60 + clockOutMinute;
            const workMinutes = clockOutTotalMinutes - clockInTotalMinutes - 80;
            attendanceRecords2.push({
              userId: user.id,
              workDate: workDateStr,
              clockInTime,
              clockOutTime,
              workMinutes: Math.max(0, workMinutes),
              clockInDevice: "pc",
              clockOutDevice: "pc"
            });
          }
        }
        if (attendanceRecords2.length > 0) {
          for (let i = 0; i < attendanceRecords2.length; i += 1e3) {
            const batch = attendanceRecords2.slice(i, i + 1e3);
            await db.insert(schema_exports.attendanceRecords).values(batch);
          }
          console.log(`[Init] \u2705 Created ${attendanceRecords2.length} sample attendance records (1 month, 20 staff)`);
        }
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize sample attendance records:", error);
    }
    try {
      const existingBroadcasts = await db.select({ id: schema_exports.salesBroadcasts.id }).from(schema_exports.salesBroadcasts).limit(1e3);
      if (existingBroadcasts.length > 0) {
        const { inArray: inArray4 } = await import("drizzle-orm");
        const broadcastIds = existingBroadcasts.map((b) => b.id);
        await db.delete(schema_exports.salesBroadcasts).where(inArray4(schema_exports.salesBroadcasts.id, broadcastIds));
        console.log(`[Init] Deleted ${existingBroadcasts.length} existing sales broadcasts`);
      }
      const sampleVehiclesForBroadcast = await db.select({ id: schema_exports.vehicles.id, vehicleNumber: schema_exports.vehicles.vehicleNumber }).from(schema_exports.vehicles).where(like(schema_exports.vehicles.vehicleNumber, "\u5BB6-%")).limit(10);
      const adminUser = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "admin")).limit(1);
      if (sampleVehiclesForBroadcast.length > 0 && adminUser.length > 0) {
        const broadcasts = [];
        const messages = [
          "\u7D0D\u8ECA\u4E88\u5B9A\u65E5\u304C\u8FD1\u3065\u3044\u3066\u3044\u307E\u3059\u3002\u6700\u7D42\u78BA\u8A8D\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002",
          "\u5916\u6CE8\u5148\u304B\u3089\u306E\u9023\u7D61\u304C\u3042\u308A\u307E\u3057\u305F\u3002\u78BA\u8A8D\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002",
          "\u30B3\u30FC\u30C6\u30A3\u30F3\u30B0\u4F5C\u696D\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002\u6700\u7D42\u30C1\u30A7\u30C3\u30AF\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002",
          "\u5E0C\u671B\u30CA\u30F3\u30D0\u30FC\u306E\u624B\u7D9A\u304D\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002",
          "\u30BF\u30A4\u30E4\u4EA4\u63DB\u4F5C\u696D\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002"
        ];
        for (let i = 0; i < Math.min(sampleVehiclesForBroadcast.length, 5); i++) {
          const vehicle = sampleVehiclesForBroadcast[i];
          const expiresAt = /* @__PURE__ */ new Date("2024-12-31T23:59:59");
          broadcasts.push({
            vehicleId: vehicle.id,
            createdBy: adminUser[0].id,
            message: messages[i % messages.length],
            expiresAt
          });
        }
        if (broadcasts.length > 0) {
          await db.insert(schema_exports.salesBroadcasts).values(broadcasts);
          console.log(`[Init] \u2705 Created ${broadcasts.length} sample sales broadcasts`);
        }
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize sample sales broadcasts:", error);
    }
    try {
      const { sql: sql7 } = await import("drizzle-orm");
      try {
        await db.execute(sql7`SELECT 1 FROM \`bulletinMessages\` LIMIT 1`);
      } catch (error) {
        if (error?.code === "ER_NO_SUCH_TABLE" || error?.message?.includes("doesn't exist")) {
          await db.execute(sql7`
                        CREATE TABLE IF NOT EXISTS \`bulletinMessages\` (
                            \`id\` int NOT NULL AUTO_INCREMENT,
                            \`userId\` int NOT NULL,
                            \`message\` varchar(500) NOT NULL,
                            \`expireDays\` int DEFAULT 5,
                            \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            PRIMARY KEY (\`id\`)
                        )
                    `);
        }
      }
      const existingBulletins = await db.execute(sql7`SELECT id FROM \`bulletinMessages\` LIMIT 1000`);
      if (Array.isArray(existingBulletins) && existingBulletins.length > 0) {
        const bulletinIds = existingBulletins.map((b) => b.id);
        if (bulletinIds.length > 0) {
          await db.execute(sql7`DELETE FROM \`bulletinMessages\` WHERE id IN (${sql7.join(bulletinIds.map((id) => sql7`${id}`), sql7`, `)})`);
          console.log(`[Init] Deleted ${bulletinIds.length} existing bulletin messages`);
        }
      }
      const staffUsers = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(5);
      if (staffUsers.length > 0) {
        const messages = [
          "\u672C\u65E5\u306E\u5B89\u5168\u30DF\u30FC\u30C6\u30A3\u30F3\u30B0\u306F8:00\u304B\u3089\u3067\u3059\u3002",
          "\u65B0\u3057\u3044\u5DE5\u5177\u304C\u5230\u7740\u3057\u307E\u3057\u305F\u3002\u5009\u5EAB\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
          "\u6765\u9031\u306E\u73FE\u5834\u898B\u5B66\u4F1A\u306E\u6E96\u5099\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002",
          "12\u6708\u306E\u7D0D\u8ECA\u4E88\u5B9A\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002\u78BA\u8A8D\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002",
          "\u5E74\u672B\u5E74\u59CB\u306E\u4F11\u696D\u671F\u9593\u306B\u3064\u3044\u3066\u304A\u77E5\u3089\u305B\u3057\u307E\u3059\u3002"
        ];
        for (let i = 0; i < Math.min(staffUsers.length, 5); i++) {
          const user = staffUsers[i];
          await db.execute(sql7`
                        INSERT INTO \`bulletinMessages\` (\`userId\`, \`message\`, \`expireDays\`)
                        VALUES (${user.id}, ${messages[i]}, 5)
                    `);
        }
        console.log(`[Init] \u2705 Created ${Math.min(staffUsers.length, 5)} sample bulletin messages`);
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize sample bulletin messages:", error);
    }
    try {
      const existingCheckRequests = await db.select({ id: schema_exports.checkRequests.id }).from(schema_exports.checkRequests).limit(1e3);
      if (existingCheckRequests.length > 0) {
        const { inArray: inArray4 } = await import("drizzle-orm");
        const requestIds = existingCheckRequests.map((r) => r.id);
        await db.delete(schema_exports.checkRequests).where(inArray4(schema_exports.checkRequests.id, requestIds));
        console.log(`[Init] Deleted ${existingCheckRequests.length} existing check requests`);
      }
      const sampleVehiclesForCheck = await db.select({ id: schema_exports.vehicles.id }).from(schema_exports.vehicles).where(like(schema_exports.vehicles.vehicleNumber, "\u5BB6-%")).limit(10);
      const checkItems2 = await db.select({ id: schema_exports.checkItems.id }).from(schema_exports.checkItems).where(eq15(schema_exports.checkItems.category, "\u4E00\u822C")).limit(10);
      const staffUsers = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(10);
      const adminUser = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "admin")).limit(1);
      if (sampleVehiclesForCheck.length > 0 && checkItems2.length > 0 && staffUsers.length > 0 && adminUser.length > 0) {
        const checkRequests2 = [];
        for (let i = 0; i < Math.min(sampleVehiclesForCheck.length, 5); i++) {
          const vehicle = sampleVehiclesForCheck[i];
          const checkItem = checkItems2[i % checkItems2.length];
          const requestedTo = staffUsers[i % staffUsers.length].id;
          const dueDate = /* @__PURE__ */ new Date("2024-12-31");
          checkRequests2.push({
            vehicleId: vehicle.id,
            checkItemId: checkItem.id,
            requestedBy: adminUser[0].id,
            requestedTo,
            dueDate,
            message: "\u30B5\u30F3\u30D7\u30EB\u30C1\u30A7\u30C3\u30AF\u4F9D\u983C\u3067\u3059\u3002",
            status: "pending"
          });
        }
        if (checkRequests2.length > 0) {
          await db.insert(schema_exports.checkRequests).values(checkRequests2);
          console.log(`[Init] \u2705 Created ${checkRequests2.length} sample check requests`);
        }
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize sample check requests:", error);
    }
    try {
      const { sql: sql7 } = await import("drizzle-orm");
      try {
        await db.execute(sql7`SELECT 1 FROM \`staffScheduleEntries\` LIMIT 1`);
      } catch (error) {
        if (error?.code === "ER_NO_SUCH_TABLE" || error?.message?.includes("doesn't exist")) {
          await db.execute(sql7`
                        CREATE TABLE IF NOT EXISTS \`staffScheduleEntries\` (
                            \`id\` int NOT NULL AUTO_INCREMENT,
                            \`userId\` int NOT NULL,
                            \`scheduleDate\` date NOT NULL,
                            \`status\` varchar(20) NOT NULL,
                            \`comment\` varchar(500),
                            PRIMARY KEY (\`id\`)
                        )
                    `);
        }
      }
      const existingScheduleEntries = await db.execute(sql7`SELECT id FROM \`staffScheduleEntries\` LIMIT 1000`);
      if (Array.isArray(existingScheduleEntries) && existingScheduleEntries.length > 0) {
        const entryIds = existingScheduleEntries.map((e) => e.id);
        if (entryIds.length > 0) {
          await db.execute(sql7`DELETE FROM \`staffScheduleEntries\` WHERE id IN (${sql7.join(entryIds.map((id) => sql7`${id}`), sql7`, `)})`);
          console.log(`[Init] Deleted ${entryIds.length} existing staff schedule entries`);
        }
      }
      const staffUsers = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(20);
      if (staffUsers.length > 0) {
        const baseYear = 2024;
        const baseMonth = 11;
        const baseDay = 1;
        const statuses = ["work", "off", "half", "leave"];
        for (const user of staffUsers) {
          for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
            const scheduleDate = new Date(baseYear, baseMonth, baseDay + dayOffset);
            const dateStr = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, "0")}-${String(scheduleDate.getDate()).padStart(2, "0")}`;
            const dayOfWeek = scheduleDate.getDay();
            const status = dayOfWeek === 0 || dayOfWeek === 6 ? "off" : statuses[dayOffset % statuses.length];
            const comment = status === "work" ? "\u73FE\u5834\u4F5C\u696D" : status === "off" ? "\u4F11\u307F" : status === "half" ? "\u534A\u4F11" : "\u6709\u7D66";
            await db.execute(sql7`
                            INSERT INTO \`staffScheduleEntries\` (\`userId\`, \`scheduleDate\`, \`status\`, \`comment\`)
                            VALUES (${user.id}, ${dateStr}, ${status}, ${comment})
                        `);
          }
        }
        console.log(`[Init] \u2705 Created ${staffUsers.length * 30} sample staff schedule entries (1 month, 20 staff)`);
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize sample staff schedule entries:", error);
    }
    try {
      const { sql: sql7 } = await import("drizzle-orm");
      try {
        await db.execute(sql7`SELECT 1 FROM \`deliverySchedules\` LIMIT 1`);
      } catch (error) {
        if (error?.code === "ER_NO_SUCH_TABLE" || error?.message?.includes("doesn't exist")) {
          await db.execute(sql7`
                        CREATE TABLE IF NOT EXISTS \`deliverySchedules\` (
                            \`id\` int NOT NULL AUTO_INCREMENT,
                            \`vehicleId\` int NOT NULL,
                            \`scheduledDate\` date NOT NULL,
                            \`status\` varchar(20) NOT NULL,
                            \`notes\` varchar(500),
                            PRIMARY KEY (\`id\`)
                        )
                    `);
        }
      }
      const existingDeliverySchedules = await db.execute(sql7`SELECT id FROM \`deliverySchedules\` LIMIT 1000`);
      if (Array.isArray(existingDeliverySchedules) && existingDeliverySchedules.length > 0) {
        const scheduleIds = existingDeliverySchedules.map((s) => s.id);
        if (scheduleIds.length > 0) {
          await db.execute(sql7`DELETE FROM \`deliverySchedules\` WHERE id IN (${sql7.join(scheduleIds.map((id) => sql7`${id}`), sql7`, `)})`);
          console.log(`[Init] Deleted ${scheduleIds.length} existing delivery schedules`);
        }
      }
      const sampleVehicles = await db.select({ id: schema_exports.vehicles.id, vehicleNumber: schema_exports.vehicles.vehicleNumber, desiredDeliveryDate: schema_exports.vehicles.desiredDeliveryDate }).from(schema_exports.vehicles).where(like(schema_exports.vehicles.vehicleNumber, "\u5BB6-%")).limit(20);
      if (sampleVehicles.length > 0) {
        const statuses = ["scheduled", "confirmed", "delivered", "delayed"];
        for (const vehicle of sampleVehicles) {
          const scheduledDate = vehicle.desiredDeliveryDate || /* @__PURE__ */ new Date("2024-12-20");
          const dateStr = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, "0")}-${String(scheduledDate.getDate()).padStart(2, "0")}`;
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const notes = `\u7D0D\u8ECA\u4E88\u5B9A: ${vehicle.vehicleNumber}`;
          await db.execute(sql7`
                        INSERT INTO \`deliverySchedules\` (\`vehicleId\`, \`scheduledDate\`, \`status\`, \`notes\`)
                        VALUES (${vehicle.id}, ${dateStr}, ${status}, ${notes})
                    `);
        }
        console.log(`[Init] \u2705 Created ${sampleVehicles.length} sample delivery schedules`);
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize sample delivery schedules:", error);
    }
    try {
      const existingMemos = await db.select({ id: schema_exports.vehicleMemos.id }).from(schema_exports.vehicleMemos).limit(1e3);
      if (existingMemos.length > 0) {
        const { inArray: inArray4 } = await import("drizzle-orm");
        const memoIds = existingMemos.map((m) => m.id);
        await db.delete(schema_exports.vehicleMemos).where(inArray4(schema_exports.vehicleMemos.id, memoIds));
        console.log(`[Init] Deleted ${existingMemos.length} existing vehicle memos`);
      }
      const sampleVehicles = await db.select({ id: schema_exports.vehicles.id, vehicleNumber: schema_exports.vehicles.vehicleNumber }).from(schema_exports.vehicles).where(like(schema_exports.vehicles.vehicleNumber, "\u5BB6-%")).limit(20);
      const staffUsers = await db.select({ id: schema_exports.users.id, name: schema_exports.users.name }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(10);
      if (sampleVehicles.length > 0 && staffUsers.length > 0) {
        const memos = [];
        const memoMessages = [
          "\u57FA\u790E\u5DE5\u4E8B\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002\u6B21\u306F\u4E0B\u5730\u5DE5\u4E8B\u306B\u9032\u307F\u307E\u3059\u3002",
          "\u96FB\u6C17\u5DE5\u4E8B\u306E\u914D\u7DDA\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002\u30B3\u30F3\u30BB\u30F3\u30C8\u306E\u8A2D\u7F6E\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002",
          "\u6C34\u9053\u5DE5\u4E8B\u306E\u7D66\u6392\u6C34\u7BA1\u63A5\u7D9A\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002",
          "\u5185\u88C5\u5DE5\u4E8B\u306E\u58C1\u7D19\u8CBC\u308A\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002",
          "\u5916\u88C5\u5DE5\u4E8B\u306E\u5916\u58C1\u65BD\u5DE5\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002",
          "\u8A2D\u5099\u5DE5\u4E8B\u306E\u30A8\u30A2\u30B3\u30F3\u8A2D\u7F6E\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002",
          "\u6700\u7D42\u78BA\u8A8D\u306E\u6E05\u6383\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002",
          "\u7D0D\u8ECA\u6E96\u5099\u304C\u6574\u3044\u307E\u3057\u305F\u3002",
          "\u5916\u6CE8\u5148\u304B\u3089\u306E\u9023\u7D61\u304C\u3042\u308A\u307E\u3057\u305F\u3002\u78BA\u8A8D\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002",
          "\u5E0C\u671B\u30CA\u30F3\u30D0\u30FC\u306E\u624B\u7D9A\u304D\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002"
        ];
        for (let i = 0; i < Math.min(sampleVehicles.length, 20); i++) {
          const vehicle = sampleVehicles[i];
          const user = staffUsers[i % staffUsers.length];
          const message = memoMessages[i % memoMessages.length];
          const createdAt = /* @__PURE__ */ new Date("2024-12-01T09:00:00+09:00");
          createdAt.setDate(createdAt.getDate() + i % 10);
          memos.push({
            vehicleId: vehicle.id,
            userId: user.id,
            content: `${vehicle.vehicleNumber}: ${message}`,
            createdAt
          });
        }
        if (memos.length > 0) {
          await db.insert(schema_exports.vehicleMemos).values(memos);
          console.log(`[Init] \u2705 Created ${memos.length} sample vehicle memos`);
        }
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize sample vehicle memos:", error);
    }
    try {
      const vehicles2 = await db.select({ id: schema_exports.vehicles.id, vehicleNumber: schema_exports.vehicles.vehicleNumber }).from(schema_exports.vehicles).where(like(schema_exports.vehicles.vehicleNumber, "\u5BB6-%")).limit(20);
      const processes2 = await db.select({ id: schema_exports.processes.id, name: schema_exports.processes.name }).from(schema_exports.processes).orderBy(schema_exports.processes.displayOrder);
      const staffUsers = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(20);
      if (vehicles2.length > 0 && processes2.length > 0 && staffUsers.length > 0) {
        const additionalWorkRecords = [];
        const baseYear = 2024;
        const baseMonth = 11;
        const baseDay = 1;
        for (let vIdx = 0; vIdx < vehicles2.length; vIdx++) {
          const vehicle = vehicles2[vIdx];
          for (let pIdx = 0; pIdx < Math.min(processes2.length, 8); pIdx++) {
            const process2 = processes2[pIdx];
            const userId = staffUsers[(vIdx + pIdx) % staffUsers.length].id;
            for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
              const workDate = new Date(baseYear, baseMonth, baseDay + vIdx * 2 + dayOffset);
              const workMinutes = 60 + pIdx * 30 + dayOffset * 20;
              const startTime = new Date(workDate);
              startTime.setHours(8 + pIdx, 0, 0, 0);
              const endTime = new Date(startTime);
              endTime.setMinutes(endTime.getMinutes() + workMinutes);
              additionalWorkRecords.push({
                userId,
                vehicleId: vehicle.id,
                processId: process2.id,
                startTime,
                endTime,
                workDescription: `${process2.name}\u4F5C\u696D\uFF08${vehicle.vehicleNumber}\uFF09`
              });
            }
          }
        }
        if (additionalWorkRecords.length > 0) {
          for (let i = 0; i < additionalWorkRecords.length; i += 1e3) {
            const batch = additionalWorkRecords.slice(i, i + 1e3);
            await db.insert(schema_exports.workRecords).values(batch);
          }
          console.log(`[Init] \u2705 Created ${additionalWorkRecords.length} additional sample work records`);
        }
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize additional work records:", error);
    }
    try {
      const vehicles2 = await db.select({ id: schema_exports.vehicles.id }).from(schema_exports.vehicles).where(like(schema_exports.vehicles.vehicleNumber, "\u5BB6-%")).limit(20);
      const checkItems2 = await db.select({ id: schema_exports.checkItems.id }).from(schema_exports.checkItems).where(eq15(schema_exports.checkItems.category, "\u4E00\u822C")).limit(20);
      const staffUsers = await db.select({ id: schema_exports.users.id }).from(schema_exports.users).where(eq15(schema_exports.users.role, "field_worker")).limit(10);
      if (vehicles2.length > 0 && checkItems2.length > 0 && staffUsers.length > 0) {
        const additionalChecks = [];
        const baseDate = /* @__PURE__ */ new Date("2024-12-01T09:00:00+09:00");
        for (let vIdx = 0; vIdx < vehicles2.length; vIdx++) {
          const vehicle = vehicles2[vIdx];
          for (let cIdx = 0; cIdx < Math.min(checkItems2.length, 15); cIdx++) {
            const checkItem = checkItems2[cIdx];
            const checkedBy = staffUsers[(vIdx + cIdx) % staffUsers.length].id;
            const checkedAt = new Date(baseDate);
            checkedAt.setDate(checkedAt.getDate() + vIdx);
            checkedAt.setHours(9 + cIdx % 8, 0, 0, 0);
            const rand = Math.random();
            let status = "checked";
            if (rand < 0.15) {
              status = "needs_recheck";
            } else if (rand < 0.2) {
              status = "unchecked";
            }
            additionalChecks.push({
              vehicleId: vehicle.id,
              checkItemId: checkItem.id,
              checkedBy,
              checkedAt,
              status,
              notes: status === "needs_recheck" ? "\u518D\u78BA\u8A8D\u304C\u5FC5\u8981\u3067\u3059" : status === "checked" ? "\u554F\u984C\u3042\u308A\u307E\u305B\u3093" : null
            });
          }
        }
        if (additionalChecks.length > 0) {
          await db.insert(schema_exports.vehicleChecks).values(additionalChecks);
          console.log(`[Init] \u2705 Created ${additionalChecks.length} additional sample vehicle checks`);
        }
      }
    } catch (error) {
      console.warn("[Init] Failed to initialize additional vehicle checks:", error);
    }
    console.log("[Init] ========== \u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\u521D\u671F\u5316\u5B8C\u4E86 ==========");
  } catch (error) {
    console.error("[Init] ========== \u30B5\u30F3\u30D7\u30EB\u30C7\u30FC\u30BF\u521D\u671F\u5316\u3067\u91CD\u5927\u306A\u30A8\u30E9\u30FC ==========");
    console.error("[Init] \u30A8\u30E9\u30FC\u8A73\u7D30:", error);
    if (error instanceof Error) {
      console.error("[Init] \u30A8\u30E9\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8:", error.message);
      console.error("[Init] \u30A8\u30E9\u30FC\u30B9\u30BF\u30C3\u30AF:", error.stack);
    }
  }
}

// server/_core/index.ts
if (!process.env.TZ) {
  process.env.TZ = "Asia/Tokyo";
}
console.log(`[Server] \u30BF\u30A4\u30E0\u30BE\u30FC\u30F3\u8A2D\u5B9A: ${process.env.TZ}`);
console.log(`[Server] \u73FE\u5728\u306E\u6642\u523B\uFF08JST\uFF09: ${(/* @__PURE__ */ new Date()).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 8700) {
  const maxPort = startPort + 100;
  for (let port = startPort; port <= maxPort; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${maxPort}`);
}
async function startServer() {
  try {
    await initializeDefaultBreakTimes();
  } catch (error) {
    console.warn("[Server] Failed to initialize break times, continuing anyway:", error);
  }
  try {
    await initializeInitialData();
  } catch (error) {
    console.warn("[Server] Failed to initialize initial data, continuing anyway:", error);
  }
  const deleteExpiredBroadcasts = async () => {
    try {
      const { getDb: getDb2, schema } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { lt, inArray: inArray4 } = await import("drizzle-orm");
      const db = await getDb2();
      if (!db) return;
      const now = /* @__PURE__ */ new Date();
      const expiredBroadcasts = await db.select().from(schema.salesBroadcasts).where(lt(schema.salesBroadcasts.expiresAt, now));
      if (expiredBroadcasts.length > 0) {
        const expiredIds = expiredBroadcasts.map((b) => b.id);
        await db.delete(schema.salesBroadcastReads).where(inArray4(schema.salesBroadcastReads.broadcastId, expiredIds));
        await db.delete(schema.salesBroadcasts).where(inArray4(schema.salesBroadcasts.id, expiredIds));
        console.log(`[\u81EA\u52D5\u524A\u9664] ${expiredBroadcasts.length}\u4EF6\u306E\u671F\u9650\u5207\u308C\u62E1\u6563\u3092\u524A\u9664\u3057\u307E\u3057\u305F`);
      }
    } catch (error) {
      console.warn("[\u81EA\u52D5\u524A\u9664] \u671F\u9650\u5207\u308C\u62E1\u6563\u306E\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", error);
    }
  };
  const deleteOldWorkRecordIssueClears = async () => {
    try {
      const { getDb: getDb2, schema } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { lt } = await import("drizzle-orm");
      const db = await getDb2();
      if (!db) return;
      const now = /* @__PURE__ */ new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      const oldRecords = await db.select().from(schema.workRecordIssueClears).where(lt(schema.workRecordIssueClears.clearedAt, oneWeekAgo));
      if (oldRecords.length > 0) {
        await db.delete(schema.workRecordIssueClears).where(lt(schema.workRecordIssueClears.clearedAt, oneWeekAgo));
        console.log(`[\u81EA\u52D5\u524A\u9664] ${oldRecords.length}\u4EF6\u306E1\u9031\u9593\u4EE5\u4E0A\u524D\u306E\u3075\u307F\u304B\u30C1\u30A7\u30C3\u30AF\u8A18\u9332\u3092\u524A\u9664\u3057\u307E\u3057\u305F`);
      }
    } catch (error) {
      if (error?.code === "ER_NO_SUCH_TABLE" || error?.message?.includes("doesn't exist")) {
        return;
      }
      console.warn("[\u81EA\u52D5\u524A\u9664] 1\u9031\u9593\u4EE5\u4E0A\u524D\u306E\u3075\u307F\u304B\u30C1\u30A7\u30C3\u30AF\u8A18\u9332\u306E\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", error);
    }
  };
  const scheduleAutoBackup = async () => {
    try {
      const { createBackup: createBackup2 } = await Promise.resolve().then(() => (init_backup(), backup_exports));
      const result = await createBackup2();
      console.log(`[\u81EA\u52D5\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7] \u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F: ${result.fileName}`);
      console.log(`[\u81EA\u52D5\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7] \u8A18\u9332\u6570:`, result.recordCount);
    } catch (error) {
      console.error("[\u81EA\u52D5\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7] \u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u4F5C\u6210\u30A8\u30E9\u30FC:", error);
    }
  };
  const scheduleNextBackup = () => {
    const now = /* @__PURE__ */ new Date();
    const nextBackup = new Date(now);
    nextBackup.setHours(3, 0, 0, 0);
    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1);
    }
    const msUntilBackup = nextBackup.getTime() - now.getTime();
    setTimeout(async () => {
      await scheduleAutoBackup();
      scheduleNextBackup();
    }, msUntilBackup);
    console.log(`[Server] \u6B21\u56DE\u306E\u81EA\u52D5\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u3092 ${nextBackup.toLocaleString("ja-JP")} \u306B\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u3057\u307E\u3057\u305F`);
  };
  const scheduleAutoClose = async () => {
    try {
      const { getDb: getDb2, schema } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { eq: eq16, and: and9, gte: gte5, lte: lte5, isNull: isNull4 } = await import("drizzle-orm");
      const { startOfDay: startOfDay4, endOfDay: endOfDay4 } = await import("date-fns");
      const { calculateBreakTimeMinutes } = await Promise.resolve().then(() => (init_attendance(), attendance_exports));
      const db = await getDb2();
      if (!db) return;
      const now = /* @__PURE__ */ new Date();
      const today = new Date(now);
      const start = startOfDay4(today);
      const end = endOfDay4(today);
      const unclosedRecords = await db.select().from(schema.attendanceRecords).where(
        and9(
          gte5(schema.attendanceRecords.clockIn, start),
          lte5(schema.attendanceRecords.clockIn, end),
          isNull4(schema.attendanceRecords.clockOut)
        )
      );
      if (unclosedRecords.length === 0) return;
      let count = 0;
      for (const record of unclosedRecords) {
        const year = record.clockIn.getUTCFullYear();
        const month = record.clockIn.getUTCMonth();
        const day = record.clockIn.getUTCDate();
        const clockOutTime = new Date(Date.UTC(year, month, day, 14, 59, 59));
        const totalMinutes = Math.floor(
          (clockOutTime.getTime() - record.clockIn.getTime()) / 1e3 / 60
        );
        const breakMinutes = await calculateBreakTimeMinutes(record.clockIn, clockOutTime, db);
        const workDuration = Math.max(0, totalMinutes - breakMinutes);
        await db.update(schema.attendanceRecords).set({
          clockOut: clockOutTime,
          clockOutDevice: "auto-23:59",
          workDuration
        }).where(eq16(schema.attendanceRecords.id, record.id));
        count++;
      }
      if (count > 0) {
        console.log(`[Server] ${count}\u4EF6\u306E\u672A\u9000\u52E4\u8A18\u9332\u309223:59\u306B\u81EA\u52D5\u9000\u52E4\u51E6\u7406\u3057\u307E\u3057\u305F`);
      }
    } catch (error) {
      console.error("[Server] \u81EA\u52D5\u9000\u52E4\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u30A8\u30E9\u30FC:", error);
    }
  };
  const scheduleNextAutoClose = () => {
    const now = /* @__PURE__ */ new Date();
    const next2359 = new Date(now);
    next2359.setHours(23, 59, 0, 0);
    if (next2359 <= now) {
      next2359.setDate(next2359.getDate() + 1);
    }
    const msUntil2359 = next2359.getTime() - now.getTime();
    setTimeout(() => {
      scheduleAutoClose();
      scheduleNextAutoClose();
    }, msUntil2359);
    console.log(`[Server] \u6B21\u56DE\u306E\u81EA\u52D5\u9000\u52E4\u51E6\u7406\u3092 ${next2359.toLocaleString("ja-JP")} \u306B\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u3057\u307E\u3057\u305F`);
  };
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  const uploadsDir = path6.resolve(process.cwd(), "uploads");
  try {
    if (!fs5.existsSync(uploadsDir)) {
      fs5.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (error) {
    console.error("[server] \u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", error);
  }
  app.use("/uploads", express2.static(uploadsDir));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "9500");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
