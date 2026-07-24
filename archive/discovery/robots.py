from discovery.urls import normalize_url
def robots_url(base_url: str) -> str:
    return normalize_url('/robots.txt', base_url=base_url)
