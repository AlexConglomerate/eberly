import type { EbelyConfig } from "ebely";
import { generateClient } from 'ebely'
import { AppStore } from "./internalVariable";
import { AppWorldStore } from "./worldVariable";
import { hooks } from "./hooks";

export const ebely = {
    internalStore: AppStore, // внутренние переменные одного пользователя
    worldStore: AppWorldStore, // внутренние переменные/сценарии всего world
    url: 'http://localhost:3000', // url бекенда, который нужно тестировать
    swagger: { pathToFile: 'swagger.json', }, // путь к swagger-схеме
    generateClientTo: 'ebely/generated.ts', // путь к генерируемому клиенту
    hooks, // before/after-хуки (объявлены в ./hooks.ts, типизированы)
    mode: 'test', // test - не-2xx статусы не бросаются.

    // mode: 'test' (по умолчанию) — методы возвращают ApiResponse с
    //   .status/.body/.assert(); не-2xx НЕ бросается.
    // mode: 'frontend' — методы возвращают тело напрямую, не-2xx бросает
    //   ошибку, .assert нет (клиент можно использовать из приложения).

    // internalStoreImport / configImport здесь НЕ нужны: их дефолты
    // ('ebely' и './ebely') уже подходят для этой раскладки.
    // Указывать их вручную надо только в нестандартных случаях —
    // см. описание полей в EbelyConfig.
} satisfies EbelyConfig

// запустить в другом файле для генерации клиента
export const generateEbelyClient = async () => {
    await generateClient(ebely)
}
