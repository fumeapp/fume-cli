import {Hook} from '@oclif/config'
import chalk from 'chalk'

const hook: Hook<'init'> = async function (opts) {
  // process.stdout.write(chalk.green('fume cli') + `example hook running ${opts.id}\n`)
  process.stdout.write(
    '\n' +
    chalk.hex('#362f79').bold('::') +
    chalk.hex('#b5c6fc').bold('fume cli') +
    chalk.hex('#362f79').bold('::') +
    chalk.bold(` v${this.config.version}`) +
    '\n\n',
  )
}

export default hook
