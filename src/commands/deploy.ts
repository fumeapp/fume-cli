import {Command} from '@oclif/command'
import cli from 'cli-ux'
import fs = require('fs')

export default class Init extends Command {
  static description = 'Deploy an Environment'

  static examples = [
    '$ fume deploy staging',
  ]

  static args = [{name: 'environment', required: true}]

  async run() {
    const {args} = this.parse(Init)

    if (!fs.existsSync('fume.yml'))
      cli.error('No fume configuration found, please run fume init')

    const environment = args.environment
    this.log(`Deploying ${environment}`)

  }
}
