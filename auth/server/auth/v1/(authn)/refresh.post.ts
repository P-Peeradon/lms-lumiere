import { defineHandler, type H3Event } from 'nitro';
import { getRequestIP, readBody, HTTPError } from 'nitro/h3';
import { setCookie } from 'h3';
import { useRuntimeConfig } from 'nitro/runtime-config';
import AuthHelper from '#helper/AuthHelper.ts';
import { getRedisJson, setRedisJson, deleteRedisValue } from '#helper/redisClient.ts';
import { queryPgLite } from '#helper/dbClient.ts';
import { type SessionObject, Role, type JWEPayload, ShadowID, University } from '#helper/interface.ts';

export default defineHandler(async (event: H3Event) => {
    const config = useRuntimeConfig();
    const body = await readBody(event).catch(() => null);

    // Accept refresh token from cookie, JSON body or Authorization header
    const cookieHeader = event.req.headers.get('cookie') ?? '';
    const authHeader = event.req.headers.get('authorization') ?? '';
    const maybeFromBody = body && typeof body === 'object' ? (body as any).refresh_token ?? (body as any).refresh : null;

    // Try cookie first (name: refresh), then body, then Authorization Bearer
    let refreshToken: string | null = null;
    const cookieMatch = cookieHeader.match(/(?:^|; )refresh=([^;]+)/i);
    if (cookieMatch) refreshToken = decodeURIComponent(cookieMatch[1]);
    if (!refreshToken && maybeFromBody) refreshToken = String(maybeFromBody);
    if (!refreshToken && authHeader.toLowerCase().startsWith('bearer ')) refreshToken = authHeader.slice(7).trim();

    if (!refreshToken) {
        throw new HTTPError('No refresh token provided', { status: 401, statusText: 'Unauthorized' });
    }

    // If configured to use an external IdP, proxy the refresh to the IdP token endpoint
    if (config.useIdp) {
        const tokenUrl = config.idpTokenUrl as string | undefined;
        const clientId = config.idpClientId as string | undefined;
        const clientSecret = config.idpClientSecret as string | undefined;

        if (!tokenUrl || !clientId) {
            throw new HTTPError('IdP not configured', { 
                status: 500, 
                statusText: 'Server Error' 
            });
        }

        const params = new URLSearchParams();
        params.set('grant_type', 'refresh_token');
        params.set('refresh_token', refreshToken);
        params.set('client_id', clientId);
        if (clientSecret) params.set('client_secret', clientSecret);

        const resp = await fetch(tokenUrl, { method: 'POST', body: params });
        if (!resp.ok) {
            throw new HTTPError('Invalid refresh token', { status: 401, statusText: 'Unauthorized' });
        }

        const payload = await resp.json();

        // If IdP provided a new refresh token, set it as a secure cookie for browser clients
        if (payload.refresh_token) {
            setCookie(event, 'refresh', String(payload.refresh_token), {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                path: '/',
                maxAge: 60 * 60 * 24 * 7
            });
        }

        // Return IdP response (access_token, id_token, etc.) to client
        event.res.status = 200;
        return {
            access_token: payload.access_token,
            id_token: payload.id_token,
            expires_in: payload.expires_in,
            scope: payload.scope
        };
    }

    // Local refresh token flow: lookup mapping refresh:{hash} => sessionID, then load session:{sessionID}
    const refreshHash = await AuthHelper.hashTokenAndIP(refreshToken, config.hmacSecret);

    const sessionId = await getRedisJson<string>(`refresh:${refreshHash}`);
    if (!sessionId) {
        throw new HTTPError('Invalid or revoked refresh token', { status: 401, statusText: 'Unauthorized' });
    }

    const session = await getRedisJson<SessionObject>(`session:${sessionId}`);
    if (!session) {
        // Stale mapping: delete it and reject
        await deleteRedisValue(`refresh:${refreshHash}`);
        throw new HTTPError('Invalid session for refresh token', { status: 401, statusText: 'Unauthorized' });
    }

    // Rotate refresh token: issue new refresh token and update session
    const newRefresh = AuthHelper.generateRefreshToken() as unknown as string;
    session.refreshToken = newRefresh;
    // Optionally update timestamps
    const now = Math.floor(Date.now() / 1000);
    session.iat = now;
    session.exp = now + 7 * 24 * 3600;

    const sessionKey = `session:${sessionId}`;
    const saved = await setRedisJson<SessionObject>(sessionKey, session, 7 * 24 * 3600);
    if (!saved) {
        throw new HTTPError('Failed to update session', { status: 500, statusText: 'Server Error' });
    }

    // Rotate refresh mapping: set new and delete old
    const newHash = await AuthHelper.hashTokenAndIP(newRefresh, config.hmacSecret);
    const mapSet = await setRedisJson<string>(`refresh:${newHash}`, sessionId, 7 * 24 * 3600);
    if (!mapSet) {
        throw new HTTPError('Failed to set new refresh mapping', { status: 500, statusText: 'Server Error' });
    }
    // delete old mapping
    await deleteRedisValue(`refresh:${refreshHash}`);

    // Issue a fresh access token (recreate same behavior as login.post.ts)
    // Credentials (user roles) are stored in pglite; query via helper
    let userRole: Role = Role.Student;
    try {
        const rows = await queryPgLite<any>('SELECT user_role FROM credentials WHERE shadow_id = ?', [session.shadowID as unknown as string]);
        if (Array.isArray(rows) && rows.length > 0) {
            const first = rows[0];
            if (first && first.user_role) userRole = first.user_role as Role;
        }
    } catch (_err) {
        // fallback to default role on any DB error
    }

    const { jweSecret, tokenIPSecret } = config;
    const clientIP = getRequestIP(event) ?? '';

    const tokenPayload: JWEPayload = {
        shadowID: ShadowID.parseShadowID(session.shadowID as unknown as string),
        sessionID: session.sessionID,
        iss: `auth.${session.tenant}` as string,
        aud: ['lumiere'],
        tenant: session.tenant as University,
        device_metadata: event.req.headers.get('user-agent') ?? null,
        role: userRole,
        iat: now,
        exp: now + 3600
    };

    const signed = await AuthHelper.signToken(tokenPayload, session.tenant as University, jweSecret, userRole);
    const jwe = await AuthHelper.encryptToken(signed);
    const hashedToken = await AuthHelper.hashTokenAndIP(jwe, tokenIPSecret);

    // Update hashed token in session record
    session.hashedToken = hashedToken;
    await setRedisJson<SessionObject>(sessionKey, session, 7 * 24 * 3600);

    // Set rotated refresh token cookie for browser clients
    setCookie(event, 'refresh', String(newRefresh), {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 3600
    });

    event.res.status = 200;
    return {
        message: 'refresh successful',
        token: jwe,
        shadowID: session.shadowID
    };
});