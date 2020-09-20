import {Command} from '@oclif/command'
import execa = require('execa')
import cli from 'cli-ux'
import fs = require('fs')
import archiver  = require('archiver')
import Listr = require('listr')

export default class Init extends Command {
  static description = 'Deploy an Environment'

  static examples = [
    '$ fume deploy staging',
  ]

  static args = [{name: 'environment', required: true}]

  async run() {
    const {args: {environment}} = this.parse(Init)

    if (!fs.existsSync('fume.yml'))
      cli.error('No fume configuration found, please run fume init')


    if (!fs.existsSync('node_modules/.bin/nuxt'))
      cli.error('Nuxt.js binary not found in node_modules/.bin/nuxt')

    this.log(`Deploying ${environment}`)

    const tasks = new Listr([
      {
        title: 'Generating assets',
        task: () => execa('node_modules/.bin/nuxt', ['generate']), // .stdout.pipe(process.stdout),
      },
      {
        title: 'Zipping up generated assets',
        task: () => this.archive(environment),
      },
    ])

    tasks.run().catch((error: any) => {
      // eslint-disable-next-line no-console
      console.error(error)
    })
  }

  archive(environment: string) {
    const bar = cli.progress()
    bar.start()
    const output = fs.createWriteStream(`deployment-${environment}.zip`)
    output.on('end', () => this.log('data has been drained'))
    const archive = archiver('zip', {zlib: {level: 9}})
    archive.on('error', error => this.error(error))
    archive.on('progress', progress => {
      bar.setTotal(progress.entries.total)
      bar.update(progress.entries.processed)
      if (progress.entries.total === progress.entries.processed)
        bar.stop()
    })
    archive.pipe(output)
    archive.directory('.nuxt/', false)
    archive.finalize()
  }

}
