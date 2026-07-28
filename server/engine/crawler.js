const { chromium } = require('playwright');
const cheerio = require('cheerio');
const jobStore = require('../services/jobStore');
const aggregate = require('./aggregator');

// --- Module-level constants (moved out of hot path) ---

const FULL_NAME_TO_CODE = {
  'spanish': 'es', 'french': 'fr', 'german': 'de', 'italian': 'it',
  'portuguese': 'pt', 'chinese': 'zh', 'japanese': 'ja', 'korean': 'ko',
  'russian': 'ru', 'arabic': 'ar', 'hindi': 'hi', 'dutch': 'nl',
  'swedish': 'sv', 'danish': 'da', 'finnish': 'fi', 'norwegian': 'no',
  'polish': 'pl', 'turkish': 'tr', 'english': 'en'
};

const MAX_PAGES = 5;
const QUEUE_CAP = 20;

// --- Browser singleton ---
// Shared across jobs to avoid repeated cold-start cost.
// Closed via closeBrowser() on graceful shutdown.

let browser = null;

async function getBrowser() {
  if (browser) return browser;
  browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu'
    ]
  });
  return browser;
}

async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

// --- Job processor ---

async function processDomains(jobId, domains) {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.status = 'running';
  job.progress = 0;
  job.total = domains.length;
  job.current = 1;
  jobStore.set(jobId, job);

  let b;
  try {
    b = await getBrowser();
  } catch (e) {
    console.error('Failed to launch browser', e);
    job.status = 'error';
    jobStore.set(jobId, job);
    return;
  }

  const results = [];
  for (let i = 0; i < domains.length; i++) {
    job.current = i + 1;
    jobStore.set(jobId, job);

    const report = await analyzeDomain(domains[i], b);
    results.push(report);

    job.progress = Math.round(((i + 1) / domains.length) * 100);
    jobStore.set(jobId, job);
  }

  job.status = 'complete';
  job.results = results;
  jobStore.set(jobId, job);
}

// --- Domain analyzer ---

async function analyzeDomain(domainStr, b) {
  const domain = domainStr.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  console.log(`[Crawler] Starting analysis for domain: ${domain}`);

  const hreflangs = new Set();
  const visited = new Set();
  const queue = [`https://${domain}`];
  let domainStatus = null;
  let domainHasError = false;
  let isSPA = false;

  let page;
  let context;
  try {
    context = await b.newContext({
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true
    });
    page = await context.newPage();

    // Block unnecessary resources to speed up page load and prevent timeouts
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  } catch (e) {
    await context?.close().catch(() => {});
    return aggregate(domain, [], 500);
  }

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    console.log(`[Crawler] [${domain}] Visiting (${visited.size}/${MAX_PAGES}): ${url}`);

    try {
      let response = null;
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (timeoutErr) {
        domainHasError = true;
        console.warn(`[Warn] Timeout or error navigating to ${url}, attempting to extract content anyway.`);
      }

      if (!domainStatus && response) {
        domainStatus = response.status();
      }

      let html = await page.content();
      let $ = cheerio.load(html);

      let currentPageIsSPA = false;
      if (!isSPA) {
        if (
          $('#root, #app, #__next, [data-reactroot]').length > 0 ||
          html.includes('__NEXT_DATA__') ||
          html.includes('__NUXT__') ||
          html.includes('window.webpackChunk')
        ) {
          currentPageIsSPA = true;
          isSPA = true;
        }
      } else {
        currentPageIsSPA = true;
      }

      if (currentPageIsSPA) {
        // Wait for SPA hydration; skip this penalty for traditional SSR sites
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        html = await page.content();
        $ = cheerio.load(html);
      }

      const htmlLang = $('html').attr('lang');
      if (htmlLang) {
        hreflangs.add(htmlLang.split('-')[0].toLowerCase());
      }

      $('link[rel="alternate"][hreflang]').each((i, el) => {
        const hl = $(el).attr('hreflang');
        if (hl && hl.toLowerCase() !== 'x-default') {
          hreflangs.add(hl.split('-')[0].toLowerCase());
        }
      });

      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        let absoluteUrl;
        try { absoluteUrl = new URL(href, url).href; } catch (e) { return; }

        let parsed;
        try { parsed = new URL(absoluteUrl); } catch (e) { return; }

        if (parsed.hostname.includes(domain)) {
          const path = parsed.pathname.toLowerCase();

          const match = path.match(/^\/([a-z]{2})(?:[-_][a-z]{2})?(?:\/|$)/);
          if (match && Object.values(FULL_NAME_TO_CODE).includes(match[1])) {
            hreflangs.add(match[1]);
          }

          for (const [name, code] of Object.entries(FULL_NAME_TO_CODE)) {
            if (path.includes(`/${name}`) || path.includes(`-${name}`)) {
              hreflangs.add(code);
            }
          }

          if (!visited.has(absoluteUrl) && queue.length < QUEUE_CAP) {
            if (match || Object.keys(FULL_NAME_TO_CODE).some(n => path.includes(n))) {
              queue.push(absoluteUrl);
            }
          }
        }
      });

    } catch (error) {
      domainHasError = true;
      if (visited.size === 1 && url.startsWith('https://')) {
        // Retry with HTTP if the first HTTPS attempt fails entirely
        queue.push(`http://${domain}`);
        visited.delete(url);
      } else {
        if (!domainStatus) domainStatus = 500;
        console.error(`Failed to fetch ${url}:`, error.message);
      }
    }
  }

  // Fix: was calling page.close() twice; context was never closed
  await page.close().catch(() => {});
  await context.close().catch(() => {});

  const finalStatusStr = domainHasError
    ? 'Error'
    : (domainStatus || (visited.size > 0 ? 200 : 500));

  console.log(`[Crawler] [${domain}] Finished. Languages: ${hreflangs.size > 0 ? Array.from(hreflangs).join(', ') : 'None'}. Status: ${finalStatusStr}`);
  return aggregate(domain, Array.from(hreflangs), finalStatusStr, domainHasError, isSPA);
}

module.exports = { processDomains, analyzeDomain, closeBrowser };
