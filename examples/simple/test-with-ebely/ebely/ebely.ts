import { AppStore } from "./internalVariable";

export const ebely = {
    swaggerSchema: 'swagger.json', // свагер бэкенда (your-app), скопированный сюда
    generateClientTo: 'ebely/generated.ts', // сюда будет генерироваться типизированный клиент для тестов
    internalStore: AppStore, // внутренние переменные
    url: 'http://localhost:3000', // url бекенда, который нужно тестировать
}