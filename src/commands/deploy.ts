import Command from '@oclif/command'
import execa = require('execa')
import {Observable} from 'rxjs'
import cli from 'cli-ux'
import fs = require('fs')
import fse = require('fs-extra')
import numeral = require('numeral')
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

  path!: string

  bucket!: string

  environment!: string

  name!: string

  altered!: boolean

  async run() {
    const {args: {environment}} = this.parse(Deploy)

    if (!fs.existsSync('fume.yml'))
      cli.error('No fume configuration (fume.yml) found, please run fume init')

    this.yaml = yml.load(fs.readFileSync('fume.yml').toString())
    this.s3 = new AWS.S3()

    if (!Object.keys(this.yaml.environments).includes(environment)) {
      cli.error(`Environment: ${environment} not found in configuration (fume.yml)`)
    }

    this.file = `deploy-${this.yaml.name}-${environment}.zip`
    this.path = `${__dirname}/${this.file}`
    this.bucket = `fume-${this.yaml.name}`
    this.environment = environment
    this.name = this.yaml.name

    this.log(`Deploying project ${this.name} environment ${environment}`)

    const tasks = new Listr([
      {
        title: 'Install modules',
        task: () => this.yarn([]),
      },
      {
        title: 'Check config syntax',
        task: (ctx, task) => this.verify(task),
      },
      {
        title: 'Build production',
        task: () => this.build(),
      },
      {
        title: 'Install only production modules',
        task: () => this.yarn(['--prod']),
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
      {
        title: 'Cleanup deployment',
        task: () => this.cleanup(),
      },
    ])

    tasks.run().catch((error: any) => {
      cli.error(error)
    })
  }

  async yarn(args: Array<string>) {
    return new Observable(observer => {
      observer.next('Running yarn')
      execa('yarn', args)
      .then(() => observer.complete()) // .stdout.pipe(process.stdout),
    })
  }

  async build() {
    return new Observable(observer => {
      observer.next('Running nuxt build')
      execa('node_modules/.bin/nuxt', ['build'])
      .then(() => observer.complete()) // .stdout.pipe(process.stdout),
    })
  }

  verify(task: Listr.ListrTaskWrapper) {
    return new Observable(observer => {
      this.altered = false
      const config = fs.readFileSync('nuxt.config.js', 'utf8')
      observer.next('Checking Syntax')
      if (config.includes('export default {')) {
        observer.next('ES6 detected, converting to CommonJS')
        this.altered = true
        fs.writeFileSync(
          'nuxt.config.js',
          config.replace('export default {', 'module.exports = {'),
          'utf8')
        task.title = 'Check config syntax: converted ES6 to CommonJS'
      } else {
        observer.next('CommonJS detected, no change needed')
      }
      observer.complete()
    })
  }

  archive() {
    return new Observable(observer => {
      fs.mkdirSync('./fume')
      fse.copy(`${__dirname}/../assets/fume`, './fume')
      const output = fs.createWriteStream(this.path)
      const archive = archiver('zip', {zlib: {level: 9}})

      output.on('end', () => this.log('data has been drained'))

      output.on('close', () => {
        console.log(archive.pointer() + ' total bytes')
        console.log('archiver has been finalized and the output file descriptor has closed.')
      })

      archive.on('warning', error => this.error(error))
      archive.on('error', error => this.error(error))
      archive.on('progress', progress => {
        observer.next(`Compressing ${numeral(progress.fs.totalBytes).format('0.0 b')}`)
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

  async deploy(task: Listr.ListrTaskWrapper) {
    return new Observable(observer => {
      observer.next('Initiating deployment')
      const data = {
        name: this.name,
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
          Body: fs.createReadStream(this.path),
        },
      }).on('httpUploadProgress', event => {
        observer.next(`${event.loaded * 100 / event.total}%`)
      }).send(() => {
        fs.unlinkSync(this.path)
        observer.complete()
      })
    })
  }

  cleanup() {
    return new Observable(observer => {
      observer.next('Requesting bucket cleanup')
      new AWS.S3().deleteObject({
        Bucket: this.bucket,
        Key: this.file,
      }, () => {
        observer.complete()
      })
    })
  }
}
