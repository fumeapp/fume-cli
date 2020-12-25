import {Auth} from './auth'
import cli from 'cli-ux'
import chalk from 'chalk'
import {FumeEnvironment} from './types'

export default class LoginTasks {
  constructor(env: FumeEnvironment) {
    this.env = env
  }

  token!: string

  env!: FumeEnvironment

  tasks() {
    return [
      {
        title: 'Launch fume in the browser',
        task: (ctx: any, task: any) => this.launch(ctx, task),
      },
      {
        title: 'Gather an API token',
        task: (ctx: any, task: any) => this.gather(ctx, task),
      },
      {
        title: 'Test generated token',
        task: (ctx: any, task: any) => this.test(ctx, task),
      },
      {
        title: 'Save our valid token',
        task: (ctx: any, task: any) => this.save(ctx, task),
      },
    ]
  }

  async launch(ctx: any, task: any) {
    const url = encodeURI(await Auth.tokenUrl(this.env))
    ctx.input = await task.prompt({
      type: 'Toggle',
      message: 'Launch fume.app in your browser?',
      initial: 'yes',
    })
    if (ctx.input) {
      await cli.open(url).catch(() => {
        task.title = 'Could not open the browser, please visit ' + chalk.bold(url) + ' and paste the provided token'
      })
      task.title = 'Launched ' + chalk.bold(url)
    } else {
      task.title = 'Please visit ' + chalk.bold(url)  + ' and paste the provided token'
    }
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
