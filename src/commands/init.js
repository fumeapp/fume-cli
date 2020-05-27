const {Command, flags} = require('@oclif/command')

class InitCommand extends Command {
  async run() {
    const {flags} = this.parse(InitCommand)
    const name = flags.name || 'world'
    this.log(`hello ${name} from ./src/commands/hello.js`)
  }
}

InitCommand.description = `Initialize your project with fume
...
Creates your fume.yml
`

InitCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = InitCommand
