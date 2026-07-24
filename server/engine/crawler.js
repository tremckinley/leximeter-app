const axios = require('axios');
const cheerio = require('cheerio');
const jobStore = require('../services/jobStore');
const aggregate = require('./aggregator');

async function processDomains(jobId, domains) {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.status = 'running';
  
  const results = [];
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const report = await analyzeDomain(domain);
    results.push(report);
    
    // Update progress
    job.progress = Math.round(((i + 1) / domains.length) * 100);
    jobStore.set(jobId, job);
  }

  job.status = 'complete';
  job.results = results;
  jobStore.set(jobId, job);
}

async function analyzeDomain(domainStr) {
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

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1'
  };

  while (queue.length > 0 && visited.size < maxPages) {
    let url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    
    try {
      const response = await axios.get(url, { 
        timeout: 5000,
        headers: browserHeaders,
        maxRedirects: 5
      });
      
      if (!domainStatus) {
         domainStatus = response.status;
      }
      
      const $ = cheerio.load(response.data);
      
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
             domainStatus = error.response ? error.response.status : (error.code === 'ECONNABORTED' ? 408 : 500);
          }
          console.error(`Failed to fetch ${url}:`, error.message);
       }
    }
  }

  return aggregate(domain, Array.from(hreflangs), domainStatus || 500);
}

module.exports = { processDomains, analyzeDomain };
