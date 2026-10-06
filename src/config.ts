// Тип пользовательского eberly-конфига (объект `eberly`, который импортирует
// сгенерированный клиент). Пользователь применяет его через `satisfies`,
// чтобы не потерять конкретный тип своего `userStore`.

import type { HooksRegistrar } from './hooks'
import type { SwaggerSource } from './generator/swagger'
import type { BaseStore } from './base-store'
import type { FileEncoding } from './files'

/**
 * Режим генерируемого клиента (решается на этапе генерации, влияет на
 * форму сгенерированного файла):
 *
 * - `'test'` — методы возвращают объект-ответ с `.status` / `.body` и
 *   методом `.assert(status, body?)`. Не-2xx НЕ бросает исключение —
 *   проверка делается явным `res.assert(...)`.
 * - `'frontend'` — методы возвращают тело ответа напрямую; не-2xx
 *   бросает ошибку; метода `.assert` нет. Подходит для использования
 *   клиента из приложения (фронтенд/сервис), а не только в тестах.
 */
export type ClientMode = 'test' | 'frontend'

/** Конфиг eberly, который пользователь объявляет в своём `eberly.ts`. */
export type EberlyConfig = {
  /** URL бэкенда, который нужно тестировать. */
  url: string
  /**
   * Класс-хранилище внутренних переменных ОДНОГО пользователя — наследник
   * `BaseStore`. Передаётся сам класс (конструктор), не его экземпляр.
   * Может содержать методы-сценарии (`async fullRegister(...)`), которые
   * через `this.api.<группа>.<метод>` дёргают эндпоинты от лица этого
   * пользователя (его заголовки, его переменные, его `ctx` в хуках).
   */
  userStore: new () => BaseStore<any, any>

  /**
   * Класс-хранилище переменных/сценариев УРОВНЯ WORLD (необязательно).
   * Тот же `BaseStore`, но его экземпляр — не «один пользователь», а
   * весь мир: сюда кладут глобальные сценарии подготовки/очистки
   * (`clearDatabase`, `seed`), доступные как `world.<метод>()`. Внутри
   * `this.api` — анонимный клиент (без per-user заголовков).
   * @default undefined — у `World` нет доп. методов
   */
  worldStore?: new () => BaseStore<any, any>

  /** Откуда брать swagger-схему: из файла (`pathToFile`) или по `url`. */
  swagger: SwaggerSource

  /** Путь, куда писать сгенерированный клиент (резолвится от process.cwd()). */
  generateClientTo: `${string}.ts`

  /**
   * Режим генерируемого клиента — см. {@link ClientMode}.
   * @default 'test'
   */
  mode?: ClientMode

  /**
   * Максимальное число ПОВТОРОВ запроса, которые eberly сделает, если
   * глобальный `retry`-хук (`h.globalRetry`) вернул `true`. Это потолок
   * на повторы СВЕРХ первой попытки: при `maxRetries: 3` запрос уйдёт
   * максимум 4 раза. Защита от бесконечного цикла, если хук упрямо просит
   * повтор (напр. сервер стабильно отвечает 401). Без `globalRetry`-хуков
   * не влияет ни на что.
   * @default 3
   */
  maxRetries?: number

  /**
   * Защита от прода: на какие хосты, КРОМЕ loopback, клиенту можно слать
   * запросы. `localhost`, `127.0.0.1` и `[::1]` разрешены всегда, список их
   * дополняет. Элемент — точный hostname (`staging.x.com`) или `*.domain`
   * (`*.staging.x.com` совпадает с `api.staging.x.com`, но не со
   * `staging.x.com`). Регистр не важен, порт игнорируется.
   *
   * Только режим `'test'`: хост проверяется при `new World()` /
   * `createUser()` — до первого запроса, в том числе для
   * `new World({ url })`. Чужой хост → `EberlyUnsafeHostError`. В
   * `'frontend'` проверки нет (клиент из приложения ходит в прод).
   *
   * Рантайм-настройка (как `maxRetries`): перегенерация НЕ нужна.
   * @default [] — только loopback
   */
  allowedHosts?: string[]

  /**
   * Регистратор хуков `before` / `after`. Объявляется в ОТДЕЛЬНОМ
   * типизированном файле (тип `Hooks` экспортирует сгенерированный
   * клиент) и передаётся сюда одной переменной:
   *
   * ```ts
   * // eberly/hooks.ts
   * import type { Hooks } from './generated'
   * export const hooks: Hooks = (h) => {
   *   h.posts.create.after(({ response, ctx }) => {
   *     ctx.set({ key: 'lastPostId', value: response.body.id })
   *   })
   * }
   * // eberly/eberly.ts
   * import { hooks } from './hooks'
   * export const eberly = { …, hooks } satisfies EberlyConfig
   * ```
   *
   * Регистратор вызывается ОДИН раз при `new World()`. Внутри хука `ctx`
   * — это store КОНКРЕТНОГО пользователя, сделавшего запрос, поэтому
   * запись в переменные не «течёт» между пользователями.
   * @default undefined
   */
  hooks?: HooksRegistrar

  /**
   * Настройки отправки файлов (multipart/form-data). `encoding` задаёт, как
   * кодируются ИМЕНА полей формы для МАССИВА файлов (для одного файла не
   * важно — всегда одно поле без скобок):
   *  - `'repeat'`        — files, files, …    (busboy: Express/Nest/Fastify, Go, Rust) — ДЕФОЛТ
   *  - `'bracket-index'` — files[0], files[1] (oRPC OpenAPI-хендлер, PHP, Rails)
   *  - `'bracket-empty'` — files[], files[]   (PHP/Rails вариант)
   *  - функция           — кастомная кодировка (escape hatch)
   *
   * Дефолт `'repeat'` — мейнстрим (веб-стандарт). Проектам на oRPC нужно
   * явно поставить `files: { encoding: 'bracket-index' }`.
   *
   * Рантайм-настройка (как `maxRetries`): читается в момент запроса, для
   * смены перегенерация клиента НЕ нужна.
   * @default 'repeat'
   */
  files?: { encoding?: FileEncoding }

  /**
   * Из какого модуля СГЕНЕРИРОВАННЫЙ файл импортирует `BaseStore`.
   * По умолчанию `'eberly'` — имя npm-пакета библиотеки. Менять нужно
   * только в нестандартной раскладке (монорепо без публикации,
   * импорт по относительному пути или по alias из tsconfig).
   * @default 'eberly'
   */
  userStoreImport?: string
  /**
   * Из какого модуля СГЕНЕРИРОВАННЫЙ файл импортирует `eberly`-конфиг
   * (нужен ему для значений по умолчанию: `eberly.url`, `eberly.userStore`).
   * Это путь ОТ сгенерированного файла К этому конфигу. По умолчанию
   * `'./eberly'` — т.е. конфиг лежит рядом с генерируемым файлом.
   * @default './eberly'
   */
  configImport?: string
}
