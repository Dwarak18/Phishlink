import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: ''
        },
        {
          src: 'src/popup.html',
          dest: 'src'
        },
        {
          src: 'src/options.html',
          dest: 'src'
        },
        {
          src: 'icons/*',
          dest: 'icons'
        },
        {
          src: 'src/styles/*',
          dest: 'src/styles'
        }
      ]
    })
  ],
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.jsx'),
        'popup-fallback': resolve(__dirname, 'src/popup.js'),
        background: resolve(__dirname, 'src/background.js'),
        'gmail-content': resolve(__dirname, 'src/contentScripts/gmail-content.js'),
        'outlook-content': resolve(__dirname, 'src/contentScripts/outlook-content.js'),
        options: resolve(__dirname, 'src/options.js'),
        utils: resolve(__dirname, 'src/utils.js')
      },
      
      output: {
        entryFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId;
          if (facadeModuleId?.includes('contentScripts/')) {
            return 'src/contentScripts/[name].js';
          }
          if (facadeModuleId?.includes('src/')) {
            return 'src/[name].js';
          }
          return '[name].js';
        },
        
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'src/styles/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    
    // Extension-specific settings
    minify: true,
    sourcemap: false,
    target: 'es2020',
    
    // Ensure compatibility with extension environment
    cssCodeSplit: false,
    
    // Don't inline small assets
    assetsInlineLimit: 0
  },
  
  // Development server settings
  server: {
    port: 3000,
    open: false
  },
  
  // Define global constants
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})