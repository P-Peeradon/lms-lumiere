import bcrypt from "bcryptjs";
import { createDecipheriv, createHmac, Sign } from 'crypto';
import type { JWEPayload, University } from "./interface";
import { CompactEncrypt, importJWK, jwtVerify, SignJWT } from "jose";
import { DefaultAzureCredential } from "@azure/identity";
import { CryptographyClient, KeyClient } from "@azure/keyvault-keys";
import { useRuntimeConfig } from "nitro/runtime-config";
import { globalPublicJwk, targetKeyId } from "#server/plugins/az-kvault-init.ts";

export class ValueError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
    }
}

export class CryptoError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
    }
}

class AuthHelper {
    private static config = useRuntimeConfig();
    private static vaultUrl = this.config.azVaultURL;
    private static credential = new DefaultAzureCredential();

    // 1. Initialize our Azure Structural Key Client
    private static keyClient = new KeyClient(this.vaultUrl, this.credential);

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

    static async hashTokenAndIP(rawToken: string, secret: string): Promise<string> {
        const hashedToken: string = await createHmac("sha3-384", secret).update(rawToken).digest('base64');

        return hashedToken;
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

    static async encryptToken(signedToken: string): Promise<string> {
        if (!globalPublicJwk) {
            throw new CryptoError("Error in getting public key from Azure Vault")
        }
        
        const rsaPublicKey = await importJWK(globalPublicJwk, 'RSA-OAEP-256');

        // Convert the plaintext signed token string into raw bytes
        const tokenBytes = new TextEncoder().encode(signedToken);

        // CompactEncrypt handles confidentiality. This is where 'alg' and 'enc' are defined.
        const encryptedJwe: string = await new CompactEncrypt(tokenBytes)
            .setProtectedHeader({ 
                alg: 'RSA-OAEP-256', // Use RSA-OAEP key wrapping (RSA-OAEP-256 is recommended)
                enc: 'A128GCM',  // The content encryption algorithm you requested
                cty: 'JWT'       // Content Type 'JWT' lets the consumer know a signed token is inside
            })
            .encrypt(rsaPublicKey);

        return encryptedJwe;
    }

    static async decryptToken(jweToken: string, jweSecret: string): Promise<JWEPayload> {
        try {
            // Step 1: Parse and unpack JWE -> 5 parts
            const parts = jweToken.split('.');
                if (parts.length !== 5) {
                    throw new CryptoError("Invalid JWE format. Expected 5 dot-separated segments.");
                }

            const [protectedHeaderB64, encryptedKeyB64, ivB64, ciphertextB64, tagB64] = parts;

            // Decode base64url JWE pieces into binary buffers
            const encryptedKeyBuffer = Buffer.from(encryptedKeyB64, 'base64url');
            const ivBuffer = Buffer.from(ivB64, 'base64url');
            const ciphertextBuffer = Buffer.from(ciphertextB64, 'base64url');
            const tagBuffer = Buffer.from(tagB64, 'base64url');
            const aadBuffer = Buffer.from(protectedHeaderB64, 'ascii'); // JWE AAD is the ASCII protected header
            
            // Decrypt by private key stored in Azure.
            const credential = new DefaultAzureCredential();
            
            // Step 2: Send the wrapped key to Azure for decryption.
            // Connect to Azure using the globally cached key ID version string
            const cryptoClient = new CryptographyClient(targetKeyId, credential);

            const azureDecryptResult = await cryptoClient.decrypt({
                algorithm: 'RSA-OAEP-256',
                ciphertext: encryptedKeyBuffer
            });

            const contentEncryptionKey = azureDecryptResult.result; // This is our raw 16-byte AES-GCM key [1]
            
            // 3. Symmetric decryption by AES128.
            const aesDecipher = createDecipheriv('aes-128-gcm', contentEncryptionKey, ivBuffer);

            // Pass the mandatory JWE Authenticated Additional Data (AAD)
            aesDecipher.setAAD(aadBuffer);
            // Pass the trailing GCM authentication tag boundary
            aesDecipher.setAuthTag(tagBuffer);

            // Decrypt the raw payload binary ciphertext
            const decryptedSignedJwsBytes = Buffer.concat([
                aesDecipher.update(ciphertextBuffer),
                aesDecipher.final()
            ]);

            // Turn binary bytes back into the original plain text JWS token string
            const signedTokenString = new TextDecoder().decode(decryptedSignedJwsBytes);

            // Step 4: use jose to verify token.
            const secretBytes = new TextEncoder().encode(jweSecret);

            // Verify signature validity, token expiration (4h), issuer, and audience bounds [1]
            const { payload } = await jwtVerify(signedTokenString, secretBytes);

            return payload as JWEPayload; // Successfully recovered your original payload data!
        } catch (error: any) {
            throw new CryptoError(`Token decryption and validation failed: ${error.message}`)
        }
    }

    static async generateSession() {

    }
}

export default AuthHelper;