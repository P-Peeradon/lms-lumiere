import type { SessionObject, ShadowID } from "#helper/interface.ts";
import { deleteRedisValue, findRedisJsonByAttribute } from "#helper/redisClient.ts";
import AuthHelper from '#helper/AuthHelper.ts';
import { useRuntimeConfig } from 'nitro/runtime-config';
import axios from "axios";
import { defineHandler, HTTPError, type H3Event } from "nitro";
import type { UUIDTypes } from "uuid";

async function getSessionByShadowID(shadowID: ShadowID) {
    return await findRedisJsonByAttribute<SessionObject>("*", "shadowID", shadowID);
}

export default defineHandler(async (event: H3Event) => {
    try {
        const response = await axios.post("/token/verify");
        if (!response) {
            throw new HTTPError("Invalid token", {
                status: 401,
                statusText: "Unauthorised"
            });
        }
        
        const { shadowID } = response.data;
        // let activeSession: Record<string, SessionObject>;

        try {
            const activeSession: Record<string, SessionObject> = await getSessionByShadowID(shadowID);
            if (!activeSession) {
                throw new HTTPError("No active session", {
                    status: 404,
                    statusText: "Not Found"
                });
            }
            
            const sessionEntries = Object.entries(activeSession) as [string, SessionObject][];
            const config = useRuntimeConfig();

            await Promise.all(sessionEntries.map(async ([id, sess]) => {
                // delete refresh mapping if present
                try {
                    if (sess && sess.refreshToken) {
                        const refreshHash = await AuthHelper.hashTokenAndIP(sess.refreshToken as unknown as string, config.hmacSecret);
                        await deleteRedisValue(`refresh:${refreshHash}`);
                    }
                } catch {}
                await deleteRedisValue(id);
            }));

            event.res.status = 204;
            event.res.statusText = "No Content";
        } catch (error: any) {
            throw new HTTPError(
                error?.message ?? "Error in deleting session from Redis", {
                    status: 500,
                    statusText: "Internal Server Error"
            });
        }
    } catch {
        throw new HTTPError("Error in logout process", {
            status: 500,
            statusText: "Internal Server Error"
        })
    }
    
})