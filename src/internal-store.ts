// Ядро библиотеки (НЕ генерируется). Базовый класс хранилища внутренних
// переменных одного пользователя. Вынесен из генерируемого world.ts, чтобы
// разорвать цикл импортов world.ts → ebely.ts → internalVariable.ts → world.ts.
//
// Это схемо-независимая обвязка — она НЕ выводится из swagger. Конкретный
// набор переменных задаёт пользователь библиотеки: он наследуется от
// InternalStore в своём (не генерируемом) файле, передаёт тип переменных
// дженериком и может добавлять производные методы поверх this.get/this.set.

export class InternalStore<
  Vars extends Record<string, unknown> = Record<string, never>,
  Api = unknown,
> {
  private internalStore = new Map<keyof Vars, unknown>()

  /**
   * Типизированный доступ к эндпоинтам ИЗНУТРИ методов-сценариев
   * («actions»): `this.api.<группа>.<метод>(...)`. Само значение
   * подставляет генерируемый `World` (для user-store — клиент этого
   * пользователя, для world-store — анонимный клиент), поэтому здесь это
   * объявление без инициализатора. Тип `Api` пользователь задаёт вторым
   * дженериком, передавая сгенерированный `WorldApi`:
   *
   *   import type { WorldApi } from './generated'
   *   class AppStore extends InternalStore<Vars, WorldApi> {
   *     async fullRegister(args: { email: string; password: string }) {
   *       await this.api.auth.register({ body: args })
   *       await this.api.auth.confirm({ body: { code: '0000' } })
   *     }
   *   }
   *
   * (Тип импортируется как `import type` → рантайм-цикла нет, ровно как
   * у `hooks.ts`; см. ARCHITECTURE.md §7–§8.)
   */
  protected api!: Api

  /** Сохранить внутреннюю переменную пользователя. */
  set<K extends keyof Vars>(args: { key: K; value: Vars[K] }): void {
    this.internalStore.set(args.key, args.value)
  }

  /** Прочитать внутреннюю переменную пользователя (undefined, если не задана). */
  get<K extends keyof Vars>(args: { key: K }): Vars[K] | undefined {
    return this.internalStore.get(args.key) as Vars[K] | undefined
  }
}
