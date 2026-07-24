import json
from pathlib import Path
from tools.build_summary import build_summary_from_json, build_summary_from_csv, SUMMARY_COLUMNS


def test_json_summary_has_v1_columns_and_review_flag(tmp_path: Path):
    report = tmp_path / "language_reports.json"
    report.write_text(json.dumps([
        {
            "domain": "gymshark.com",
            "findings": [
                {"name": "English", "confidence_label": "High", "confidence_percent": 90},
                {"name": "Spanish", "confidence_label": "High", "confidence_percent": 90},
            ],
            "warnings": []
        },
        {
            "domain": "review.example",
            "findings": [],
            "warnings": [{"type": "no_language"}]
        }
    ]), encoding="utf-8")

    rows = build_summary_from_json(report)
    assert list(rows[0].keys()) == SUMMARY_COLUMNS
    assert rows[0] == {
        "Domain Name": "gymshark.com",
        "Language Count": "2",
        "Languages": "English (High, 90%); Spanish (High, 90%)",
        "Review Recommended": "No",
    }
    assert rows[1]["Review Recommended"] == "Yes"


def test_csv_fallback_has_v1_columns(tmp_path: Path):
    report = tmp_path / "language_reports.csv"
    report.write_text(
        'domain,language_count,languages,warnings\n'
        'gymshark.com,1,"English (High, 90%);Spanish (High, 90%)",[]\n',
        encoding="utf-8",
    )
    rows = build_summary_from_csv(report)
    assert list(rows[0].keys()) == SUMMARY_COLUMNS
    assert rows[0]["Language Count"] == "2"
    assert rows[0]["Review Recommended"] == "No"
