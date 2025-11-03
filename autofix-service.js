#!/usr/bin/env node

// Simple Node.js microservice to auto-fix statusType
const http = require('http');
const { exec } = require('child_process');
const url = require('url');

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/fix-latest-status' && req.method === 'GET') {
        console.log('🔧 Auto-fix request received');
        
        // Run the Python script
        exec('cd /home/ubuntu/RupiyaMe && python3 fix_latest_status.py', (error, stdout, stderr) => {
            if (error) {
                console.error('Fix script error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            } else {
                console.log('Fix script output:', stdout);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, output: stdout }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Auto-fix service running on port ${PORT}`);
    console.log(`📡 Endpoint: http://localhost:${PORT}/fix-latest-status`);
});