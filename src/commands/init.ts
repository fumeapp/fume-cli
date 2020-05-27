import {Command} from '@oclif/command'
import cli from 'cli-ux'
import * as inquirer from 'inquirer'
import yml = require('js-yaml')
import fs = require('fs')

export default class Init extends Command {
  static description = 'Initialize your fume project'

  async run() {
    const project = await cli.prompt('What is your project name?')
    const responses: any = await inquirer.prompt([{
      name: 'environment',
      message: 'choose environments',
      type: 'checkbox',
      choices: [{name: 'staging'}, {name: 'production'}],
    }])

    this.log(`Project is  ${project}`)
    this.log(`Stage: ${responses.environment}`)

    interface Yaml {
      name: string;
      environments: Record<string, any>;
    }

    const yaml: Yaml = {
      name: project,
      environments: {},
    }

    responses.environment.forEach((env: string) => {
      yaml.environments[env] = {memory: 1024}
    })
    cli.action.start('Writing fume.yml')
    fs.writeFileSync('fume.yml', yml.safeDump(yaml))
    cli.action.stop()
  }


}
