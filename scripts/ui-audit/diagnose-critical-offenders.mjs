import { chromium } from 'playwright'
import fs from 'node:fs'

const base = process.env.BASE_URL || 'https://biddeed.ai'
const routes = ['/', '/radar', '/radar?view=map', '/radar?view=calendar', '/discover', '/auctions', '/counties', '/sign-in', '/sign-up', '/buy-report', '/support']
const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]
const canon = new Set(['#ffffff', '#e6f0fa', '#1a1a1a', '#0a2540', '#d7e3f1', '#005eb8', '#004a92'])
const parseRgb = (value) => { const match = value.match(/rgba?\(([^)]+)\)/); if (!match) return null; const parts = match[1].split(',').map(Number); return { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 } }
const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const luminance = (rgb) => rgb.map((v) => { const x=v/255; return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4 }).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0)
const result = []
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] })
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, ignoreHTTPSErrors: true })
  for (const route of routes) {
    const page = await context.newPage()
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1200)
    const data = await page.evaluate(({ canon }) => {
      const parse = (v) => { const m=v.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p=m[1].split(',').map(Number); return { rgb:p.slice(0,3), alpha:p[3]??1 } }
      const lum = (rgb) => rgb.map((v)=>{const x=v/255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
      const hx = (rgb) => `#${rgb.map((v)=>Math.round(v).toString(16).padStart(2,'0')).join('')}`
      const bg = (el) => { let n=el; while(n){const p=parse(getComputedStyle(n).backgroundColor); if(p&&p.alpha>.5)return p.rgb; n=n.parentElement} return [255,255,255] }
      const badContrast=[], offPalette=[]
      for(const node of document.querySelectorAll('body *')){
        const text=(node.innerText||'').trim().replace(/\s+/g,' ')
        if(!text||node.children.length>0) continue
        const s=getComputedStyle(node); if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0) continue
        const fg=parse(s.color); if(!fg||fg.alpha===0) continue
        const b=bg(node), ratio=(Math.max(lum(fg.rgb),lum(b))+.05)/(Math.min(lum(fg.rgb),lum(b))+.05)
        const fgh=hx(fg.rgb), bgh=hx(b); if(!canon.includes(fgh)||!canon.includes(bgh)) offPalette.push({text:text.slice(0,100),fg:fgh,bg:bgh,tag:node.tagName,cls:String(node.className).slice(0,180)})
        if(ratio<4.5) badContrast.push({text:text.slice(0,100),ratio:Number(ratio.toFixed(2)),fg:fgh,bg:bgh,tag:node.tagName,cls:String(node.className).slice(0,180)})
      }
      const geometry=[]
      for(const node of document.querySelectorAll('body a,body button,body input,body select,body textarea')){
        const s=getComputedStyle(node), r=node.getBoundingClientRect(); if(s.display==='none'||s.visibility==='hidden'||!r.width||!r.height) continue
        if((r.right>innerWidth+2||r.left<-2)&&r.width>40&&!/(auto|scroll|hidden)/.test(s.overflowX+s.overflow)) geometry.push({text:(node.innerText||node.getAttribute('aria-label')||'').trim().slice(0,80),tag:node.tagName,rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},cls:String(node.className).slice(0,160)})
      }
      return {badContrast:badContrast.slice(0,20),offPalette:offPalette.slice(0,20),geometry:geometry.slice(0,30)}
    }, { canon: [...canon] })
    result.push({ viewport: viewport.name, route, ...data })
    await page.close()
  }
  await context.close()
}
await browser.close()
fs.writeFileSync(process.env.OUT || 'artifacts/critical-ui-gates/offenders.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
