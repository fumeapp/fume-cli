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

  file!: string

  bucket!: string

  async run() {
    const {args: {environment}} = this.parse(Deploy)

    if (!fs.existsSync('fume.yml'))
      cli.error('No fume configuration found, please run fume init')

    this.config = yml.load(fs.readFileSync('fume.yml').toString())
    this.s3 = new AWS.S3()

    if (!fs.existsSync('node_modules/.bin/nuxt'))
      cli.error('Nuxt.js binary not found in node_modules/.bin/nuxt')

    this.log(`Deploying environment ${environment}`)

    this.file = `deployment-${this.config.name}-${environment}.zip`
    this.bucket = `fume-${this.config.name}-${environment}`

    const tasks = new Listr([
      /*
      {
        title: 'Generating assets',
        task: () => execa('node_modules/.bin/nuxt', ['generate']), // .stdout.pipe(process.stdout),
      },
      */
      {
        title: 'Zipping up generated assets',
        task: () => this.archive(),
      },
      {
        title: 'Uploading deployment package',
        task: () => this.upload(),
      },
    ])

    tasks.run().catch((error: any) => {
    })
  }

  async upload() {
    return new Listr([
      {
        title: `Checking for bucket ${this.bucket}`,
        task: (ctx, task) => {
          this.s3.createBucket({Bucket: this.bucket}, (error, data) => {
            if (error && error.statusCode === 409)
              task.title = `Bucket already exists ${this.bucket}`
            else
              task.title = `Bucket Created ${this.bucket}`
          })
        },
      },
      {
        title: 'Sending package to bucket',
        task: () => this.sendFile(),
      },
    ])
  }

  sendFile() {
    return new Observable(observer => {
      observer.next(`Sending file to ${this.bucket}`)
      new AWS.S3.ManagedUpload({
        params: {
          Bucket: this.bucket,
          Key: this.file,
          Body: fs.createReadStream(this.file),
        },
      }).on('httpUploadProgress', event => {
        observer.next(`${event.loaded * 100 / event.total}%`)
        if (event.loaded === event.total) observer.complete()
      }).send()
    })
  }

  archive() {
    return new Observable(observer => {
      const output = fs.createWriteStream(this.file)
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
