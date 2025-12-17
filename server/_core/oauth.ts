import type { Express } from "express";

export function registerOAuthRoutes(app: Express) {
    // OAuth routes will be implemented here
    // For now, just a placeholder to prevent import errors
    app.get("/api/oauth/callback", (_req, res) => {
        res.status(501).json({ error: "OAuth not implemented" });
    });
}

