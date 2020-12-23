import Command from '../base'
import AuthStatus from './auth/status'
import execa = require('execa')
import {Observable} from 'rxjs'
import cli from 'cli-ux'
import fs = require('fs')
import fse = require('fs-extra')
import numeral = require('numeral')
import archiver  = require('archiver')
import {Listr} from 'listr2'
import yml = require('js-yaml')
import S3 from 'aws-sdk/clients/s3'
import chalk from 'chalk'
import Deployment from '../lib/deployment'
import {YamlConfig, Variable} from '../lib/types'

export default class Deploy extends Command {
  static description = 'Deploy an Environment'

  static examples = [
    '$ fume deploy staging',
  ]

  static args = [
    {
      name: 'environment',
      required: true,
      description: 'environment to deploy to (ex: staging)',
    },
  ]

  fumeConfig!: YamlConfig

  environment!: string

  name!: string

  structure!: string

  variables!: Array<Variable>

  private deployment!: Deployment;

  async run() {
    const {args: {environment}} = this.parse(Deploy)

    if (!fs.existsSync('fume.yml'))
      cli.error('No fume configuration (fume.yml) found, please run ' + chalk.bold('fume config'))

    this.fumeConfig = yml.load(fs.readFileSync('fume.yml').toString())

    const initial = new Listr([
      {
        title: 'Verify authentication',
        task: async (ctx, task) =>
          (new AuthStatus([], this.config)).tasks(ctx, task, true),
      },
      {
        title: 'Initialize deployment',
        task: (ctx, task) => this.create(ctx, task, environment),
      },
    ])

    const ssr = new Listr([
      {
        title: 'Install modules',
        task: () => this.yarn([]),
      },
      {
        title: 'Check config syntax',
        task: (ctx, task) => this.verify(task),
      },
      {
        title: 'Prepare environment variables',
        task: () => this.envPrepare(),
        skip: () => this.variables.length < 1,
      },
      {
        title: 'Bundle for server and client',
        task: () => this.build(),
      },
      {
        title: 'Install production modules',
        task: () => this.yarn(['--prod']),
      },
      {
        title: 'Restore environment variables',
        task: () => this.envRestore(),
        skip: () => this.variables.length < 1,
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
        task: (ctx, task) => this.deploy('DEPLOY_FUNCTION', task),
      },
      {
        title: 'Cleanup deployment',
        task: () => this.cleanup(),
      },
    ])

    const headless = new Listr([
      {
        title: 'Install modules',
        task: () => this.yarn([]),
      },
      {
        title: 'Prepare environment variables',
        task: () => this.envPrepare(),
        skip: () => this.variables.length < 1,
      },
      {
        title: 'Generating distribution files',
        task: () => this.generate(),
      },
      {
        title: 'Restore environment variables',
        task: () => this.envRestore(),
        skip: () => this.variables.length < 1,
      },
      {
        title: 'Syncing distribution to the cloud',
        task: () => this.sync(),
      },
      {
        title: 'Deploy package',
        task: (ctx, task) => this.deploy('DEPLOY_S3', task),
      },
    ])

    await initial.run().catch(() =>  false)
    if (this.structure === 'ssr') ssr.run().catch(() => false)
    if (this.structure === 'headless') headless.run().catch(() => false)
  }

  async create(ctx: any, task: any, environment: string) {
    this.deployment = new Deployment(this.fumeConfig, this.env)
    try {
      await this.deployment.initialize(environment)
    } catch (error) {
      task.title = error.response.data.errors[0].detail
      throw new Error(error.response.data.errors[0].detail)
    }
    this.environment = environment
    this.structure = this.deployment.entry.project.structure
    this.variables = this.deployment.entry.env.variables
    return true
  }

  async yarn(args: Array<string>) {
    if (args.length > 0)
      await this.deployment.update('YARN_PROD')
    else
      await this.deployment.update('YARN_ALL')
    return new Observable(observer => {
      observer.next('Running yarn')
      execa('yarn', args)
      .then(() => observer.complete()) // .stdout.pipe(process.stdout),
    })
  }

  async build() {
    await this.deployment.update('NUXT_BUILD')
    return new Observable(observer => {
      observer.next('Running nuxt build')
      execa('node_modules/.bin/nuxt', ['build'])
      .then(() => observer.complete()) // .stdout.pipe(process.stdout),
    })
  }

