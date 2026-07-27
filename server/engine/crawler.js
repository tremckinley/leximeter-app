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
  console.log(`[Crawler] Starting analysis for domain: ${domain}`);
  
  let hreflangs = new Set();
  let visited = new Set();
  let queue = [`https://${domain}`];
  let maxPages = 5;
  let domainStatus = null;
  let domainHasError = false;

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

    // Block unnecessary resources to drastically speed up page load and prevent timeouts
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  } catch (e) {
    return aggregate(domain, [], 500);
  }

  while (queue.length > 0 && visited.size < maxPages) {
    let url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    console.log(`[Crawler] [${domain}] Visiting (${visited.size}/${maxPages}): ${url}`);
    
    try {
      let response = null;
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Give SPAs time to execute JavaScript and inject dynamic links
        await page.waitForTimeout(5000).catch(() => {});
      } catch (timeoutErr) {
        domainHasError = true;
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
          if (match && Object.values(fullNameToCode).includes(match[1])) {
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
       domainHasError = true;
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

  if (hreflangs.size <= 1 && !domainHasError) {
    const commonCodes = ['es', 'fr', 'de', 'pt', 'zh', 'ar', 'ru', 'ja'];
    console.log(`[Crawler] [${domain}] Initiating brute-force language discovery...`);
    
    let templatePaths = new Set(['/', '/home']);
    for (const url of visited) {
      try {
        const parsed = new URL(url);
        const match = parsed.pathname.match(/^\/[a-z]{2}(?:[-_][a-z]{2})?(?:\/|$)/i);
        if (match) {
          let p = parsed.pathname.substring(match[0].length > 1 ? match[0].length - 1 : 0);
          if (!p.startsWith('/')) p = '/' + p;
          templatePaths.add(p);
          if (templatePaths.size >= 3) break;
        }
      } catch (e) {}
    }

    const checkPromises = [];
    for (const code of commonCodes) {
      if (hreflangs.has(code)) continue;
      checkPromises.push((async () => {
        let found = false;
        for (const p of templatePaths) {
          if (found) break;
          try {
            const langPage = await context.newPage();
            await langPage.route('**/*', (route) => {
              const type = route.request().resourceType();
              if (['image', 'media', 'font'].includes(type)) {
                route.abort();
              } else {
                route.continue();
              }
            });
            
            const checkUrl = `https://${domain}/${code}${p}`;
            await langPage.goto(checkUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            // Wait up to 5 seconds for the SPA to update the lang attribute
            try {
              await langPage.waitForFunction(`document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith('${code}')`, { timeout: 5000 });
              hreflangs.add(code);
              console.log(`[Crawler] [${domain}] Brute-force found language: ${code} at ${p}`);
              found = true;
            } catch (timeoutErr) {
              // Not found within timeout
            }
            
            await langPage.close().catch(() => {});
          } catch (err) {}
        }
      })());
    }
    await Promise.allSettled(checkPromises);
  }

  let finalStatusStr = domainStatus || (visited.size > 0 ? 200 : 500);
  if (domainHasError) {
    finalStatusStr = 'Error';
  }

  console.log(`[Crawler] [${domain}] Finished. Languages found: ${hreflangs.size > 0 ? Array.from(hreflangs).join(', ') : 'None'}. Status: ${finalStatusStr}`);
  return aggregate(domain, Array.from(hreflangs), finalStatusStr, domainHasError);
}

module.exports = { processDomains, analyzeDomain };
