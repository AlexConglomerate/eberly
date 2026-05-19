// Публичный API библиотеки ebely (npm-пакет «ebely»).
export { InternalStore } from './src/internal-store'
export { ApiResponse, EbelyAssertionError } from './src/response'
export type { DeepPartial } from './src/response'
export { HookRegistry } from './src/hooks'
export type {
  HooksRegistrar,
  BeforeHook,
  AfterHook,
  BeforeHookArgs,
  AfterHookArgs,
  HookRequest,
  HookResponse,
} from './src/hooks'
export { generateClient, } from './src/generate-client'
export type { SwaggerSource } from './src/generate-client'
export type { EbelyConfig, ClientMode } from './src/config'
