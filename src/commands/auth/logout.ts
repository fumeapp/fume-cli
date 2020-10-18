import {Command} from '@oclif/command'
import * as Config from '@oclif/config'
import {Auth} from '../../lib/auth'
import {Listr} from 'listr2'

export default class AuthLogout extends Command {
  static description = 'Invalidate token and remove credentials'

  auth: Auth

  constructor(argv: string[], config: Config.IConfig) {
    super(argv, config)
    this.auth = new Auth()
  }

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
    try {
      await this.auth.logout()
      task.title = 'Token invalidated and removed'
    } catch (error) {
      throw new Error(error)
    }
  }
}
