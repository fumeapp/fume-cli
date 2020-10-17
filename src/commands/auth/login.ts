import {Command} from '@oclif/command'
import axios from 'axios'
import execa = require('execa')
import cli from 'cli-ux'

export default class AuthInit extends Command {
  static description = 'initialize fume authentication'

  static flags = {
  }

  static args = [{name: 'file'}]

  async run() {
    const name =  (await execa('scutil', ['--get', 'ComputerName'])).stdout
    await cli.open(`http://localhost:3000/session/create?name=${name}`)
    const token = await cli.prompt('Please paste the generated token', {type: 'hide'})
    axios.get(
      'http://localhost:8000/me',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    ).then(response => {
      console.log(response.data)
    })
  }
}
