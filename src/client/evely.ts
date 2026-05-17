import { AppStore } from "./internalVariable";

export const evely = {
    swaggerSchema: 'src/test-backend/swagger.json', // свагер бакэнда
    generateClientTo: 'src/client/world.ts', // сюда будет генерироваться типизированный клиент для тестов
    internalStore: AppStore, // внутренние переменные
}