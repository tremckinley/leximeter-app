from __future__ import annotations
import asyncio
from typing import Iterable
import aiohttp
from config import DEFAULT_CONFIG, DiscoveryConfig
from models import FetchResult

class AsyncFetcher:
    def __init__(self, config: DiscoveryConfig = DEFAULT_CONFIG):
        self.config = config
        self._session: aiohttp.ClientSession | None = None
    async def __aenter__(self):
        timeout = aiohttp.ClientTimeout(total=self.config.request_timeout_seconds)
        headers = {"User-Agent": self.config.user_agent, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": self.config.accept_language}
        self._session = aiohttp.ClientSession(timeout=timeout, headers=headers, connector=aiohttp.TCPConnector(ssl=self.config.verify_ssl), raise_for_status=False)
        return self
    async def __aexit__(self, exc_type, exc, tb):
        if self._session:
            await self._session.close()
            self._session = None
    @property
    def session(self):
        if self._session is None:
            raise RuntimeError("AsyncFetcher must be used as an async context manager.")
        return self._session
    async def fetch_text(self, url: str) -> FetchResult:
        try:
            async with self.session.get(url, allow_redirects=True, max_redirects=self.config.max_redirects) as response:
                text = await response.text(errors="replace")
                final_url = str(response.url)
                return FetchResult(url, final_url, response.status, response.headers.get("content-type"), text, None, final_url.rstrip("/") != url.rstrip("/"))
        except asyncio.TimeoutError:
            return FetchResult(requested_url=url, error="timeout")
        except aiohttp.TooManyRedirects:
            return FetchResult(requested_url=url, error="too_many_redirects")
        except aiohttp.ClientError as exc:
            return FetchResult(requested_url=url, error=f"client_error: {exc.__class__.__name__}")
        except Exception as exc:
            return FetchResult(requested_url=url, error=f"unexpected_error: {exc.__class__.__name__}")
    async def fetch_many(self, urls: Iterable[str]) -> list[FetchResult]:
        return await asyncio.gather(*[self.fetch_text(url) for url in urls])
