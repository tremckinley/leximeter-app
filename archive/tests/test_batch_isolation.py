from pathlib import Path
from types import SimpleNamespace

import pytest

import main


class FakeDiscovery:
    def __init__(self, domain, languages):
        self.domain = domain
        self.normalized_start_url = f"https://{domain}/"
        self.registered_domain = domain
        self.hreflang_targets = set()
        self.candidate_language_paths = set()
        self.subdomains = {domain}
        self.discovered_urls = {f"https://{domain}/"}
        self.pages = []
        self._languages = languages

    def to_dict(self, include_text=False):
        return {
            "domain": self.domain,
            "counts": {"urls": 1, "pages": 0},
            "languages_for_test": self._languages,
        }


class FakeReport:
    def __init__(self, domain, languages):
        self.domain = domain
        self.language_count = len(languages)
        self.languages = languages
        self.findings = []
        self.discovery_counts = {}
        self.warnings = []

    def to_dict(self):
        return {
            "domain": self.domain,
            "language_count": self.language_count,
            "languages": self.languages,
            "findings": [],
            "warnings": [],
        }


@pytest.mark.asyncio
async def test_each_domain_uses_fresh_discoverer_and_aggregator(monkeypatch):
    created_discoverers = []
    created_aggregators = []

    class FakeDiscoverer:
        def __init__(self):
            created_discoverers.append(self)

        async def discover(self, domain):
            languages = ["Spanish (High, 90%)"] if "gym" in domain else ["English (High, 90%)"]
            if domain == "gymshark.com":
                languages = ["English (High, 90%)", "Spanish (High, 90%)"]
            return FakeDiscovery(domain, languages)

    class FakeAggregator:
        def __init__(self):
            created_aggregators.append(self)

        def aggregate(self, discovery):
            return FakeReport(discovery.domain, discovery._languages)

    monkeypatch.setattr(main, "DomainDiscoverer", FakeDiscoverer)
    monkeypatch.setattr(main, "LanguageAggregator", FakeAggregator)

    discoveries, reports = await main.analyze_domains(["example.org", "gymshark.com"])

    assert len(created_discoverers) == 2
    assert len(created_aggregators) == 2
    assert reports[1].domain == "gymshark.com"
    assert reports[1].language_count == 2
    assert reports[1].languages == ["English (High, 90%)", "Spanish (High, 90%)"]


@pytest.mark.asyncio
async def test_debug_files_are_written_per_domain(monkeypatch, tmp_path: Path):
    class FakeDiscoverer:
        async def discover(self, domain):
            return FakeDiscovery(domain, ["English (High, 90%)", "Spanish (High, 90%)"])

    class FakeAggregator:
        def aggregate(self, discovery):
            return FakeReport(discovery.domain, discovery._languages)

    monkeypatch.setattr(main, "DomainDiscoverer", lambda: FakeDiscoverer())
    monkeypatch.setattr(main, "LanguageAggregator", lambda: FakeAggregator())

    await main.analyze_domains(["gymshark.com"], debug_dir=tmp_path)

    assert (tmp_path / "gymshark.com.discovery.json").exists()
    assert (tmp_path / "gymshark.com.language_debug.json").exists()
