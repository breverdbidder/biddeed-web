/**
 * D4D Drive-mode voice command grammar (issue #20104).
 *
 * The command mic understands a FIXED, small set of driving actions - "next
 * stop", "mark vacant/occupied/uncertain", "bid/review/skip", "note <text>",
 * "log a find" - in the driver's own language. Anything that does not match
 * this table for the active language is not an error: it is a question for
 * Deed (routed to app/api/d4d/ask), which is why parseD4DVoiceCommand returns
 * `null` rather than throwing on a miss.
 *
 * Phrases below are a best-effort direct translation of the English grammar,
 * not a professional localization pass (INFERRED, no native-speaker review) -
 * flagged explicitly in docs/spec/20104.md. Matching is exact-phrase against
 * a normalized transcript (trimmed, lower-cased, trailing punctuation
 * stripped) so recognition noise on the surrounding sentence doesn't matter,
 * but a rephrasing of a command in-language falls through to Deed exactly
 * like an out-of-grammar English phrase would.
 */

export type FieldStatusWord = 'vacant' | 'occupied' | 'uncertain' | 'bid' | 'review' | 'skip'

export type D4DVoiceCommand =
  | { type: 'next' }
  | { type: 'status'; status: FieldStatusWord }
  | { type: 'note'; text: string }
  | { type: 'find' }

export interface D4DVoiceLanguage {
  /** BCP-47 tag passed straight to SpeechRecognition.lang / speechSynthesis voice matching. */
  bcp47: string
  /** English name, for the language selector. */
  label: string
  /** Name in the language itself, for the language selector. */
  nativeLabel: string
  next: string[]
  mark: string[]
  status: Record<FieldStatusWord, string[]>
  note: string[]
  find: string[]
}

export const D4D_VOICE_LANGUAGES: D4DVoiceLanguage[] = [
  {
    bcp47: 'en-US',
    label: 'English',
    nativeLabel: 'English',
    next: ['next stop', 'next'],
    mark: ['mark'],
    status: {
      vacant: ['vacant'],
      occupied: ['occupied'],
      uncertain: ['uncertain'],
      bid: ['bid'],
      review: ['review'],
      skip: ['skip'],
    },
    note: ['note'],
    find: ['log a find', 'log find'],
  },
  {
    bcp47: 'es-ES',
    label: 'Spanish',
    nativeLabel: 'Español',
    next: ['siguiente parada', 'siguiente'],
    mark: ['marcar'],
    status: {
      vacant: ['vacante'],
      occupied: ['ocupada', 'ocupado'],
      uncertain: ['incierto', 'incierta'],
      bid: ['puja', 'oferta'],
      review: ['revisar'],
      skip: ['omitir'],
    },
    note: ['nota'],
    find: ['registrar un hallazgo', 'registrar hallazgo'],
  },
  {
    bcp47: 'pt-BR',
    label: 'Portuguese',
    nativeLabel: 'Português',
    next: ['próxima parada', 'proxima parada', 'próximo', 'proximo'],
    mark: ['marcar'],
    status: {
      vacant: ['vago', 'vaga'],
      occupied: ['ocupado', 'ocupada'],
      uncertain: ['incerto', 'incerta'],
      bid: ['lance'],
      review: ['revisar'],
      skip: ['pular'],
    },
    note: ['nota'],
    find: ['registrar achado'],
  },
  {
    bcp47: 'he-IL',
    label: 'Hebrew',
    nativeLabel: 'עברית',
    next: ['תחנה הבאה', 'הבא'],
    mark: ['סמן'],
    status: {
      vacant: ['פנוי'],
      occupied: ['תפוס'],
      uncertain: ['לא ברור'],
      bid: ['הצעה'],
      review: ['בדיקה'],
      skip: ['דלג'],
    },
    note: ['הערה'],
    find: ['רשום ממצא'],
  },
  {
    bcp47: 'ru-RU',
    label: 'Russian',
    nativeLabel: 'Русский',
    next: ['следующая остановка', 'следующий'],
    mark: ['отметить'],
    status: {
      vacant: ['свободно'],
      occupied: ['занято'],
      uncertain: ['неясно'],
      bid: ['ставка'],
      review: ['проверить'],
      skip: ['пропустить'],
    },
    note: ['заметка'],
    find: ['записать находку'],
  },
  {
    bcp47: 'ar-SA',
    label: 'Arabic',
    nativeLabel: 'العربية',
    next: ['المحطة التالية', 'التالي'],
    mark: ['علم'],
    status: {
      vacant: ['شاغر'],
      occupied: ['مشغول'],
      uncertain: ['غير متأكد'],
      bid: ['مزايدة'],
      review: ['مراجعة'],
      skip: ['تخطي'],
    },
    note: ['ملاحظة'],
    find: ['سجل اكتشاف'],
  },
  {
    bcp47: 'fr-FR',
    label: 'French',
    nativeLabel: 'Français',
    next: ['prochain arrêt', 'prochain arret', 'suivant'],
    mark: ['marquer'],
    status: {
      vacant: ['vacant'],
      occupied: ['occupé', 'occupe'],
      uncertain: ['incertain'],
      bid: ['enchère', 'enchere'],
      review: ['revoir'],
      skip: ['passer'],
    },
    note: ['note'],
    find: ['signaler une découverte', 'signaler une decouverte'],
  },
  {
    bcp47: 'de-DE',
    label: 'German',
    nativeLabel: 'Deutsch',
    next: ['nächster stopp', 'nachster stopp', 'weiter'],
    mark: ['markieren'],
    status: {
      vacant: ['leer'],
      occupied: ['besetzt'],
      uncertain: ['unsicher'],
      bid: ['gebot'],
      review: ['prüfen', 'prufen'],
      skip: ['überspringen', 'uberspringen'],
    },
    note: ['notiz'],
    find: ['fund melden'],
  },
  {
    bcp47: 'it-IT',
    label: 'Italian',
    nativeLabel: 'Italiano',
    next: ['prossima tappa', 'prossimo'],
    mark: ['segna'],
    status: {
      vacant: ['vacante'],
      occupied: ['occupato', 'occupata'],
      uncertain: ['incerto', 'incerta'],
      bid: ['offerta'],
      review: ['rivedi'],
      skip: ['salta'],
    },
    note: ['nota'],
    find: ['segnala scoperta'],
  },
  {
    bcp47: 'zh-CN',
    label: 'Chinese',
    nativeLabel: '中文',
    next: ['下一站'],
    mark: ['标记'],
    status: {
      vacant: ['空置'],
      occupied: ['有人'],
      uncertain: ['不确定'],
      bid: ['出价'],
      review: ['复查'],
      skip: ['跳过'],
    },
    note: ['备注'],
    find: ['记录发现'],
  },
  {
    bcp47: 'ja-JP',
    label: 'Japanese',
    nativeLabel: '日本語',
    next: ['次の停留所', '次へ'],
    mark: ['マーク'],
    status: {
      vacant: ['空き'],
      occupied: ['入居中'],
      uncertain: ['不明'],
      bid: ['入札'],
      review: ['確認'],
      skip: ['スキップ'],
    },
    note: ['メモ'],
    find: ['発見を記録'],
  },
  {
    bcp47: 'ko-KR',
    label: 'Korean',
    nativeLabel: '한국어',
    next: ['다음 정류장', '다음'],
    mark: ['표시'],
    status: {
      vacant: ['공실'],
      occupied: ['거주중', '거주 중'],
      uncertain: ['불확실'],
      bid: ['입찰'],
      review: ['검토'],
      skip: ['건너뛰기'],
    },
    note: ['메모'],
    find: ['발견 기록'],
  },
]

