import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/diffviewer/',
  build: {
    outDir: './dist'
  },
  plugins: [react()],
})
