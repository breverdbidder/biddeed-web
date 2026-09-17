/**
 * Upload text extraction for Deed (PARITY CP-3), ported from the Cloudflare
 * Worker's dependency-free implementation (src/worker.js "Upload text
 * extraction") so the same PDFs that cited correctly there cite here.
 *
 * Web-standard APIs only — DecompressionStream, TextDecoder — because this
 * runs inside the OpenNext Cloudflare Worker, where a Node-only PDF package
 * would not load. Best-effort by design: objects are indexed by scanning
 * "N 0 obj … endobj" (works when the xref is a compressed stream we do not
 * parse), each page's /Font resources resolve to their /ToUnicode CMaps for
 * CID-keyed embedded fonts, and literal (…)Tj strings cover simple fonts.
 * Anything else reports 'unsupported' or 'failed' rather than an empty
 * string presented as text.
 */

export type ExtractionStatus = 'ok' | 'unsupported' | 'failed'
export interface Extraction {
  status: ExtractionStatus
  text: string | null
}

const MAX_TEXT = 50_000
const TEXT_MIME_TYPES = new Set(['text/plain', 'text/csv', 'text/markdown', 'application/csv'])

function strToBytes(s: string): Uint8Array {
  const a = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff
  return a
}

async function inflateBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate')
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds)
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

function indexPdfObjects(latin1: string): Map<number, string> {
  const objs = new Map<number, string>()
  const objRe = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g
  let m: RegExpExecArray | null
  while ((m = objRe.exec(latin1))) objs.set(parseInt(m[1], 10), m[2])
  return objs
}

// Balanced << >> extraction — a naive non-greedy regex breaks on nested dicts
// (e.g. /Resources << /ExtGState << … >> /Font << … >> >>).
function findBalancedDict(text: string, key: string): string | null {
  const m = new RegExp('/' + key + '\\s*<<').exec(text)
  if (!m) return null
  let i = m.index + m[0].length
  let depth = 1
  const start = i
  while (i < text.length && depth > 0) {
    if (text.startsWith('<<', i)) {
      depth++
      i += 2
    } else if (text.startsWith('>>', i)) {
      depth--
      i += 2
    } else i++
  }
  return text.slice(start, i - 2)
}

function findPdfRef(dictText: string, key: string): number | null {
  const m = new RegExp('/' + key + '\\s+(\\d+)\\s+0\\s+R').exec(dictText)
  return m ? parseInt(m[1], 10) : null
}

async function getPdfStreamBytes(objText: string): Promise<Uint8Array | null> {
  const sm = /stream\r?\n([\s\S]*?)endstream/.exec(objText)
  if (!sm) return null
  // The EOL that precedes `endstream` is not part of the data. The WHATWG
  // DecompressionStream (unlike zlib.decompress) throws on trailing bytes,
  // which is why the Worker's copy silently fell back to the raw deflate
  // bytes on every LibreOffice / Word export.
  let data = sm[1]
  while (data.length && (data.endsWith('\n') || data.endsWith('\r'))) data = data.slice(0, -1)
  const raw = strToBytes(data)
  if (/\/FlateDecode/.test(objText.slice(0, sm.index))) {
    try {
      return await inflateBytes(raw)
    } catch {
      return raw
    }
  }
  return raw
}

function hexToUnicodeStr(hex: string): string {
  let out = ''
  for (let i = 0; i < hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16))
  return out
}

interface CMap {
  map: Map<number, string>
  /** Code width in bytes from the codespace range: 1 for simple TrueType/Type1 fonts, 2 for CID fonts. */
  codeBytes: number
}

function parseToUnicodeCMap(cmapText: string): CMap {
  const map = new Map<number, string>()
  // The Worker's version assumed 2-byte codes everywhere; LibreOffice / Word
  // exports subset simple fonts with 1-byte codes (<00> <FF>) and came back
  // empty. The codespace range says which it is.
  let codeBytes = 2
  const cs = /begincodespacerange\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(cmapText)
  if (cs) codeBytes = Math.max(1, Math.min(4, Math.ceil(cs[2].length / 2)))
  const charRe = /beginbfchar([\s\S]*?)endbfchar/g
  let cm: RegExpExecArray | null
  while ((cm = charRe.exec(cmapText))) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g
    let pm: RegExpExecArray | null
    while ((pm = pairRe.exec(cm[1]))) map.set(parseInt(pm[1], 16), hexToUnicodeStr(pm[2]))
  }
  const rangeRe = /beginbfrange([\s\S]*?)endbfrange/g
  let rm: RegExpExecArray | null
  while ((rm = rangeRe.exec(cmapText))) {
    const tripleRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g
    let tm: RegExpExecArray | null
    while ((tm = tripleRe.exec(rm[1]))) {
      const lo = parseInt(tm[1], 16)
      const hi = parseInt(tm[2], 16)
      const dstStart = parseInt(tm[3], 16)
      for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, String.fromCharCode(dstStart + (c - lo)))
    }
  }
  return { map, codeBytes }
}

async function buildPdfFontCMaps(objs: Map<number, string>, fontResourceRefs: Map<string, number>) {
  const fontMaps = new Map<string, CMap>()
  for (const [name, objNum] of fontResourceRefs) {
    const fontObjText = objs.get(objNum)
    if (!fontObjText) continue
    const tuRef = findPdfRef(fontObjText, 'ToUnicode')
    if (!tuRef) continue
    const tuObjText = objs.get(tuRef)
    if (!tuObjText) continue
    const bytes = await getPdfStreamBytes(tuObjText)
    if (!bytes) continue
    fontMaps.set(name, parseToUnicodeCMap(new TextDecoder('latin1').decode(bytes)))
  }
  return fontMaps
}

