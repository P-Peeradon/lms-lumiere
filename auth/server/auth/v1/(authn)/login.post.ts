import { defineHandler, HTTPResponse, type H3Event } from 'nitro';
import { getRequestIP, HTTPError, readBody } from 'nitro/h3';
import * as jose from 'jose';
import { Role, ShadowID, type JWEPayload, type SessionObject } from '#helper/interface.ts';
import { v4 as uuidv4, type UUIDTypes } from 'uuid';
import jweTokenHelper from '#helper/jweToken.ts';
import { createHmac } from 'crypto';
import { useDatabase } from 'nitro/database';
import passwordHelper from '#helper/credential.ts';

const WHITELIST_TENANT = new Set(["university_of_melbourne", "university_of_sydney"]);

export default defineHandler(async (event: H3Event) => {
    const db = useDatabase();
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

    let credential;

    // compare password and username
    try {
        credential = await db.sql`
            SELECT shadow_id, hashed_username, hashed_password, user_role
            FROM credentials
            WHERE hashed_username = encode(hmac(${username}, '', 'sha256'), 'base64')
        ;`;
    } catch {
        throw new HTTPError("Error querying data");
    }

    // { shadow_id, hashed_username, hashed_password, user_role }
    const { rows } = credential;
    if (!rows) {
        throw new HTTPError("User not found", {
            status: 404,
            statusText: "Not Found"
        });
    }

    const { shadow_id, hashed_username, hashed_password, user_role } = rows[0];

    if (!passwordHelper.compareHash(hashed_username as string, passwordHelper.hashCredential(username, "")) ||
        !passwordHelper.verifyPassword(password, hashed_password as string)) {
        throw new HTTPError("User not found", {
            status: 403,
            statusText: "Forbidden"
        });
    }
    
    const clientIP: string | undefined = getRequestIP(event);
    const device: string | null = event.req.headers.get('user-agent');
    const sessionID: UUIDTypes = uuidv4();
    const issue: EpochTimeStamp = new Date().getTime();

    const tokenPayload: JWEPayload = {
        shadow_id: ShadowID.parseShadowID(shadow_id as string),
        session_id: sessionID,
        token_scope: [""],
        tenant: tenant,
        device_metadata: device,
        role: user_role as Role,
        issued_at: issue,
        expiry: issue + (8 * 3600)
    };

    // Issue token
    const jwe = await jweTokenHelper.generateJWEToken(tokenPayload, "");

        // Record session in Redis
    const newSession: SessionObject = {
        sessionId: sessionID,
        hashedToken: passwordHelper.hashCredential(jwe, ""),
        shadowId: ShadowID.parseShadowID("P1502502Y"),
        iat: issue,
        exp: issue + (8 * 3600),
        tenant: tenant,
        hashedIP: passwordHelper.hashCredential(clientIP ?? "", ""),
        userAgent: device ?? ""
    }

    return new HTTPResponse("Login Success", {
        status: 200,
        statusText: "OK"
    })
});