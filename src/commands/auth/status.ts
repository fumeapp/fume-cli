import {Command} from '@oclif/command'
import {Listr} from 'listr2'
import {Auth} from '../../lib/auth'
import chalk from 'chalk'

export default class AuthStatus extends Command {
  static description = 'View authentication status'

  auth!: Auth

  async run() {
    this.tasks(false, false).run().catch(() => false)
  }

  tasks(pctx: any, ptask: any) {
    return new Listr([
      {
        title: 'Initializing',
        task: () => this.init(),
      },
      {
        title: 'Testing Credentials',
        task: (ctx, task) => this.status(ctx, task, ptask),
      },
    ])
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

  async status(ctx: any, task: any, ptask: any) {
    try {
      const me = await this.auth.me()
      task.title = 'Authenticated as ' + chalk.bold(me.email)
      if (ptask) ptask.title = 'Authenticated as ' + chalk.bold(me.email)
    } catch (error) {
      throw new Error('Authentication error, token is invalid, run ' + chalk.bold('fume auth:login'))
    }
  }
}
