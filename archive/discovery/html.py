from __future__ import annotations
import re
from bs4 import BeautifulSoup
from discovery.urls import normalize_url, same_registered_domain
SPACE_RE = re.compile(r"\s+")
def parse_html_evidence(html: str, page_url: str, registered_domain: str) -> dict:
    soup = BeautifulSoup(html or "", "lxml")
    html_lang = str(soup.html.get("lang") or "").strip() if soup.html and soup.html.has_attr("lang") else None
    html_lang = html_lang or None
    hreflangs=set(); hreflang_urls=set(); links=set()
    for tag in soup.find_all("link"):
        rel = " ".join(tag.get("rel", [])) if isinstance(tag.get("rel"), list) else str(tag.get("rel", ""))
        if "alternate" in rel.lower():
            h=str(tag.get("hreflang") or "").strip()
            if h: hreflangs.add(h)
            href=tag.get("href")
            if href:
                n=normalize_url(str(href), base_url=page_url)
                if n and same_registered_domain(n, registered_domain): hreflang_urls.add(n)
    for a in soup.find_all("a", href=True):
        n=normalize_url(str(a.get("href")), base_url=page_url)
        if n and same_registered_domain(n, registered_domain): links.add(n)
    for bad in soup(["script","style","noscript","svg"]): bad.decompose()
    return {"html_lang": html_lang, "hreflangs": hreflangs, "hreflang_urls": hreflang_urls, "internal_links": links, "visible_text": SPACE_RE.sub(" ", soup.get_text(" ")).strip()}
