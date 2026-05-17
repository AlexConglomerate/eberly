import type { EbelyConfig } from "ebely";
import { AppStore } from "./internalVariable";
import { generateClient } from 'ebely'

export const ebely = {
    internalStore: AppStore, // внутренние переменные
    url: 'http://localhost:3000', // url бекенда, который нужно тестировать
    swagger: { pathToFile: 'swagger.json', }, // путь к swagger-схеме
    generateClientTo: 'ebely/generated.ts', // путь к генерируемому клиенту

    configImport: './ebely', // путь до этого файла. это очень странно.
    internalStoreImport: 'ebely', // название этой библиотеки.
} satisfies EbelyConfig

// запустить в другом файле для генерации клиента
export const generateEbelyClient = async () => {
    await generateClient(ebely)
}