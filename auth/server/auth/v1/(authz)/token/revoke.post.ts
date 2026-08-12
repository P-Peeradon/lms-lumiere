import AuthHelper from "#helper/AuthHelper.ts";
import type { JWEPayload, SessionObject } from "#helper/interface.ts";
import { deleteRedisValue, getRedisJson } from "#helper/redisClient.ts";
import { defineHandler, HTTPError, type H3Event } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler(async (event: H3Event) => {
    const { jweSecret, hmacSecret } = useRuntimeConfig();
    const authHeader = event.req.headers.get("authorization") ?? ""; // To get Bearer access token.
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : authHeader.trim();

    if (!token) {
        throw new HTTPError("Missing bearer token", {
            status: 401,
            statusText: "Unauthorized"
        });
    }

    try {
        const payload = (await AuthHelper.decryptToken(token, jweSecret)) as JWEPayload;
        const sessionID = payload.sessionID?.toString();

        if (!sessionID) {
            throw new Error("Session ID missing from token payload");
        }

        const session = await getRedisJson<SessionObject>(`session:${sessionID}`);

        if (session) {
            const refreshHash = await AuthHelper.hashTokenAndIP(String(session.refreshToken), hmacSecret);
            await deleteRedisValue(`session:${sessionID}`);
            await deleteRedisValue(`refresh:${refreshHash}`);
        }

        event.res.status = 200;

        return {
            message: "Session revoked successfully",
            sessionID,
            revoked: true
        };
    } catch (error) {
        throw new HTTPError({
            statusCode: 401,
            message: "Invalid or expired token",
            statusText: "Unauthorized"
        });
    }
});
