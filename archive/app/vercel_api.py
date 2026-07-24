from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.vercel_bridge import create_job, get_job_result, get_job_status
from main import analyze_domains
from tools.build_summary import write_summary_csv, write_summary_json

ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / "web"
OUTPUT_DIR = ROOT / "output"

app = FastAPI(title="Language Finder Vercel Bridge", version="0.1.0")
app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


class RunRequest(BaseModel):
    domains: list[str] = Field(default_factory=list)


class RunResponse(BaseModel):
    jobId: str
    status: str


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return (WEB_DIR / "index.html").read_text(encoding="utf-8")


@app.post("/api/run", response_model=RunResponse)
async def run(request: RunRequest) -> RunResponse:
    try:
        job = create_job(request.domains)
        domains = job.get("domains", [])
        if not domains:
            raise HTTPException(status_code=400, detail="Provide at least one domain.")

        _, reports = await analyze_domains(domains)
        report_payload = [r.to_dict() for r in reports]
        rows = [
            {
                "Domain Name": report.get("domain", ""),
                "Language Count": str(report.get("language_count", 0)),
                "Languages": "; ".join(report.get("languages", [])),
                "Review Recommended": "No" if report.get("language_count", 0) else "Yes",
            }
            for report in report_payload
        ]

        summary_json_path = OUTPUT_DIR / "summary.json"
        summary_csv_path = OUTPUT_DIR / "summary.csv"
        write_summary_json(summary_json_path, rows)
        write_summary_csv(summary_csv_path, rows)

        payload = [
            {
                "domain": row["Domain Name"],
                "languageCount": int(row["Language Count"] or 0),
                "languages": row["Languages"],
                "reviewRecommended": row["Review Recommended"],
            }
            for row in rows
        ]
        get_job_result(job["jobId"], payload=payload, store_path=OUTPUT_DIR / "vercel_jobs.json")
        return RunResponse(jobId=job["jobId"], status="completed")
    except Exception as exc:
        return RunResponse(jobId="", status=f"error:{exc.__class__.__name__}")


@app.get("/api/status/{job_id}")
async def status(job_id: str) -> dict[str, Any]:
    return get_job_status(job_id)


@app.get("/api/results/{job_id}")
async def results(job_id: str) -> JSONResponse:
    try:
        job = get_job_status(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="job not found") from exc

    if job["status"] != "completed":
        return JSONResponse(status_code=202, content={"status": job["status"], "progress": job["progress"]})

    result_payload = get_job_result(job_id, store_path=OUTPUT_DIR / "vercel_jobs.json")
    csv_text = (OUTPUT_DIR / "summary.csv").read_text(encoding="utf-8") if (OUTPUT_DIR / "summary.csv").exists() else ""
    return JSONResponse(
        content={
            "jobId": job_id,
            "status": "completed",
            "results": result_payload["results"],
            "csv": csv_text,
        }
    )
