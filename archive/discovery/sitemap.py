from __future__ import annotations
import gzip
from xml.etree import ElementTree as ET
from discovery.urls import normalize_url, same_registered_domain
DEFAULT_SITEMAPS = ["/sitemap.xml", "/sitemap_index.xml"]
def extract_sitemaps_from_robots(text: str) -> list[str]:
    out=[]
    for raw in text.splitlines():
        line=raw.strip()
        if line.lower().startswith("sitemap:"):
            val=line.split(":",1)[1].strip()
            if val: out.append(val)
    return list(dict.fromkeys(out))
def decode_sitemap_payload(payload: str | bytes) -> str:
    if isinstance(payload, bytes):
        if payload[:2] == b"\x1f\x8b":
            return gzip.decompress(payload).decode("utf-8", errors="replace")
        return payload.decode("utf-8", errors="replace")
    return payload
def parse_sitemap_xml(xml_text: str | bytes) -> dict[str, list[str]]:
    xml=decode_sitemap_payload(xml_text).strip()
    if not xml: return {"urls": [], "sitemaps": []}
    root=ET.fromstring(xml)
    is_index=root.tag.lower().endswith("sitemapindex")
    urls=[]; sitemaps=[]
    for loc in root.findall(".//{*}loc"):
        v=(loc.text or "").strip()
        if v: (sitemaps if is_index else urls).append(v)
    return {"urls": list(dict.fromkeys(urls)), "sitemaps": list(dict.fromkeys(sitemaps))}
def default_sitemap_candidates(base_url: str) -> list[str]:
    return [normalize_url(path, base_url=base_url) for path in DEFAULT_SITEMAPS]
def filter_domain_urls(urls: list[str], registered_domain: str) -> list[str]:
    out=[]
    for u in urls:
        n=normalize_url(u)
        if n and same_registered_domain(n, registered_domain): out.append(n)
    return list(dict.fromkeys(out))
