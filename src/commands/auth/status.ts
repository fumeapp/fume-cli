import Command from '../../base'
import {Listr} from 'listr2'
import {Auth} from '../../lib/auth'
import chalk from 'chalk'

export default class AuthStatus extends Command {
  static description = 'View authentication status'

  auth!: Auth

  private authed!: boolean;

  async run() {
    this.tasks(false, false, false).run().catch(() => false)
  }

  tasks(ParentCtx: any, parentTask: any, init: boolean) {
    if (init) this.init()
    return new Listr([
      {
        title: 'Initializing',
        task: (ctx, task) => this.initialize(ctx, task),
      },
      {
        title: 'Testing Credentials',
        task: (ctx, task) => this.status(ctx, task, parentTask),
        enabled: () => this.authed,
      },
    ])
  }

  async initialize(ctx: any, task: any) {
    try {
      this.auth = new Auth(this.env)
      task.title = `Initialized for ${this.env.env} environment`
      this.authed = true
    } catch (error) {
      if (error.message === 'no-auth')
        this.error('No authentication file or FUME_TOKEN found, try running ' + chalk.bold('fume auth:login'))
      else
        throw new Error(error.message)
    }
  }

  async status(ctx: any, task: any, parentTask: any) {
    try {
      const me = await this.auth.me()
      if (this.auth.foundEnv)
        task.title = 'Authenticated as ' + chalk.bold(me.email) + ' from FUME_TOKEN'
      else
        task.title = 'Authenticated as ' + chalk.bold(me.email) + ' from fume.yml'

      if (parentTask) parentTask.title = 'Authenticated as ' + chalk.bold(me.email)
    } catch (error) {
      throw new Error('Authentication error, token is invalid, run ' + chalk.bold('fume auth:login'))
    }
  }
}