export const D4D_DEFAULT_LANG = 'en-US'

/** Exact BCP-47 match first, then base-language match (`es` matches `es-MX`), then English. */
export function resolveD4DVoiceLanguage(lang: string): D4DVoiceLanguage {
  const norm = lang.trim().toLowerCase()
  const exact = D4D_VOICE_LANGUAGES.find((l) => l.bcp47.toLowerCase() === norm)
  if (exact) return exact
  const base = norm.split('-')[0]
  const byBase = D4D_VOICE_LANGUAGES.find((l) => l.bcp47.toLowerCase().split('-')[0] === base)
  return byBase ?? D4D_VOICE_LANGUAGES[0]
}

function normalize(transcript: string): string {
  return transcript
    .trim()
    .toLowerCase()
    .replace(/[.!?。！？،؛]+$/g, '')
    .trim()
}

/**
 * Matches `transcript` against the fixed grammar for `lang`. Returns `null`
 * on no match - the caller's job is to treat that as a question for Deed,
 * not as a recognition failure.
 */
export function parseD4DVoiceCommand(transcript: string, lang: string): D4DVoiceCommand | null {
  const phrases = resolveD4DVoiceLanguage(lang)
  const t = normalize(transcript)
  if (!t) return null

  if (phrases.next.includes(t)) return { type: 'next' }
  if (phrases.find.includes(t)) return { type: 'find' }

  const statusKeys = Object.keys(phrases.status) as FieldStatusWord[]
  for (const status of statusKeys) {
    if (phrases.status[status].includes(t)) return { type: 'status', status }
  }

  for (const markWord of phrases.mark) {
    if (!t.startsWith(markWord)) continue
    const rest = t.slice(markWord.length).trim()
    for (const status of statusKeys) {
      if (phrases.status[status].includes(rest)) return { type: 'status', status }
    }
  }

  for (const noteWord of phrases.note) {
    if (t.startsWith(noteWord)) {
      const text = t.slice(noteWord.length).trim()
      if (text) return { type: 'note', text }
    }
  }

  return null
}
