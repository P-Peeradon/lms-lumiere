import type { SessionObject, ShadowID } from "#helper/interface.ts";
import { deleteRedisValue, findRedisJsonByAttribute } from "#helper/redisClient.ts";
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
            
            const sessionIDs: string[] = Object.keys(activeSession);

            await Promise.all(sessionIDs.map(id => deleteRedisValue(id)));

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