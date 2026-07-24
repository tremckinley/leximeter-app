from __future__ import annotations
import csv, json
from pathlib import Path
from models import DiscoveryResult, LanguageReport

def write_json(path: str | Path, data) -> None:
    Path(path).write_text(json.dumps(data, indent=2, sort_keys=True), encoding='utf-8')

def write_language_csv(path: str | Path, reports: list[LanguageReport]) -> None:
    with Path(path).open('w', newline='', encoding='utf-8') as f:
        writer=csv.DictWriter(f, fieldnames=['domain','language_count','languages','confidence_details','warnings'])
        writer.writeheader()
        for report in reports:
            writer.writerow({'domain':report.domain,'language_count':report.language_count,'languages':';'.join(report.languages),'confidence_details':json.dumps([x.to_dict() for x in report.findings], sort_keys=True),'warnings':json.dumps(report.warnings, sort_keys=True)})

def write_discovery_csv(path: str | Path, discoveries: list[DiscoveryResult]) -> None:
    with Path(path).open('w', newline='', encoding='utf-8') as f:
        writer=csv.DictWriter(f, fieldnames=['domain','registered_domain','subdomain_count','url_count','sitemap_count','candidate_language_paths','hreflang_targets'])
        writer.writeheader()
        for d in discoveries:
            c=d.to_dict()['counts']
            writer.writerow({'domain':d.domain,'registered_domain':d.registered_domain,'subdomain_count':c['subdomains'],'url_count':c['urls'],'sitemap_count':c['sitemaps'],'candidate_language_paths':';'.join(sorted(d.candidate_language_paths)),'hreflang_targets':';'.join(sorted(d.hreflang_targets))})
