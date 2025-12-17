import { parse } from "cookie";
import { jwtVerify, SignJWT } from "jose";
import { ENV } from "./env";

const COOKIE_NAME = "campervan_session";

export async function getUserIdFromCookie(req: { headers: { cookie?: string } }): Promise<string | null> {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = parse(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;

    try {
        const secret = new TextEncoder().encode(ENV.cookieSecret);
        const { payload } = await jwtVerify(token, secret);
        return payload.sub as string | null;
    } catch {
        return null;
    }
}

export async function setAuthCookie(res: any, userId: number) {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const token = await new SignJWT({ sub: userId.toString() })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(secret);

    const isProduction = ENV.isProduction;
    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; ${isProduction ? "Secure; SameSite=Strict" : "SameSite=Lax"}`
    );
}

export function clearAuthCookie(res: any) {
    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
    );
}

