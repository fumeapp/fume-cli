import axios, {AxiosInstance} from 'axios'
import yml = require('js-yaml')
import fs = require('fs')
import execa = require('execa')
import os = require('os')
import fse = require('fs-extra')
import {FumeEnvironment, FumeAuth, Inquiry} from './types'

export class Auth {
  auth: FumeAuth

  axios: AxiosInstance

  foundEnv: boolean | undefined

  env: FumeEnvironment

  constructor(env: FumeEnvironment) {
    this.env = env

    if (process.env.FUME_TOKEN && process.env.FUME_TOKEN.length === 64) {
      this.foundEnv = true
      this.auth = {
        token: process.env.FUME_TOKEN,
      }
    } else {
      if (!fs.existsSync(`${os.homedir()}/.config/fume/auth.yml`)) {
        throw new Error('no-auth')
      }
      this.auth = yml.load(fs.readFileSync(`${os.homedir()}/.config/fume/auth.yml`).toString())
    }

    this.axios = axios.create({
      baseURL: this.env.api,
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

  static async inquire(env: FumeEnvironment) {
    axios.defaults.baseURL = env.api
    const data = {
      name: await this.getName(),
    }
    return (await axios.post('/inquiry', data)).data.data
  }

  static async probe(env: FumeEnvironment, inquiry: Inquiry) {
    axios.defaults.baseURL = env.api
    return (await axios.get(`/probe/${inquiry.hash}`)).data.data
  }

  static async test(env: FumeEnvironment, token: string) {
    axios.defaults.baseURL = env.api
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
    if (['win32', 'linux', 'openbsd'].includes(process.platform))
      return (await execa('hostname')).stdout
    if (process.platform === 'darwin')
      return (await execa('scutil', ['--get', 'ComputerName'])).stdout
    return ''
  }

  static async tokenUrl(env: FumeEnvironment, inquiry: Inquiry) {
    return `${env.web}/session/approve/${inquiry.hash}`
  }

  static async projectUrl(env: FumeEnvironment) {
    return `${env.web}/project/create`
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
