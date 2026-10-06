// Интерфейс Standard Schema v1 (https://standardschema.dev) — минимальная
// копия, как и рекомендует спецификация: без зависимости от
// `@standard-schema/spec`. Его реализуют Zod (3.24+), Valibot, ArkType,
// Effect Schema — поэтому `assert` принимает схему любой из них.

/** Схема, совместимая со Standard Schema v1. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
    ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
  }
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardSchemaIssue> }

export interface StandardSchemaIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
}

/** Duck-typing: у схемы есть `~standard.validate`. ArkType-схемы — функции. */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false
  const props = (value as { '~standard'?: { validate?: unknown } })['~standard']
  return typeof props?.validate === 'function'
}
