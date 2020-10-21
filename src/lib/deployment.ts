import {Auth} from './auth'
import {YamlConfig, Entry, AwsClientConfig, FumeEnvironment} from './types'

export default class Deployment {
  auth: Auth

  config: YamlConfig

  entry!: Entry

  constructor(config: YamlConfig, env: FumeEnvironment) {
    this.auth = new Auth(env)
    this.config = config
  }

  async initialize(environment: string) {
    this.entry = (await this.auth.axios.post(`/project/${this.config.id}/deployment`, {environment})).data.data.data
    return this.entry
  }

  async update(status: string) {
    return this.auth.axios.put(`/project/${this.config.id}/deployment/${this.entry.id}`, {status: status})
  }

  async sts(): Promise<AwsClientConfig> {
    const result = (await this.auth.axios.get('/sts')).data.data
    return {
      accessKeyId: result.AccessKeyId,
      secretAccessKey: result.SecretAccessKey,
      sessionToken: result.SessionToken,
      expiration: result.Expiration,
      region: this.entry.project.region,
    }
  }
}
