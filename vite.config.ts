import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const appsScript = mode === 'apps-script'

  return {
    plugins: [react(), tailwindcss()],
    base: appsScript ? './' : '/sankalp/',
    build: appsScript
      ? {
          outDir: 'dist-apps-script',
          emptyOutDir: true,
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
              entryFileNames: 'assets/app.js',
              assetFileNames: 'assets/[name][extname]',
            },
          },
        }
      : undefined,
  }
})
