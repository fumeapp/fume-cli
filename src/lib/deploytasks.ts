import Deployment from './deployment'
import chalk from 'chalk'
import {Observable} from 'rxjs'
import {FumeEnvironment, Mode, PackageType, Size, Variable, YamlConfig} from './types'
import {Listr} from 'listr2'
import S3 from 'aws-sdk/clients/s3'
import fs from 'fs'
import execa from 'execa'
import archiver from 'archiver'
import numeral from 'numeral'
import {cli} from 'cli-ux'
import fse = require('fs-extra');
import yml = require('js-yaml');

const md5file = require('md5-file')
const getFolderSize  = require('get-folder-size')

export default class DeployTasks {
  constructor(env: FumeEnvironment, environment: string) {
    this.env = env
    this.environment = environment
  }

  env: FumeEnvironment

  environment!: string

  fumeConfig!: YamlConfig

  public noConfig = false

  public variables!: Array<Variable>

  public deployment!: Deployment

  public firstDeploy!: boolean

  public name!: string

  public structure!: string

  public hash!: string

  public refresh_deps!: boolean

  public size!: Size

  public mode!: Mode

  public nuxtConfig!: any

  public staticDir = 'static/'

  public packager = 'yarn'

  async checkConfig() {
    try {
      this.fumeConfig = yml.load(fs.readFileSync('fume.yml').toString())
    } catch (error) {
      if (error.code === 'ENOENT')
        this.noConfig = true
      else
        throw error
    }
  }

  async modeSelect(task: any) {
    this.size = {
      deps: await this.getSize('node_modules', ''),
      code: await this.getSize('.nuxt', ''),
      static: await this.getSize(this.staticDir, ''),
      dist: 0,
    }
    /*
    * TODO: determine mode based on max package size of 262144000
    */
    this.mode = Mode.layer

    const deps = numeral(this.size.deps).format('0.0b')
    const code = numeral(this.size.code).format('0.0b')
    const stat = numeral(this.size.static).format('0.0b')
    const all = numeral(this.size.deps + this.size.code + this.size.static).format('0.0b')
    task.title = `Deps: ${chalk.bold(deps)} Code: ${chalk.bold(code)} Assets: ${chalk.bold(stat)} Total: ${chalk.bold(all)}`
  }

  async loadConfig() {
    this.fumeConfig = yml.load(fs.readFileSync('fume.yml').toString())
  }

  async billing(ctx: any, task: any) {
    task.title = 'This action requires an active subscription from a team member'
    ctx.input = await task.prompt({
      type: 'Toggle',
      message: 'Visit your billing section?',
      initial: 'yes',
    })
    if (ctx.input) await cli.open(`${this.env.web}/billing`)
    throw new Error(`Visit ${this.env.web}https://fume.app/billing and choose a plan that fits.`)
  }

