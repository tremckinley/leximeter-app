const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://fifa.com', {waitUntil: 'domcontentloaded'});
  const html = await page.content();
  console.log('__NEXT_DATA__:', html.includes('__NEXT_DATA__'));
  console.log('webpackChunk:', html.includes('webpackChunk'));
  console.log('root/app/__next:', !!html.match(/id="(root|app|__next)"/i));
  
  // Try to find ANY generic SPA signatures
  console.log('script type=module:', html.includes('type="module"'));
  console.log('chunk.js:', html.includes('chunk.js'));
  console.log('index.js:', html.includes('index.js'));
  
  await browser.close();
})();
