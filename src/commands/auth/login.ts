import Command from '../../base'
import cli from 'cli-ux'
import {Auth} from '../../lib/auth'
import {Listr} from 'listr2'
import chalk from 'chalk'

export default class AuthLogin extends Command {
  static description = 'Login to fume'

  token!: string

  async run() {
    const tasks = new Listr([
      {
        title: 'Launch fume in the browser',
        task: (ctx, task) => this.launch(ctx, task),
      },
      {
        title: 'Gather an API token',
        task: (ctx, task) => this.gather(ctx, task),
      },
      {
        title: 'Test generated token',
        task: (ctx, task) => this.test(ctx, task),
      },
      {
        title: 'Save our valid token',
        task: (ctx, task) => this.save(ctx, task),
      },
    ], {concurrent: false})

    tasks.run().catch(() => false)
  }

  async launch(ctx: any, task: any) {
    const url = await Auth.tokenUrl(this.env)
    ctx.input = await task.prompt({
      type: 'Toggle',
      message: 'Launch fume.app in your browser?',
      initial: 'yes',
    })
    if (ctx.input) await cli.open(url)
    else task.title = 'Please visit ' + chalk.bold(url)  + ' and paste the provided token'
  }

  async gather(ctx: any, task: any) {
    ctx.input = await task.prompt({type: 'Password', message: 'Paste generated token'})
    this.token = ctx.input
  }

  async test(ctx: any, task: any) {
    if (ctx.input.length !== 64) throw new Error('Invalid token')
    try {
      const me = (await Auth.test(this.env, this.token))
      task.title = 'Authenticated as ' + chalk.bold(me.name) + ' (' + chalk.bold(me.email) + ')'
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  async save(ctx: any, task: any) {
    if (Auth.save(this.env, this.token)) {
      task.title = 'Token Saved'
    }
  }
}
