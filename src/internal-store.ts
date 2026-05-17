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
> {
  private internalStore = new Map<keyof Vars, unknown>()

  /** Сохранить внутреннюю переменную пользователя. */
  set<K extends keyof Vars>(args: { key: K; value: Vars[K] }): void {
    this.internalStore.set(args.key, args.value)
  }

  /** Прочитать внутреннюю переменную пользователя (undefined, если не задана). */
  get<K extends keyof Vars>(args: { key: K }): Vars[K] | undefined {
    return this.internalStore.get(args.key) as Vars[K] | undefined
  }
}
