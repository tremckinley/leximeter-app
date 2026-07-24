from __future__ import annotations
from dataclasses import asdict, dataclass, field
from typing import Any

@dataclass
class FetchResult:
    requested_url: str
    final_url: str | None = None
    status_code: int | None = None
    content_type: str | None = None
    text: str | None = None
    error: str | None = None
    redirected: bool = False
    @property
    def ok(self) -> bool:
        return self.error is None and self.status_code is not None and 200 <= self.status_code < 400
    def to_dict(self, include_text: bool = False) -> dict[str, Any]:
        data = asdict(self)
        if not include_text and data.get("text"):
            data["text_length"] = len(data["text"])
            data.pop("text", None)
        return data

@dataclass
class DiscoverySeed:
    input_domain: str
    normalized_url: str
    registered_domain: str
    host: str
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

@dataclass
class PageEvidence:
    url: str
    final_url: str | None = None
    status_code: int | None = None
    html_lang: str | None = None
    hreflang_targets: set[str] = field(default_factory=set)
    internal_links: set[str] = field(default_factory=set)
    visible_text: str | None = None
    error: str | None = None
    def to_dict(self, include_text: bool = False) -> dict[str, Any]:
        data = {
            "url": self.url,
            "final_url": self.final_url,
            "status_code": self.status_code,
            "html_lang": self.html_lang,
            "hreflang_targets": sorted(self.hreflang_targets),
            "internal_links": sorted(self.internal_links),
            "error": self.error,
        }
        if include_text:
            data["visible_text"] = self.visible_text
        elif self.visible_text:
            data["visible_text_length"] = len(self.visible_text)
        return data

@dataclass
class DiscoveryResult:
    domain: str
    normalized_start_url: str
    registered_domain: str
    subdomains: set[str] = field(default_factory=set)
    sitemap_urls: set[str] = field(default_factory=set)
    discovered_urls: set[str] = field(default_factory=set)
    hreflang_targets: set[str] = field(default_factory=set)
    candidate_language_paths: set[str] = field(default_factory=set)
    pages: list[PageEvidence] = field(default_factory=list)
    fetch_errors: list[str] = field(default_factory=list)
    def to_dict(self, include_text: bool = False) -> dict[str, Any]:
        return {
            "domain": self.domain,
            "normalized_start_url": self.normalized_start_url,
            "registered_domain": self.registered_domain,
            "subdomains": sorted(self.subdomains),
            "sitemap_urls": sorted(self.sitemap_urls),
            "discovered_urls": sorted(self.discovered_urls),
            "hreflang_targets": sorted(self.hreflang_targets),
            "candidate_language_paths": sorted(self.candidate_language_paths),
            "pages": [p.to_dict(include_text=include_text) for p in self.pages],
            "fetch_errors": self.fetch_errors,
            "counts": {
                "subdomains": len(self.subdomains),
                "sitemaps": len(self.sitemap_urls),
                "urls": len(self.discovered_urls),
                "hreflang_targets": len(self.hreflang_targets),
                "candidate_language_paths": len(self.candidate_language_paths),
                "pages": len(self.pages),
                "fetch_errors": len(self.fetch_errors),
            },
        }

@dataclass
class LanguageFinding:
    code: str
    name: str
    confidence: int = 0
    confidence_label: str | None = None
    sources: set[str] = field(default_factory=set)
    sample_urls: set[str] = field(default_factory=set)
    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "name": self.name,
            "confidence_percent": self.confidence,
            "confidence_label": self.confidence_label,
            "sources": sorted(self.sources),
            "sample_urls": sorted(self.sample_urls)[:5],
        }

@dataclass
class LanguageReport:
    domain: str
    language_count: int
    languages: list[str]
    findings: list[LanguageFinding]
    discovery_counts: dict[str, int]
    warnings: list[dict] = field(default_factory=list)
    def to_dict(self) -> dict[str, Any]:
        return {
            "domain": self.domain,
            "language_count": self.language_count,
            "languages": self.languages,
            "findings": [f.to_dict() for f in self.findings],
            "warnings": self.warnings,
            "discovery_counts": self.discovery_counts,
        }
