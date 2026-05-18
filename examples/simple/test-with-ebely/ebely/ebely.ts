import type { EbelyConfig } from "ebely";
import { generateClient } from 'ebely'
import { AppStore } from "./internalVariable";

export const ebely = {
    internalStore: AppStore, // внутренние переменные
    url: 'http://localhost:3000', // url бекенда, который нужно тестировать
    swagger: { pathToFile: 'swagger.json', }, // путь к swagger-схеме
    generateClientTo: 'ebely/generated.ts', // путь к генерируемому клиенту

    // internalStoreImport / configImport здесь НЕ нужны: их дефолты
    // ('ebely' и './ebely') уже подходят для этой раскладки.
    // Указывать их вручную надо только в нестандартных случаях —
    // см. описание полей в EbelyConfig.
} satisfies EbelyConfig

// запустить в другом файле для генерации клиента
export const generateEbelyClient = async () => {
    await generateClient(ebely)
}
