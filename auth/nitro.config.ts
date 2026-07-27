import { defineConfig } from "nitro"

export default defineConfig({
    serverDir: './server',
    experimental: {
        database: true
    },
    runtimeConfig: {
        hmacSecret: process.env.HMAC_SECRET ?? "",
        jweSecret: process.env.JWE_SECRET ?? "",
        tokenIPSecret: process.env.TOKEN_IP_SECRET ?? "",
        azVaultURL: process.env.AZURE_VAULT_URL ?? "",
        authKeyPairName: process.env.AUTH_KEYPAIR_NAME ?? ""
    },
    database: {
        default: {
            connector: "pglite",
            options: {
                // Persists data to a local file directory inside your project
                dataDir: './.data/credential' 
            }
        }
    },
    plugins: ['./server/plugins/db-init.ts', './server/plugins/az-kvault-init.ts']
});
