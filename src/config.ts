// Тип пользовательского ebely-конфига (объект `ebely`, который импортирует
// сгенерированный world.ts). Пользователь применяет его через `satisfies`,
// чтобы не потерять конкретный тип своего `internalStore`.

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
}
