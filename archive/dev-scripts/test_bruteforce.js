const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  try {
    await page.goto('https://fifa.com/es/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith('es'), { timeout: 5000 });
    console.log('Success! lang:', await page.evaluate(() => document.documentElement.lang));
  } catch (err) {
    console.log('Failed:', err.message);
  }
  await browser.close();
})();
