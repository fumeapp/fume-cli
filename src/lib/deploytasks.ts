import Deployment from './deployment'
import chalk from 'chalk'
import { FumeEnvironment, Mode, PackageType, Size, Variable, YamlConfig } from './types'
import { Listr, ListrTaskWrapper } from 'listr2'
import S3 from 'aws-sdk/clients/s3'
import * as fs from 'fs'
import execa from 'execa'
import numeral from 'numeral'
import { cli } from 'cli-ux'
import fse = require('fs-extra')
import yml = require('js-yaml')

const fastFolderSizeSync = require('fast-folder-size/sync')
const { stringify } = require('envfile')

// const {transformSync} = require('@babel/core')

const md5file = require('md5-file')

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

  public framework!: string

  public structure!: string

  public nitro = false

  public hash!: string

  public refresh_deps!: boolean

  public size!: Size

  public mode!: Mode

  public staticDir = 'static/'

  public packager = 'yarn'

  async checkConfig() {
    try {
      this.fumeConfig = yml.load(fs.readFileSync('fume.yml').toString()) as YamlConfig
      if (this.fumeConfig.nuxt && this.fumeConfig.nuxt.srcDir)
        this.staticDir = this.fumeConfig.nuxt.srcDir[this.fumeConfig.nuxt.srcDir.length - 1] === '/' ? `${this.fumeConfig.nuxt.srcDir}static` : `${this.fumeConfig.nuxt.srcDir}/static`
    } catch (error: any) {
      if (error.code === 'ENOENT')
        this.noConfig = true
      else
        throw error
    }
  }

  async modeSelect(task: any) {
    const util = require('util')
    const format = '0.0b'
    if (this.nitro) {
      this.mode = Mode.native

      fs.writeFileSync('.output/server/fume.js', `
exports.handler = async (event, context) => {
  const { handler } = await import('/var/task/.output/server/index.mjs');
  return handler(event, context);
}`)


      this.size = {
        pub: await fastFolderSizeSync('.output/public'),
        server: await fastFolderSizeSync('.output/server'),
        deps: 0,
        code: 0,
        static: 0,
      }
      const pub = numeral(this.size.pub).format(format)
      const server = numeral(this.size.server).format(format)
      const all = numeral(this.size.pub + this.size.server).format(format)

      task.title = `Public: ${chalk.bold(pub)} Server: ${chalk.bold(server)} Total: ${chalk.bold(all)} Mode: ${chalk.bold(this.mode)}`
      return
    }

    this.size = this.deployment.entry.project.framework === 'NestJS' ? {
      deps: await fastFolderSizeSync('node_modules'),
      code: await fastFolderSizeSync('dist'),
      static: 0,
      pub: 0,
      server: 0,
    } : {
      deps: await fastFolderSizeSync('node_modules'),
      code: await fastFolderSizeSync('.nuxt'),
      static: await fastFolderSizeSync(this.staticDir),
      pub: 0,
      server: 0,
    }
    this.mode = Mode.image
    const allowed = 262_144_000
    if (this.refresh_deps && this.size.deps > allowed)
      this.mode = Mode.image
    /*
      const error = `Dependencies greater than an allowed size of ${allowed} bytes (${numeral(allowed).format(format)}) - ${this.size.deps} (${numeral(this.size.deps).format(format)})`
      this.deployment.fail({
        message: error,images
        detail: [
          `Current Payload size: ${this.size.deps} (${numeral(this.size.deps).format(format)})`,
          `Difference: ${this.size.deps - allowed} (${numeral(this.size.deps - allowed).format(format)})`,
        ],
      })
      this.cleanup()
      throw new Error(error)
   */

    const deps = numeral(this.size.deps).format(format)
    const code = numeral(this.size.code).format(format)
    const stat = numeral(this.size.static).format(format)
    const all = numeral(this.size.deps + this.size.code + this.size.static).format(format)
    task.title = `Deps: ${chalk.bold(deps)} Code: ${chalk.bold(code)} Assets: ${chalk.bold(stat)} Total: ${chalk.bold(all)} Mode: ${chalk.bold(this.mode)}`
  }

  async loadConfig() {
    this.fumeConfig = yml.load(fs.readFileSync('fume.yml').toString()) as YamlConfig
  }

  async billing(ctx: any, task: any) {
    task.title = 'This action requires an active subscription from a team member'
    ctx.input = await task.prompt({
      type: 'Toggle',
      message: 'Visit your billing section?',
      initial: 'yes',
    })
    if (ctx.input) await cli.open(`${this.env.web}/billing`)
    throw new Error(`Visit ${this.env.web}/billing and choose a plan that fits.`)
  }

  async choose(ctx: any, task: any) {
    this.deployment = new Deployment(this.fumeConfig, this.env)
    let environments
    try {
      environments = await this.deployment.environments()
      task.title = `Choose an environment to deploy (${environments[0].project.name})`
    } catch (error: any) {
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
    } catch (error: any) {
      if (!error.response) throw new Error(error)
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
    this.framework = this.deployment.entry.project.framework
    this.structure = this.deployment.entry.project.structure
    this.variables = this.deployment.entry.env.variables
    if (this.structure === 'headless') this.mode = Mode.headless
    if (this.framework !== 'Go' && this.structure === 'ssr') {
      if (await this.checkNitro()) {
        this.nitro = true
        task.title += ` - ${chalk.yellowBright('⚡')}nitro d3tected`
      }

      this.hash = this.lock()
      this.refresh_deps = this.deployment.entry.env.detail && this.deployment.entry.env.detail.hash ? this.hash !== this.deployment.entry.env.detail.hash : true
    }

    return true
  }

  // check if our setup is using nuxt3 or nuxt-bridge - in that case compile with nitro
  async checkNitro(): Promise<boolean> {
    const pkg = JSON.parse(fs.readFileSync('package.json').toString()) as Record<string, any>
    if (pkg.devDependencies && (pkg.devDependencies.nuxt3 || pkg?.devDependencies?.nuxt?.includes('^3'))) return true
    return Boolean(pkg.devDependencies && pkg.devDependencies['@nuxt/bridge'])
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

  async yarn(type: string, task: ListrTaskWrapper<any, any>) {
    if (type === 'production') {
      task.title = `Install production dependencies with ${chalk.bold(this.packager)}`
      await this.deployment.update('YARN_PROD')
    } else {
      task.title = `Install all dependencies with ${chalk.bold(this.packager)}`
      await this.deployment.update('YARN_ALL')
    }

    if (this.packager === 'npm' && type === 'production') {
      task.title = 'Pruning node_modules/'
      fse.emptyDirSync('./node_modules')
    }

    let args: Array<string> = []
    if (this.packager === 'npm') {
      args = type === 'production' ? ['install', '--only=prod'] : ['install']
    } else if (this.packager === 'yarn') {
      args = type === 'production' ? ['--prod'] : ['install']
    }

    task.title = `Running ${chalk.bold(this.packager)} ${args.join(' ')}`
    await execa(this.packager, args)
  }

  async goCompile(task: ListrTaskWrapper<any, any>) {
    task.title = 'Compiling go binary'
    await this.deployment.update('GO_COMPILE')
    await execa('go', ['build', '-o', 'main', 'main.go'], { env: { GOOS: 'linux', GOARCH: 'amd64' } })
  }

  async goArchive(task: ListrTaskWrapper<any, any>) {
    this.mode = Mode.native
    await this.deployment.update('GO_ARCHIVE')
    task.title = 'Archiving go binary'
    this.size = {
      pub: 0,
      server: 0,
      deps: 0,
      code: fs.statSync('main').size,
      static: 0,
    }
    await execa('zip', [this.deployment.s3.code, 'main'])
  }

  async outputArchive(task: ListrTaskWrapper<any, any>) {
    this.mode = Mode.native
    await this.deployment.update('MAKE_CODE_ZIP')
    task.title = 'Archiving .output binary'
    await execa('zip', ['-r', this.deployment.s3.code, '.output'])
  }


  async outputUpload(task: ListrTaskWrapper<any, any>) {
    await this.deployment.update('UPLOAD_CODE_ZIP')
    task.title = 'Uploading .output archvie'
    const sts = await this.deployment.sts()
    return new Promise((resolve, reject) => {
      new S3.ManagedUpload({
        service: new S3(sts),
        params: {
          Bucket: this.deployment.s3.bucket,
          Key: this.deployment.s3.code,
          Body: fs.createReadStream(this.deployment.s3.code),
        },
      }).on('httpUploadProgress', event => {
        task.title = `Uploading .output archive: ${numeral((event.loaded / event.total)).format('0%')}`
      }).send(async (error: any) => {
        if (error) {
          await this.deployment.fail({
            message: error.message,
            detail: error,
          })
          reject(error)
        } else {
          resolve(true)
        }
      })
    })
  }



  async goUpload(task: ListrTaskWrapper<any, any>) {
    await this.deployment.update('UPLOAD_BINARY')
    task.title = 'Uploading binary archive'
    const sts = await this.deployment.sts()
    return new Promise((resolve, reject) => {
      new S3.ManagedUpload({
        service: new S3(sts),
        params: {
          Bucket: this.deployment.s3.bucket,
          Key: this.deployment.s3.code,
          Body: fs.createReadStream(this.deployment.s3.code),
        },
      }).on('httpUploadProgress', event => {
        task.title = `Uploading binary archive: ${numeral((event.loaded / event.total)).format('0%')}`
      }).send(async (error: any) => {
        if (error) {
          await this.deployment.fail({
            message: error.message,
            detail: error,
          })
          reject(error)
        } else {
          resolve(true)
        }
      })
    })
  }

  async build() {
    await this.deployment.update('NUXT_BUILD', { nitro: this.nitro })
    let args: Array<string> = []
    try {
      args = this.packager === 'npm' ? ['run', 'build'] : ['build']
      await (this.nitro ? execa(this.packager, args, { env: { NITRO_PRESET: 'aws-lambda' } }) : execa(this.packager, args))
    } catch (error: any) {
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
    await execa('node_modules/.bin/nuxt', ['generate'])
  }

  async envPrepare() {
    await this.deployment.update('ENV_PREPARE')
    if (fs.existsSync('.env')) {
      fs.copyFileSync('.env', '.env.fume')
    }

    const env: Record<string, any> = {}
    for (const variable of this.variables)
      env[variable.name] = variable.value
    fs.writeFileSync('.env', stringify(env), 'utf8')
  }

  async envRestore() {
    await this.deployment.update('ENV_RESTORE')
    if (fs.existsSync('.env.fume')) {
      fs.copyFileSync('.env.fume', '.env')
      fs.unlinkSync('.env.fume')
    }
  }

  async package(type: PackageType) {
    if (type === PackageType.output) {
      return new Listr([
        {
          title: 'Syncing build output to S3',
          task: (_, task) => this.sync(
            task,
            '.output',
            this.deployment.s3.bucket,
            'SYNC_OUTPUT',
          ),
        },
        {
          title: 'Syncing _nuxt folder to S3',
          task: (_, task) => this.sync(
            task,
            '.output/public/_nuxt',
            this.deployment.s3.bucket,
            'SYNC_OUTPUT',
            'public/' + this.deployment.entry.env.id + '/',
            false,
          ),
        },
      ])
    }

    return new Listr([
      {
        title: `Archiving ${type} package`,
        task: () => this.archive(type),
      },
      {
        title: `Uploading ${type} package`,
        task: (_, task) => this.upload(task, type),
      },
    ])
  }

  async archive(type: PackageType) {
    if (type === PackageType.layer) await this.deployment.update('SYNC_DEPS')
    if (type === PackageType.code) await this.deployment.update('MAKE_CODE_ZIP')

    if (type === PackageType.layer)
      await execa('zip', [
        '-r',
        this.deployment.s3.paths[type],
        'node_modules/',
      ])
    if (type === PackageType.code) {
      await (this.deployment.entry.project.framework === 'NestJS' ? execa('zip', [
        this.deployment.s3.paths[type],
        '-r',
        'dist',
        'fume.yml',
      ]) : execa('zip', [
        this.deployment.s3.paths[type],
        '-r',
        this.staticDir,
        'nuxt.config.js',
        'fume.yml',
        '.nuxt/',
      ]))
    }
  }

  async upload(task: ListrTaskWrapper<any, any>, type: PackageType) {
    if (type === PackageType.code) await this.deployment.update('UPLOAD_CODE_ZIP')
    const sts = await this.deployment.sts()
    return new Promise((resolve, reject) => {
      new S3.ManagedUpload({
        service: new S3(sts),
        params: {
          Bucket: this.deployment.s3.bucket,
          Key: type === PackageType.layer ? this.deployment.s3.layer : this.deployment.s3.code,
          // @ts-ignore
          Body: fs.createReadStream(this.deployment.s3.paths[type]),
        },
      }).on('httpUploadProgress', event => {
        task.title = `Uploading ${type} package: ${numeral((event.loaded / event.total)).format('0%')}`
      }).send(async (error: any) => {
        if (error) {
          await this.deployment.fail({
            message: error.message,
            detail: error,
          })
          reject(error)
        } else {
          resolve(true)
        }
      })
    })
  }

  async sync(task: ListrTaskWrapper<any, any> | null, folder: string, bucket: string, status: string, prefix = '', deleteRemoved = true) {
    await this.deployment.update(status)
    const sts = await this.deployment.sts()
    const client = require('@auth0/s3').createClient({ s3Client: new S3(sts) })
    return new Promise((resolve, reject) => {
      const uploader = client.uploadDir({
        localDir: folder,
        deleteRemoved: deleteRemoved,
        s3Params: {
          Bucket: bucket,
          ACL: 'public-read',
          Prefix: prefix,
        },
      })
      uploader.on('progress', () => {
        if (!isNaN(uploader.progressAmount / uploader.progressTotal)) {
          const formatted = numeral(uploader.progressAmount / uploader.progressTotal).format('0.00%')
          if (task) task.title = `Syncing distribution to the cloud: ${formatted} complete`
        }
      })
      uploader.on('error', (err: Error) => reject(err))
      uploader.on('end', () => resolve(true))
    })
  }

  async image(task: ListrTaskWrapper<any, any>) {
    await this.deployment.update('IMAGE_BUILD', { nitro: this.nitro })
    let attempts = 80
    const delay = 5
    while (attempts !== 0) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.deployment.get()
      if (result.data && result.data.data && result.data.data.status === 'FAILURE')
        throw new Error(`Error building image - check details at ${this.env.web}${this.deployment.entry.dep_url}`)
      if (result.data && result.data.data && result.data.data.digest !== null)
        return true
      task.title = `Build container image (${attempts}:${delay})`
      // eslint-disable-next-line no-await-in-loop
      await this.sleep(delay * 1000)
      attempts--
    }

    throw new Error('Timed out waiting for image digest')
  }

  sleep(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
  }

  async deploy(status: string, task: any) {
    const payload = {
      size: this.size,
    }
    return this.deployment.update(status, { hash: this.hash, mode: this.mode, payload })
      .then(response => {
        task.title = 'Deployment Successful: ' + chalk.bold(response.data.data.data)
      })
      .catch(async error => {
        if (error.response.data.errors) {
          error(error.response.data.errors[0].message)
        }

        if (error.message) {
          await this.deployment.fail({
            message: error.message,
            detail: error,
          })
          error(error.message)
        } else if (error.response.data) throw new Error(JSON.stringify(error.response.data))
        else throw error
      })
  }

  cleanup() {
    if (fs.existsSync('.nuxt.config.fume')) fse.moveSync('.nuxt.config.fume', 'nuxt.config.js', { overwrite: true })
    if (fs.existsSync('./.fume')) fse.removeSync('./.fume')
    if (fs.existsSync('./fume.js')) fse.removeSync('./fume.js')
    if (fs.existsSync('.env.fume')) {
      fs.copyFileSync('.env.fume', '.env')
      fs.unlinkSync('.env.fume')
    }

    if (fs.existsSync('main')) fse.removeSync('main')
    if (fs.existsSync(this.deployment.s3.paths.code)) fse.removeSync(this.deployment.s3.paths.code)

    if (this && this.deployment.s3.code && fs.existsSync(this.deployment.s3.code))
      fs.unlinkSync(this.deployment.s3.code)
    if (this && this.deployment.s3 && fs.existsSync(this.deployment.s3.paths.layer))
      fs.unlinkSync(this.deployment.s3.paths.layer)
  }
}
