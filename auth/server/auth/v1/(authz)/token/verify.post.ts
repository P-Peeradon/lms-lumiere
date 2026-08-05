import AuthHelper from "#helper/AuthHelper.ts";
import type { JWEPayload } from "#helper/interface.ts";
import { defineHandler, HTTPError, type H3Event } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";
import { ShadowID } from "#helper/interface.ts"

/* 
{
  "iss": "auth.university-enterprise",
  "aud": "university-enterprise",
  "iat": 1721970000,
  "exp": 1721973600,

  "shadow_id": "X8054061K",
  "role": "faculty_admin",
  "tenant": University,

  "session_id": "uuid",
  "device_id": "opaque-device-id",
  "mfa": true
}
*/
export default defineHandler(async (event: H3Event) => {
    const { jweSecret } = useRuntimeConfig();
    const token = event.req.headers.get("authorization")?.replace("Bearer ", "") ?? "";

    try {
        const payload: JWEPayload = await AuthHelper.decryptToken(token, jweSecret);

        const { role, shadow_id, iss, aud, tenant, iat, exp } = payload;
        let shadowID: ShadowID;

        try {
            shadowID = ShadowID.parseShadowID(shadow_id as string);
        } catch {
            throw new HTTPError("Failure to parse the ShadowID", {
                status: 422,
                statusText: "Unprocessable Entity"
            })
        }

        event.res.status = 200;
        return {
            shadowID,
            role,
            iss,
            aud,
            tenant,
            iat,
            exp
        } as JWEPayload; // For attaching to the request header of other api request.
    } catch (error) {
        throw new HTTPError({ 
            statusCode: 401, 
            message: "Invalid token",
            statusText: "Unauthorized"
        });
    }
});