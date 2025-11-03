"""
High-performance caching system for API optimization
Designed for sub-millisecond response times and 10K+ concurrent requests
"""
import asyncio
import time
import json
import hashlib
from typing import Any, Dict, Optional, Callable, Union, List
from functools import wraps
import logging

logger = logging.getLogger(__name__)

class HighPerformanceCache:
    """Ultra-fast in-memory cache with TTL and LRU eviction"""
    
    def __init__(self, max_size: int = 10000, default_ttl: int = 300):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.access_times: Dict[str, float] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._lock = asyncio.Lock()
    
    def _generate_key(self, *args, **kwargs) -> str:
        """Generate cache key from function arguments"""
        key_data = f"{args}{sorted(kwargs.items())}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        async with self._lock:
            if key not in self.cache:
                return None
            
            entry = self.cache[key]
            current_time = time.time()
            
            # Check if expired
            if current_time > entry['expires_at']:
                del self.cache[key]
                if key in self.access_times:
                    del self.access_times[key]
                return None
            
            # Update access time for LRU
            self.access_times[key] = current_time
            return entry['value']
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with TTL"""
        if ttl is None:
            ttl = self.default_ttl
        
        async with self._lock:
            # Evict old entries if cache is full
            if len(self.cache) >= self.max_size:
                await self._evict_lru()
            
            current_time = time.time()
            self.cache[key] = {
                'value': value,
                'expires_at': current_time + ttl,
                'created_at': current_time
            }
            self.access_times[key] = current_time
    
    async def _evict_lru(self) -> None:
        """Evict least recently used entries"""
        if not self.access_times:
            return
        
        # Remove 10% of entries (LRU)
        evict_count = max(1, len(self.access_times) // 10)
        sorted_keys = sorted(self.access_times.items(), key=lambda x: x[1])
        
        for key, _ in sorted_keys[:evict_count]:
            self.cache.pop(key, None)
            self.access_times.pop(key, None)
    
    async def invalidate(self, pattern: str) -> None:
        """Invalidate cache entries matching pattern"""
        async with self._lock:
            keys_to_remove = [k for k in self.cache.keys() if pattern in k]
            for key in keys_to_remove:
                self.cache.pop(key, None)
                self.access_times.pop(key, None)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            'size': len(self.cache),
            'max_size': self.max_size,
            'hit_ratio': getattr(self, '_hit_count', 0) / max(getattr(self, '_request_count', 1), 1)
        }

# Global cache instance
cache = HighPerformanceCache(max_size=50000, default_ttl=300)

def cached_response(ttl: int = 300, cache_key_func: Optional[Callable] = None):
    """
    Decorator for caching API responses
    
    Args:
        ttl: Time to live in seconds
        cache_key_func: Custom function to generate cache key
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            if cache_key_func:
                cache_key = cache_key_func(*args, **kwargs)
            else:
                cache_key = f"{func.__name__}:{cache._generate_key(*args, **kwargs)}"
            
            # Try to get from cache
            start_time = time.time()
            cached_result = await cache.get(cache_key)
            
            if cached_result is not None:
                logger.debug(f"Cache HIT for {func.__name__} in {(time.time() - start_time)*1000:.2f}ms")
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache.set(cache_key, result, ttl)
            
            logger.debug(f"Cache MISS for {func.__name__} in {(time.time() - start_time)*1000:.2f}ms")
            return result
        
        return wrapper
    return decorator

def invalidate_cache_pattern(pattern: str):
    """Invalidate cache entries matching pattern"""
    return asyncio.create_task(cache.invalidate(pattern))

# Quick access functions for common patterns
async def cache_user_permissions(user_id: str, permissions: Dict[str, Any]):
    """Cache user permissions for fast access"""
    await cache.set(f"user_permissions:{user_id}", permissions, ttl=1800)  # 30 minutes

async def get_cached_user_permissions(user_id: str) -> Optional[Dict[str, Any]]:
    """Get cached user permissions"""
    return await cache.get(f"user_permissions:{user_id}")

async def cache_leads_list(user_id: str, filters: str, leads_data: List[Dict], ttl_seconds: int = 60):
    """
    Cache leads list for specific user and filters
    
    Args:
        user_id: User ID
        filters: Filter string for cache key generation
        leads_data: List of lead data to cache
        ttl_seconds: Time to live in seconds (default: 60 seconds)
    """
    cache_key = f"leads_list:{user_id}:{hashlib.md5(filters.encode()).hexdigest()}"
    await cache.set(cache_key, leads_data, ttl=ttl_seconds)

async def get_cached_leads_list(user_id: str, filters: str, ttl_seconds: int = None) -> Optional[List[Dict]]:
    """
    Get cached leads list
    
    Args:
        user_id: User ID
        filters: Filter string for cache key generation
        ttl_seconds: If provided, updates the TTL when setting the cache in cache miss scenarios
    """
    cache_key = f"leads_list:{user_id}:{hashlib.md5(filters.encode()).hexdigest()}"
    return await cache.get(cache_key)

# Generic cache functions for route optimization
async def cache_response(cache_key: str, response_data: Any, ttl: int = 300):
    """Cache any response data with TTL"""
    await cache.set(cache_key, response_data, ttl)

async def get_cached_response(cache_key: str) -> Optional[Any]:
    """Get any cached response data"""
    return await cache.get(cache_key)

# Cache warming functions
async def warm_cache():
    """Pre-warm cache with frequently accessed data"""
    logger.info("🔥 Warming up cache...")
    # Implementation would go here to pre-load common data
    pass

# Performance monitoring
class PerformanceMonitor:
    def __init__(self):
        self.request_times = []
        self.slow_queries = []
    
    def record_request_time(self, endpoint: str, duration: float):
        """Record request timing"""
        self.request_times.append((endpoint, duration, time.time()))
        
        # Track slow queries (>100ms)
        if duration > 0.1:
            self.slow_queries.append((endpoint, duration, time.time()))
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        if not self.request_times:
            return {"avg_response_time": 0, "slow_queries": 0}
        
        recent_times = [t[1] for t in self.request_times[-1000:]]  # Last 1000 requests
        return {
            "avg_response_time": sum(recent_times) / len(recent_times),
            "slow_queries": len([q for q in self.slow_queries if q[2] > time.time() - 3600]),  # Last hour
            "cache_stats": cache.get_stats()
        }

performance_monitor = PerformanceMonitor()
