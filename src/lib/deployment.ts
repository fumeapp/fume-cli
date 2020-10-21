import {Auth} from './auth'
import {YamlConfig, Entry, Project, AwsClientConfig} from './types'

export default class Deployment {
  auth: Auth

  config: YamlConfig

  project!: Project

  entry!: Entry

  constructor(config: YamlConfig) {
    this.auth = new Auth()
    this.config = config
  }

  async initialize(environment: string) {
    this.project = (await this.auth.axios.get(`/team/${this.config.team_id}/project/${this.config.id}`)).data.data
    this.entry = (await this.auth.axios.post(`/project/${this.config.id}/deployment`, {environment})).data.data.data
    return this.entry
  }

  async update(status: string) {
    await this.auth.axios.put(`/project/${this.config.id}/deployment/${this.entry.id}`, {status: status})
  }

  async sts(): Promise<AwsClientConfig> {
    const result = (await this.auth.axios.get('/sts')).data.data
    return {
      accessKeyId: result.AccessKeyId,
      secretAccessKey: result.SecretAccessKey,
      sessionToken: result.SessionToken,
      expiration: result.Expiration,
      region: this.project.region,
    }
  }
}
