// Тип пользовательского ebely-конфига (объект `ebely`, который импортирует
// сгенерированный клиент). Пользователь применяет его через `satisfies`,
// чтобы не потерять конкретный тип своего `userStore`.

import type { HooksRegistrar } from './hooks'
import type { SwaggerSource } from './generator/swagger'
import type { BaseStore } from './base-store'

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

/** Конфиг ebely, который пользователь объявляет в своём `ebely.ts`. */
export type EbelyConfig = {
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
   * Регистратор хуков `before` / `after`. Объявляется в ОТДЕЛЬНОМ
   * типизированном файле (тип `Hooks` экспортирует сгенерированный
   * клиент) и передаётся сюда одной переменной:
   *
   * ```ts
   * // ebely/hooks.ts
   * import type { Hooks } from './generated'
   * export const hooks: Hooks = (h) => {
   *   h.posts.create.after(({ response, ctx }) => {
   *     ctx.set({ key: 'lastPostId', value: response.body.id })
   *   })
   * }
   * // ebely/ebely.ts
   * import { hooks } from './hooks'
   * export const ebely = { …, hooks } satisfies EbelyConfig
   * ```
   *
   * Регистратор вызывается ОДИН раз при `new World()`. Внутри хука `ctx`
   * — это store КОНКРЕТНОГО пользователя, сделавшего запрос, поэтому
   * запись в переменные не «течёт» между пользователями.
   * @default undefined
   */
  hooks?: HooksRegistrar

  /**
   * Из какого модуля СГЕНЕРИРОВАННЫЙ файл импортирует `BaseStore`.
   * По умолчанию `'ebely'` — имя npm-пакета библиотеки. Менять нужно
   * только в нестандартной раскладке (монорепо без публикации,
   * импорт по относительному пути или по alias из tsconfig).
   * @default 'ebely'
   */
  userStoreImport?: string
  /**
   * Из какого модуля СГЕНЕРИРОВАННЫЙ файл импортирует `ebely`-конфиг
   * (нужен ему для значений по умолчанию: `ebely.url`, `ebely.userStore`).
   * Это путь ОТ сгенерированного файла К этому конфигу. По умолчанию
   * `'./ebely'` — т.е. конфиг лежит рядом с генерируемым файлом.
   * @default './ebely'
   */
  configImport?: string
}
