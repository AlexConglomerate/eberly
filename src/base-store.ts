// Ядро библиотеки (НЕ генерируется). Базовый класс хранилища внутренних
// переменных одного пользователя. Вынесен из генерируемого world.ts, чтобы
// разорвать цикл импортов world.ts → eberly.ts → userStore.ts → world.ts.
//
// Это схемо-независимая обвязка — она НЕ выводится из swagger. Конкретный
// набор переменных задаёт пользователь библиотеки: он наследуется от
// BaseStore в своём (не генерируемом) файле, передаёт тип переменных
// дженериком и может добавлять производные методы поверх this.get/this.set.

export class BaseStore<
  // По умолчанию `unknown`, не `never`: голый `BaseStore` — ограничение в
  // сгенерированных `World` / `Hooks`, он должен принимать любой стор, а с
  // `never` строгий тип возврата `get` его отвергнет.
  Vars extends Record<string, unknown> = Record<string, unknown>,
  Api = unknown,
> {
  // Ключ — `PropertyKey`, а не `keyof Vars`: иначе приватное поле делает
  // `BaseStore<UserVars>` несовместимым с голым `BaseStore` (в `.d.ts` тип
  // приватного поля стирается, а в исходнике — нет).
  private store = new Map<PropertyKey, unknown>()

  /**
   * Типизированный доступ к эндпоинтам ИЗНУТРИ методов-сценариев
   * («actions»): `this.api.<группа>.<метод>(...)`. Само значение
   * подставляет генерируемый `World` (для user-store — клиент этого
   * пользователя, для world-store — анонимный клиент), поэтому здесь это
   * объявление без инициализатора. Тип `Api` пользователь задаёт вторым
   * дженериком, передавая сгенерированный `WorldApi`:
   *
   *   import type { WorldApi } from './generated'
   *   class UserStore extends BaseStore<Vars, WorldApi> {
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
    this.store.set(args.key, args.value)
  }

  /**
   * Read a user variable. Throws if it is not set.
   * If the value may be missing (e.g. in a hook for an anonymous user), use `getSafe`.
   * @throws {Error} when the key has no value
   */
  get<K extends keyof Vars>(args: { key: K }): Vars[K] {
    if (!this.store.has(args.key)) {
      const key = String(args.key)
      throw new Error(
        `eberly: "${key}" is not set on this user. It is usually set by a hook or a scenario — ` +
          `check that the request ran and succeeded. If the value may be missing, use getSafe({ key: '${key}' }).`,
      )
    }
    return this.store.get(args.key) as Vars[K]
  }

  /** Read a user variable, or `undefined` if it is not set. Never throws. */
  getSafe<K extends keyof Vars>(args: { key: K }): Vars[K] | undefined {
    return this.store.get(args.key) as Vars[K] | undefined
  }
}
