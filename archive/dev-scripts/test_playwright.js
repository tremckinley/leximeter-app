const { analyzeDomain } = require('./engine/crawler');
const { chromium } = require('playwright');

async function run() {
  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu'
    ]
  });

  console.log("Analyzing domain...");
  const result = await analyzeDomain('fifa.com', browser);
  console.log("Result:", result);

  await browser.close();
}

run().catch(console.error);
