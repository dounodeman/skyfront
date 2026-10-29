// Headless browser smoke test: loads the game, collects console errors, runs an optional script, screenshots.
// usage: node tools/smoke.cjs <outPrefix> [scriptFile]
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || 'shot';
  const script = process.argv[3] ? fs.readFileSync(process.argv[3], 'utf8') : '';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
  await page.goto(process.env.URL || 'http://localhost:5173/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  if (script) {
    const fn = new Function('page', `return (async () => { ${script} })()`);
    await fn(page);
  }
  await page.screenshot({ path: `${out}.png` });
  console.log(errors.length ? errors.join('\n') : 'NO CONSOLE ERRORS');
  await browser.close();
})();
