import type { EbelyConfig } from "ebely";
import { AppStore } from "./internalVariable";

export const ebely = {
    internalStore: AppStore, // внутренние переменные
    url: 'http://localhost:3000', // url бекенда, который нужно тестировать
} satisfies EbelyConfig