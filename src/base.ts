import Command from '@oclif/command'
import {FumeEnvironment} from './lib/types'
const Raven = require('raven')
const {oclif} = require('../package.json')

export default abstract class extends Command {
  envs: Array<FumeEnvironment> = [
    {
      env: 'local',
      web: 'http://localhost:3000',
      api: 'http://localhost:8000',
    },
    {
      env: 'staging',
      web: 'https://staging.fume.app',
      api: 'https://staging-api.fume.app',
    },
    {
      env: 'production',
      web: 'https://fume.app',
      api: 'https://api.fume.app',
    },
  ]

  env: FumeEnvironment = this.envs[0]

  async init() {
    let env
    if (
      process.env.FUME_ENV &&
      (env = this.envs.find(e => e.env === process.env.FUME_ENV))
    ) {
      this.env = env
      return
    }
    env = this.envs.find(e => e.env === oclif.env)
    if (env !== undefined) this.env = env
    if (oclif.env === 'production')
      Raven.config('https://7a94a89f88b34b5ba4f00f814126d231@o436461.ingest.sentry.io/539770').install()
  }
}
