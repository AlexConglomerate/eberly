// JSDoc-комментарии в сгенерированном коде: над эндпоинтом в `WorldApi`,
// над path/query-параметрами и над полями схем.
//
// Описания — внешний текст из свагера. `*/` внутри него закрыл бы
// комментарий, и остаток описания стал бы КОДОМ в generated.ts (сломанный
// файл или инъекция). Поэтому `*/` всегда экранируется в `*\/`.

/** Экранирует текст для тела JSDoc: `*\/` вместо `*` + `/`, без `\r`. */
export function escapeJsDoc(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\*\//g, '*\\/')
}

/**
 * Блок JSDoc с отступом `indent` (строка пробелов); каждая строка блока
 * заканчивается `\n`, так что результат ставится прямо перед строкой
 * свойства. `lines` — абзацы (пустые и `undefined` пропускаются), между
 * абзацами пустая строка ` *`. Один однострочный абзац без `@deprecated` →
 * `/** text *\/` в одну строку. Нечего писать → пустая строка (никаких
 * пустых `/** *\/`).
 */
export function renderJsDoc(args: {
  lines: Array<string | undefined>
  deprecated?: boolean
  indent: string
}): string {
  const { lines, deprecated = false, indent } = args
  const paragraphs = lines
    .map((l) => (l === undefined ? '' : escapeJsDoc(l).trim()))
    .filter((l) => l !== '')

  if (paragraphs.length === 0 && !deprecated) return ''
  if (paragraphs.length === 1 && !paragraphs[0]!.includes('\n') && !deprecated) {
    return `${indent}/** ${paragraphs[0]} */\n`
  }
  if (paragraphs.length === 0) return `${indent}/** @deprecated */\n`

  const body = paragraphs
    .map((p) => p.split('\n').map((l) => (l.trim() ? `${indent} * ${l.trimEnd()}` : `${indent} *`)))
    .reduce<string[]>((acc, p) => (acc.length === 0 ? p : [...acc, `${indent} *`, ...p]), [])
  if (deprecated) body.push(`${indent} * @deprecated`)
  return `${indent}/**\n${body.join('\n')}\n${indent} */\n`
}
