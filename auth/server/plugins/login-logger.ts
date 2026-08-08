import type { ShadowID } from "#helper/interface.ts";
import { definePlugin } from "nitro";
import { useDatabase } from "nitro/database";
import type { NitroApp } from "nitro/types";
import { v7 as UUIDv7 } from 'uuid';

interface LoginResponse extends Response {
    hashedIP: string,
    message: string,
    token: string,
    shadowID: ShadowID
}

export default definePlugin((nitroApp: NitroApp) => {
    nitroApp.hooks?.hook("response", async (res, event) => {
        const resBody = res.clone();
        const iam = useDatabase("iam_database")
        const { hashedIP, shadowID } = resBody as LoginResponse;

        const loginID: string = UUIDv7();
        const statusCode: number = res.status;
        const success: boolean = statusCode < 400; // HTTP Status code 2xx success, but 4xx and 5xx fail.
        const timeStamp: Date = new Date();
        
        try {
            await iam.sql`
                INSERT INTO logins (login_id, shadow_id, hashed_id, timestamps, success) 
                VALUES (${loginID}, ${shadowID.toString()}, ${hashedIP}, ${timeStamp.getTime()/1000}, ${success});
            `;
        }
        catch (error: any) {
            console.error(error?.message);
        }
    });
});