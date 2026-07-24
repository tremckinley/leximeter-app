const axios = require('axios');
const cheerio = require('cheerio');

async function testFifa() {
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

  try {
    const res = await axios.get('https://www.fifa.com', { headers: browserHeaders, maxRedirects: 5 });
    console.log("Status:", res.status);
    
    const $ = cheerio.load(res.data);
    console.log("HTML lang:", $('html').attr('lang'));
    
    const hreflangs = [];
    $('link[rel="alternate"][hreflang]').each((i, el) => {
      hreflangs.push($(el).attr('hreflang'));
    });
    console.log("Hreflangs found:", hreflangs);
    
    const links = [];
    $('a[href]').each((i, el) => {
      links.push($(el).attr('href'));
    });
    
    console.log("Total internal links on homepage:", links.filter(l => l.startsWith('/') || l.includes('fifa.com')).length);
    console.log("Sample links:", links.slice(0, 10));

  } catch(e) {
    console.log("Error:", e.message);
  }
}

testFifa();
