import { chromium } from "@playwright/test";
const b = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const routes = ['/academy/investor-paths', '/academy/workbooks'];
const viewports = [[360,740],[390,844],[768,1024],[1024,768],[1280,800],[1440,900]];
const out = {};
for (const route of routes) {
  out[route] = {};
  for (const [w,h] of viewports) {
    const ctx = await b.newContext({ viewport: {width:w,height:h}, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const resp = await page.goto('https://biddeed.ai'+route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => null);
    const status = resp ? resp.status() : 'nav-failed';
    await page.waitForTimeout(2500);
    const title = await page.title().catch(()=> '');
    const bodyText = (await page.locator('body').innerText().catch(()=> '')).slice(0,150).replace(/\n/g,' | ');
    const shot = `/downloads/v119-${route.split('/').pop()}-${w}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    // link collection: Research/Projects links on page
    const links = await page.locator('a[href*="research" i], a[href*="project" i]').evaluateAll(els => els.map(e => e.getAttribute('href'))).catch(()=>[]);
    out[route][w] = { status, title: title.slice(0,60), bodyText, links };
    await ctx.close();
  }
}
console.log(JSON.stringify(out, null, 1));
await b.close();
