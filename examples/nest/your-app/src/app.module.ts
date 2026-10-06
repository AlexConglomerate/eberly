import { type DynamicModule, Module } from '@nestjs/common'

import { AuthController } from './auth/auth.controller.js'
import { AuthGuard } from './auth/auth.guard.js'
import { CommentsController } from './comments/comments.controller.js'
import { PostsController } from './posts/posts.controller.js'
import { Store } from './store.js'
import { TestController } from './test/test.controller.js'
import { UsersController } from './users/users.controller.js'

@Module({})
export class AppModule {
  // #region docs:test-mode
  /** `testMode` mounts `TestController` (`POST /test/reset`). */
  static register({ testMode }: { testMode: boolean }): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        AuthController,
        PostsController,
        CommentsController,
        UsersController,
        ...(testMode ? [TestController] : []),
      ],
      providers: [Store, AuthGuard],
    }
  }
  // #endregion
}
