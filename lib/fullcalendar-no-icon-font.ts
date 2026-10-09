/**
 * Keep FullCalendar's embedded `fcicons` font out of the page.
 *
 * FullCalendar 6 injects its stylesheet at runtime through CSSOM insertRule()
 * into a `<style data-fullcalendar>` element, and that stylesheet carries an
 * `@font-face { font-family: fcicons; src: url("data:application/x-font-ttf;
 * base64,...") }` rule. middleware.ts sets `font-src 'self'
 * https://fonts.gstatic.com`, so Chromium refuses the data: font and logs a
 * CSP violation on every calendar load - even though we never render an
 * fc-icon (buttonIcons={false}, plus the glyph overrides in globals.css).
 * Chromium starts loading data: fonts as soon as the @font-face is parsed,
 * whether or not any element uses it, so CSS overrides alone cannot stop the
 * error. REA teardown 2026-10-09 recorded it as the only console error on
 * /radar?view=calendar.
 *
 * `data:` is deliberately NOT added to font-src for one decorative glyph set.
 * Instead, this module runs before @fullcalendar/core is evaluated (it is
 * imported first in AuctionCalendar.tsx) and pre-creates the
 * `<style data-fullcalendar>` element FullCalendar looks for. FullCalendar
 * adopts an existing element instead of creating its own, so every rule it
 * injects goes through this sheet's insertRule, which drops the one fcicons
 * @font-face rule and passes everything else through unchanged. Indexes are
 * clamped because FullCalendar computes `cssRules.length + i` up front and one
 * skipped rule would otherwise make every later insert throw IndexSizeError.
 *
 * Side-effect module. No exports. Safe to import more than once.
 */
const FCICONS_FONT_FACE = /^\s*@font-face\s*\{[^}]*font-family\s*:\s*["']?fcicons\b/i

function patchSheet(sheet: CSSStyleSheet) {
  const marked = sheet as CSSStyleSheet & { __bdNoFcicons?: boolean }
  if (marked.__bdNoFcicons) return
  marked.__bdNoFcicons = true

  const insert = sheet.insertRule.bind(sheet)
  sheet.insertRule = (rule: string, index?: number) => {
    const at = Math.min(index ?? 0, sheet.cssRules.length)
    if (FCICONS_FONT_FACE.test(rule)) return at
    return insert(rule, at)
  }

  // If FullCalendar got here first, remove a rule it already inserted.
  for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
    if (FCICONS_FONT_FACE.test(sheet.cssRules[i].cssText)) sheet.deleteRule(i)
  }
}

if (typeof document !== 'undefined') {
  let el = document.querySelector<HTMLStyleElement>('style[data-fullcalendar]')
  if (!el) {
    el = document.createElement('style')
    el.setAttribute('data-fullcalendar', '')
    // Same nonce lookup and insertion point FullCalendar itself uses.
    const nonce =
      document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ||
      document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ||
      ''
    if (nonce) el.nonce = nonce
    document.head.insertBefore(
      el,
      document.head.querySelector('script,link[rel=stylesheet],link[as=style],style')
    )
  }
  if (el.sheet) patchSheet(el.sheet)
}

export {}
