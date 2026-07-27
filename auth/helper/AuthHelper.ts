import bcrypt from "bcryptjs";
import { createHmac, Sign } from 'crypto';
import type { JWEPayload, University } from "./interface";
import { CompactEncrypt, EncryptJWT, SignJWT } from "jose";

export class ValueError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
    }
}

class AuthHelper {
    static async hashPassword(rawPassword: string): Promise<string> {
        const lowerCase: RegExp = /[a-z]+/;
        const upperCase: RegExp = /[A=Z]+/;
        const numeric: RegExp = /[0-9]+/;

        if (rawPassword.length < 7) 
            throw new ValueError("Password should be longer than 7 characters");
        if (!lowerCase.test(rawPassword) || !upperCase.test(rawPassword) || !numeric.test(rawPassword))
            throw new ValueError("Password must contain both lowercase and uppercase");

        const hashedPassword: string = await bcrypt.hash(rawPassword, 11);
        return hashedPassword;
    }

    static async hashUsername(rawUsername: string, secret: string): Promise<string> {
        const hashedUsername: string = await createHmac("sha256", secret).update(rawUsername).digest('base64');

        return hashedUsername;
    }

    static async signToken(payload: JWEPayload, tenant: University, jweSecret: string): Promise<string> {
        const secret = new TextEncoder().encode(jweSecret);

        const token: string = await new SignJWT(payload)
            .setProtectedHeader({ alg: 'hs256' })
            .setIssuer(tenant)
            .setAudience(tenant)
            .setExpirationTime('4h')
            .sign(secret);

        return token;
    }

    static async encryptToken(signedToken: string, jweSecret: string): Promise<string> {
        // Convert the secret into raw bytes
        const secret = new TextEncoder().encode(jweSecret);
        
        // Convert the plaintext signed token string into raw bytes
        const tokenBytes = new TextEncoder().encode(signedToken);

        // CompactEncrypt handles confidentiality. This is where 'alg' and 'enc' are defined.
        const encryptedJwe: string = await new CompactEncrypt(tokenBytes)
            .setProtectedHeader({ 
                alg: 'RSA-OAEP-256', // Use RSA-OAEP key wrapping (RSA-OAEP-256 is recommended)
                enc: 'A128GCM',  // The content encryption algorithm you requested
                cty: 'JWT'       // Content Type 'JWT' lets the consumer know a signed token is inside
            })
            .encrypt(secret);

        return encryptedJwe;
    }
}

export default AuthHelper;