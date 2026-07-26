const { chromium } = require('playwright');
const cheerio = require('cheerio');
const jobStore = require('../services/jobStore');
const aggregate = require('./aggregator');

async function processDomains(jobId, domains) {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.status = 'running';
  job.progress = 0;
  job.total = domains.length;
  job.current = 1;
  jobStore.set(jobId, job);
  
  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu'
      ]
    });
  } catch(e) {
    console.error("Failed to launch playwright", e);
    job.status = 'error';
    jobStore.set(jobId, job);
    return;
  }
  
  const results = [];
  for (let i = 0; i < domains.length; i++) {
    job.current = i + 1;
    jobStore.set(jobId, job);

    const domain = domains[i];
    const report = await analyzeDomain(domain, browser);
    results.push(report);
    
    // Update progress
    job.progress = Math.round(((i + 1) / domains.length) * 100);
    jobStore.set(jobId, job);
  }

  if (browser) {
    await browser.close();
  }

  job.status = 'complete';
  job.results = results;
  jobStore.set(jobId, job);
}

async function analyzeDomain(domainStr, browser) {
  let domain = domainStr.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  let hreflangs = new Set();
  let visited = new Set();
  let queue = [`https://${domain}`];
  let maxPages = 5;
  let domainStatus = null;

  const fullNameToCode = {
    'spanish': 'es', 'french': 'fr', 'german': 'de', 'italian': 'it',
    'portuguese': 'pt', 'chinese': 'zh', 'japanese': 'ja', 'korean': 'ko',
    'russian': 'ru', 'arabic': 'ar', 'hindi': 'hi', 'dutch': 'nl',
    'swedish': 'sv', 'danish': 'da', 'finnish': 'fi', 'norwegian': 'no',
    'polish': 'pl', 'turkish': 'tr', 'english': 'en'
  };

  let page;
  try {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true
    });
    page = await context.newPage();
  } catch (e) {
    return aggregate(domain, [], 500);
  }

  while (queue.length > 0 && visited.size < maxPages) {
    let url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    
    try {
      let response = null;
      try {
        response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        // Give SPAs time to execute JavaScript and inject dynamic links
        await page.waitForTimeout(3000).catch(() => {});
      } catch (timeoutErr) {
        console.warn(`[Warn] timeout or error navigating to ${url}, attempting to extract content anyway.`);
      }
      
      if (!domainStatus && response) {
         domainStatus = response.status();
      }
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      let htmlLang = $('html').attr('lang');
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
        let href = $(el).attr('href');
        if (!href) return;
        
        let absoluteUrl;
        try { absoluteUrl = new URL(href, url).href; } catch(e) { return; }
        
        let parsed;
        try { parsed = new URL(absoluteUrl); } catch(e) { return; }
        
        if (parsed.hostname.includes(domain)) {
          let path = parsed.pathname.toLowerCase();
          
          let match = path.match(/^\/([a-z]{2})(?:[-_][a-z]{2})?(?:\/|$)/);
          if (match) {
            hreflangs.add(match[1]);
          }
          
          for (const [name, code] of Object.entries(fullNameToCode)) {
            if (path.includes(`/${name}`) || path.includes(`-${name}`)) {
              hreflangs.add(code);
            }
          }

          if (!visited.has(absoluteUrl) && queue.length < 20) {
            if (match || Object.keys(fullNameToCode).some(n => path.includes(n))) {
               queue.push(absoluteUrl);
            }
          }
        }
      });

    } catch (error) {
       if (visited.size === 1 && url.startsWith('https://')) {
          queue.push(`http://${domain}`);
          visited.delete(url);
       } else {
          if (!domainStatus) {
             domainStatus = 500;
          }
          console.error(`Failed to fetch ${url}:`, error.message);
       }
    }
  }

  await page.close().catch(() => {});

  return aggregate(domain, Array.from(hreflangs), domainStatus || (visited.size > 0 ? 200 : 500));
}

module.exports = { processDomains, analyzeDomain };
