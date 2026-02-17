import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Check if running in dev environment (via DEV_PORT env var)
const isDevEnvironment = process.env.DEV_PORT === '8050';
const devPort = isDevEnvironment ? 4522 : 4521;
const backendTarget = isDevEnvironment ? 'https://localhost:8050' : 'https://rupiyamaker.com';

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
    allowedHosts: ['rupiyamaker.com', 'localhost', '156.67.111.95'],
    hmr: isDevEnvironment ? {
      protocol: 'ws',
      host: 'localhost',
      port: devPort,
      clientPort: devPort
    } : {
      protocol: 'wss',
      host: 'rupiyamaker.com',
      port: 443,
      clientPort: 443
    },
    proxy: {
      // Proxy API requests to backend
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
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
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'], // Remove specific console methods
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
          ]
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
    
    // Clear output directory before build
    emptyOutDir: true
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
      'xlsx'
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