import axios from 'axios'
import yml = require('js-yaml')
import fs = require('fs')
import execa = require('execa')
import os = require('os')

export class Auth {
  async test(token: string) {
    try {
      return (await axios.get(
        'http://localhost:8000/me',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )).data.data
    } catch (error) {
      return false
    }
  }

  async name() {
    return (await execa('scutil', ['--get', 'ComputerName'])).stdout
  }

  async url() {
    const name = await this.name()
    return `http://localhost:3000/session/create?name=${name}`
  }

  save(token: string) {
    const config = {
      'http://localhost:8000/': {
        token: token,
      },
    }
    if (!fs.existsSync(`${os.homedir()}/.config`)) fs.mkdirSync(`${os.homedir()}/.config`)
    if (!fs.existsSync(`${os.homedir()}/.config/fume`)) fs.mkdirSync(`${os.homedir()}/.config/fume`)
    fs.writeFileSync(`${os.homedir()}/.config/fume/hosts.yml`, yml.safeDump(config))
    return true
  }
}
