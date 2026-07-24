from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from discovery.crawler import DomainDiscoverer
from language.aggregator import LanguageAggregator
from reporting.reporter import write_discovery_csv, write_json, write_language_csv


def safe_domain_slug(domain: str) -> str:
    """Create a filesystem-safe domain slug for per-domain debug files."""
    return (
        str(domain)
        .strip()
        .replace("https://", "")
        .replace("http://", "")
        .replace("/", "_")
        .replace(":", "_")
        .replace(" ", "_")
        or "unknown_domain"
    )


def build_language_debug_payload(discovery, report) -> dict[str, Any]:
    """Create an auditable per-domain language/debug payload.

    This intentionally captures enough detail to compare a single-domain run
    against the same domain inside a multi-domain batch.
    """
    return {
        "domain": report.domain,
        "final_language_count": report.language_count,
        "final_languages": report.languages,
        "findings": [finding.to_dict() for finding in report.findings],
        "warnings": getattr(report, "warnings", []),
        "discovery_counts": discovery.to_dict().get("counts", {}),
        "trusted_evidence_snapshot": {
            "hreflang_targets": sorted(discovery.hreflang_targets),
            "candidate_language_paths": sorted(discovery.candidate_language_paths),
            "subdomains": sorted(discovery.subdomains),
            "sample_discovered_urls": sorted(discovery.discovered_urls)[:50],
        },
        "page_evidence_sample": [page.to_dict(include_text=False) for page in discovery.pages[:25]],
    }


async def analyze_domain(domain: str, *, debug_dir: Path | None = None):
    """Analyze a single domain with fresh per-domain objects.

    Critical isolation rule: create a new DomainDiscoverer and LanguageAggregator
    on every domain, so batch mode behaves like repeated single-domain runs.
    """
    discoverer = DomainDiscoverer()
    aggregator = LanguageAggregator()

    discovery = await discoverer.discover(domain)
    report = aggregator.aggregate(discovery)

    if debug_dir is not None:
        debug_dir.mkdir(parents=True, exist_ok=True)
        slug = safe_domain_slug(domain)
        write_json(debug_dir / f"{slug}.discovery.json", discovery.to_dict(include_text=False))
        write_json(debug_dir / f"{slug}.language_debug.json", build_language_debug_payload(discovery, report))

    return discovery, report


async def analyze_domains(domains: list[str], *, debug_dir: Path | None = None):
    """Analyze multiple domains with strict per-domain isolation.

    Domains are processed sequentially on purpose. This avoids accidental shared
    state, budget leakage, or result interleaving between domains. If concurrency
    is added later, each domain should still construct its own discoverer,
    aggregator, discovery result, and report objects.
    """
    discoveries = []
    reports = []

    for domain in domains:
        discovery, report = await analyze_domain(domain, debug_dir=debug_dir)
        discoveries.append(discovery)
        reports.append(report)

    return discoveries, reports


def read_domains(args) -> list[str]:
    values: list[str] = []
    if args.domain:
        values.extend(args.domain)
    if args.input:
        text = Path(args.input).read_text(encoding="utf-8")
        for line in text.splitlines():
            line = line.strip().strip(",")
            if line and not line.lower().startswith("domain"):
                values.append(line.split(",")[0].strip())
    return list(dict.fromkeys(values))


def parse_args():
    parser = argparse.ArgumentParser(description="Language Discovery Engine")
    parser.add_argument("--domain", action="append", help="Domain to analyze. Can be repeated.")
    parser.add_argument("--input", help="Optional CSV or text file with domains in first column.")
    parser.add_argument("--output-dir", default="output", help="Directory for JSON and CSV output.")
    parser.add_argument("--include-text", action="store_true", help="Include extracted visible text in discovery JSON.")
    parser.add_argument("--debug", action="store_true", help="Write per-domain debug files to output/debug.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    domains = read_domains(args)
    if not domains:
        raise SystemExit("Provide --domain or --input")

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    debug_dir = out / "debug" if args.debug else None

    discoveries, reports = asyncio.run(analyze_domains(domains, debug_dir=debug_dir))

    write_json(out / "language_reports.json", [r.to_dict() for r in reports])
    write_json(out / "discovery_results.json", [d.to_dict(include_text=args.include_text) for d in discoveries])
    write_language_csv(out / "language_reports.csv", reports)
    write_discovery_csv(out / "discovery_results.csv", discoveries)

    if debug_dir is not None:
        write_json(
            debug_dir / "batch_manifest.json",
            {
                "domains": domains,
                "domain_count": len(domains),
                "debug_files": sorted(path.name for path in debug_dir.glob("*.json")),
            },
        )

    print(json.dumps([r.to_dict() for r in reports], indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
