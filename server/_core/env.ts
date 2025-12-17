export const ENV = {
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
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
};

// デバッグ用：環境変数の状態をログに出力（本番環境でも表示）
console.log("[ENV] MYSQL_URL:", process.env.MYSQL_URL ? "set (length: " + process.env.MYSQL_URL.length + ")" : "not set");
console.log("[ENV] DATABASE_URL:", process.env.DATABASE_URL ? "set (length: " + process.env.DATABASE_URL.length + ")" : "not set");
if (ENV.databaseUrl) {
    const maskedUrl = ENV.databaseUrl.replace(/:([^:@]+)@/, ":****@");
    console.log("[ENV] Using databaseUrl:", maskedUrl);
} else {
    console.log("[ENV] Using databaseUrl: not set");
}
