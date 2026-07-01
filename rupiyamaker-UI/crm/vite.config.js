import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Check if running in dev environment (via DEV_PORT env var)
const isDevEnvironment = process.env.DEV_PORT === '8051';
const devPort = isDevEnvironment ? 4522 : 4521;
const backendTarget = isDevEnvironment ? 'https://localhost:8051' : 'http://127.0.0.1:8049';

console.log('🔧 Vite Config:', {
  isDevEnvironment,
  devPort,
  backendTarget,
  DEV_PORT: process.env.DEV_PORT
});

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: devPort,
    host: '0.0.0.0',
    https: isDevEnvironment ? {
      key: fs.readFileSync(path.resolve(__dirname, 'dev-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'dev-cert.pem'))
    } : false,
    allowedHosts: ['crm.fixyourfinance.ai', 'localhost', '156.67.111.95'],
    hmr: isDevEnvironment ? {
      protocol: 'wss',
      host: '156.67.111.95',
      port: devPort,
      clientPort: devPort
    } : {
      // Uses the browser hostname (works before/after DNS for crm.fixyourfinance.ai)
      protocol: 'wss',
      port: 443,
      clientPort: 443
    },
    proxy: {
      // Proxy API requests to backend
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.error('❌ Proxy Error:', err.message);
            console.error('Request URL:', req.url);
            console.error('Target:', backendTarget);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🚀 Proxying Request:', req.method, req.url, '→', `${backendTarget}${req.url}`);
            console.log('Headers:', proxyReq.getHeaders());
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('📥 Response from Backend:', proxyRes.statusCode, req.url);
            if (proxyRes.statusCode >= 400) {
              console.error('❌ Backend Error Response:', proxyRes.statusCode, proxyRes.statusMessage);
            }
            // Rewrite redirect Location headers so the browser follows them
            // through the proxy (avoids CORS errors on trailing-slash redirects)
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
              try {
                const location = proxyRes.headers.location;
                const targetUrl = new URL(backendTarget);
                const redirectUrl = new URL(location, backendTarget);
                // Only rewrite if backend is redirecting to itself
                if (redirectUrl.host === targetUrl.host) {
                  proxyRes.headers.location = '/api' + redirectUrl.pathname + redirectUrl.search;
                }
              } catch (_e) { /* ignore malformed location headers */ }
            }
          });
        },
      }
    }
  },
  plugins: [
    react({
      // Enable React Fast Refresh for better development experience
      fastRefresh: true,
      // Optimize React for production builds
      jsxRuntime: 'automatic'
    }), 
    tailwindcss()
  ],
  
  // Build optimizations for maximum performance
  build: {
    // Target modern browsers for smaller bundles
    target: 'es2020',
    
    // Enable minification
    minify: 'terser',
    
    // Terser options for maximum compression
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.error/warn for debugging
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove verbose console methods only
        passes: 2 // Multiple passes for better compression
      },
      mangle: {
        safari10: true // Fix Safari 10 issues
      }
    },
    
    // Rollup options for advanced optimization
    rollupOptions: {
      output: {
        // Manual chunking for optimal loading
        manualChunks: {
          // Vendor libraries - separate chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@mui/x-date-pickers'],
          'vendor-utils': ['axios', 'dayjs', 'date-fns', 'clsx', 'tailwind-merge'],
          'vendor-office': ['xlsx', 'file-saver', 'jszip'],
          
          // Large components - separate chunks
          'lead-components': [
            './src/components/CreateLead_new.jsx',
            './src/components/LeadCRM.jsx'
          ],
          'employee-components': [
            './src/components/AllEmployees.jsx',
            './src/components/EmployeeDetails.jsx'
          ],
          'task-components': [
            './src/components/Task.jsx',
            './src/components/CreateTask.jsx',
            './src/components/EditTask.jsx'
          ],
          // face-api + TensorFlow: isolated chunk so TF.js backend init
          // (which has side-effects at module parse time) only runs when
          // the face recognition component is actually mounted, never
          // during the initial page load / route evaluation.
          'face-api': ['@vladmandic/face-api']
        },
        
        // Optimize chunk file names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId) {
            const fileName = facadeModuleId.split('/').pop().replace('.jsx', '').replace('.js', '')
            return `chunks/${fileName}-[hash].js`
          }
          return 'chunks/[name]-[hash].js'
        },
        
        // Optimize asset file names
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').pop()
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return 'images/[name]-[hash][extname]'
          }
          if (/css/i.test(extType)) {
            return 'styles/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      },
      
      // External dependencies (if using CDN)
      external: [],
      
      // Input optimizations
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    },
    
    // Chunk size settings
    chunkSizeWarningLimit: 500, // Warning for chunks over 500kb
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Source maps for debugging (disable in production for smaller builds)
    sourcemap: false,
    
    // Report compressed file sizes
    reportCompressedSize: true,
    
    // Optimize assets
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    
    // Output directory
    outDir: 'dist',
    
    // Keep previous builds' hashed chunks on disk — do NOT wipe the output dir.
    // Wiping it (emptyOutDir:true) deletes old chunk files, so any browser tab
    // still running the previous build 404s when it lazy-loads a chunk, causing
    // "component not found / failed to load" (and a white screen if the stale
    // tab's entry script itself was deleted). Keeping old chunks lets already-open
    // tabs finish on the old build while fresh loads get the new index.html +
    // chunks. Truly dead chunks are pruned after 14 days by the build scripts.
    emptyOutDir: false
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'antd',
      '@ant-design/icons',
      'axios',
      'dayjs',
      'jszip'
    ],
    exclude: [
      // Large libraries that should be loaded dynamically
      'xlsx',
      // Exclude face-api and TensorFlow.js from pre-bundling.
      // @vladmandic/face-api initialises TF.js backends (CPU/WebGL) as a
      // side-effect at module parse time, which throws
      // "Cannot read properties of undefined (reading 'fp')" in browsers
      // where the backend is not yet ready.  Excluding it here forces Vite
      // to leave it as a bare dynamic import that only runs when the component
      // is actually rendered, not at bundle evaluation time.
      '@vladmandic/face-api',
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow/tfjs-backend-cpu'
    ]
  },
  
  // Define global constants for tree shaking
  define: {
    __DEV__: JSON.stringify(false),
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  
  // Resolve optimizations
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@pages': path.resolve(__dirname, 'src/pages')
    }
  }
})