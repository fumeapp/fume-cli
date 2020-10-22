import {Auth} from './auth'
import {YamlConfig, Entry, AwsClientConfig, FumeEnvironment} from './types'
import execa from 'execa'

export default class Deployment {
  auth: Auth

  config: YamlConfig

  entry!: Entry

  constructor(config: YamlConfig, env: FumeEnvironment) {
    this.auth = new Auth(env)
    this.config = config
  }

  async get(type: string) {
    let args
    if (type === 'commit') args = ['rev-parse', 'HEAD']
    if (type === 'branch') args = ['rev-parse', '--abbrev-ref', 'HEAD']
    if (type === 'message') args = ['log', '--format=%B', '-n 1']
    try {
      return (await execa('git', args)).stdout
    } catch (error) {
      return null
    }
  }

  async initialize(environment: string) {
    const data = {
      environment: environment,
      commit: await this.get('commit'),
      branch: await this.get('branch'),
      message: await this.get('message'),
    }
    this.entry = (await this.auth.axios.post(`/project/${this.config.id}/deployment`, data)).data.data.data
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
