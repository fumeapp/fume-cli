import axios, {AxiosInstance} from 'axios'
import yml = require('js-yaml')
import fs = require('fs')
import execa = require('execa')
import os = require('os')
import fse = require('fs-extra')

export class Auth {
  config: Record<string, any>

  axios: AxiosInstance

  constructor() {
    if (!fs.existsSync(`${os.homedir()}/.config/fume/auth.yml`)) {
      throw new Error('no-file')
    }
    this.config = yml.load(fs.readFileSync(`${os.homedir()}/.config/fume/auth.yml`).toString())
    this.axios = axios.create({
      baseURL: 'http://localhost:8000',
    })
    this.axios.defaults.headers.common.Authorization = `Bearer ${this.config.token}`
  }

  static async test(token: string) {
    axios.defaults.baseURL = 'http://localhost:8000'
    try {
      return (await axios.get(
        '/me',
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

  static async getName() {
    return (await execa('scutil', ['--get', 'ComputerName'])).stdout
  }

  static async tokenUrl() {
    return `http://localhost:3000/session/create?name=${await Auth.getName()}`
  }

  static async projectUrl() {
    return 'http://localhost:3000/project/create'
  }

  static save(token: string) {
    const config = {
      token: token,
    }
    if (!fs.existsSync(`${os.homedir()}/.config`)) fs.mkdirSync(`${os.homedir()}/.config`)
    if (!fs.existsSync(`${os.homedir()}/.config/fume`)) fs.mkdirSync(`${os.homedir()}/.config/fume`)
    fs.writeFileSync(`${os.homedir()}/.config/fume/auth.yml`, yml.safeDump(config))
    return true
  }

  async load() {
    if (!fs.existsSync(`${os.homedir()}/.config/fume/auth.yml`)) {
      throw new Error('No authentication file found')
    }
    this.config = yml.load(fs.readFileSync(`${os.homedir()}/.config/fume/auth.yml`).toString())
  }

  async me() {
    return (await this.axios.get('/me')).data.data
  }

  async logout() {
    try {
      await this.axios.get('/logout')
      fse.unlinkSync(`${os.homedir()}/.config/fume/auth.yml`)
    } catch (error) {
      throw new Error(error)
    }
  }
}
