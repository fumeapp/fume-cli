import Command from '../../base'
import {Listr} from 'listr2'
import {Auth} from '../../lib/auth'
import chalk from 'chalk'

export default class AuthStatus extends Command {
  static description = 'View authentication status'

  auth!: Auth

  async run() {
    this.tasks(false, false, false).run().catch(() => false)
  }

  tasks(ParentCtx: any, parentTask: any, init: boolean) {
    if (init) this.init()
    return new Listr([
      {
        title: 'Initializing',
        task: () => this.initialize(),
      },
      {
        title: 'Testing Credentials',
        task: (ctx, task) => this.status(ctx, task, parentTask),
      },
    ])
  }

  async initialize() {
    try {
      this.auth = new Auth(this.env)
    } catch (error) {
      if (error.message === 'no-file')
        this.error('No authentication file found, try running ' + chalk.bold('fume auth:login'))
      else
        throw new Error(error.message)
    }
  }

  async status(ctx: any, task: any, parentTask: any) {
    try {
      const me = await this.auth.me()
      task.title = 'Authenticated as ' + chalk.bold(me.email)
      if (parentTask) parentTask.title = 'Authenticated as ' + chalk.bold(me.name) + ' (' + chalk.bold(me.email) + ')'
    } catch (error) {
      throw new Error('Authentication error, token is invalid, run ' + chalk.bold('fume auth:login'))
    }
  }
}
