import Command from '@oclif/command'
import {FumeEnvironment} from './lib/types'

// @ts-ignore
import {oclif} from '../package.json'

export default abstract class extends Command {
  env!: FumeEnvironment

  async init() {
    this.env = oclif.env
  }
}
