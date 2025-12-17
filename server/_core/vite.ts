import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
    const serverOptions = {
        middlewareMode: true,
        hmr: { server },
        allowedHosts: true as const,
    };

    const vite = await createViteServer({
        ...viteConfig,
        configFile: false,
        server: serverOptions,
        appType: "custom",
    });

    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
        const url = req.originalUrl;

        // APIルートはスキップ
        if (url.startsWith("/api/")) {
            return next();
        }

        try {
            const clientTemplate = path.resolve(
                import.meta.dirname,
                "../..",
                "client",
                "index.html"
            );

            // always reload the index.html file from disk incase it changes
            let template = await fs.promises.readFile(clientTemplate, "utf-8");
            template = template.replace(
                `src="/src/main.tsx"`,
                `src="/src/main.tsx?v=${nanoid()}"`
            );
            const page = await vite.transformIndexHtml(url, template);
            res.status(200).set({ "Content-Type": "text/html" }).end(page);
        } catch (e) {
            console.error("[vite] Error serving page:", e);
            vite.ssrFixStacktrace(e as Error);
            next(e);
        }
    });
}

export function serveStatic(app: Express) {
    // 本番環境では、ビルド後のdist/publicディレクトリを参照
    // ビルド後のdist/index.jsから見て、dist/publicは同じdistディレクトリ内にある
   const distPath = path.resolve(import.meta.dirname, "../../dist");
    console.log(`Serving static files from: ${distPath}`);
    if (!fs.existsSync(distPath)) {
        console.error(
            `Could not find the build directory: ${distPath}, make sure to build the client first`
        );
        // エラーが発生しても、フォールバックルートを設定する
        app.get("*", (_req, res) => {
            res.status(500).send("Build directory not found. Please run 'pnpm build' first.");
        });
        return;
    }

    // 静的ファイルを配信
    app.use(express.static(distPath, { index: false }));

    // すべてのGETリクエストに対して、APIルート以外はindex.htmlを返す
    app.get("*", (req, res, next) => {
        // APIルートはスキップ
        if (req.originalUrl.startsWith("/api/")) {
            return next();
        }
        const indexPath = path.resolve(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send("index.html not found");
        }
    });
}

