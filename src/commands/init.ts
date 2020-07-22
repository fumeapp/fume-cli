import Command, {flags} from '@oclif/command'
import cli from 'cli-ux'
import * as inquirer from 'inquirer'
import yml = require('js-yaml')
import fs = require('fs')

export default class Init extends Command {
  static description = 'Initialize your fume project'

  static flags = {
    name: flags.string({
      description: 'Project Name (sets default environments)',
      required: false,
    }),
  }

  async run() {
    const {flags} = this.parse(Init)
    let name
    let environments
    if (fs.existsSync('fume.yml'))
      cli.error('A fume.yml already exists for this project')
    if (flags.name) {
      name = flags.name
      environments = ['staging', 'production']
    } else {
      name = await cli.prompt('What is your project name?')
      const responses = await inquirer.prompt([{
        name: 'environment',
        message: 'choose environments',
        type: 'checkbox',
        choices: [{name: 'staging'}, {name: 'production'}],
      }])
      environments = responses.environment
    }

    interface Yaml {
      name: string;
      environments: Record<string, any>;
    }

    const yaml: Yaml = {
      name: name,
      environments: {},
    }

    environments.forEach((env: string) => {
      yaml.environments[env] = {memory: 1024}
    })

    cli.action.start(`Creating fume.yml for project ${name}`)
    fs.writeFileSync('fume.yml', yml.safeDump(yaml))
    cli.action.stop()
  }
}
