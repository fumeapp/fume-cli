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
import {YamlConfig} from '../lib/types'

export default class Deploy extends Command {
  static description = 'Deploy an Environment'

  static examples = [
    '$ fume deploy staging',
  ]

  static args = [{name: 'environment', required: true}]

  fumeConfig!: YamlConfig

  environment!: string

  name!: string

  private deployment!: Deployment;

  async run() {
    const {args: {environment}} = this.parse(Deploy)

    if (!fs.existsSync('fume.yml'))
      cli.error('No fume configuration (fume.yml) found, please run ' + chalk.bold('fume config'))

    this.fumeConfig = yml.load(fs.readFileSync('fume.yml').toString())

    if (!Object.keys(this.fumeConfig.environments).includes(environment)) {
      cli.error(`Environment: ${environment} not found in configuration (fume.yml)`)
    }

    this.environment = environment
    this.name = this.fumeConfig.name

    const tasks = new Listr([
      {
        title: 'Verify authentication',
        task: async (ctx, task) =>
          (new AuthStatus([], this.config)).tasks(ctx, task, true),
      },
      {
        title: 'Initialize deployment',
        task: (ctx, task) => this.create(ctx, task),
      },
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

    tasks.run().catch(() =>  false)
  }

  async create(ctx: any, task: any) {
    this.deployment = new Deployment(this.fumeConfig, this.env)

    try {
      await this.deployment.initialize(this.environment)
    } catch (error) {
      task.title = error.response.data.errors[0].detail
      ctx.input = await task.prompt({
        type: 'Toggle',
        message: 'Launch fume.app in your browser?',
        initial: 'yes',
      })
      if (ctx.input) await cli.open(`${this.env.web}/team/${this.deployment.entry.team_id}/#cloud`)
      throw new Error(error.response.data.errors[0].detail)
    }

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
      fse.copy(`${__dirname}/../assets/fume`, './fume')
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
        observer.next(`${event.loaded * 100 / event.total}%`)
      }).send(() => {
        fs.unlinkSync(this.deployment.s3.path)
        observer.complete()
      })
    })
  }

  async deploy(task: any) {
    return new Observable(observer => {
      observer.next('Initiating deployment')
      this.deployment.update('FUNCTION_DELIVER')
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
