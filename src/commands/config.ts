import {flags} from '@oclif/command'
import {Listr} from 'listr2'
import Command from '../base'
import AuthStatus from './auth/status'
import {Auth} from '../lib/auth'
import ConfigTasks from '../lib/configtasks'

export default class Config extends Command {
  static description = 'Generate a fume.yml config'

  static flags = {
    help: flags.help({char: 'h'}),
  }

  private auth!: Auth

  async run() {
    this.parse(Config)

    const checkAuth = new Listr([
      {
        title: 'Verify authentication',
        task: async (ctx, task) =>
          (new AuthStatus([], this.config)).tasks(ctx, task, true),
      },
    ])

    const ct = new ConfigTasks(this.env, this.auth)

    await checkAuth.run()
    .then(() => new Listr(ct.tasks(), {concurrent: false}).run().catch(() => false)).catch(() => false)
  }
}
