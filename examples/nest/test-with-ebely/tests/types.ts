// Тест ТИПОВ на настоящем клиенте. vitest его не запускает (нет
// `.test.` в имени), проверяет `pnpm typecheck` (`tsc --noEmit`). Если
// ожидаемая ошибка пропадёт, tsc скажет «Unused '@ts-expect-error'».

import { World } from '../ebely/generated'

export async function typeChecks(): Promise<void> {
  const user = new World().createUser()
  const res = await user.posts.create({ body: { title: 'Hello', content: 'World' } })

  // `POST /posts` отвечает 201, а не 200 — опечатку видно сразу.
  res.assert(201)
  // @ts-expect-error — 200 не задекларирован
  res.assert(200)

  // Задекларированная ошибка: тело типизировано как ErrorDto.
  res.assert(400, { statusCode: 400 })
  // @ts-expect-error — у ErrorDto нет поля `title`
  res.assert(400, { title: 'Hello' })

  // Незадекларированный 4xx — без каста.
  res.assert(403)

  // @ts-expect-error — лишнего поля нет в CreatePostDto
  await user.posts.create({ body: { title: 'Hello', content: 'World', tags: [] } })

  // После assert тело сужено до PostDto.
  const id: number = res.assert(201).body.id
  // @ts-expect-error — без assert тело — союз PostDto | ErrorDto
  const raw: number = res.body.id
  void [id, raw]
}
