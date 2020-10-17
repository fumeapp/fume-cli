import {Command} from '@oclif/command'
import cli from 'cli-ux'
import {Observable} from 'rxjs'
import {Auth} from '../../lib/auth'
import {Listr} from 'listr2'
import * as Config from '@oclif/config'

export default class AuthLogin extends Command {
  static description = 'Login to fume'

  auth: Auth

  token!: string

  constructor(argv: string[], config: Config.IConfig) {
    super(argv, config)
    this.auth = new Auth()
  }

  async run() {
    const tasks = new Listr([
      {
        title: 'Launch fume',
        task: (ctx, task) => this.launch(ctx, task),
      },
      {
        title: 'Gather Token',
        task: (ctx, task) => this.gather(ctx, task),
      },
      {
        title: 'Test given token',
        task: (ctx, task) => this.test(ctx, task),
      },
      {
        title: 'Save our generated token',
        task: (ctx, task) => this.save(ctx, task),
      },
    ], {concurrent: false})

    tasks.run().catch((error: any) => {
      cli.error(error)
    })
  }

  async launch(ctx: any, task: any) {
    ctx.input = await task.prompt({type: 'Confirm', message: 'Press Y to launch fume.app in your browser'})
    if (ctx.input) await cli.open(await this.auth.url())
  }

  async gather(ctx: any, task: any) {
    ctx.input = await task.prompt({type: 'Password', message: 'Paste generated token'})
    this.token = ctx.input
  }

  async test(ctx: any, task: any) {
    if (await this.auth.test(this.token)) {
      task.title = 'Token validated'
    }
  }

  async save(ctx: any, task: any) {
    if (this.auth.save(this.token)) {
      task.title = 'Token Saved'
    }
  }
}
