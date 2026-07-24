from dataclasses import dataclass

@dataclass(frozen=True)
class DiscoveryConfig:
    request_timeout_seconds: int = 20
    max_redirects: int = 10
    user_agent: str = "Mozilla/5.0 (compatible; TNC-LanguageDiscovery/0.5)"
    accept_language: str = "en-US,en;q=0.9"
    verify_ssl: bool = True
    max_sitemaps: int = 50
    max_sitemap_urls: int = 5000
    max_pages: int = 100
    max_depth: int = 2
    max_links_per_page: int = 100
    min_text_chars_for_detection: int = 300
    language_confidence_threshold: int = 40

DEFAULT_CONFIG = DiscoveryConfig()
