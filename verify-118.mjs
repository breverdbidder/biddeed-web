import { chromium } from "@playwright/test";
const b = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const out = {};
// mobile 390x844
for (const [name, vp] of [['mobile', {width:390,height:844}], ['desktop', {width:1280,height:800}]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: name==='mobile', hasTouch: name==='mobile', userAgent: name==='mobile' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const page = await ctx.newPage();
  const resp = await page.goto('https://biddeed.ai/academy', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => null);
  out[name+'_academy_status'] = resp ? resp.status() : 'nav-failed';
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `/downloads/v118-${name}-academy-top.png` });
  // scroll to bottom where prev/next nav lives
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/downloads/v118-${name}-academy-bottom.png` });
  // find the Next link/card
  const nextLink = page.locator('a:has-text("Next")').last();
  const nextVisible = await nextLink.isVisible().catch(() => false);
  // fixed Deed launcher presence on academy
  const deedLauncher = await page.locator('button:has-text("Deed"), a:has-text("Talk to Deed"), [class*="deed" i]').count();
  out[name] = { nextVisible, deedLauncherCount: deedLauncher };
  if (nextVisible) {
    const box = await nextLink.boundingBox();
    out[name].nextBox = box;
    await nextLink.click().catch(e => { out[name].clickError = String(e); });
    await page.waitForTimeout(3000);
    out[name].afterClickUrl = page.url();
    await page.screenshot({ path: `/downloads/v118-${name}-after-next-click.png` });
  }
  await ctx.close();
}
console.log(JSON.stringify(out, null, 2));
await b.close();
