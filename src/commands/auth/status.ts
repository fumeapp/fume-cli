import Command from '../../base'
import { Listr } from 'listr2'
import { Auth } from '../../lib/auth'
import chalk = require('chalk')
import LoginTasks from '../../lib/logintasks'

export default class AuthStatus extends Command {
  static description = 'View authentication status'

  static aliases = ['status']

  auth!: Auth

  private authed: any = null;

  async run() {
    this.tasks(false, false, false).run().catch(() => false)
  }

  tasks(ParentCtx: any, parentTask: any, init: boolean) {
    if (init) this.init()
    return new Listr([
      {
        title: 'Initialize environment',
        task: (ctx, task) => this.initialize(ctx, task),
      },
      {
        title: 'Authenticate with fume',
        task: (ctx, task): Listr =>
          task.newListr((new LoginTasks(this.env)).tasks(), { concurrent: false }),
        enabled: () => this.authed === false,
      },
      {
        title: 'Test Credentials',
        task: (ctx, task) => this.status(ctx, task, parentTask),
      },
    ])
  }

  async initialize(ctx: any, task: any) {
    try {
      this.auth = new Auth(this.env)
      task.title = `Initialized for ${this.env.env} environment`
      this.authed = true
    } catch (error: any) {
      if (error.message === 'no-auth') {
        ctx.input = await task.prompt({
          type: 'Toggle',
          message: 'No config file or FUME_TOKEN exists, ' + chalk.bold('Log in') + '?',
          initial: 'yes',
        })
        if (ctx.input) {
          this.authed = false
        } else this.error('No config file or FUME_TOKEN found, please run ' + chalk.bold('fume auth:login'))
      } else
        throw new Error(error.message)
    }
  }

  async status(ctx: any, task: any, parentTask: any) {
    if (this.authed === false)
      await this.initialize(ctx, task)
    try {
      const me = await this.auth.me()
      if (this.auth.foundEnv)
        task.title = 'Authenticated as ' + chalk.bold(me.email) + ' from FUME_TOKEN'
      else
        task.title = 'Authenticated as ' + chalk.bold(me.email) + ' from fume.yml'

      if (parentTask) parentTask.title = 'Authenticated as ' + chalk.bold(me.email)
    } catch (error) {
      Auth.remove()
      throw new Error('Authentication error, token is invalid, run ' + chalk.bold('fume auth:login'))
    }
  }
}
