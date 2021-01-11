import Command from '../base'
import AuthStatus from './auth/status'
import {Observable} from 'rxjs'
import {flags} from '@oclif/command'
import {Listr} from 'listr2'
import S3 from 'aws-sdk/clients/s3'
import chalk from 'chalk'
import Deployment from '../lib/deployment'
import {PackageType, Variable, YamlConfig} from '../lib/types'
import ConfigTasks from '../lib/configtasks'
import {Auth} from '../lib/auth'
import execa = require('execa');
import fs = require('fs');
import onDeath from 'death'
import fse = require('fs-extra');
import numeral = require('numeral');
import archiver = require('archiver');
import yml = require('js-yaml');

const md5file = require('md5-file')
const getFolderSize  = require('get-folder-size')

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

  hash!: string

  layer!: boolean

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
        title: 'Send dependencies',
        task: () => this.package(PackageType.layer),
        enabled: () => this.layer,
      },
      {
        title: 'Send source code',
        task: () => this.package(PackageType.code),
      },
      {
        title: 'Deploy package(s)',
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
    if (fs.existsSync('.nuxt.config.fume')) fse.moveSync('.nuxt.config.fume', 'nuxt.config.js', {overwrite: true})
    if (fs.existsSync('./.fume')) fse.removeSync('./.fume')
    if (fs.existsSync('.env.fume')) {
      fs.copyFileSync('.env.fume', '.env')
      fs.unlinkSync('.env.fume')
    }
    if (this && this.deployment.s3 && fs.existsSync(this.deployment.s3.paths.code))
      fs.unlinkSync(this.deployment.s3.paths.code)
    if (this && this.deployment.s3 && fs.existsSync(this.deployment.s3.paths.layer))
      fs.unlinkSync(this.deployment.s3.paths.layer)
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
    if (this.structure === 'ssr') {
      this.hash = this.lock()
      this.layer = this.hash !== this.deployment.entry.env.detail.hash
    }
    return true
  }

  lock() {
    const locks = ['yarn.lock', 'package-lock.json']
    for (const lock of locks) if (fs.existsSync(lock)) return md5file.sync(lock)
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
    try {
      await execa('node_modules/.bin/nuxt', ['build'])
    } catch (error) {
      await this.deployment.fail({
        message: 'Error bundling server and client',
        detail: error,
      })
      throw new Error(error)
    }
    return true
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
        fs.copyFileSync('nuxt.config.js', '.nuxt.config.fume')
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

  async getSize(path: string, ignore: string): Promise<number> {
    return new Promise((resolve, reject) => {
      getFolderSize(path, new RegExp(ignore), (error: Error, size: any) => {
        if (error) {
          reject(error)
        }
        resolve(size)
      })
    })
  }

  private static mb(size: number) {
    return (size / 1024 / 1024).toFixed(2) + 'MB'
  }

  /*
   * copy fume assets into project
   */
  async assets() {
    if (fs.existsSync('./.fume')) fs.rmdirSync('./.fume', {recursive: true})
    fs.mkdirSync('./.fume')
    fse.copySync(`${__dirname}/../../src/assets/nuxt`, './.fume')
  }

  async package(type: PackageType) {
    return new Listr([
      {
        title: `Archiving ${type} package`,
        task: () =>  this.archive(type),
      },
      {
        title: `Uploading ${type} package`,
        task: () =>  this.upload(type),
      },
    ])
  }

  async archive(type: PackageType) {
    const size = await this.getSize('./', 'node_modules')
    if (size >= 250000000) {
      const msg = `SSR projects with AWS cannot exceed 250MB, (Project size is ${Deploy.mb(size)})`
      await this.deployment.fail({
        message: msg,
        detail: {size},
      })
      this.cleanup()
      throw new Error(msg)
    }
    if (type ===  PackageType.layer) await this.deployment.update('MAKE_LAYER_ZIP')
    if (type === PackageType.code) await this.deployment.update('MAKE_CODE_ZIP')
    const output = fs.createWriteStream(this.deployment.s3.paths[type])
    return new Observable(observer => {
      this.assets()

      const archive = archiver('zip', {zlib: {level: 9}})

      if (type === PackageType.layer)
        archive.directory('./node_modules', 'nodejs/node_modules')
      if (type === PackageType.code) {
        for (const entry of fs.readdirSync('./', {withFileTypes: true})) {
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.git')
              archive.directory(entry.name, entry.name)
          } else archive.file(entry.name, {name: entry.name})
        }
      }

      archive.on('warning', error => this.error(error))
      archive.on('error', error => this.error(error))
      archive.on('progress', progress => {
        if (numeral(progress.fs.totalBytes).format('0').toString()[1] === '0')
          observer.next(`Compressing ${numeral(progress.fs.totalBytes).format('0.0 b')}`)
      })

      archive.pipe(output)

      archive.finalize()
      archive.on('finish', () => {
        observer.complete()
      })
    })
  }

  async upload(type: PackageType) {
    if (type === PackageType.layer) await this.deployment.update('UPLOAD_LAYER_ZIP')
    if (type === PackageType.code) await this.deployment.update('UPLOAD_CODE_ZIP')
    const sts = await this.deployment.sts()
    return new Observable(observer => {
      observer.next(type === 'layer' ? 'Sending layer..' : 'Sending code..')
      new S3.ManagedUpload({
        service: new S3(sts),
        params: {
          Bucket: this.deployment.s3.bucket,
          Key: type === PackageType.layer ? this.deployment.s3.layer : this.deployment.s3.code,
          Body: fs.createReadStream(this.deployment.s3.paths[type]),
        },
      }).on('httpUploadProgress', event => {
        observer.next(`${(event.loaded * 100 / event.total).toFixed(2)}%`)
      }).send((error: Error) => {
        if (error) this.error(error)
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

  async deploy(status: string, task: any) {
    return new Observable(observer => {
      observer.next('Initiating deployment')
      this.deployment.update(status, status === 'DEPLOY_FUNCTION' ? this.hash : null)
      .then(response =>  {
        task.title = 'Deployment Successful: ' + chalk.bold(response.data.data.data)
        observer.complete()
      })
      .catch(error => {
        if (error.response.data.errors) this.error(error.response.data.errors[0].detail)
        else throw new Error(error)
        observer.complete()
      })
    })
  }
}
