import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getUserById } from "../db";
import { getUserIdFromCookie } from "./cookies";
import { ENV } from "./env";

export async function createContext({ req, res }: CreateExpressContextOptions) {
    const userIdStr = await getUserIdFromCookie(req);
    let user = null;
    if (userIdStr) {
        const userId = parseInt(userIdStr);
        if (!isNaN(userId)) {
            user = await getUserById(userId);
        }
    }

    return {
        req,
        res,
        userId: user?.id,
        user,
        isAdmin: user?.role === "admin" || user?.role === "sub_admin" || user?.username === ENV.ownerOpenId,
        isSuperAdmin: user?.role === "admin" || user?.username === ENV.ownerOpenId,
    };
}

export type Context = inferAsyncReturnType<typeof createContext>;

