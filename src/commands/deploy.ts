import Command from '../base'
import AuthStatus from './auth/status'
import {flags} from '@oclif/command'
import {Listr} from 'listr2'
import {Mode, PackageType} from '../lib/types'
import ConfigTasks from '../lib/configtasks'
import {Auth} from '../lib/auth'
import onDeath from 'death'
import DeployTasks from '../lib/deploytasks'

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

  async run() {
    const {args: {environment}} = this.parse(Deploy)

    const dp = new DeployTasks(this.env, environment)

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
          task.newListr((new ConfigTasks(this.env, this.auth)).tasks(), {concurrent: false}),
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
        task: () => dp.yarn([]),
      },
      {
        title: 'Check config syntax',
        task: (ctx, task) => dp.verify(task),
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
        task: () => dp.yarn(['--prod']),
        enabled: () => dp.refresh_deps,
      },
      {
        title: 'Restore environment variables',
        task: () => dp.envRestore(),
        enabled: () => dp.variables.length > 0,
      },
      {
        title: 'Analyze project structure',
        task: (ctx, task) => dp.modeSelect(task),
      },
      {
        title: 'Send dependencies package',
        task: () => dp.package(PackageType.layer),
        enabled: () => dp.refresh_deps,
      },
      {
        title: 'Send source package',
        task: () => dp.package(PackageType.code),
      },
      {
        title: 'Create or update function',
        task: (ctx, task) => dp.deploy('DEPLOY_FUNCTION', task),
      },
      {
        title: 'Cleanup deployment',
        task: () => dp.cleanup(),
      },
    ])

    /*
    const ssrLayer = new Listr([
      {
        title: 'Send dependencies',
        task: () => dp.package(PackageType.layer),
        enabled: () => dp.refresh_deps,
      },
      {
        title: 'Send source code',
        task: () => dp.package(PackageType.code),
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

    const ssrEFS = new Listr([
      {
        title: 'Sync dependencies',
        task: () => dp.sync(
          './node_modules',
          dp.deployment.s3.bucket,
          'SYNC_DEPS',
          `env-${dp.deployment.entry.env.id}-deps/node_modules/`,
        ),
        enabled: () => dp.refresh_deps,
      },
      {
        title: 'Send source code',
        task: () => dp.package(PackageType.code),
      },
      {
        title: 'Deploy package(s)',
        task: (ctx, task) => dp.deploy('DEPLOY_FUNCTION', task),
      },
      {
        title: 'Cleanup deployment',
        task: () => dp.cleanup(),
      },
    ])
    */

    const headless = new Listr([
      {
        title: 'Install modules',
        task: () => dp.yarn([]),
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
        task: () => dp.sync(
          'dist',
          dp.deployment.s3.headless,
          'SYNC_FILES',
          ''),
      },
      {
        title: 'Deploy package',
        task: (ctx, task) => dp.deploy('DEPLOY_S3', task),
      },
    ])

    await initial.run().catch(() => false)
    if (dp.structure === 'ssr') await ssr.run().catch(() => false)
    /*
    if (dp.mode === Mode.layer)
      ssrLayer.run().catch(() => false)
    if (dp.mode === Mode.efs)
      ssrEFS.run().catch(() => false)
    */
    if (dp.structure === 'headless') await headless.run().catch(() => false)
    if (dp.firstDeploy)
      this.warn('First deployments take time to propagate')

    onDeath(dp.cleanup)
  }
}
