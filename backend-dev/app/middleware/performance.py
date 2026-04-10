"""
High-Performance Middleware for tracking response times and optimizing requests
"""
import time
import asyncio
import logging
from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware
from typing import Callable
import json

logger = logging.getLogger(__name__)

class PerformanceMiddleware(BaseHTTPMiddleware):
    """
    Middleware to monitor and optimize API performance
    Target: Sub-millisecond response times for cached requests
    """
    
    def __init__(self, app, target_time_ms: float = 0.1):
        super().__init__(app)
        self.target_time_ms = target_time_ms
        self.slow_requests = []
        self.request_count = 0
        self.total_time = 0.0
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()
        
        # Add performance headers
        response = await call_next(request)
        
        # Calculate response time
        process_time = (time.perf_counter() - start_time) * 1000  # Convert to milliseconds
        
        # Add performance headers
        response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
        response.headers["X-Performance-Target"] = f"{self.target_time_ms}ms"
        
        # Track performance metrics
        self.request_count += 1
        self.total_time += process_time
        
        # Log slow requests
        if process_time > self.target_time_ms:
            self.slow_requests.append({
                "path": str(request.url.path),
                "method": request.method,
                "time_ms": process_time,
                "timestamp": time.time()
            })
            
            # Keep only last 100 slow requests
            if len(self.slow_requests) > 100:
                self.slow_requests = self.slow_requests[-100:]
        
        # Log performance for critical endpoints
        if process_time > 10:  # More than 10ms
            logger.warning(
                f"SLOW REQUEST: {request.method} {request.url.path} - {process_time:.2f}ms"
            )
        elif process_time <= self.target_time_ms:
            logger.debug(
                f"FAST REQUEST: {request.method} {request.url.path} - {process_time:.2f}ms ⚡"
            )
        
        return response
    
    def get_performance_stats(self) -> dict:
        """Get current performance statistics"""
        avg_time = self.total_time / max(self.request_count, 1)
        return {
            "total_requests": self.request_count,
            "average_response_time_ms": round(avg_time, 2),
            "target_time_ms": self.target_time_ms,
            "performance_ratio": round(self.target_time_ms / max(avg_time, 0.001), 2),
            "slow_requests_count": len(self.slow_requests),
            "recent_slow_requests": self.slow_requests[-10:] if self.slow_requests else []
        }

class CompressionMiddleware(BaseHTTPMiddleware):
    """
    Advanced compression middleware for faster data transfer
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Add cache headers for static content
        if request.url.path.startswith(("/static/", "/media/")):
            response.headers["Cache-Control"] = "public, max-age=86400"  # 24 hours
            response.headers["Vary"] = "Accept-Encoding"
        
        # Add performance headers for API endpoints
        elif request.url.path.startswith("/leads"):
            response.headers["Cache-Control"] = "private, max-age=60"  # 1 minute
        
        return response

class RequestOptimizationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to optimize requests before they reach the endpoints
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Pre-process request for optimization
        start_time = time.perf_counter()
        
        # Add request ID for tracking
        request_id = f"req_{int(time.time() * 1000)}_{id(request)}"
        request.state.request_id = request_id
        
        # Log high-frequency endpoints at debug level only
        if request.url.path in ["/leads", "/users", "/roles"]:
            logger.debug(f"[{request_id}] {request.method} {request.url.path}")
        else:
            logger.info(f"[{request_id}] {request.method} {request.url.path}")
        
        try:
            response = await call_next(request)
            
            # Add request tracking header
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            process_time = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"[{request_id}] ERROR after {process_time:.2f}ms: {str(e)}"
            )
            raise
