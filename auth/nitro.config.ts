import { defineConfig } from "nitro"

export default defineConfig({
    serverDir: './server',
    experimental: {
        database: true
    },
    runtimeConfig: {
        hmacSecret: process.env.HMAC_SECRET ?? "",
        jweSecret: process.env.JWE_SECRET ?? "",
        runtimeConfig: process.env.AZURE_VAULT_URL ?? ""
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
    plugins: ['./server/plugins/db-init.ts']
});
