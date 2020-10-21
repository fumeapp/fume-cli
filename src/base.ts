import Command from '@oclif/command'
import {FumeEnvironment} from './lib/types'
const {oclif} = require('../package.json')

export default abstract class extends Command {
  env!: FumeEnvironment

  async init() {
    this.env = oclif.env
  }
}
