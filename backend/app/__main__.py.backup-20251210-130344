if __name__ == "__main__":
    import os
    import sys
    import multiprocessing
    from pathlib import Path
    
    # Get the current directory and adjust SSL certificate paths
    current_dir = Path(__file__).parent
    backend_dir = current_dir.parent
    ssl_keyfile = str(backend_dir / "../ssl.key")
    ssl_certfile = str(backend_dir / "../ssl.crt")
    
    # Check if SSL certificates exist
    ssl_available = os.path.exists(ssl_keyfile) and os.path.exists(ssl_certfile)
    
    # Determine if we're in production or development
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    
    # Import string that works with reload - app is defined in __init__.py
    app_import = "app:app" 
    
    # Add current directory to Python path for proper imports
    if str(current_dir.parent) not in sys.path:
        sys.path.insert(0, str(current_dir.parent))
    
    # Configure Uvicorn for MAXIMUM PERFORMANCE (10K+ concurrent)
    config = {
        "app": app_import,
        "host": "0.0.0.0",
        "port": 8049,
        "loop": "uvloop",               # Ultra-fast event loop
        "http": "httptools",            # Ultra-fast HTTP parser
        "ws": "websockets",             # WebSocket support
        "lifespan": "on",               # Enable lifespan events
        "access_log": False,            # Disable access logs for max performance
        "server_header": False,         # Disable server header for security
        "date_header": False,           # Disable date header for performance
        "log_level": "warning",         # Minimal logging for production speed
        
        # ⚡ HIGH CONCURRENCY SETTINGS
        "backlog": 4096,                # Large listen backlog
        "limit_concurrency": 10000,     # Support 10K concurrent connections
        "limit_max_requests": 50000,    # Max requests per worker
        "timeout_keep_alive": 30,       # Keep connections alive longer
        "timeout_graceful_shutdown": 5, # Fast graceful shutdown
        
        # ⚡ PERFORMANCE OPTIMIZATIONS  
        "h11_max_incomplete_event_size": 65536,  # Larger buffer for HTTP
        "ws_max_size": 16777216,        # 16MB WebSocket message size
        "interface": "asgi3",           # Use ASGI3 interface
    }
    
    # Add SSL if certificates are available
    if ssl_available:
        config.update({
            "ssl_keyfile": ssl_keyfile,
            "ssl_certfile": ssl_certfile,
        })
        print("✓ SSL certificates found - HTTPS enabled")
    else:
        print("⚠ SSL certificates not found - running HTTP only")
    
    if is_production:
        # ⚡ PRODUCTION: Ultra-high performance configuration
        config.update({
            "workers": max(multiprocessing.cpu_count() * 2, 4),  # Reasonable workers for uvicorn
            # Note: worker_class is for gunicorn, not uvicorn
            # "max_requests": 100000,         # Not supported by uvicorn
            # "max_requests_jitter": 10000,   # Not supported by uvicorn
            # "preload_app": True,            # Not supported by uvicorn
            # "keepalive": 30,                # Not supported by uvicorn
            # "worker_connections": 2048,     # Not supported by uvicorn
            # "max_worker_connections": 2048,  # Not supported by uvicorn
            # "worker_tmp_dir": "/dev/shm",   # Not supported by uvicorn
        })
        print(f"🚀 PRODUCTION: {config.get('workers', 'N/A')} workers optimized for 10K+ concurrent requests")
    else:
        # ⚡ DEVELOPMENT: Fast reload with performance
        config.update({
            "reload": False,                # Disable reload for performance testing
            "reload_dirs": [str(current_dir)] if False else [],  # Conditional reload
            "reload_delay": 0.1,            # Faster reload when enabled
            "use_colors": True,             # Colored output
            # "workers": max(multiprocessing.cpu_count() * 4, 8)
            "workers": 1
        })
        print("🔧 DEVELOPMENT: Single worker with performance optimizations")
    
    # Import and run uvicorn
    import uvicorn
    
    print(f"📡 Server starting on {'https' if ssl_available else 'http'}://0.0.0.0:8049")
    print(f"🔥 Optimized for 10K+ concurrent connections")
    print(f"📁 Working directory: {os.getcwd()}")
    print(f"🔍 App import: {app_import}")
    
    uvicorn.run(**config)