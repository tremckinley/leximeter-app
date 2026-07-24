# Language Finder – Project Handover and Vercel Migration Plan

## Purpose

This document summarizes the Language Finder project as it exists today and provides a recommended path to convert it into a small self-service web application using Vercel Functions.

---

# Business Problem

The original goal was to allow a non-technical SEO specialist to:

1. Submit a list of domains.
2. Discover published languages on those domains.
3. Receive a simple portfolio-level report.
4. Avoid requiring Python, local installation, or GitHub knowledge.

The project evolved from a command-line utility into a lightweight self-service reporting application.

---

# Current Solution Components

## 1. Language Discovery Engine

A deterministic language detection engine.

Primary signals:

- hreflang tags
- html lang attributes
- language URL paths
- language subdomains
- other structured language indicators

The intentionally favored deterministic scoring over AI inference.

---

## 2. GitHub Actions Workflow

Current execution model:

Input:

```text
List of domains
```

Processing:

```text
GitHub Actions
↓
Language Discovery Engine
↓
Report Generation
```

Outputs:

```text
summary.csv
summary.json
summary.md
```

---

## 3. Primary Deliverable

The primary output was intentionally simplified to:

```text
summary.csv
```

Columns:

```text
Domain Name
Language Count
Languages
Review Recommended
```

Example:

| Domain Name | Language Count | Languages | Review Recommended |
|------------|------------|------------|------------|
| gymshark.com | 2 | English; Spanish | No |
| example.ca | 2 | English; French | No |
| example.org | 0 | - | Yes |

---

## 4. JSON Output

To support web display the workflow was modified to generate:

```json
[
  {
    "domain": "gymshark.com",
    "languageCount": 2,
    "languages": "English; Spanish",
    "reviewRecommended": "No"
  }
]
```

File:

```text
summary.json
```

---

## 5. GitHub Pages Prototype

A lightweight web prototype was built.

Features:

- Paste domains
- Run Analysis button
- Wait screen with progress indicator
- Results table
- Download summary.csv

The UI was intentionally simplified.

---

# Problem With GitHub Pages Approach

The current GitHub Pages design exposes a workflow problem.

Current flow:

```text
User
↓
GitHub Pages
↓
Open GitHub Action
↓
Run Workflow
```

Issue:

```text
User requires GitHub access
```

If the SEO specialist has no GitHub account or repository access, they cannot run the workflow.

This is the primary blocker.

---

# Recommended Vercel Architecture

## Goal

Preserve:

- GitHub Actions
- Language Discovery Engine
- summary.csv
- summary.json

Replace:

```text
GitHub Pages
```

with:

```text
Vercel
```

---

# Proposed Architecture

```text
User
↓
Vercel Front End
↓
Vercel Function
↓
GitHub Actions Workflow Dispatch
↓
Language Finder Engine
↓
summary.json
↓
Vercel Front End
```

---

# Front End Responsibilities

The front end should:

## Ready State

```text
Paste Domains
Run Analysis
```

## Running State

```text
Analysis Running
Please keep this page open
Progress indicator
```

## Complete State

```text
Results Table
Download CSV
```

Recommended columns:

```text
Domain Name
Language Count
Languages
Review Recommended
```

---

# Vercel Function Responsibilities

The Vercel Function becomes the secure bridge.

Responsibilities:

1. Accept domain submissions.
2. Trigger GitHub workflow_dispatch.
3. Store GitHub token securely.
4. Return job information.
5. Provide job status endpoint.

Example endpoints:

```text
POST /api/run
GET  /api/status?id=xxx
GET  /api/results?id=xxx
```

---

# Recommended GitHub Changes

## Workflow Input

Continue using:

```yaml
workflow_dispatch
```

Input:

```text
domains
```

No major workflow redesign needed.

---

## Results Publishing

Continue generating:

```text
summary.csv
summary.json
```

The web application should consume:

```text
summary.json
```

CSV remains downloadable.

---

# Suggested API Design

## Start Job

```http
POST /api/run
```

Payload:

```json
{
  "domains": [
    "gymshark.com",
    "example.ca"
  ]
}
```

Response:

```json
{
  "jobId": "abc123",
  "status": "queued"
}
```

---

## Poll Job

```http
GET /api/status/abc123
```

Response:

```json
{
  "status": "running",
  "progress": 62
}
```

---

## Retrieve Results

```http
GET /api/results/abc123
```

Response:

Same structure as summary.json.

---

# Recommended V1 Release Scope

Build only:

✅ Single page UI

✅ Submit domains

✅ Trigger GitHub workflow

✅ Poll status

✅ Display results

✅ Download CSV

Avoid:

❌ Authentication

❌ User accounts

❌ Database

❌ Historical reporting

❌ Multi-user job management

The current use case does not justify additional complexity.

---

# Recommended Repository Structure

```text
language-finder/
│
├── api/
│   ├── run.ts
│   ├── status.ts
│   └── results.ts
│
├── public/
│
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
│
├── .github/
│   └── workflows/
│
├── tools/
│
└── README.md
```

---

# Final Recommendation

The language detection engine is complete enough for a V1 release.

The next engineering effort should not be improving detection accuracy.

The next effort should be:

```text
User Experience
```

Specifically:

```text
Replace GitHub Pages
with
Vercel + a single secure serverless function
```

That provides the simplest path to a true self-service web application while preserving the existing GitHub Actions investment and avoiding unnecessary infrastructure.
