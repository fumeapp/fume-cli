import {flags} from '@oclif/command'
import {Listr, ListrTaskWrapper} from 'listr2'
import cli from 'cli-ux'
import yml = require('js-yaml')
import fs = require('fs')
import Command from '../base'
import AuthStatus from './auth/status'
import {Auth} from '../lib/auth'
import chalk from 'chalk'
import {YamlConfig} from '../lib/types'

export default class Config extends Command {
  static description = 'Generate a fume.yml config'

  static flags = {
    help: flags.help({char: 'h'}),
  }

  private auth!: Auth

  private projects!: Record<any, any>;

  private project!: Record<any, any>;

  async run() {
    this.parse(Config)
    const checkAuth = new Listr([
      {
        title: 'Verify authentication',
        task: async (ctx, task) =>
          (new AuthStatus([], this.config)).tasks(ctx, task, true),
      },
    ])

    const tasks = new Listr([
      {
        title: 'Check for an existing configuration',
        task: (ctx, task) => this.check(ctx, task),
      },
      {
        title: 'Retrieve a list of projects to choose from',
        task: (ctx, task) => this.projectList(ctx, task),
      },
      {
        title: 'Choose a project to configure',
        task: (ctx, task) => this.projectChoose(ctx, task),
      },
      {
        title: 'Write configuration file',
        task: (ctx, task) => this.writeConfig(ctx, task),
      },
    ])

    await checkAuth.run()
    .then(() => tasks.run().catch(() => false)).catch(() => false)
  }

  async check(ctx: any, task: ListrTaskWrapper<any, any>) {
    this.auth = new Auth(this.env)
    if (fs.existsSync('fume.yml')) {
      ctx.input = await task.prompt({
        type: 'Toggle',
        message: 'An existing fume.yml already exists, did you want to overwrite this?',
        initial: 'yes',
      })
      if (!ctx.input) throw new Error('A ' + chalk.bold('fume.yml') + ' already exists for this project')
    }
  }

  async projectList(ctx: any, task: ListrTaskWrapper<any, any>) {
    this.projects = (await this.auth.axios.get('/project?team=true')).data
    if (this.projects.data.length === 0) {
      const url = await Auth.projectUrl(this.env)
      task.title = 'No projects found'
      ctx.input = await task.prompt({
        type: 'Toggle',
        message: 'Launch fume.app to create a project?',
        initial: 'yes',
      })
      if (ctx.input) {
        await cli.open(url)
        throw new Error('Run ' + chalk.bold('fume config') + ' again after a project has been created')
      } else {
        throw new Error('Please visit ' + chalk.bold(url)  + ' and create a project, then run ' + chalk.bold('fume config') + ' again')
      }
    }
  }

  async projectChoose(ctx: any, task: ListrTaskWrapper<any, any>) {
    const choices = this.projects.data.map((p: any) => `${p.name} (${p.team.name})`)
    const response = await task.prompt({
      type: 'AutoComplete',
      message: 'Choose a project',
      choices: choices,
    })
    this.project = this.projects.data.find((p: any) => response === `${p.name} (${p.team.name})`)
    task.title = 'Project chosen: ' + chalk.bold(response)
  }

  writeConfig(ctx: any, task: ListrTaskWrapper<any, any>) {
    const config: YamlConfig = {
      id: this.project.id,
    }

    fs.writeFileSync('fume.yml', yml.safeDump(config))
    task.title = 'Configuration file generated, ready to deploy!'
  }
}