  async choose(ctx: any, task: any) {
    this.deployment = new Deployment(this.fumeConfig, this.env)
    let environments
    try {
      environments = await this.deployment.environments()
      task.title = `Choose an environment to deploy (${environments[0].project.name})`
    } catch (error) {
      if (error.response && error.response.status === 404)
        throw new Error('Invalid fume configuration')
      if (error.response && error.response.data) {
        if (error.response.data.message) {
          task.title = error.response.data.message
          throw error
        }
        if (error.response.data.errors[0].detail) {
          task.title = error.response.data.errors[0].detail
          throw new Error(error.response.data.errors[0].detail)
        }
      } else {
        throw error
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
    if (!this.deployment) this.deployment = new Deployment(this.fumeConfig, this.env)
    try {
      await this.deployment.initialize(this.environment)
      task.title = `Initiated for ${chalk.bold(this.deployment.entry.project.name)} (${chalk.bold(this.deployment.entry.env.name)})`
    } catch (error) {
      if (error.response && error.response.status === 402)
        return this.billing(ctx, task)
      if (error.response && error.response.data.message)
        throw new Error(error.response.data.message)
      if (error.response && error.response.data.errors[0] && error.response.data.errors[0].detail) {
        task.title = error.response.data.errors[0].detail
        throw new Error(error.response.data.errors[0].detail)
      } else {
        throw new Error(error)
      }
    }
    this.firstDeploy = this.deployment.entry.firstDeploy
    this.structure = this.deployment.entry.project.structure
    this.variables = this.deployment.entry.env.variables
    if (this.structure === 'headless') this.mode = Mode.headless
    if (this.structure === 'ssr') {
      this.hash = this.lock()
      if (this.deployment.entry.env.detail && this.deployment.entry.env.detail.hash)
        this.refresh_deps = this.hash !== this.deployment.entry.env.detail.hash
      else
        this.refresh_deps = true
    }
    return true
  }

  lock() {
    if (fs.existsSync('yarn.lock')) {
      this.packager = 'yarn'
      return md5file.sync('yarn.lock')
    }
    if (fs.existsSync('package-lock.json')) {
      this.packager = 'npm'
      return md5file.sync('package-lock.json')
    }
    throw new Error('No lock file found, could not determine packager')
  }

  async yarn(type: string) {
    if (type === 'production')
      await this.deployment.update('YARN_PROD')
    else
      await this.deployment.update('YARN_ALL')
    return new Observable(observer => {
      if (this.packager === 'npm' && type === 'production') {
        observer.next('Pruning node_modules/')
        fse.emptyDirSync('./node_modules')
      }
      let args: Array<string> = []
      if (this.packager === 'npm') {
        if (type === 'production') args = ['install', '--only=prod']
        else args = ['install']
      } else if (this.packager === 'yarn') {
        if (type === 'production') args = ['--prod']
      }
      observer.next(`Running ${chalk.bold(this.packager)}`)
      execa(this.packager, args)
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
      if (config.trim().startsWith('import')) {
        this.deployment.fail({
          message: 'import detected inside nuxt.config.js - Fume does not yet support this but will soon',
          detail: config,
        })
        this.cleanup()
        throw new Error('"import" detected inside nuxt.config.js - Fume does not yet support this but will soon')
      }
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
      this.nuxtConfig = require(`${process.cwd()}/nuxt.config.js`)
      if (this.nuxtConfig.srcDir)
        this.staticDir = `${this.nuxtConfig.srcDir}static/`
      observer.complete()
    })
  }

  async getSize(path: string, ignore: string): Promise<number> {
    if (ignore === '')
      return new Promise((resolve, reject) => {
        getFolderSize(path, (error: Error, size: any) => {
          if (error) {
            reject(error)
          }
          resolve(size)
        })
      })
    return new Promise((resolve, reject) => {
      getFolderSize(path, new RegExp(ignore), (error: Error, size: any) => {
        if (error) {
          reject(error)
        }
        resolve(size)
      })
    })
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
        task: () => this.archive(type),
      },
      {
        title: `Uploading ${type} package`,
        task: () => this.upload(type),
      },
    ])
  }

  async archive(type: PackageType) {
    if (type ===  PackageType.layer) await this.deployment.update('SYNC_DEPS')
    if (type === PackageType.code) await this.deployment.update('MAKE_CODE_ZIP')
    const output = fs.createWriteStream(this.deployment.s3.paths[type])
    return new Observable(observer => {
      this.assets()

      const archive = archiver('zip', {zlib: {level: 9}})

      if (type === PackageType.layer)
        archive.directory('node_modules', 'nodejs/node_modules')
      if (type === PackageType.code) {
        archive.directory('.nuxt', '.nuxt')
        archive.directory('.fume', '.fume')
        archive.directory(this.staticDir, this.staticDir)
        archive.file('nuxt.config.js', {name: 'nuxt.config.js'})
      }
      /*
      for (const entry of fs.readdirSync('.nuxt/', {withFileTypes: true})) {
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'vendor')
            archive.directory(entry.name, entry.name)
        } else archive.file(entry.name, {name: entry.name})
      }
     */

      archive.on('warning', error => {
        throw error
      })
      archive.on('error', async error => {
        await this.deployment.fail({
          message: error.message,
          detail: error,
        })
        observer.error(error.message)
      })

      const size = type === PackageType.layer ? this.size.deps : this.size.code
      archive.on('progress', progress => {
        const complete = progress.fs.totalBytes / size
        observer.next(`Compressing ${numeral(complete).format('0%')}`)
      })

      archive.pipe(output)

      archive.finalize()
      archive.on('finish', () => {
        observer.complete()
      })
    })
  }

  async upload(type: PackageType) {
    if (type === PackageType.code) await this.deployment.update('UPLOAD_CODE_ZIP')
    const sts = await this.deployment.sts()
    return new Observable(observer => {
      observer.next('Sending code..')
      new S3.ManagedUpload({
        service: new S3(sts),
        params: {
          Bucket: this.deployment.s3.bucket,
          Key: type === PackageType.layer ? this.deployment.s3.layer : this.deployment.s3.code,
          Body: fs.createReadStream(this.deployment.s3.paths[type]),
        },
      }).on('httpUploadProgress', event => {
        observer.next(`${numeral((event.loaded  / event.total)).format('0%')}`)
      }).send(async (error: any) =>  {
        if (error) {
          await this.deployment.fail({
            message: error.message,
            detail: error,
          })
          observer.error(error.message)
        } else observer.complete()
      })
    })
  }

  async sync(folder: string, bucket: string, status: string, prefix: string) {
    await this.deployment.update(status)
    const sts = await this.deployment.sts()
    this.size = {
      deps: 0,
      code: 0,
      static: 0,
      dist: await this.getSize('dist', ''),
    }
    return new Observable(observer => {
      observer.next('Comparing remote dependencies..')
      const client = require(`${__dirname}/../../src/lib/s3`).createClient({s3Client: new S3(sts)})
      const uploader = client.uploadDir({
        localDir: folder,
        deleteRemoved: true,
        s3Params: {
          Bucket: bucket,
          ACL: 'public-read',
          Prefix: prefix,
        },
      })
      uploader.on('progress', () => {
        if (!isNaN(uploader.progressAmount / uploader.progressTotal))
          observer.next(`${(uploader.progressAmount / uploader.progressTotal * 100).toFixed(2)}% complete`)
      })

      uploader.on('end', () => observer.complete())
    })
  }

  async deploy(status: string, task: any) {
    return new Observable(observer => {
      observer.next('Initiating deployment')
      const payload = {
        size: this.size,
      }
      this.deployment.update(status, {hash: this.hash, mode: this.mode, payload})
      .then(response =>  {
        task.title = 'Deployment Successful: ' + chalk.bold(response.data.data.data)
        observer.complete()
      })
      .catch(async error => {
        if (error.response.data.errors) {
          observer.error(error.response.data.errors[0].message)
        }
        if (error.message) {
          await this.deployment.fail({
            message: error.message,
            detail: error,
          })
          observer.error(error.message)
        } else if (error.response.data) throw new Error(JSON.stringify(error.response.data))
        else throw error
      })
    })
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
}
