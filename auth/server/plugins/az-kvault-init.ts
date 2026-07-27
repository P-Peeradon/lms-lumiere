import { DefaultAzureCredential } from "@azure/identity";
import { KeyClient, type KeyVaultKey } from "@azure/keyvault-keys";
import { definePlugin } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";
import type { NitroApp } from "nitro/types";

// Export this variable so your API routes can import it
export let globalPublicJwk: any = null;
export let targetKeyId: string = "";

export default definePlugin(async (nitroApp: NitroApp) => {
    const config = useRuntimeConfig();
    const credential = new DefaultAzureCredential();

    const vaultUrl = config.azVaultURL;
    const keyClient = new KeyClient(vaultUrl, credential);
    const keyName = config.authKeyPairName || "lms-lumiere-auth";

    let azureKey: KeyVaultKey;

    try {
        console.log(`🔍 Checking if RSA key pair "${keyName}" already exists...`);
        // Try to read the existing key first so we don't break active tokens
        azureKey = await keyClient.getKey(keyName);
        console.log(`✅ Existing key found! Reusing Key URL: ${azureKey.id}`);
    } catch (error: any) {
        // RestKeyVault errors standardly use 'KeyNotFound' or status 404
        if (error.statusCode === 404 || error.code === 'KeyNotFound') {
            console.log(`🚀 Key not found. Requesting Azure to generate new RSA key pair: "${keyName}"...`);
            
            azureKey = await keyClient.createRsaKey(keyName, {
                keySize: 4096, // Great security choice!
                publicExponent: 65537
            });
            
            console.log(`✅ New Key Pair created successfully! Unique Key URL: ${azureKey.id}`);
        } else {
            // If it's a 403 Forbidden or network issue, fail loudly so you know your config is broken
            console.error(`❌ Failed to connect to Azure Key Vault: ${error.message}`);
            throw error;
        }
    }

    const publicJwkMaterial = azureKey.key;
    if (!publicJwkMaterial) {
        throw new Error("Failed to retrieve public key properties from Azure asset block.");
    }

    globalPublicJwk = publicJwkMaterial;
    targetKeyId = azureKey.id!;
    console.log("💼 Public JWK successfully mounted to global Nitro server context.");
});