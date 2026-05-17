import { AppStore } from "./internalVariable";

export const evely = {
    forGen: {
        swaggerSchema: 'test-backend/swagger.json', // свагер бакэнда
        generateClientTo: 'src/world.ts', // сюда будет генерироваться типизированный клиент для тестов
    },
    internalStore: AppStore, // внутренние переменные
    url: 'http://localhost:3000', // url бекенда, который нужно тестировать
}