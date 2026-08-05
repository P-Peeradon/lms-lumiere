import axios from 'axios';
import { defineHandler, type H3Event } from 'nitro';
import { HTTPError, readBody } from 'nitro/h3';

interface RegisterBody {
    firstName: string;
    lastName: string;
    uniID: string;
    DOB: Date;
    personalEmail: string;
    phone: string;
    address: string;
    nationality: string;
}

export default defineHandler(async (event: H3Event) => {
    const auth_token: string | null = event.req.headers.get("Authorization");
    const body = (await readBody(event)) as RegisterBody;
    
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
    const { role, tenant, shadow_id } = data;
    
    
    
});