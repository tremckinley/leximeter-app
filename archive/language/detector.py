from __future__ import annotations
import re
from urllib.parse import urlparse
LANGUAGE_NAMES={'en':'English','es':'Spanish','fr':'French','de':'German','pt':'Portuguese','it':'Italian','ja':'Japanese','zh':'Chinese','ar':'Arabic','ko':'Korean','nl':'Dutch','sv':'Swedish','da':'Danish','fi':'Finnish','no':'Norwegian','pl':'Polish','ru':'Russian','tr':'Turkish','vi':'Vietnamese','th':'Thai','id':'Indonesian','hi':'Hindi','he':'Hebrew','cs':'Czech'}
LANG_RE=re.compile(r'^([a-z]{2,3})(?:[-_]([a-z]{2}|[0-9]{3}))?$',re.I)
URL_LANG_RE=re.compile(r'/(%s)(?:[-_][a-z]{2})?(?:/|$)'%'|'.join(LANGUAGE_NAMES),re.I)
SUBDOMAIN_LANG_RE=re.compile(r'^(%s)\.'%'|'.join(LANGUAGE_NAMES),re.I)
STOPWORDS={'en':{'the','and','of','to','in','for','with','our','is'},'es':{'el','la','de','que','y','en','para','con','nuestro','una'},'fr':{'le','la','de','et','les','des','pour','avec','notre','une'},'de':{'der','die','das','und','von','mit','für','ist','ein','eine'},'pt':{'o','a','de','e','que','em','para','com','nosso','uma'}}
def normalize_language_code(value):
    if not value: return None
    v=value.strip().lower()
    if v=='x-default': return None
    m=LANG_RE.match(v)
    if not m: return None
    code=m.group(1)
    return code if code in LANGUAGE_NAMES else None
def language_name(code): return LANGUAGE_NAMES.get(code, code)
def detect_language_from_url(url):
    p=urlparse(url); host=p.netloc.lower(); sub=SUBDOMAIN_LANG_RE.search(host)
    if sub: return normalize_language_code(sub.group(1))
    path=URL_LANG_RE.search(p.path.lower())
    if path: return normalize_language_code(path.group(1))
    return None
def heuristic_detect_text_language(text, min_chars=300):
    if not text or len(text)<min_chars: return None
    tokens=re.findall(r'[a-záéíóúüñçàèùâêîôûäöß]+',text.lower())
    if not tokens: return None
    scores={c:0 for c in STOPWORDS}
    for tok in tokens[:500]:
        for c,words in STOPWORDS.items():
            if tok in words: scores[c]+=1
    best,score=max(scores.items(),key=lambda kv:kv[1])
    return best if score>=4 else None
