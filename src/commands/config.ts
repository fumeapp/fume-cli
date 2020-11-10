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

  private environments!: Array<string>;

  async run() {
    this.parse(Config)
    this.auth = new Auth(this.env)
    const tasks = new Listr([
      {
        title: 'Verify authentication',
        task: async (ctx, task) =>
          (new AuthStatus([], this.config)).tasks(ctx, task, true),
      },
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
      /*
      {
        title: 'Select some initial environments',
        task: (ctx, task) => this.environmentChoose(ctx, task),
      },
      */
      {
        title: 'Write configuration file',
        task: (ctx, task) => this.writeConfig(ctx, task),
      },
    ])
    tasks.run().catch(() => false)
  }

  async check(ctx, task) {
    if (fs.existsSync('fume.yml'))
      ctx.input = await task.prompt({
        type: 'Toggle',
        message: 'An existing fume.yml already exists, did you want to overwrite this?',
        initial: 'yes',
      })

    if (!ctx.input) throw new Error('A ' + chalk.bold('fume.yml') + ' already exists for this project')
  }

  async projectList(ctx: any, task: ListrTaskWrapper<any, any>) {
    this.projects = (await this.auth.axios.get('/project?team=true')).data
    if (this.projects.data.length === 0) {
      this.warn('No projects found')
      const response = await task.prompt({
        type: 'Toggle',
        message: 'Launch fume.app in your browser to create one?',
        initial: 'yes',
      })
      if (response) {
        cli.open(await Auth.projectUrl(this.env))
        this.error('Run ' + chalk.bold('fume config') + ' again after a project has been created')
      } else {
        this.error('Visit fume.app to create a project.')
      }
    } else {
      task.title = `${this.projects.data.length} project(s) found`
      return true
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

  async environmentChoose(ctx: any, task: ListrTaskWrapper<any, any>) {
    this.environments = await task.prompt({
      type: 'MultiSelect',
      message: 'Choose environments (a = all)',
      choices: ['staging', 'production'],
    })
    const len: number = this.environments.length
    if (len === 0) this.error('We need at least one environment to deploy')
    task.title = chalk.bold(len.toString()) + ' Environments chosen'
  }

  writeConfig(ctx: any, task: ListrTaskWrapper<any, any>) {
    const config: YamlConfig = {
      id: this.project.id,
      // environments: {staging: {memory: 1024, domain: false}},
    }
    /*
    this.environments.forEach((env: string) => {
      if (env !== 'staging' && env !== 'production') throw new Error('Invalid environment')
      config.environments[env] = {memory: 1024, domain: false}
    })
   */

    fs.writeFileSync('fume.yml', yml.safeDump(config))
    task.title = 'Configuration file generated, ready to deploy!'
  }
}
