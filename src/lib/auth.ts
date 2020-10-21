import axios, {AxiosInstance} from 'axios'
import yml = require('js-yaml')
import fs = require('fs')
import execa = require('execa')
import os = require('os')
import fse = require('fs-extra')
import {FumeEnvironment, FumeAuth} from './types'

export class Auth {
  auth: FumeAuth

  axios: AxiosInstance

  env: FumeEnvironment

  constructor(env: FumeEnvironment) {
    this.env = env

    if (!fs.existsSync(`${os.homedir()}/.config/fume/auth.yml`)) {
      throw new Error('no-file')
    }
    this.auth = yml.load(fs.readFileSync(`${os.homedir()}/.config/fume/auth.yml`).toString())

    this.axios = axios.create({
      baseURL: this.env.api_url,
    })
    this.axios.defaults.headers.common.Authorization = `Bearer ${this.auth.token}`
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

  static async test(env: FumeEnvironment, token: string) {
    axios.defaults.baseURL = env.api_url
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

  static async tokenUrl(env: FumeEnvironment) {
    return `${env.web_url}/session/create?name=${await Auth.getName()}`
  }

  static async projectUrl(env: FumeEnvironment) {
    return `${env.web_url}/project/create`
  }

  static save(env: FumeEnvironment, token: string) {
    const config: FumeAuth = {
      token: token,
    }
    if (!fs.existsSync(`${os.homedir()}/.config`)) fs.mkdirSync(`${os.homedir()}/.config`)
    if (!fs.existsSync(`${os.homedir()}/.config/fume`)) fs.mkdirSync(`${os.homedir()}/.config/fume`)
    fs.writeFileSync(`${os.homedir()}/.config/fume/auth.yml`, yml.safeDump(config))
    return true
  }
}
