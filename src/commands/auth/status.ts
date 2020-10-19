import {Command} from '@oclif/command'
import {Listr} from 'listr2'
import {Auth} from '../../lib/auth'
import chalk from 'chalk'

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
    try {
      this.auth = new Auth()
    } catch (error) {
      // console.log(error.message)
      if (error.message === 'no-file')
        this.error('No authentication file found, try running ' + chalk.bold('fume auth:login'))
      else
        throw new Error(error.message)
    }
  }

  async status(ctx: any, task: any) {
    try {
      const me = await this.auth.me()
      task.title = 'Authenticated as ' + chalk(me.email)
    } catch (error) {
      throw new Error('Authentication error, token is invalid, run ' + chalk.bold('fume auth:login'))
    }
  }
}
