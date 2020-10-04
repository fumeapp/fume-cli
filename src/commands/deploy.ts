import Command from '@oclif/command'
import execa = require('execa')
import {Observable} from 'rxjs'
import cli from 'cli-ux'
import fs = require('fs')
import fse = require('fs-extra')
import archiver  = require('archiver')
import Listr = require('listr')
import yml = require('js-yaml')
import AWS = require('aws-sdk')
import axios from 'axios'

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

  yaml: Config = {
    name: 'string',
    environments: {memory: 1024},
  }

  file!: string

  bucket!: string

  environment!: string

  async run() {
    const {args: {environment}} = this.parse(Deploy)

    if (!fs.existsSync('fume.yml'))
      cli.error('No fume configuration (fume.yml) found, please run fume init')

    this.yaml = yml.load(fs.readFileSync('fume.yml').toString())
    this.s3 = new AWS.S3()

    if (!Object.keys(this.yaml.environments).includes(environment)) {
      cli.error(`Environment: ${environment} not found in configuration (fume.yml)`)
    }

    if (!fs.existsSync('node_modules/.bin/nuxt'))
      cli.error('Nuxt.js binary not found in node_modules/.bin/nuxt')

    this.log(`Deploying environment ${environment}`)

    this.file = `deploy-${this.yaml.name}-${environment}.zip`
    this.bucket = `fume-${this.yaml.name}-${environment}`
    this.environment = environment

    const tasks = new Listr([
      {
        title: 'Build production',
        task: () => execa('node_modules/.bin/nuxt', ['build']), // .stdout.pipe(process.stdout),
      },
      {
        title: 'Create deployment package',
        task: () => this.archive(),
      },
      {
        title: 'Upload deployment package',
        task: () => this.upload(),
      },
      {
        title: 'Deploy package',
        task: (ctx, task) => this.deploy(task),
      },
    ])

    tasks.run().catch((error: any) => {
      cli.error(error)
    })
  }

  async deploy(task: Listr.ListrTaskWrapper) {
    return new Observable(observer => {
      observer.next('Initiating deployment')
      const data = {
        environment: this.environment,
        bucket: this.bucket,
        file: this.file,
      }
      axios.post('http://localhost:8000/deploy', data)
      .then(response => {
        task.title = `Deploy complete: ${response.data.data.data.url}`
        observer.complete()
      })
      .catch(error => console.error(error.response))
    })
  }

  async upload() {
    return new Listr([
      {
        title: `Checking for bucket ${this.bucket}`,
        task: (ctx, task) => {
          this.s3.createBucket({Bucket: this.bucket}, error => {
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
      observer.next(`Sending ${this.file} to ${this.bucket}`)
      new AWS.S3.ManagedUpload({
        params: {
          Bucket: this.bucket,
          Key: this.file,
          Body: fs.createReadStream(this.file),
        },
      }).on('httpUploadProgress', event => {
        observer.next(`${event.loaded * 100 / event.total}%`)
      }).send(() => {
        fs.unlinkSync(this.file)
        observer.complete()
      })
    })
  }

  archive() {
    return new Observable(observer => {
      fs.mkdirSync('./fume')
      fse.copy(`${__dirname}/../assets/fume`, './fume')
      const output = fs.createWriteStream(this.file)
      output.on('end', () => this.log('data has been drained'))
      const archive = archiver('zip', {zlib: {level: 9}})
      archive.on('error', error => this.error(error))
      archive.on('progress', progress => {
        observer.next(`${progress.entries.processed * 100 / progress.entries.total}%`)
      })
      archive.pipe(output)
      archive.directory('./', false)
      archive.finalize()
      archive.on('finish', () => {
        fse.removeSync('./fume')
        observer.complete()
      })
    })
  }
}
