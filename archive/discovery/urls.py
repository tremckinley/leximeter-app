from __future__ import annotations
import re
from urllib.parse import urljoin, urlparse, urlunparse
try:
    import tldextract
except Exception:
    tldextract = None
from models import DiscoverySeed

LANG_PATH_RE = re.compile(r"^/([a-z]{2})(?:[-_]([a-z]{2}))?(?:/|$)", re.IGNORECASE)

def ensure_scheme(value: str, default_scheme: str = "https") -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Domain or URL cannot be empty.")
    if not cleaned.startswith(("http://", "https://")):
        cleaned = f"{default_scheme}://{cleaned}"
    return cleaned

def strip_default_port(netloc: str) -> str:
    if netloc.endswith(":443"):
        return netloc[:-4]
    if netloc.endswith(":80"):
        return netloc[:-3]
    return netloc

def normalize_url(url: str, base_url: str | None = None, keep_query: bool = False) -> str | None:
    if not url:
        return None
    candidate = url.strip()
    if candidate.startswith(("mailto:", "tel:", "javascript:", "#")):
        return None
    if base_url:
        candidate = urljoin(base_url, candidate)
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/") + "/"
    return urlunparse((parsed.scheme.lower(), strip_default_port(parsed.netloc.lower()), path, "", parsed.query if keep_query else "", ""))

def get_host(url: str) -> str:
    return strip_default_port(urlparse(ensure_scheme(url)).netloc.lower())

def get_registered_domain(host_or_url: str) -> str:
    host = get_host(host_or_url) if "://" in host_or_url else strip_default_port(host_or_url.lower().strip())
    if tldextract is not None:
        ext = tldextract.extract(host)
        if ext.domain and ext.suffix:
            return f"{ext.domain}.{ext.suffix}"
    parts = [p for p in host.split(".") if p]
    return ".".join(parts[-2:]) if len(parts) >= 2 else host

def same_registered_domain(url: str, registered_domain: str) -> bool:
    try:
        return get_registered_domain(url) == registered_domain.lower().strip()
    except Exception:
        return False

def build_discovery_seed(domain_or_url: str) -> DiscoverySeed:
    normalized = normalize_url(ensure_scheme(domain_or_url))
    if normalized is None:
        raise ValueError(f"Could not normalize input: {domain_or_url}")
    host = get_host(normalized)
    return DiscoverySeed(domain_or_url, normalized, get_registered_domain(host), host)

def extract_candidate_language_path(url: str) -> str | None:
    match = LANG_PATH_RE.match(urlparse(url).path or "")
    if not match:
        return None
    language = match.group(1).lower()
    region = match.group(2).lower() if match.group(2) else None
    return f"/{language}-{region}/" if region else f"/{language}/"
