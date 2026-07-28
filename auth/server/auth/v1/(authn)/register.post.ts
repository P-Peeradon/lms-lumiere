import axios from 'axios';
import { defineHandler, type H3Event } from 'nitro';
import { HTTPError, readBody } from 'nitro/h3';

export default defineHandler(async (event: H3Event) => {
    const auth_token: string | null = event.req.headers.get("Authorization");
    
    if (!auth_token || !auth_token.startsWith("Bearer ")) {
        throw new HTTPError("Invalid token", {
            status: 401,
            statusText: "Unauthorized"
        });
    }

    const response = await axios.post("localhost:3000/auth/v1/token/verify", {
        token: auth_token
    })
    
});