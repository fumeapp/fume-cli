import Command from '../base'
import { Args } from '@oclif/core'
import AuthStatus from './auth/status'
import { Flags } from '@oclif/core'
import { Listr } from 'listr2'
import { Mode, PackageType } from '../lib/types'
import ConfigTasks from '../lib/configtasks'
import { Auth } from '../lib/auth'
// import * as onDeath from 'death'
import DeployTasks from '../lib/deploytasks'
import { toUnicode } from 'punycode'

export default class Deploy extends Command {
  static description = 'Deploy an Environment'

  static flags: { help: any } = {
    help: Flags.help({ char: 'h' }),
  }

  static examples = [
    '$ fume deploy staging',
  ]

  static args = {
    environment: Args.string({
      name: 'environment',
      required: false,
      description: 'environment to deploy to (ex: staging)',
    }),
  }

  private auth!: Auth

  async run() {
    const { args } = await this.parse(Deploy)
    if (process.platform === 'win32')
      this.error('Windows is not supported yet')

    const dp = new DeployTasks(this.env, args.environment as string)

    const initial = new Listr([
      {
        title: 'Verify authentication',
        task: async (ctx, task) =>
          (new AuthStatus([], this.config)).tasks(ctx, task, true),
      },
      {
        title: 'Verify fume configuration',
        task: () => dp.checkConfig(),
      },
      {
        title: 'Create fume configuration',
        task: (ctx, task): Listr =>
          task.newListr((new ConfigTasks(this.env, this.auth)).tasks(), { concurrent: false }),
        enabled: () => dp.noConfig,
      },
      {
        title: 'Load new fume configuration',
        task: () => dp.loadConfig(),
        enabled: () => dp.noConfig,
      },
      {
        title: 'Choose an environment',
        task: (ctx, task) => dp.choose(ctx, task),
        enabled: () => dp.environment === undefined,
      },
      {
        title: 'Initialize deployment',
        task: (ctx, task) => dp.create(ctx, task),
      },
    ])

    const ssr = new Listr([
      {
        title: 'Install all dependencies',
        task: (ctx, task) => dp.yarn('all', task),
      },
      {
        title: 'Prepare environment variables',
        task: () => dp.envPrepare(),
        enabled: () => dp.variables.length > 0,
      },
      {
        title: 'Bundle for server and client',
        task: () => dp.build(),
      },
      {
        title: 'Install production dependencies',
        task: (ctx, task) => dp.yarn('production', task),
        enabled: () => dp.refresh_deps,
      },
      {
        title: 'Analyze project structure',
        task: (ctx, task) => dp.modeSelect(task),
      },
    ], { concurrent: false })

    const nitro = new Listr([
      {
        title: 'Install dependencies',
        task: (ctx, task) => dp.yarn('all', task),
      },
      {
        title: 'Prepare environment variables',
        task: () => dp.envPrepare(),
        enabled: () => dp.variables.length > 0,
      },
      {
        title: 'Generate output for public and server',
        task: () => dp.build(),
      },
      {
        title: 'Analyze .output structure',
        task: (_ctx, task) => dp.modeSelect(task),
      },
      {
        title: 'Sending build output',
        task: () => dp.package(PackageType.output),
        enabled: () => dp.nitro,
      },
      {
        title: 'Archive .output directory',
        task: (_ctx, task) => dp.outputArchive(task),
      },
      {
        title: 'Upload archive directory',
        task: (ctx, task) => dp.outputUpload(task),
      },
      {
        title: 'Restore environment variables',
        task: () => dp.envRestore(),
        enabled: () => dp.variables.length > 0,
      },
      {
        title: 'Deploy to function',
        task: (ctx, task) => dp.deploy('DEPLOY_FUNCTION', task),
      },
      {
        title: 'Cleanup deployment',
        task: () => dp.cleanup(),
      },


    ])

    const nest = new Listr([
      {
        title: 'Install all dependencies',
        task: (ctx, task) => dp.yarn('all', task),
      },
      {
        title: 'Prepare environment variables',
        task: () => dp.envPrepare(),
        enabled: () => dp.variables.length > 0,
      },
      {
        title: 'Bundle for server and client',
        task: () => dp.build(),
      },
      {
        title: 'Analyze project structure',
        task: (ctx, task) => dp.modeSelect(task),
      },
    ], { concurrent: false })

    const go = new Listr([
      {
        title: 'Compile go package',
        task: (ctx, task) => dp.goCompile(task),
      },
      {
        title: 'Archive binary',
        task: (ctx, task) => dp.goArchive(task),
      },
      {
        title: 'Upload binary archive',
        task: (ctx, task) => dp.goUpload(task),
      },
      {
        title: 'Deploy to function',
        task: (ctx, task) => dp.deploy('DEPLOY_FUNCTION', task),
      },
      {
        title: 'Cleanup deployment',
        task: () => dp.cleanup(),
      },
    ], { concurrent: false })

    const image = new Listr([
      {
        title: 'Send dependencies',
        task: () => dp.package(PackageType.layer),
        enabled: () => dp.refresh_deps && !dp.nitro,
      },
      {
        title: 'Send source code',
        task: () => dp.package(PackageType.code),
        enabled: () => !dp.nitro,
      },
      {
        title: 'Sending build output',
        task: () => dp.package(PackageType.output),
        enabled: () => dp.nitro,
      },
      {
        title: 'Restore environment variables',
        task: () => dp.envRestore(),
        enabled: () => dp.variables.length > 0,
      },
      {
        title: 'Build container image',
        task: (ctx, task) => dp.image(task),
      },
      {
        title: 'Deploy to function',
        task: (ctx, task) => dp.deploy('DEPLOY_FUNCTION', task),
      },
      {
        title: 'Cleanup deployment',
        task: () => dp.cleanup(),
      },
    ])

    const headless = new Listr([
      {
        title: 'Install modules',
        task: (ctx, task) => dp.yarn('all', task),
      },
      {
        title: 'Prepare environment variables',
        task: () => dp.envPrepare(),
        enabled: () => dp.variables.length > 0,
      },
      {
        title: 'Generating distribution files',
        task: () => dp.generate(),
      },
      {
        title: 'Restore environment variables',
        task: () => dp.envRestore(),
        enabled: () => dp.variables.length > 0,
      },
      {
        title: 'Syncing distribution to the cloud',
        task: (_, task) => dp.sync(
          task,
          'dist',
          dp.deployment.s3.headless,
          'SYNC_FILES',
        ),
      },
      {
        title: 'Deploy package',
        task: (ctx, task) => dp.deploy('DEPLOY_S3', task),
      },
    ], { concurrent: false })

    await initial.run().catch(error => this.error(error))
    if (dp.framework === 'Go') {
      await go.run().catch(error => this.error(error))
    } else if (dp.framework === 'NestJS') {
      await nest.run().catch(error => this.error(error))
      await image.run().catch(error => this.error(error))
    } else {
      if (dp.structure === 'ssr') {
        if (dp.nitro) await nitro.run().catch(error => this.error(error))
        else await ssr.run().catch(error => this.error(error))
      }
      if (dp.mode === Mode.image) image.run().catch(() => false)
      if (dp.structure === 'headless') await headless.run().catch(error => this.error(error))
    }
    if (dp.firstDeploy) this.warn('First deployments take time to propagate - the URL will work in several minutes')

    // onDeath(dp.cleanup)
  }
}
