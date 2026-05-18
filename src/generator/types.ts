// Общие типы генератора. Держим их отдельно, чтобы модули генератора
// (swagger / schema / operations / render) не импортировали друг друга
// только ради одного вспомогательного типа.

/** Произвольный узел swagger/JSON-Schema-документа. */
export type Json = Record<string, any>
