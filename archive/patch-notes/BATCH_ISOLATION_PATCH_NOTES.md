# Batch Isolation + Debug Output Patch

## Problem addressed

Gymshark was reported correctly when run by itself, but in a multi-domain Python job only Spanish survived in the output. That symptom suggests the multi-domain batch layer needs stronger isolation and auditability.

## What this patch changes

1. Every domain gets a fresh `DomainDiscoverer`.
2. Every domain gets a fresh `LanguageAggregator`.
3. Multi-domain processing is intentionally sequential.
4. Optional `--debug` mode writes per-domain files:

```text
output/debug/<domain>.discovery.json
output/debug/<domain>.language_debug.json
output/debug/batch_manifest.json
```

## How to run locally

```bash
python main.py --input input/domains.csv --output-dir output --debug
```

## What to compare for Gymshark

Run Gymshark alone and then inside a multi-domain CSV. Compare:

```text
output/debug/gymshark.com.language_debug.json
```

The final language list and trusted evidence snapshot should match between runs.

## GitHub Actions change

Update the workflow's language-discovery step to include:

```bash
--debug
```

A workflow snippet is included in:

```text
.github-workflow-snippet.yml
```

## Primary file to replace

```text
main.py
```
