import Command from '../base'
import AuthStatus from './auth/status'
import execa = require('execa')
import {Observable} from 'rxjs'
import fs = require('fs')
import onDeath = require('death')
import fse = require('fs-extra')
import numeral = require('numeral')
import archiver  = require('archiver')
import {flags} from '@oclif/command'
import {Listr} from 'listr2'
import yml = require('js-yaml')
import S3 from 'aws-sdk/clients/s3'
import chalk from 'chalk'
import Deployment from '../lib/deployment'
import {YamlConfig, Variable} from '../lib/types'
import ConfigTasks from '../lib/configtasks'
import {Auth} from '../lib/auth'

export default class Deploy extends Command {
  static description = 'Deploy an Environment'

  static flags = {
    help: flags.help({char: 'h'}),
  }

  static examples = [
    '$ fume deploy staging',
  ]

  static args = [
    {
      name: 'environment',
      required: false,
      description: 'environment to deploy to (ex: staging)',
    },
  ]

  private auth!: Auth

  fumeConfig!: YamlConfig

  environment!: string

  name!: string

  structure!: string

  variables!: Array<Variable>

  private deployment!: Deployment;

  private noConfig = false

  async run() {
    const {args: {environment}} = this.parse(Deploy)

    this.environment = environment

    const initial = new Listr([
      {
        title: 'Verify authentication',
        task: async (ctx, task) =>
          (new AuthStatus([], this.config)).tasks(ctx, task, true),
      },
      {
        title: 'Verify fume configuration',
        task: () => this.checkConfig(),
      },
      {
        title: 'Create fume configuration',
        task: (ctx, task): Listr =>
          task.newListr((new ConfigTasks(this.env, this.auth)).tasks(), {concurrent: false}),
        enabled: () => this.noConfig,
      },
      {
        title: 'Load new fume configuration',
        task: () => this.loadConfig(),
        enabled: () => this.noConfig,
      },
      {
        title: 'Choose an environment',
        task: (ctx, task) => this.choose(ctx, task),
        enabled: () => this.environment === undefined,
      },
      {
        title: 'Initialize deployment',
        task: (ctx, task) => this.create(ctx, task),
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
        enabled: () => this.variables.length > 0,
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
        enabled: () => this.variables.length > 0,
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
        enabled: () => this.variables.length > 0,
      },
      {
        title: 'Generating distribution files',
        task: () => this.generate(),
      },
      {
        title: 'Restore environment variables',
        task: () => this.envRestore(),
        enabled: () => this.variables.length > 0,
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

    await initial.run().catch(() => false)
    if (this.structure === 'ssr') ssr.run().catch(() => false)
    if (this.structure === 'headless') headless.run().catch(() => false)

    onDeath(this.cleanup)
  }

  cleanup() {
    if (fs.existsSync('nuxt.config.fume')) fse.moveSync('nuxt.config.fume', 'nuxt.config.js', {overwrite: true})
    if (fs.existsSync('./fume')) fse.removeSync('./fume')
    if (fs.existsSync('.env.fume')) {
      fs.copyFileSync('.env.fume', '.env')
      fs.unlinkSync('.env.fume')
    }
    if (this && this.deployment.s3 && fs.existsSync(this.deployment.s3.path))
      fs.unlinkSync(this.deployment.s3.path)
  }

  async checkConfig() {
    try {
      this.fumeConfig = yml.load(fs.readFileSync('fume.yml').toString())
    } catch (error) {
      if (error.code === 'ENOENT')
        this.noConfig = true
      else
        throw new Error(error)
    }
  }

  async loadConfig() {
    this.fumeConfig = yml.load(fs.readFileSync('fume.yml').toString())
  }

  async choose(ctx: any, task: any) {
    this.deployment = new Deployment(this.fumeConfig, this.env)
    let environments
    try {
      environments = await this.deployment.environments()
      task.title = `Choose an environment to deploy (${environments[0].project.name})`
    } catch (error) {
      if (error.response.status === 404)
        throw new Error('Invalid fume configuration')
      if (error.response && error.response.data) {
        if (error.response.data.message) {
          task.title = error.response.data.message
          throw new Error(error)
        }
        if (error.response.data.errors[0].detail) {
          task.title = error.response.data.errors[0].detail
          throw new Error(error.response.data.errors[0].detail)
        }
      } else {
        throw new Error(error)
      }
    }
    const choices = environments.map((e: any) => e.name)
    const response = await task.prompt({
      type: 'AutoComplete',
      message: 'Choose an environment',
      choices: choices,
    })
    this.environment = response
    task.title = `Environment chosen: ${chalk.bold(response)}`
  }

  async create(ctx: any, task: any) {
    if (!this.deployment)
      this.deployment = new Deployment(this.fumeConfig, this.env)
    try {
      await this.deployment.initialize(this.environment)
    } catch (error) {
      if (error.response && error.response.data.errors[0] && error.response.data.errors[0].detail) {
        task.title = error.response.data.errors[0].detail
        throw new Error(error.response.data.errors[0].detail)
      } else {
        throw new Error(error)
      }
    }
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
      if (fs.existsSync('./fume')) fs.rmdirSync('./fume', {recursive: true})
      fs.mkdirSync('./fume')
      fse.copySync(`${__dirname}/../../src/assets/nuxt`, './fume')
      const output = fs.createWriteStream(this.deployment.s3.path)
      const archive = archiver('zip', {zlib: {level: 9}})

      archive.on('warning', error => this.error(error))
      archive.on('error', error => this.error(error))
      archive.on('progress', progress => {
        if (numeral(progress.fs.totalBytes).format('0').toString()[1] === '0')
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
        if (fs.existsSync(this.deployment.s3.path))
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
}
