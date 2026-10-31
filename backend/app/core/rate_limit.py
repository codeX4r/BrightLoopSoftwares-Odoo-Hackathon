"""In-memory sliding-window limiter for failed login attempts.

State lives in the API process. If you run several workers or instances, move this to a
shared store (e.g. Redis) so the limits apply across all of them.
"""

import math
import threading
import time
from collections import deque
from functools import lru_cache

from app.core.config import get_settings


class LoginRateLimiter:
    def __init__(
        self,
        max_failures_per_email: int,
        max_failures_per_ip: int,
        window_seconds: int,
    ) -> None:
        self._limits = {"email": max_failures_per_email, "ip": max_failures_per_ip}
        self._window = window_seconds
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _keys(email: str, ip: str) -> dict[str, str]:
        return {"email": f"email:{email}", "ip": f"ip:{ip}"}

    def _prune(self, key: str, now: float) -> deque[float] | None:
        attempts = self._failures.get(key)
        if attempts is None:
            return None
        while attempts and attempts[0] <= now - self._window:
            attempts.popleft()
        if not attempts:
            del self._failures[key]
            return None
        return attempts

    def retry_after(self, email: str, ip: str) -> int | None:
        """Seconds until another attempt is allowed, or None if not currently blocked."""
        now = time.monotonic()
        wait = 0.0
        with self._lock:
            for kind, key in self._keys(email, ip).items():
                attempts = self._prune(key, now)
                if attempts and len(attempts) >= self._limits[kind]:
                    wait = max(wait, attempts[0] + self._window - now)
        return math.ceil(wait) if wait > 0 else None

    def record_failure(self, email: str, ip: str) -> None:
        now = time.monotonic()
        with self._lock:
            for key in self._keys(email, ip).values():
                self._failures.setdefault(key, deque()).append(now)

    def record_success(self, email: str) -> None:
        # Only the per-email counter is reset; the per-IP counter keeps limiting
        # password spraying across many accounts from one client.
        with self._lock:
            self._failures.pop(f"email:{email}", None)

    def clear(self) -> None:
        with self._lock:
            self._failures.clear()


@lru_cache
def get_login_rate_limiter() -> LoginRateLimiter:
    settings = get_settings()
    return LoginRateLimiter(
        max_failures_per_email=settings.login_max_failures_per_email,
        max_failures_per_ip=settings.login_max_failures_per_ip,
        window_seconds=settings.login_failure_window_seconds,
    )
