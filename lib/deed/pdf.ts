/**
 * A dependency-free text PDF writer (PARITY CP-4 PR B — generated project
 * reports). Letter pages, Helvetica / Helvetica-Bold from the PDF standard
 * 14, WinAnsi encoding, word wrap by real glyph widths, page breaks, page
 * numbers. Produces a valid PDF 1.4 that opens in every viewer — real bytes,
 * not a print-styled HTML page.
 *
 * Why hand-rolled: the route runs on Cloudflare Workers (OpenNext) where
 * bundle size matters and a PDF library is not needed for text. Anything
 * beyond text (images, tables with rules) is out of scope on purpose.
 */

export interface PdfBlock {
  kind: 'title' | 'h1' | 'h2' | 'p' | 'kv' | 'bullet' | 'gap' | 'rule'
  text?: string
  /** For 'kv': the label; `text` is the value. */
  label?: string
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 54
const CONTENT_W = PAGE_W - MARGIN * 2
const BODY = 10
const LINE = 14

// Helvetica advance widths (1/1000 em) for WinAnsi 32..126, from the AFM.
const HELV: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
const HELV_BOLD: number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]

// Unicode → WinAnsi for the characters the reports actually use.
const WINANSI: Record<string, number> = {
  '—': 0x97, '–': 0x96, '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '…': 0x85, '•': 0x95,
  ' ': 0x20, '·': 0xb7, 'é': 0xe9, 'è': 0xe8, 'ü': 0xfc, 'ñ': 0xf1, 'á': 0xe1, 'ó': 0xf3, 'í': 0xed, 'ú': 0xfa, 'ç': 0xe7,
}

function toWinAnsi(text: string): number[] {
  const out: number[] = []
  for (const ch of text.replace(/\r\n?/g, '\n')) {
    const code = ch.codePointAt(0) ?? 63
    if (code === 10) out.push(10)
    else if (code >= 32 && code <= 126) out.push(code)
    else if (WINANSI[ch] !== undefined) out.push(WINANSI[ch])
    else if (code >= 0xa0 && code <= 0xff) out.push(code)
    else out.push(63) // '?'
  }
  return out
}

function width(codes: number[], size: number, bold: boolean): number {
  const table = bold ? HELV_BOLD : HELV
  let w = 0
  for (const c of codes) {
    if (c >= 32 && c <= 126) w += table[c - 32]
    else if (c >= 0xa0) w += 556 // WinAnsi upper half: use the average lowercase width
  }
  return (w / 1000) * size
}

