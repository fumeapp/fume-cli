import { ListrTaskWrapper } from 'listr2'
import { Auth } from './auth'
import chalk = require('chalk')
import cli from 'cli-ux'
import { YamlConfig, FumeEnvironment } from './types'
import * as fs from 'fs'
import * as yml from 'js-yaml'

export default class ConfigTasks {
  constructor(env: FumeEnvironment, auth: Auth) {
    this.env = env
    this.auth = auth
  }

  private env!: FumeEnvironment

  private auth!: Auth

  private projects!: Record<any, any>

  private project!: Record<any, any>

  tasks() {
    return [
      {
        title: 'Check for an existing configuration',
        task: (ctx: any, task: any) => this.check(ctx, task),
      },
      {
        title: 'Retrieve a list of projects to choose from',
        task: (ctx: any, task: any) => this.projectList(ctx, task),
      },
      {
        title: 'Choose a project to configure',
        task: (ctx: any, task: any) => this.projectChoose(ctx, task),
      },
      {
        title: 'Write configuration file',
        task: (ctx: any, task: any) => this.writeConfig(ctx, task),
      },
    ]
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
        throw new Error('Please visit ' + chalk.bold(url) + ' and create a project, then run ' + chalk.bold('fume config') + ' again')
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

    fs.writeFileSync('fume.yml', yml.dump(config))
    task.title = 'Configuration file generated, ready to deploy!'
  }
}
