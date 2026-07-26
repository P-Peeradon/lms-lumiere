import { defineConfig } from "nitro"

export default defineConfig({
    serverDir: './server',
    experimental: {
        database: true
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
