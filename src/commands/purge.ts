import Command from '@oclif/command'
import {Observable} from 'rxjs'
import yml = require('js-yaml')
import cli from 'cli-ux'
import fs = require('fs')
import axios from 'axios'
import Listr = require('listr')

export default class Purge extends Command {
  static description = 'Purge an environment'

  static examples = [
    '$ fume purge staging',
  ]

  static args = [{name: 'environment', required: true}]

  async run() {
    const {args: {environment}} = this.parse(Purge)

    if (!fs.existsSync('fume.yml'))
      cli.error('No fume configuration (fume.yml) found, please run fume config')

    const yaml = yml.load(fs.readFileSync('fume.yml').toString())

    if (!yaml.environments || !Object.keys(yaml.environments).includes(environment)) {
      cli.error(`Environment: ${environment} not found in configuration (fume.yml)`)
    }
    const tasks = new Listr([
      {
        title: `Purging environment ${environment}`,
        task: () => this.purge(environment),
      },
    ])

    tasks.run().catch((error: any) => {
      this.error(error)
    })
  }

  purge(environment: string) {
    return new Observable(observer => {
      observer.next('Sending pure request')
      axios.get('http://localhost:8000/purge', {params: {environment}})
      .then(() => observer.complete())
      .catch(error => console.error(error.response))
    })
  }
}
