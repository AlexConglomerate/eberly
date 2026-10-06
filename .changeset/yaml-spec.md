---
"eberly": minor
---

Схема в YAML и URL без `.json`.

- `swagger.pathToFile` принимает `.json`, `.yaml` и `.yml`.
- `swagger.url` — любой http(s)-URL: `http://localhost:3000/docs-json`
  (Nest), `/v3/api-docs` (springdoc), `/openapi` — без скачивания curl-ом.
- Формат определяется по тексту: начинается с `{` → JSON, иначе YAML.
  Битый текст или не объект — ошибка *"eberly: failed to parse the OpenAPI
  spec from <source> as JSON or YAML: …"*.
- Новая рантайм-зависимость — `yaml` (без транзитивных зависимостей,
  грузится лениво, только для YAML).
