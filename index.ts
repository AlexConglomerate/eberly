// Публичный API библиотеки ebely (npm-пакет «ebely»).
export { InternalStore } from './src/internal-store'
export { ApiResponse, EbelyAssertionError } from './src/response'
export type { DeepPartial } from './src/response'
export { generateClient, } from './src/generate-client'
export type { SwaggerSource } from './src/generate-client'
export type { EbelyConfig, ClientMode } from './src/config'
