import { defineHandler, HTTPResponse, type H3Event } from 'nitro';
import { getRequestIP, HTTPError, readBody } from 'nitro/h3';

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

        // Issue token

        // Record session in Redis

        return new HTTPResponse(null, {
            status: 200,
            statusText: "OK"
        })

    }
);