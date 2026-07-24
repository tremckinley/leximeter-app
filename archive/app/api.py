from __future__ import annotations
import csv, io
from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from main import analyze_domains
ROOT=Path(__file__).resolve().parents[1]
WEB_DIR=ROOT/'web'
app=FastAPI(title='Language Discovery Web App', version='0.5.0')
app.mount('/static', StaticFiles(directory=str(WEB_DIR)), name='static')
class AnalyzeRequest(BaseModel): domains:list[str]=Field(default_factory=list)
class AnalyzeResponse(BaseModel): reports:list[dict[str,Any]]; csv:str
def clean_domains(values:list[str])->list[str]:
    out=[]
    for value in values:
        for token in str(value).replace(',', ' ').split():
            if token.strip() and token.lower()!='domain': out.append(token.strip())
    return list(dict.fromkeys(out))
def reports_to_csv(reports:list[dict[str,Any]])->str:
    buf=io.StringIO(); writer=csv.DictWriter(buf, fieldnames=['domain','language_count','languages','confidence_details','warnings'])
    writer.writeheader()
    for r in reports:
        writer.writerow({'domain':r.get('domain',''),'language_count':r.get('language_count',0),'languages':';'.join(r.get('languages',[])),'confidence_details':r.get('findings',[]),'warnings':r.get('warnings',[])})
    return buf.getvalue()
@app.get('/', response_class=HTMLResponse)
async def index(): return (WEB_DIR/'index.html').read_text(encoding='utf-8')
@app.post('/api/analyze', response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    domains=clean_domains(request.domains)
    if not domains: raise HTTPException(status_code=400, detail='Provide at least one domain.')
    _, report_objects=await analyze_domains(domains)
    reports=[r.to_dict() for r in report_objects]
    return AnalyzeResponse(reports=reports, csv=reports_to_csv(reports))
@app.post('/api/analyze.csv', response_class=PlainTextResponse)
async def analyze_csv(request: AnalyzeRequest):
    domains=clean_domains(request.domains)
    if not domains: raise HTTPException(status_code=400, detail='Provide at least one domain.')
    _, report_objects=await analyze_domains(domains)
    reports=[r.to_dict() for r in report_objects]
    return PlainTextResponse(reports_to_csv(reports), media_type='text/csv', headers={'Content-Disposition':'attachment; filename=language_reports.csv'})