function wrap(codes: number[], size: number, bold: boolean, maxWidth: number): number[][] {
  const lines: number[][] = []
  for (const para of splitOn(codes, 10)) {
    const words = splitOn(para, 32)
    let line: number[] = []
    for (const word of words) {
      const candidate = line.length ? [...line, 32, ...word] : word
      if (line.length && width(candidate, size, bold) > maxWidth) {
        lines.push(line)
        line = word
      } else line = candidate
      // A single word longer than the line: hard-break it.
      while (width(line, size, bold) > maxWidth && line.length > 1) {
        let cut = line.length - 1
        while (cut > 1 && width(line.slice(0, cut), size, bold) > maxWidth) cut--
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    lines.push(line)
  }
  return lines
}

function splitOn(codes: number[], sep: number): number[][] {
  const out: number[][] = []
  let cur: number[] = []
  for (const c of codes) {
    if (c === sep) {
      out.push(cur)
      cur = []
    } else cur.push(c)
  }
  out.push(cur)
  return out
}

function pdfString(codes: number[]): string {
  let s = '('
  for (const c of codes) {
    if (c === 0x28 || c === 0x29 || c === 0x5c) s += '\\' + String.fromCharCode(c)
    else if (c < 32 || c > 126) s += '\\' + c.toString(8).padStart(3, '0')
    else s += String.fromCharCode(c)
  }
  return s + ')'
}

interface Line {
  codes: number[]
  size: number
  bold: boolean
  indent: number
  /** Extra vertical space before the line. */
  before: number
}

function layout(blocks: PdfBlock[]): Line[] {
  const lines: Line[] = []
  for (const b of blocks) {
    switch (b.kind) {
      case 'title':
        for (const l of wrap(toWinAnsi(b.text ?? ''), 18, true, CONTENT_W)) lines.push({ codes: l, size: 18, bold: true, indent: 0, before: 4 })
        break
      case 'h1':
        wrap(toWinAnsi(b.text ?? ''), 13, true, CONTENT_W).forEach((l, i) => lines.push({ codes: l, size: 13, bold: true, indent: 0, before: i === 0 ? 12 : 0 }))
        break
      case 'h2':
        wrap(toWinAnsi(b.text ?? ''), 11, true, CONTENT_W).forEach((l, i) => lines.push({ codes: l, size: 11, bold: true, indent: 0, before: i === 0 ? 8 : 0 }))
        break
      case 'p':
        wrap(toWinAnsi(b.text ?? ''), BODY, false, CONTENT_W).forEach((l, i) => lines.push({ codes: l, size: BODY, bold: false, indent: 0, before: i === 0 ? 2 : 0 }))
        break
      case 'kv': {
        const label = toWinAnsi(`${b.label ?? ''}: `)
        const value = toWinAnsi(b.text ?? '')
        const labelW = width(label, BODY, true)
        const first = wrap(value, BODY, false, CONTENT_W - labelW)
        lines.push({ codes: [...label, 0, ...(first[0] ?? [])], size: BODY, bold: true, indent: 0, before: 1 })
        for (const l of first.slice(1)) lines.push({ codes: l, size: BODY, bold: false, indent: labelW, before: 0 })
        break
      }
      case 'bullet':
        wrap(toWinAnsi(b.text ?? ''), BODY, false, CONTENT_W - 14).forEach((l, i) => lines.push({ codes: i === 0 ? [0x95, 32, ...l] : l, size: BODY, bold: false, indent: i === 0 ? 0 : 14, before: i === 0 ? 1 : 0 }))
        break
      case 'gap':
        lines.push({ codes: [], size: BODY, bold: false, indent: 0, before: 6 })
        break
      case 'rule':
        lines.push({ codes: [0x2d], size: 1, bold: false, indent: -1, before: 6 })
        break
    }
  }
  return lines
}

/**
 * Renders blocks to PDF bytes. `footer` is printed on every page next to the
 * page number (e.g. "BidDeed.AI · Project report · 2026-09-18").
 */
export function renderTextPdf(blocks: PdfBlock[], footer: string): Uint8Array {
  const lines = layout(blocks)
  const pages: string[] = []
  let ops: string[] = []
  let y = PAGE_H - MARGIN
  const flush = () => {
    pages.push(ops.join('\n'))
    ops = []
    y = PAGE_H - MARGIN
  }
  for (const line of lines) {
    const h = line.size <= 1 ? 1 : Math.max(LINE, line.size * 1.35)
    if (y - line.before - h < MARGIN + LINE) flush()
    y -= line.before
    if (line.indent === -1) {
      // Horizontal rule.
      ops.push(`0.6 w 0.75 G ${MARGIN} ${(y - 2).toFixed(1)} m ${PAGE_W - MARGIN} ${(y - 2).toFixed(1)} l S 0 G`)
      y -= 6
      continue
    }
    y -= h
    if (line.codes.length) {
      // A 0 byte inside a 'kv' line switches from the bold label to the regular value.
      const split = line.codes.indexOf(0)
      const x = MARGIN + line.indent
      if (split >= 0) {
        const label = line.codes.slice(0, split)
        const value = line.codes.slice(split + 1)
        const labelW = width(label, line.size, true)
        ops.push(`BT /F2 ${line.size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td ${pdfString(label)} Tj ET`)
        ops.push(`BT /F1 ${line.size} Tf ${(x + labelW).toFixed(1)} ${y.toFixed(1)} Td ${pdfString(value)} Tj ET`)
      } else {
        ops.push(`BT /${line.bold ? 'F2' : 'F1'} ${line.size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td ${pdfString(line.codes)} Tj ET`)
      }
    }
  }
  flush()

  // Objects: 1 catalog, 2 pages, 3 F1, 4 F2, then per page: page + content.
  const objects: string[] = []
  const add = (body: string) => {
    objects.push(body)
    return objects.length
  }
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // pages placeholder
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const pageIds: number[] = []
  pages.forEach((content, i) => {
    const foot = toWinAnsi(`${footer}  ·  Page ${i + 1} of ${pages.length}`)
    const stream = `${content}\nBT /F1 8 Tf ${MARGIN} ${MARGIN - 18} Td ${pdfString(foot)} Tj ET`
    const bytes = new TextEncoder().encode(stream).length
    const contentId = add(`<< /Length ${bytes} >>\nstream\n${stream}\nendstream`)
    const pageId = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`)
    pageIds.push(pageId)
  })
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let out = '%PDF-1.4\n%âãÏÓ\n'
  const offsets: number[] = []
  const enc = new TextEncoder()
  let byteLen = enc.encode(out).length
  const chunks: Uint8Array[] = [enc.encode(out)]
  objects.forEach((body, i) => {
    offsets.push(byteLen)
    const obj = `${i + 1} 0 obj\n${body}\nendobj\n`
    const b = enc.encode(obj)
    chunks.push(b)
    byteLen += b.length
  })
  const xrefStart = byteLen
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) xref += `${off.toString().padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  chunks.push(enc.encode(xref))
  out = ''
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const result = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) {
    result.set(c, pos)
    pos += c.length
  }
  return result
}
