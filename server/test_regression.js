/**
 * Regression test suite for the language-finder crawler.
 *
 * Tests are defined as known-good sites with their expected language count
 * and the specific language names that MUST appear in the result.
 *
 * Run with:   node test_regression.js
 * Or via npm: npm test  (after updating package.json scripts)
 *
 * Exit code is non-zero when any test fails.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { analyzeDomain, closeBrowser } = require('./engine/crawler');

// ─── Known-good sites ────────────────────────────────────────────────────────
//   expectedCount  – the exact number of distinct languages the tool must find
//   mustInclude    – language names (as returned by the aggregator) that must
//                    all be present in the result
// ─────────────────────────────────────────────────────────────────────────────
const SITES = [
  {
    domain: 'nature.org',
    expectedCount: 2,
    mustInclude: ['English', 'Spanish'],
    description: 'nature.org – English + Spanish'
  },
  {
    domain: 'stayingconnectedinitiative.org',
    expectedCount: 2,
    mustInclude: ['English', 'French'],
    description: 'stayingconnectedinitiative.org – English + French'
  },
  {
    domain: 'dallascowboys.com',
    expectedCount: 2,
    mustInclude: ['English', 'Spanish'],
    description: 'dallascowboys.com – English + Spanish'
  },
  {
    domain: 'visitsanantonio.com',
    expectedCount: 2,
    mustInclude: ['English', 'Spanish'],
    description: 'visitsanantonio.com – English + Spanish'
  }
];

// ─── Test runner ─────────────────────────────────────────────────────────────

let browser;

before(async () => {
  console.log('\n[Setup] Launching Playwright browser...');
  browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu'
    ]
  });
  console.log('[Setup] Browser ready.\n');
});

after(async () => {
  console.log('\n[Teardown] Closing browser...');
  await closeBrowser();
  console.log('[Teardown] Done.');
});

for (const site of SITES) {
  test(site.description, { timeout: 120_000 }, async (t) => {
    console.log(`\n[Test] Analyzing ${site.domain}...`);

    const result = await analyzeDomain(site.domain, browser);

    // ── 1. Language count ──────────────────────────────────────────────────
    assert.equal(
      result.languageCount,
      site.expectedCount,
      `Expected ${site.expectedCount} language(s), got ${result.languageCount} (languages: "${result.languages}")`
    );

    // ── 2. Required languages present ─────────────────────────────────────
    const foundNames = result.languages
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    for (const lang of site.mustInclude) {
      assert.ok(
        foundNames.includes(lang),
        `Expected "${lang}" to be in the detected languages, but got: "${result.languages}"`
      );
    }

    // ── 3. No review recommended for a known-good bilingual site ──────────
    assert.equal(
      result.reviewRecommended,
      'No',
      `reviewRecommended should be "No" for a confirmed bilingual site, got "${result.reviewRecommended}"`
    );

    console.log(`  ✓  ${site.domain}: ${result.languageCount} language(s) – ${result.languages}`);
  });
}
