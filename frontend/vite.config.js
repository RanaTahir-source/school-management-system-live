import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            // Proxied server-side by Vite's Node process, so the browser only ever
            // talks to its own origin (localhost:5173) - this avoids Chrome's
            // "Local Network Access" permission prompt that blocks page JS from
            // fetching another localhost port directly.
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/api/, ''); },
            },
        },
    },
});
