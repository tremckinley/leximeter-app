from pathlib import Path

from app.vercel_bridge import create_job, get_job_result, get_job_status


def test_create_job_and_fetch_status_round_trip(tmp_path: Path):
    store_path = tmp_path / "jobs.json"

    job = create_job(["example.org", "gymshark.com"], store_path=store_path)

    assert job["status"] == "queued"
    assert job["jobId"]
    assert job["domains"] == ["example.org", "gymshark.com"]

    status = get_job_status(job["jobId"], store_path=store_path)
    assert status["status"] == "queued"
    assert status["progress"] == 0


def test_get_job_result_returns_stored_payload(tmp_path: Path):
    store_path = tmp_path / "jobs.json"

    job = create_job(["example.org"], store_path=store_path)
    job_id = job["jobId"]

    payload = [
        {
            "domain": "example.org",
            "languageCount": 1,
            "languages": "English",
            "reviewRecommended": "No",
        }
    ]

    result = get_job_result(job_id, payload=payload, store_path=store_path)
    assert result["status"] == "completed"
    assert result["results"] == payload