function unescapePdfString(s: string): string {
  return s.replace(/\\([()\\])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '')
}

function decodePdfHexShowString(hex: string, fontName: string | null, fontMaps: Map<string, CMap>): string {
  const cmap = fontName ? fontMaps.get(fontName) : null
  let out = ''
  if (cmap) {
    const step = cmap.codeBytes * 2
    for (let i = 0; i + step <= hex.length; i += step) {
      const code = parseInt(hex.slice(i, i + step), 16)
      if (cmap.map.has(code)) out += cmap.map.get(code)
    }
  } else {
    for (let i = 0; i + 2 <= hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  }
  return out
}

function walkPdfContentStream(content: string, fontMaps: Map<string, CMap>): string {
  let out = ''
  let currentFont: string | null = null
  const tokenRe = /\/(\w+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]*)>\s*Tj|\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\[\]]|\\.)*)\]\s*TJ|(T\*|Td|TD)\b/g
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(content))) {
    if (m[1]) {
      currentFont = '/' + m[1]
      continue
    }
    if (m[5]) {
      out += content.substr(m.index, 2) === 'T*' ? '\n' : ' '
      continue
    }
    if (m[2] !== undefined && content[m.index] === '<') {
      out += decodePdfHexShowString(m[2], currentFont, fontMaps)
      continue
    }
    if (m[3] !== undefined) {
      out += unescapePdfString(m[3])
      continue
    }
    if (m[4] !== undefined) {
      const partRe = /\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f]*)>/g
      let pm: RegExpExecArray | null
      while ((pm = partRe.exec(m[4]))) {
        if (pm[1] !== undefined) out += unescapePdfString(pm[1])
        else if (pm[2] !== undefined) out += decodePdfHexShowString(pm[2], currentFont, fontMaps)
      }
      out += ' '
      continue
    }
  }
  return out + '\n'
}

export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pagesFound: number }> {
  let latin1 = ''
  // Chunked: a 8 MB spread into one Array.from(...).join would allocate far more than it needs to.
  for (let i = 0; i < bytes.length; i += 8192) {
    latin1 += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)))
  }
  const objs = indexPdfObjects(latin1)
  const pageObjNums: number[] = []
  for (const [num, text] of objs) if (/\/Type\s*\/Page\b(?!s)/.test(text)) pageObjNums.push(num)
  let allText = ''
  for (const pageNum of pageObjNums) {
    const pageText = objs.get(pageNum) || ''
    let resText = findBalancedDict(pageText, 'Resources')
    if (!resText) {
      const r = findPdfRef(pageText, 'Resources')
      if (r && objs.has(r)) resText = objs.get(r) || null
    }
    const fontRefs = new Map<string, number>()
    if (resText) {
      let fontDictText = findBalancedDict(resText, 'Font')
      if (!fontDictText) {
        const fr = findPdfRef(resText, 'Font')
        if (fr && objs.has(fr)) fontDictText = objs.get(fr) || null
      }
      if (fontDictText) {
        const fe = /\/(\w+)\s+(\d+)\s+0\s+R/g
        let m: RegExpExecArray | null
        while ((m = fe.exec(fontDictText))) fontRefs.set('/' + m[1], parseInt(m[2], 10))
      }
    }
    const fontMaps = await buildPdfFontCMaps(objs, fontRefs)
    const contentsArrM = /\/Contents\s*\[([^\]]*)\]/.exec(pageText)
    const contentRefs: number[] = []
    if (contentsArrM) {
      const re = /(\d+)\s+0\s+R/g
      let mm: RegExpExecArray | null
      while ((mm = re.exec(contentsArrM[1]))) contentRefs.push(parseInt(mm[1], 10))
    } else {
      const single = findPdfRef(pageText, 'Contents')
      if (single) contentRefs.push(single)
    }
    for (const cRef of contentRefs) {
      const cObjText = objs.get(cRef)
      if (!cObjText) continue
      const bytes2 = await getPdfStreamBytes(cObjText)
      if (!bytes2) continue
      allText += walkPdfContentStream(new TextDecoder('latin1').decode(bytes2), fontMaps)
    }
  }
  return { text: allText.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(), pagesFound: pageObjNums.length }
}

export async function extractUploadText(mimeType: string | null, filename: string, bytes: Uint8Array): Promise<Extraction> {
  const mt = (mimeType || '').toLowerCase()
  const ext = (filename || '').toLowerCase().split('.').pop()
  try {
    if (TEXT_MIME_TYPES.has(mt) || ext === 'txt' || ext === 'csv' || ext === 'md') {
      return { status: 'ok', text: new TextDecoder('utf-8').decode(bytes).slice(0, MAX_TEXT) }
    }
    if (mt === 'application/pdf' || ext === 'pdf') {
      const { text, pagesFound } = await extractPdfText(bytes)
      if (!text) return { status: pagesFound > 0 ? 'failed' : 'unsupported', text: null }
      return { status: 'ok', text: text.slice(0, MAX_TEXT) }
    }
    // DOCX / XLSX / images: no OCR or Office parser here yet — an honest
    // 'unsupported' (the file is still attached by name) beats a silent
    // empty citation.
    return { status: 'unsupported', text: null }
  } catch {
    return { status: 'failed', text: null }
  }
}
