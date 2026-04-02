from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import ipaddress
import time
from collections import defaultdict
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)

# 한국 IP 대역 (주요 ISP)
KOREA_IP_RANGES = [
    # KT
    "1.0.0.0/8", "14.0.0.0/8", "27.0.0.0/8", "39.7.0.0/16",
    "58.0.0.0/8", "59.0.0.0/8", "60.0.0.0/8", "61.0.0.0/8",
    "106.0.0.0/8", "110.0.0.0/8", "112.0.0.0/8", "114.0.0.0/8",
    "115.0.0.0/8", "116.0.0.0/8", "117.0.0.0/8", "118.0.0.0/8",
    "119.0.0.0/8", "121.0.0.0/8", "122.0.0.0/8", "123.0.0.0/8",
    "124.0.0.0/8", "125.0.0.0/8", "175.0.0.0/8", "180.0.0.0/8",
    "182.0.0.0/8", "183.0.0.0/8", "203.0.0.0/8", "210.0.0.0/8",
    "211.0.0.0/8", "218.0.0.0/8", "220.0.0.0/8", "221.0.0.0/8",
    "222.0.0.0/8", "223.0.0.0/8",
    # SKB
    "106.101.0.0/16", "106.102.0.0/16",
    # LG U+
    "106.240.0.0/12",
    # AWS Korea
    "3.0.0.0/8", "13.0.0.0/8", "15.0.0.0/8", "52.0.0.0/8",
    # GCP Korea
    "34.0.0.0/8", "35.0.0.0/8",
    # Localhost
    "127.0.0.0/8", "::1/128",
    # Private networks
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
]

# Rate limiting storage
request_counts: Dict[str, list] = defaultdict(list)

class SecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, enable_geo_blocking: bool = True, enable_rate_limit: bool = True):
        super().__init__(app)
        self.enable_geo_blocking = enable_geo_blocking
        self.enable_rate_limit = enable_rate_limit
        self.korea_networks = [ipaddress.ip_network(ip_range) for ip_range in KOREA_IP_RANGES]
        
    def is_korean_ip(self, ip_str: str) -> bool:
        """Check if IP is from Korea"""
        try:
            ip = ipaddress.ip_address(ip_str)
            for network in self.korea_networks:
                if ip in network:
                    return True
            return False
        except ValueError:
            logger.warning(f"Invalid IP address: {ip_str}")
            return False
    
    def check_rate_limit(self, ip: str, max_requests: int = 100, window: int = 60) -> bool:
        """
        Rate limiting: max_requests per window seconds
        Default: 100 requests per 60 seconds
        """
        current_time = time.time()
        
        # Clean old requests
        request_counts[ip] = [
            req_time for req_time in request_counts[ip]
            if current_time - req_time < window
        ]
        
        # Check if limit exceeded
        if len(request_counts[ip]) >= max_requests:
            return False
        
        # Add current request
        request_counts[ip].append(current_time)
        return True
    
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host if request.client else "Unknown"
        
        # Check for X-Forwarded-For (proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        # Skip security checks for health endpoints
        if request.url.path in ["/health", "/ready"]:
            return await call_next(request)
        
        # Geo-blocking: Korea only
        if self.enable_geo_blocking:
            if not self.is_korean_ip(client_ip):
                logger.warning(f"Blocked non-Korean IP: {client_ip} accessing {request.url.path}")
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": "Access denied. Service is only available in Korea.",
                        "error_code": "GEO_BLOCKED"
                    }
                )
        
        # Rate limiting
        if self.enable_rate_limit:
            if not self.check_rate_limit(client_ip, max_requests=100, window=60):
                logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Too many requests. Please try again later.",
                        "error_code": "RATE_LIMIT_EXCEEDED"
                    }
                )
        
        response = await call_next(request)
        return response
