import {Hook} from '@oclif/config'
import chalk from 'chalk'
import axios from 'axios'

/**
 * @desc Fetch the latest dist tag version from the repository
 * @returns Promise<string|undefined>
 */
const fetchLatestVersion = async (): Promise<string|undefined> => {
  try {
    const data = (await axios.get('https://registry.npmjs.org/fume-cli')).data
    return data['dist-tags'].latest
  } catch {}
}

const hook: Hook<'init'> = async function (): Promise<void> {
  const currentVersion = this.config.version
  const latestVersion = await fetchLatestVersion()

  if (latestVersion && currentVersion !== latestVersion) {
    this.log(chalk.yellow('You are using an old version of the CLI.\n' +
      `You can update it by running: ${chalk.green('yarn global upgrade fume-cli')}`))
  }

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
