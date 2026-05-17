// Тип пользовательского ebely-конфига (объект `ebely`, который импортирует
// сгенерированный world.ts). Пользователь применяет его через `satisfies`,
// чтобы не потерять конкретный тип своего `internalStore`.

import type { SwaggerSource } from './generate-client'
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
   * Откуда сгенерированный файл импортирует `InternalStore`.
   * По умолчанию — имя пакета библиотеки.
   */
  internalStoreImport?: string
  /**
   * Откуда сгенерированный файл импортирует `ebely`-конфиг.
   * По умолчанию — соседний модуль `./ebely`.
   */
  configImport?: string

}

