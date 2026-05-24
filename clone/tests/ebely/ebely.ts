import type { EbelyConfig } from "ebely";
import { generateClient } from 'ebely'
import { UserStore } from "./userStore";
import { WorldStore } from "./worldStore";
import { hooks } from "./hooks";

export const ebely = {
    userStore: UserStore, // внутренние переменные одного пользователя
    worldStore: WorldStore, // внутренние переменные/сценарии всего приложения

    url: 'http://localhost:3000', // url бекенда, который нужно тестировать
    swagger: { pathToFile: 'swagger.json', }, // путь к swagger-схеме
    generateClientTo: 'ebely/generated.ts', // путь к генерируемому клиенту
    hooks, // before/after-хуки (объявлены в ./hooks.ts, типизированы)
    mode: 'test', // test - не-2xx статусы не бросаются.
} satisfies EbelyConfig

// запустить в другом файле для генерации клиента
export const generateEbelyClient = async () => {
    await generateClient(ebely)
}
