// Тип пользовательского ebely-конфига (объект `ebely`, который импортирует
// сгенерированный клиент). Пользователь применяет его через `satisfies`,
// чтобы не потерять конкретный тип своего `internalStore`.

import type { SwaggerSource } from './generator/swagger'
import type { InternalStore } from './internal-store'

/** Конфиг ebely, который пользователь объявляет в своём `ebely.ts`. */
export type EbelyConfig = {
  /** URL бэкенда, который нужно тестировать. */
  url: string
  /**
   * Класс-хранилище внутренних переменных — наследник `InternalStore`.
   * Передаётся сам класс (конструктор), не его экземпляр.
   */
  internalStore: new () => InternalStore<any>

  /** Откуда брать swagger-схему: из файла (`pathToFile`) или по `url`. */
  swagger: SwaggerSource

  /** Путь, куда писать сгенерированный клиент (резолвится от process.cwd()). */
  generateClientTo: `${string}.ts`

  /**
   * Из какого модуля СГЕНЕРИРОВАННЫЙ файл импортирует `InternalStore`.
   * По умолчанию `'ebely'` — имя npm-пакета библиотеки. Менять нужно
   * только в нестандартной раскладке (монорепо без публикации,
   * импорт по относительному пути или по alias из tsconfig).
   * @default 'ebely'
   */
  internalStoreImport?: string
  /**
   * Из какого модуля СГЕНЕРИРОВАННЫЙ файл импортирует `ebely`-конфиг
   * (нужен ему для значений по умолчанию: `ebely.url`, `ebely.internalStore`).
   * Это путь ОТ сгенерированного файла К этому конфигу. По умолчанию
   * `'./ebely'` — т.е. конфиг лежит рядом с генерируемым файлом.
   * @default './ebely'
   */
  configImport?: string
}
