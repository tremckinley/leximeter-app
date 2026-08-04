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

const LANG_CODES = new Set(Object.values(FULL_NAME_TO_CODE));
const LANG_NAMES = Object.keys(FULL_NAME_TO_CODE);

const MAX_PAGES = 5;
const QUEUE_CAP = 20;

// Strategy 4: canonical paths to probe via HEAD when crawl finds no non-English language.
// Each entry: [pathToProbe, languageCode]
const PROBE_PATHS = Object.entries(FULL_NAME_TO_CODE)
  .filter(([, code]) => code !== 'en')
  .flatMap(([name, code]) => [
    [`/${code}`, code],
    [`/${code}/`, code],
    [`/${name}`, code],
    [`/${name}/`, code],
  ]);

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
  let hasHreflangTags = false;  // track if any hreflang <link> tags were found

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
    const isFirstPage = visited.size === 1;
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

      // ── Detect SPA or lazy-module patterns that need JS hydration ──────────
      // Only check on the first page per domain to avoid false positives on
      // language sub-pages that may have different structure.
      if (isFirstPage && !isSPA) {
        const hasReactRoot = $('#root, #app, #__next, [data-reactroot]').length > 0;
        const hasNextData = html.includes('__NEXT_DATA__');
        const hasNuxt = html.includes('__NUXT__');
        const hasWebpack = html.includes('window.webpackChunk');
        // Structural lazy-module pattern: data-require on navigation/header elements
        const hasLazyNav = $('header[data-require], nav[data-require], [data-require*="navigation"], [data-require*="nav"]').length > 0;

        if (hasReactRoot || hasNextData || hasNuxt || hasWebpack || hasLazyNav) {
          isSPA = true;
          console.log(`[Crawler] [${domain}] Lazy/SPA pattern detected – will use settle wait.`);
        }
      }

      // ── Settle wait: deterministic fixed delay for lazy-loaded content ──────
      // For SPA/lazy-module sites we give a guaranteed 1500 ms for JS modules
      // to inject navigation. Only apply on page 1 — sub-pages of the same site
      // share the same nav and don't need the extra wait after the first load.
      // Using a fixed delay (not networkidle) makes timing consistent across
      // multiple domains regardless of background network traffic.
      if (isSPA && isFirstPage) {
        await page.waitForTimeout(1500);
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
          hasHreflangTags = true;
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

          // ── Strategy 1: path-prefix language code (e.g. /es/, /fr-us/)
          const match = path.match(/^\/([a-z]{2})(?:[-_][a-z]{2})?(?:\/|$)/);
          if (match && LANG_CODES.has(match[1])) {
            hreflangs.add(match[1]);
          }

          // ── Strategy 2: full language name in path (e.g. /spanish, -french)
          for (const [name, code] of Object.entries(FULL_NAME_TO_CODE)) {
            if (path.includes(`/${name}`) || path.includes(`-${name}`)) {
              hreflangs.add(code);
            }
          }

          // ── Strategy 3: language-code subdomain (e.g. es.visitsanantonio.com)
          const subdomainParts = parsed.hostname.split('.');
          const subdomainPrefix = subdomainParts.length > 2 ? subdomainParts[0] : null;
          const isLangSubdomain = subdomainPrefix && LANG_CODES.has(subdomainPrefix);
          if (isLangSubdomain) {
            hreflangs.add(subdomainPrefix);
          }

          if (!visited.has(absoluteUrl) && queue.length < QUEUE_CAP) {
            if (match || isLangSubdomain || LANG_NAMES.some(n => path.includes(n))) {
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

  await page.close().catch(() => {});
  await context.close().catch(() => {});

  // ── Strategy 4: Proactive HEAD probing ─────────────────────────────────────
  // Only fire if: (a) no non-English language was found AND (b) no hreflang
  // <link> tags were present. If a site has proper hreflang tags we trust them;
  // if a site already showed multi-language links we don't need probing.
  // This avoids wasting 8+ seconds on legitimately English-only sites.
  const nonEnglishFound = Array.from(hreflangs).some(c => c !== 'en');
  if (!nonEnglishFound && !hasHreflangTags) {
    console.log(`[Crawler] [${domain}] No non-English languages found and no hreflang tags – running proactive URL probes...`);
    const probeResults = await probeLanguagePaths(domain, PROBE_PATHS);
    for (const code of probeResults) {
      hreflangs.add(code);
    }
    if (probeResults.size > 0) {
      console.log(`[Crawler] [${domain}] Probing found: ${Array.from(probeResults).join(', ')}`);
    }
  }

  const finalStatusStr = domainHasError
    ? 'Error'
    : (domainStatus || (visited.size > 0 ? 200 : 500));

  console.log(`[Crawler] [${domain}] Finished. Languages: ${hreflangs.size > 0 ? Array.from(hreflangs).join(', ') : 'None'}. Status: ${finalStatusStr}`);
  return aggregate(domain, Array.from(hreflangs), finalStatusStr, domainHasError, isSPA);
}

// --- Strategy 4: Proactive language path prober ---
// Fires parallel HEAD requests against canonical language URL candidates.
// Returns a Set of language codes that resolved to a 2xx or 3xx response.

async function probeLanguagePaths(domain, probePaths) {
  const found = new Set();

  // Deduplicate paths before firing requests
  const seen = new Set();
  const unique = probePaths.filter(([path, code]) => {
    const key = `${code}:${path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const controller = new AbortController();
  const PROBE_TIMEOUT_MS = 8000;
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    await Promise.allSettled(
      unique.map(async ([path, code]) => {
        const url = `https://${domain}${path}`;
        try {
          const res = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; LexiBot/1.0)',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          });
          // Accept 2xx and 3xx – a redirect itself signals the path exists
          if (res.status >= 200 && res.status < 400) {
            console.log(`[Probe] [${domain}] ${url} → ${res.status} (${code})`);
            found.add(code);
          }
        } catch {
          // Network error or timeout – silently skip
        }
      })
    );
  } finally {
    clearTimeout(timer);
  }

  return found;
}

module.exports = { processDomains, analyzeDomain, closeBrowser };
