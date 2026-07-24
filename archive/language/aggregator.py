from __future__ import annotations
from config import DEFAULT_CONFIG, DiscoveryConfig
from language.detector import detect_language_from_url, heuristic_detect_text_language, language_name, normalize_language_code
from models import DiscoveryResult, LanguageFinding, LanguageReport
TRUSTED_SOURCE_POINTS={'hreflang':45,'html_lang':35,'url_pattern':35}
SUPPLEMENTAL_SOURCE_POINTS={'text_heuristic':10}
def confidence_percent(score:int)->int: return max(0,min(100,score))
def confidence_label(percent:int)->str: return 'High' if percent>=85 else 'Medium' if percent>=60 else 'Low'
class LanguageAggregator:
    def __init__(self, config:DiscoveryConfig=DEFAULT_CONFIG): self.config=config
    def aggregate(self, discovery: DiscoveryResult) -> LanguageReport:
        findings={}; warnings=[]
        def add_trusted(code, source, url=None, evidence=None):
            if not code: return
            f=findings.setdefault(code, LanguageFinding(code=code, name=language_name(code)))
            f.confidence += TRUSTED_SOURCE_POINTS.get(source,0); f.sources.add(evidence or source)
            if url: f.sample_urls.add(url)
        def add_supplemental(code, source, url=None):
            if not code: return
            if code in findings:
                findings[code].confidence += SUPPLEMENTAL_SOURCE_POINTS.get(source,0); findings[code].sources.add(source)
                if url: findings[code].sample_urls.add(url)
            else:
                warnings.append({'type':'suppressed_text_only_language','language':language_name(code),'code':code,'url':url,'message':'Text heuristic suggested this language, but no trusted hreflang, html lang, URL path, or subdomain evidence was found.'})
        for target in discovery.hreflang_targets: add_trusted(normalize_language_code(target),'hreflang',evidence=f'hreflang={target}')
        for path in discovery.candidate_language_paths: add_trusted(normalize_language_code(path.strip('/').split('-',1)[0]),'url_pattern',evidence=path)
        for url in discovery.discovered_urls: add_trusted(detect_language_from_url(url),'url_pattern',url,'url_or_subdomain_pattern')
        for page in discovery.pages:
            page_url=page.final_url or page.url; html_code=normalize_language_code(page.html_lang); url_code=detect_language_from_url(page_url)
            if page.html_lang: add_trusted(html_code,'html_lang',page_url,f'html_lang={page.html_lang}')
            for hreflang in page.hreflang_targets: add_trusted(normalize_language_code(hreflang),'hreflang',page_url,f'hreflang={hreflang}')
            add_trusted(url_code,'url_pattern',page_url,'url_or_subdomain_pattern')
            text_code=heuristic_detect_text_language(page.visible_text or '', self.config.min_text_chars_for_detection)
            if text_code and text_code not in {html_code,url_code}:
                warnings.append({'type':'text_signal_conflict','language':language_name(text_code),'code':text_code,'url':page_url,'message':'Text heuristic conflicted with stronger page evidence and was not allowed to create a language.'})
            add_supplemental(text_code,'text_heuristic',page_url)
        final=[]
        for f in findings.values():
            pct=confidence_percent(f.confidence); f.confidence=pct; f.confidence_label=confidence_label(pct)
            f.sources.add(f'confidence={pct}%'); f.sources.add(f'confidence_label={f.confidence_label}')
            if pct >= self.config.language_confidence_threshold: final.append(f)
        final.sort(key=lambda f:(-f.confidence,f.name))
        return LanguageReport(discovery.domain,len(final),[f'{f.name} ({f.confidence_label}, {f.confidence}%)' for f in final],final,discovery.to_dict().get('counts',{}),warnings)