  async generate() {
    await this.deployment.update('NUXT_GENERATE')
    return new Observable(observer => {
      observer.next('Running nuxt generate')
      execa('node_modules/.bin/nuxt', ['generate'])
      .then(() => observer.complete()) // .stdout.pipe(process.stdout),
    })
  }

  async envPrepare() {
    await this.deployment.update('ENV_PREPARE')
    return new Observable(observer => {
      observer.next(`Compiling .env for ${this.environment}`)
      if (fs.existsSync('.env')) {
        fs.copyFileSync('.env', '.env.fume')
      }
      const cfg = this.variables.map(v => `${v.name}=${v.value}`).join('\n')
      fs.writeFileSync('.env', cfg, 'utf8')
      observer.complete()
    })
  }

  async envRestore() {
    await this.deployment.update('ENV_RESTORE')
    return new Observable(observer => {
      observer.next(`Compiling .env for ${this.environment}`)
      if (fs.existsSync('.env.fume')) {
        fs.copyFileSync('.env.fume', '.env')
        fs.unlinkSync('.env.fume')
      }
      observer.complete()
    })
  }

  verify(task: any) {
    return new Observable(observer => {
      const config = fs.readFileSync('nuxt.config.js', 'utf8')
      observer.next('Checking Syntax')
      if (config.includes('export default {')) {
        observer.next('ES6 detected, converting to CommonJS')
        fs.copyFileSync('nuxt.config.js', 'nuxt.config.fume')
        fs.writeFileSync(
          'nuxt.config.js',
          config.replace('export default {', 'module.exports = {'),
          'utf8')
        task.title = 'Check config syntax: converted'
      } else {
        observer.next('CommonJS detected, no change needed')
      }
      observer.complete()
    })
  }

  async archive() {
    await this.deployment.update('MAKE_ZIP')
    return new Observable(observer => {
      fs.mkdirSync('./fume')
      fse.copySync(`${__dirname}/../../src/assets/nuxt`, './fume')
      const output = fs.createWriteStream(this.deployment.s3.path)
      const archive = archiver('zip', {zlib: {level: 9}})

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

  async sync() {
    await this.deployment.update('SYNC_FILES')
    const sts = await this.deployment.sts()
    return new Observable(observer => {
      observer.next('Syncing distribution..')
      const client = require(`${__dirname}/../../src/lib/s3`).createClient({s3Client: new S3(sts)})
      const uploader = client.uploadDir({
        localDir: './dist',
        deleteRemoved: true,
        s3Params: {
          Bucket: this.deployment.s3.headless,
          ACL: 'public-read',
        },
      })
      uploader.on('progress', () => {
        if (!isNaN(uploader.pgoressAmount / uploader.progressTotal))
          observer.next(`${(uploader.progressAmount / uploader.progressTotal * 100).toFixed(2)} complete`)
      })

      uploader.on('end', () => observer.complete())
    })
  }

  async upload() {
    await this.deployment.update('UPLOAD_ZIP')
    const sts = await this.deployment.sts()
    return new Observable(observer => {
      observer.next('Sending deployment..')
      new S3.ManagedUpload({
        service: new S3(sts),
        params: {
          Bucket: this.deployment.s3.bucket,
          Key: this.deployment.s3.file,
          Body: fs.createReadStream(this.deployment.s3.path),
        },
      }).on('httpUploadProgress', event => {
        observer.next(`${(event.loaded * 100 / event.total).toFixed(2)}%`)
      }).send((error: Error) => {
        if (error) this.error(error)
        fs.unlinkSync(this.deployment.s3.path)
        observer.complete()
      })
    })
  }

  async deploy(status: string, task: any) {
    return new Observable(observer => {
      observer.next('Initiating deployment')
      this.deployment.update(status)
      .then(response =>  {
        task.title = 'Deployment Successful: ' + chalk.bold(response.data.data.data)
        observer.complete()
      })
      .catch(error => {
        this.error(error.response.data.errors[0].detail)
        observer.complete()
      })
    })
  }

  async cleanup() {
    return new Observable(observer => {
      if (fs.existsSync('nuxt.config.fume')) fse.moveSync('nuxt.config.fume', 'nuxt.config.js', {overwrite: true})
      observer.complete()
    })
  }
}
