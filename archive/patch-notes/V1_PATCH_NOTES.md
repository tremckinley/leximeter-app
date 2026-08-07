# V1 Summary + README Patch Notes

## Changed

- Makes `summary.csv` the primary deliverable.
- Updates `summary.csv` to contain exactly these columns:

```text
Domain Name | Language Count | Languages | Review Recommended
```

- Updates the GitHub Actions run summary to emphasize `summary.csv` as the primary output.
- Keeps per-domain debug output enabled.
- Updates README for v1 usage.

## Review Recommended logic

`Review Recommended` is `Yes` when:

- warnings exist for the domain, or
- the domain has zero languages over the reporting threshold.

Otherwise it is `No`.

## Files to replace

```text
tools/build_summary.py
.github/workflows/discover-languages-self-service.yml
README.md
```

## Optional test file

```text
tests/test_v1_summary.py
```
