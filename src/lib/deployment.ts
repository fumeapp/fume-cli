import {Auth} from './auth'
import {YamlConfig} from '../commands/deploy'

export default class Deployment {
  auth: Auth

  config: YamlConfig

  constructor(config: YamlConfig) {
    this.auth = new Auth()
    this.config = config
  }

  async initialize() {
    return (await this.auth.axios.post(`/project/${this.config.id}/deployment`)).data.data
  }
}
