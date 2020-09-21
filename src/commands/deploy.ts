import Command from '@oclif/command'
import execa = require('execa')
import {Observable} from 'rxjs'
import cli from 'cli-ux'
import fs = require('fs')
import archiver  = require('archiver')
import Listr = require('listr')
import yml = require('js-yaml')
import AWS = require('aws-sdk')

interface Config {
  name: string;
  environments: Environment;
}

interface Environment {
  memory: number;
}

export default class Deploy extends Command {
  static description = 'Deploy an Environment'

  static examples = [
    '$ fume deploy staging',
  ]

  static args = [{name: 'environment', required: true}]

  s3!: AWS.S3

  config!: Config

  async run() {
    const {args: {environment}} = this.parse(Deploy)

    if (!fs.existsSync('fume.yml'))
      cli.error('No fume configuration found, please run fume init')

    this.config = yml.load(fs.readFileSync('fume.yml').toString())
    this.s3 = new AWS.S3()

    if (!fs.existsSync('node_modules/.bin/nuxt'))
      cli.error('Nuxt.js binary not found in node_modules/.bin/nuxt')

    this.log(`Deploying environment ${environment}`)

    const tasks = new Listr([
      {
        title: 'Generating assets',
        task: () => execa('node_modules/.bin/nuxt', ['generate']), // .stdout.pipe(process.stdout),
      },
      {
        title: 'Zipping up generated assets',
        task: () => this.archive(environment),
      },
      {
        title: 'Uploading deployment package',
        task: () => this.upload(environment),
      },
    ])

    tasks.run().catch((error: any) => {
      // eslint-disable-next-line no-console
      console.error(error)
    })
  }

  async upload(environment: string) {
    const bucket = `fume-${this.config.name}-${environment}`
    return new Listr([
      {
        title: `Checking for bucket ${bucket}`,
        task: () => {
          return new Observable(observer => {
            if (this.exists(bucket)) {
              observer.next('Bucket found')
              observer.complete()
            } else {
              observer.next(`Creating bucket ${bucket}`)
              this.s3.createBucket({Bucket: bucket}, (error, data) => {
                if (error)
                  this.error(error)
                this.log(data)
              })
            }
          })
        },
      },
      {
        title: 'Sending package to bucket',
        task: () => this.sendFile(bucket),
      },
    ])
  }

  sendFile(bucket: string) {
    return new Observable(observer => {
      observer.next(`Sending file to ${bucket}`)
      setTimeout(() => observer.complete(), 2000)
    })
  }

  async exists(bucket: string) {
    try {
      await this.s3.headBucket({Bucket: bucket}).promise()
      return true
    } catch (error) {
      return false
    }
  }

  archive(environment: string) {
    return new Observable(observer => {
      const output = fs.createWriteStream(`deployment-${this.config.name}-${environment}.zip`)
      output.on('end', () => this.log('data has been drained'))
      const archive = archiver('zip', {zlib: {level: 9}})
      archive.on('error', error => this.error(error))
      archive.on('progress', progress => {
        observer.next(`${progress.entries.processed * 100 / progress.entries.total}%`)
        if (progress.entries.total === progress.entries.processed)
          observer.complete()
      })
      archive.pipe(output)
      archive.directory('dist/', false)
      archive.finalize()
    })
  }
}
