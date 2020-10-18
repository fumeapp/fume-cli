import {Command} from '@oclif/command'
import cli from 'cli-ux'
import {Auth} from '../../lib/auth'
import {Listr} from 'listr2'

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
        title: 'Save generated token',
        task: (ctx, task) => this.save(ctx, task),
      },
    ], {concurrent: false})

    tasks.run().catch(() => false)
  }

  async launch(ctx: any, task: any) {
    ctx.input = await task.prompt({type: 'Confirm', message: 'Press Y to launch fume.app in your browser'})
    if (ctx.input) await cli.open(await Auth.url())
  }

  async gather(ctx: any, task: any) {
    ctx.input = await task.prompt({type: 'Password', message: 'Paste generated token'})
    if (ctx.input.length !== 64) throw new Error('Invalid token')
    this.token = ctx.input
  }

  async test(ctx: any, task: any) {
    if (await Auth.test(this.token)) {
      task.title = 'Token validated'
    }
  }

  async save(ctx: any, task: any) {
    if (Auth.save(this.token)) {
      task.title = 'Token Saved'
    }
  }
}
