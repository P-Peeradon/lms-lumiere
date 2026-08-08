import axios from 'axios';
import { defineHandler, type H3Event } from 'nitro';
import { HTTPError, readBody } from 'nitro/h3';
import * as AmqpSender from "#network_socket/amqpSender.ts"
import { ShadowID } from '#helper/interface.ts';
import { setRedisJson } from '#helper/redisClient.ts';
import client from "#network_socket/gRPCSocket.ts";
import { useDatabase } from 'nitro/database';

interface RegisterBody {
    firstName: string;
    lastName: string;
    uniID: string;
    DOB: Date;
    personalEmail: string;
    phone: string;
    address: string;
    nationalID: string;
    nationality: string;
    passportID: string;
    newUserShadowID: ShadowID; // The new user get the ShadowID at the application day, not the enrol day.
}

export default defineHandler(async (event: H3Event) => {
    const auth_token: string | null = event.req.headers.get("Authorization");
    const body = (await readBody(event)) as RegisterBody;
    const db = useDatabase();
    
    if (!auth_token || !auth_token.startsWith("Bearer ")) {
        throw new HTTPError("Invalid token", {
            status: 401,
            statusText: "Unauthorized"
        });
    }

    let response;

    try {
        response = await axios.post("/auth/v1/token/verify", {
            token: auth_token
        });

        if (response.data.role !== "central_admin" && response.data.role !== "system_admin") {
        throw new HTTPError("Unauthorized access", {
            status: 403,
            statusText: "Forbidden"
        });
    } 
    } catch (error) {
        throw new HTTPError("Failed to capture data from the server", {
            status: 500,
            statusText: "Internal Server Error"
        });
    }

    const { data } = response;
    const { role, tenant, shadow_id } = data; // requester ShadowID
    const requesterShadowID = ShadowID.parseShadowID(shadow_id);

    const { newUserShadowID, ...personalData } = body;
    const { firstName, lastName } = personalData;
    const username = `${firstName[0]}${lastName}`.toLowerCase();

    try {
        const rpcResponse = await client.encryptedPII({
            tenant,
            requesterShadowID,
            role,
            newUserShadowID,
            ...personalData
        }, { bearerToken: `Bearer ${auth_token}`});
    } catch (error: any) {
        throw new HTTPError(error.message ?? "Unavailable to encrypt data", {
            status: 502,
            statusText: "Service Unavailable"
        })
    }

    const eventPayload = {
        shadowID: newUserShadowID,
        role: "student",
        credentialVersion: "v1"
    };

    AmqpSender.default.emitEvent(
        requesterShadowID,
        "auth.account",
        "account.registered",
        eventPayload,
        tenant
    );

    // Save user credential into internal database.
    try{
        await db.exec(`INSERT INTO credentials (shadow_id, username, user_role) 
                    VALUES (${newUserShadowID}, ${username}, 'student')`);
    } catch (error: any) {
        throw new HTTPError(error?.message, {
            status: 503,
            statusText: "Service Unavailable"
        });
    }

    // Save user data in the MySQL

    event.res.status = 201;

    return {
        success: true,
        message: 'User registration completed',
        shadowID: newUserShadowID
    };
});