import { defineHandler, HTTPResponse, type H3Event } from 'nitro';
import { getRequestIP, HTTPError, readBody } from 'nitro/h3';
import * as jose from 'jose';
import { Role, ShadowID, type JWEPayload, type SessionObject } from '#helper/interface.ts';
import { v4 as uuidv4, type UUIDTypes } from 'uuid';
import jweTokenHelper from '#helper/jweToken.ts';
import { createHmac } from 'crypto';

const WHITELIST_TENANT = new Set(["university_of_melbourne", "university_of_sydney"]);

export default defineHandler(async (event: H3Event) => {
        const body = await readBody(event);
        let payload;

        try {
            payload = JSON.parse(body as any);
        } catch {
            throw new HTTPError("Error in parsing JSON request", {
                status: 500,
                statusText: "Internal Server Error"
            });
        }

        const { username, password, tenant } = payload;

        if (!username || !password || !tenant) {
            throw new HTTPError("Please include username, password and tenant for login", {
                status: 400,
                statusText: "Bad Request"
            });
        } else if (WHITELIST_TENANT.has(tenant)) {
            throw new HTTPError("Your university is not registered as our tenant.", {
                status: 412,
                statusText: "Precondition Failed"
            });
        }

        const clientIP: string | undefined = getRequestIP(event);
        const device: string | null = event.req.headers.get('user-agent');
        const sessionID: UUIDTypes = uuidv4();
        const issue: EpochTimeStamp = new Date().getTime();

        const tokenPayload: JWEPayload = {
            shadow_id: ShadowID.parseShadowID("P1502502Y"),
            session_id: sessionID,
            token_scope: [""],
            tenant: tenant,
            device_metadata: device,
            role: Role.Student,
            issued_at: issue,
            expiry: issue + (8 * 3600)
        };

        // Issue token
        const jwe = await jweTokenHelper.generateJWEToken(tokenPayload, "");

        // Record session in Redis
        const newSession: SessionObject = {
            sessionId: sessionID,
            hashedToken: createHmac('sha256', "").update(jwe).digest('base64'),
            shadowId: ShadowID.parseShadowID("P1502502Y"),
            iat: issue,
            exp: issue + (8 * 3600),
            tenant: tenant,
            hashedIP: createHmac('sha256', "").update(clientIP ?? "").digest('base64'),
            userAgent: device ?? ""
        }

        return new HTTPResponse("Login Success", {
            status: 200,
            statusText: "OK"
        })

    }
);