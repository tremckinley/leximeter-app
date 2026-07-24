from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

SUMMARY_COLUMNS = ["Domain Name", "Language Count", "Languages", "Review Recommended"]


def clean(value: Any) -> str:
    return str(value or "").strip()


def has_warnings(report: dict[str, Any]) -> bool:
    return bool(report.get("warnings") or [])


def language_labels_from_json(report: dict[str, Any]) -> list[str]:
    findings = report.get("findings") or []
    if findings:
        labels = []
        for finding in findings:
            name = clean(finding.get("name"))
            label = clean(finding.get("confidence_label"))
            pct = finding.get("confidence_percent")
            if name and label and pct is not None:
                labels.append(f"{name} ({label}, {pct}%)")
            elif name:
                labels.append(name)
        return labels
    return [clean(item) for item in report.get("languages", []) if clean(item)]


def build_summary_from_json(language_report_json: Path) -> list[dict[str, str]]:
    reports = json.loads(language_report_json.read_text(encoding="utf-8"))
    rows = []
    for report in reports:
        languages = language_labels_from_json(report)
        rows.append({
            "Domain Name": clean(report.get("domain")),
            "Language Count": str(len(languages)),
            "Languages": "; ".join(languages),
            "Review Recommended": "Yes" if has_warnings(report) or len(languages) == 0 else "No",
        })
    return rows


def write_summary_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=SUMMARY_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def write_summary_json(path: Path, rows: list[dict[str, str]]) -> None:
    payload = [
        {
            "domain": row["Domain Name"],
            "languageCount": int(row["Language Count"] or 0),
            "languages": row["Languages"],
            "reviewRecommended": row["Review Recommended"],
        }
        for row in rows
    ]
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_summary_md(path: Path, rows: list[dict[str, str]]) -> None:
    lines = [
        "## Portfolio summary",
        "",
        "| Domain Name | Language Count | Languages | Review Recommended |",
        "|---|---:|---|---|",
    ]
    for row in rows:
        domain = (row.get("Domain Name") or "_Unknown domain_").replace("|", "\\|")
        count = row.get("Language Count") or "0"
        languages = (row.get("Languages") or "_None over threshold_").replace("|", "\\|")
        review = row.get("Review Recommended") or "No"
        lines.append(f"| {domain} | {count} | {languages} | {review} |")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build V1 summary outputs for Language Discovery.")
    parser.add_argument("--language-report-json", required=True)
    parser.add_argument("--summary-output", required=True)
    parser.add_argument("--summary-json-output", required=True)
    parser.add_argument("--markdown-output", required=True)
    args = parser.parse_args()

    rows = build_summary_from_json(Path(args.language_report_json))
    write_summary_csv(Path(args.summary_output), rows)
    write_summary_json(Path(args.summary_json_output), rows)
    write_summary_md(Path(args.markdown_output), rows)


if __name__ == "__main__":
    main()
