import Command from '../../base'
import {Listr} from 'listr2'
import LoginTasks from '../../lib/logintasks'

export default class AuthLogin extends Command {
  static description = 'Login to fume'

  static aliases = ['login']

  async run() {
    const lt = new LoginTasks(this.env)
    new Listr(lt.tasks(), {concurrent: false}).run().catch(() => false)
  }
}
