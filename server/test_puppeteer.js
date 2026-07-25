const { analyzeDomain } = require('./engine/crawler');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  console.log("Analyzing domain...");
  const result = await analyzeDomain('fifa.com', browser);
  console.log("Result:", result);

  await browser.close();
}

run().catch(console.error);
