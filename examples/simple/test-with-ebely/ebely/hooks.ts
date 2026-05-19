const api = createClient(spec)

// регистрировать можно где угодно — в setup-файле, в beforeAll, в модуле сценария
api.hooks.post.create.after(({ request, response, ctx }) => {
  ctx.set('lastPostId', response.body.id)
})

api.hooks.get.list.before(({ ctx, query }) => {
  query.afterId = ctx.get('lastPostId')
})

// несколько хуков на один endpoint складываются в очередь
api.hooks.post.create.after(logResponse)
api.hooks.post.create.after(updateMetrics)