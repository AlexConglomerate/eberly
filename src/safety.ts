// Защита от прода: сгенерированный клиент в режиме 'test' отказывается
// ходить на хост, которого нет в `allowedHosts`. Тесты создают и удаляют
// данные — случайный `url` на прод не должен дойти до первого запроса.
//
// Правило: loopback (`localhost`, `127.0.0.1`, `[::1]`) можно всегда,
// остальное — только из списка. Элемент списка — точный hostname или
// `*.domain` (совпадает с поддоменами, но не с самим доменом). Регистр не
// важен, порт игнорируется. Чистые функции, без сети.

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]']

/** Ошибка: хост бэкенда не входит в `allowedHosts`. */
export class EberlyUnsafeHostError extends Error {
  constructor(public readonly host: string) {
    super(
      `eberly: refusing to send requests to "${host}" — the host is not in allowedHosts. ` +
        `Tests create and delete data. If this is a test environment, ` +
        'add the host to `allowedHosts` in eberly.ts.',
    )
    this.name = 'EberlyUnsafeHostError'
  }
}

/** Элемент списка → нижний регистр, без порта (`API.x.com:8080` → `api.x.com`). */
function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase().replace(/:\d+$/, '')
}

function matchesPattern(args: { host: string; pattern: string }): boolean {
  const { host, pattern } = args
  if (pattern.startsWith('*.')) return host.endsWith(pattern.slice(1))
  return host === pattern
}

/** Разрешён ли хост из `url`: loopback — всегда, остальное — по списку. */
export function isHostAllowed(args: { url: string; allowedHosts?: string[] }): boolean {
  const { url, allowedHosts = [] } = args
  // URL сам приводит hostname к нижнему регистру и отрезает порт.
  const host = new URL(url).hostname
  return [...LOOPBACK, ...allowedHosts.map(normalizePattern)].some((pattern) =>
    matchesPattern({ host, pattern }),
  )
}

/** Бросает {@link EberlyUnsafeHostError}, если хост из `url` не разрешён. */
export function assertHostAllowed(args: { url: string; allowedHosts?: string[] }): void {
  if (!isHostAllowed(args)) throw new EberlyUnsafeHostError(new URL(args.url).hostname)
}
