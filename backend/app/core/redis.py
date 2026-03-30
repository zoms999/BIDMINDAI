import redis
from app.core.config import settings

try:
    if settings.REDIS_URL:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    else:
        redis_client = redis.Redis(
            host=settings.REDIS_HOST, 
            port=settings.REDIS_PORT, 
            decode_responses=True
        )
    # Ping to check connection
    redis_client.ping()
    print("Redis connected successfully.")
except Exception as e:
    print(f"Redis connection failed (HyDE caching will be disabled): {e}")
    redis_client = None
