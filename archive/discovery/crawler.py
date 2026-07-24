from __future__ import annotations
from collections import deque
from config import DEFAULT_CONFIG, DiscoveryConfig
from discovery.fetcher import AsyncFetcher
from discovery.html import parse_html_evidence
from discovery.robots import robots_url
from discovery.sitemap import default_sitemap_candidates, extract_sitemaps_from_robots, filter_domain_urls, parse_sitemap_xml
from discovery.urls import build_discovery_seed, extract_candidate_language_path, get_host, normalize_url, same_registered_domain
from models import DiscoveryResult, PageEvidence
HTML_TYPES=("text/html","application/xhtml+xml")
class DomainDiscoverer:
    def __init__(self, config: DiscoveryConfig = DEFAULT_CONFIG): self.config=config
    async def discover(self, domain: str) -> DiscoveryResult:
        seed=build_discovery_seed(domain)
        result=DiscoveryResult(seed.input_domain, seed.normalized_url, seed.registered_domain)
        result.subdomains.add(seed.host); result.discovered_urls.add(seed.normalized_url)
        async with AsyncFetcher(self.config) as fetcher:
            await self._discover_sitemaps(fetcher, seed.normalized_url, result)
            await self._crawl_pages(fetcher, result)
        return result
    async def _discover_sitemaps(self, fetcher, base_url, result):
        candidates=[]; rob=await fetcher.fetch_text(robots_url(base_url))
        if rob.ok and rob.text: candidates.extend(extract_sitemaps_from_robots(rob.text))
        elif rob.error: result.fetch_errors.append(f"robots: {rob.requested_url}: {rob.error}")
        candidates.extend(default_sitemap_candidates(base_url)); candidates=filter_domain_urls([c for c in candidates if c], result.registered_domain)
        q=deque(candidates); seen=set()
        while q and len(seen)<self.config.max_sitemaps and len(result.discovered_urls)<self.config.max_sitemap_urls:
            sm=q.popleft()
            if sm in seen: continue
            seen.add(sm); result.sitemap_urls.add(sm); fetched=await fetcher.fetch_text(sm)
            if not fetched.ok or not fetched.text:
                if fetched.error: result.fetch_errors.append(f"sitemap: {sm}: {fetched.error}")
                continue
            try: parsed=parse_sitemap_xml(fetched.text)
            except Exception as exc:
                result.fetch_errors.append(f"sitemap_parse: {sm}: {exc.__class__.__name__}"); continue
            for child in filter_domain_urls(parsed.get("sitemaps",[]), result.registered_domain):
                if child not in seen: q.append(child)
            for url in filter_domain_urls(parsed.get("urls",[]), result.registered_domain): self._record_url(result,url)
    async def _crawl_pages(self, fetcher, result):
        q=deque((u,0) for u in [result.normalized_start_url]+sorted(result.discovered_urls)[:self.config.max_pages] if u)
        visited=set()
        while q and len(result.pages)<self.config.max_pages:
            url,depth=q.popleft(); url=normalize_url(url)
            if not url or url in visited or not same_registered_domain(url,result.registered_domain): continue
            visited.add(url); fetched=await fetcher.fetch_text(url)
            page=PageEvidence(url=url, final_url=fetched.final_url, status_code=fetched.status_code, error=fetched.error)
            if not fetched.ok or not fetched.text:
                result.pages.append(page)
                if fetched.error: result.fetch_errors.append(f"page: {url}: {fetched.error}")
                continue
            ctype=(fetched.content_type or '').lower()
            if not any(t in ctype for t in HTML_TYPES) and '<html' not in fetched.text[:1000].lower(): continue
            e=parse_html_evidence(fetched.text, fetched.final_url or url, result.registered_domain)
            page.html_lang=e['html_lang']; page.hreflang_targets=e['hreflangs']; page.internal_links=e['internal_links']; page.visible_text=e['visible_text']
            result.pages.append(page); result.hreflang_targets.update(page.hreflang_targets)
            for newurl in list(e['hreflang_urls'])+list(page.internal_links)[:self.config.max_links_per_page]:
                self._record_url(result,newurl)
                if depth<self.config.max_depth: q.append((newurl,depth+1))
    def _record_url(self, result, url):
        n=normalize_url(url)
        if not n or not same_registered_domain(n,result.registered_domain): return
        result.discovered_urls.add(n)
        try: result.subdomains.add(get_host(n))
        except Exception: pass
        cand=extract_candidate_language_path(n)
        if cand: result.candidate_language_paths.add(cand)
