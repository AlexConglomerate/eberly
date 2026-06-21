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

    // Отправка файлов (multipart). encoding задаёт кодировку имён полей для
    // МАССИВА файлов; дефолт 'repeat' (веб-стандарт busboy/Go/Rust). Этот
    // бэкенд на oRPC, поэтому при появлении файловых эндпоинтов нужно:
    // files: { encoding: 'bracket-index' }, // files[0], files[1] — как ждёт oRPC

    // mode: 'test' (по умолчанию) — методы возвращают ApiResponse с
    //   .status/.body/.assert(); не-2xx НЕ бросается.
    // mode: 'frontend' — методы возвращают тело напрямую, не-2xx бросает
    //   ошибку, .assert нет (клиент можно использовать из приложения).

    // userStoreImport / configImport здесь НЕ нужны: их дефолты
    // ('ebely' и './ebely') уже подходят для этой раскладки.
    // Указывать их вручную надо только в нестандартных случаях —
    // см. описание полей в EbelyConfig.
} satisfies EbelyConfig

// запустить в другом файле для генерации клиента
export const generateEbelyClient = async () => {
    await generateClient(ebely)
}
