import { defineHandler, HTTPResponse, type H3Event } from 'nitro';
import { getRequestIP, HTTPError, readBody } from 'nitro/h3';
import { Role, ShadowID, University, type JWEPayload, type SessionObject } from '#helper/interface.ts';
import { v4 as uuidv4, type UUIDTypes } from 'uuid';
import AuthHelper from '#helper/AuthHelper.ts';
import { useDatabase } from 'nitro/database';
import passwordHelper from '#helper/credential.ts';
import { useRuntimeConfig } from 'nitro/runtime-config';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';

const WHITELIST_TENANT = new Set(["university_of_melbourne", "university_of_sydney"]);

interface UserPacket {
    shadow_id: ShadowID, 
    hashed_username: string, 
    hashed_password: string, 
    user_role: Role
}

interface LoginPayload { 
    username: string, 
    password: string, 
    tenant: University 
}

export default defineHandler(async (event: H3Event) => {
    const db = useDatabase();
    const config = useRuntimeConfig();
    const { jweSecret, hmacSecret } = config;
    const body = await readBody(event);
    const contentType = event.req.headers.get("Content-Type") ?? "";

    if (typeof body !== "object" || contentType.toLowerCase() !== "application/json" ) {
        throw new HTTPError("Format of data payload is not valid: JSON only.", {
            status: 422,
            statusText: "Unprocessable Content"
        })
    }

    const { username, password, tenant } = body as LoginPayload;

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

    let row: UserPacket | undefined;

    // compare password and username
    try {
        const statement = db.prepare(`SELECT shadow_id, hashed_username, hashed_password, user_role
            FROM credentials
            WHERE hashed_username = encode(hmac(?, '', 'sha256'), 'base64');`)

        row = (await statement.get(username)) as UserPacket;
    } catch {
        throw new HTTPError("Error querying data", {
            status: 500,
            statusText: "Internal Server Error"
        });
    }

    // { shadow_id, hashed_username, hashed_password, user_role }
    if (!row) {
        throw new HTTPError("User not found", {
            status: 404,
            statusText: "Not Found"
        });
    }

    const { shadow_id, hashed_username, hashed_password, user_role } = row;
    const bufferUsername = Buffer.from(await AuthHelper.hashUsername(username, hmacSecret), "base64");
    const bufferUsernameCredential = Buffer.from(hashed_username, "base64")

    if (!timingSafeEqual(bufferUsernameCredential, bufferUsername) ||
        !bcrypt.compareSync(password, hashed_password)) {
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
    const signedJWT = await AuthHelper.signToken(tokenPayload, tenant, jweSecret);
    const jweToken = await AuthHelper.encryptToken(signedJWT);

    // Record session in Redis
    const newSession: SessionObject = {
        sessionId: sessionID,
        hashedToken: passwordHelper.hashCredential(jweToken, ""),
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