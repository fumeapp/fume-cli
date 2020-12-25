import Command from '../../base'
import {Auth} from '../../lib/auth'
import {Listr} from 'listr2'

export default class AuthLogout extends Command {
  static description = 'Invalidate token and remove credentials'

  static aliases = ['logout']

  auth!: Auth

  async run() {
    const tasks = new Listr([
      {
        title: 'Logging out',
        task: (ctx, task) => this.logout(ctx, task),
      },
    ])

    tasks.run().catch(() => false)
  }

  async logout(ctx: any, task: any) {
    this.auth = new Auth(this.env)
    try {
      await this.auth.logout()
      task.title = 'Token invalidated and removed'
    } catch (error) {
      throw new Error(error)
    }
  }
}
