import {Hook} from '@oclif/core'
import chalk from 'chalk'

const hook: Hook<'init'> = async function () {
  process.stdout.write(
    '\n' +
    chalk.hex('#362f79').bold('::') +
    chalk.hex('#b5c6fc').bold('fume') +
    chalk.hex('#362f79').bold(':') +
    chalk.hex('#b5c6fc').bold('cli') +
    chalk.hex('#362f79').bold('::') +
    chalk.bold(` v${this.config.version}`) +
    '\n\n',
  )
}

export default hook
