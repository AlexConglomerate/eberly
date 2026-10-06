import { defineConfig } from 'vitest/config'

// Тест-файлы ходят в ОДИН бэкенд с общей базой, и каждый чистит её
// в beforeAll (`world.reset()` / `world.clearDatabase()`). Параллельно
// файлы стирали бы данные друг друга — поэтому строго по очереди.
// #region docs:vitest-config
export default defineConfig({
  test: {
    fileParallelism: false,
  },
})
// #endregion
