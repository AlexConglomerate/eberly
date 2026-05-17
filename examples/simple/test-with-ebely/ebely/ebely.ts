import type { EbelyConfig } from "ebely";
import { AppStore } from "./internalVariable";
import { generateClient } from 'ebely'

export const ebely = {
    internalStore: AppStore, // внутренние переменные
    url: 'http://localhost:3000', // url бекенда, который нужно тестировать
    swagger: { pathToFile: 'swagger.json', },
    generateClientTo: 'ebely/generated.ts',
} satisfies EbelyConfig


export const generateEbelyClient = async () => {
    await generateClient(ebely)
}