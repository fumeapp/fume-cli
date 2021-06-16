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
      this.auth = yml.load(fs.readFileSync(`${os.homedir()}/.config/fume/auth.yml`).toString()) as FumeAuth
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
    } catch (error) {
      if (error.response.status === 401)
        Auth.remove()
      throw new Error(error)
    }
    Auth.remove()
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
    let attempts = 30
    while (attempts !== 0) {
      attempts--
      // eslint-disable-next-line no-await-in-loop
      const result = (await axios.get(`/probe/${inquiry.key}`))
      if (result.data && result.data.data && result.data.data.is_approved) {
        return result.data.data.token
      }
      // eslint-disable-next-line no-await-in-loop
      await this.sleep(1000)
    }
    throw new Error('Token request timed out')
  }

  static async sleep(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
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
    return `${env.web}/session/inquire/${inquiry.key}`
  }

  static async projectUrl(env: FumeEnvironment) {
    return `${env.web}/project/create`
  }

  static async billingUrl(env: FumeEnvironment) {
    return `${env.web}/billing`
  }

  static remove() {
    const file = `${os.homedir()}/.config/fume/auth.yml`
    if (fs.existsSync(file)) fse.unlinkSync(file)
  }

  static save(token: string) {
    const config: FumeAuth = {
      token: token,
    }
    if (!fs.existsSync(`${os.homedir()}/.config`)) fs.mkdirSync(`${os.homedir()}/.config`)
    if (!fs.existsSync(`${os.homedir()}/.config/fume`)) fs.mkdirSync(`${os.homedir()}/.config/fume`)
    fs.writeFileSync(`${os.homedir()}/.config/fume/auth.yml`, yml.dump(config))
    return true
  }
}
