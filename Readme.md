### Быстрый старт из шаблона

Склонировать готовый тест-проект (как `create-react-app`):

```sh
npx ebely create my-tests   # в новую/пустую папку
# или
npx ebely create            # в текущую папку
```

Затем:

```sh
cd my-tests
pnpm install
# отредактируй ebely/ebely.ts (url, путь к swagger) под свой бэкенд
pnpm run client:generate
pnpm test
```

### Алгоритм действий для пользователя библиотекой


#### 1. Установить библиотеку
`pnpm add -D ebely`

#### 2. Один раз разложить скиллы в проект
`npx ebely skills`

#### 3. Открыть проект в Claude Code и вызвать настройку
`/ebely-setup `            # настроит конфиг, сгенерирует клиент, стор, хуки

#### 4. Дальше при написании любых тестов
`/ebely-write-tests `      # опишет сценарий — тесты напишутся сами