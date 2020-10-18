import {Command} from '@oclif/command'
import {Listr} from 'listr2'
import {Auth} from '../../lib/auth'

export default class AuthStatus extends Command {
  static description = 'View authentication status'

  auth!: Auth

  async run() {
    const tasks = new Listr([
      {
        title: 'Initialize authentication',
        task: () => this.init(),
      },
      {
        title: 'Test Credentials',
        task: (ctx, task) => this.status(ctx, task),
      },
    ])

    tasks.run().catch(() => false)
  }

  async init() {
    this.auth = new Auth()
  }

  async status(ctx: any, task: any) {
    const me = await this.auth.me()
    task.title = `Authenticated as ${me.email}`
  }
}
