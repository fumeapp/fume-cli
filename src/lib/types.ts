export interface FumeAuth {
  token: string
}

export interface FumeEnvironment {
  env: string
  web: string
  api: string
}

export interface YamlConfig {
  id: number
  nuxt?: YamlNuxtConfig
}
export interface YamlNuxtConfig {
  srcDir?: string
}

export interface Environment {
  memory: number
  domain: string | boolean
}

export interface AwsClientConfig {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  expiration: string
  region: string
}

export interface S3Config {
  code: string
  layer: string
  codePath: string
  layerPath: string
  bucket: string
  headless: string
  paths: S3ConfigPath
}
export interface S3ConfigPath {
  code: string
  layer: string
}

export enum PackageType {
  code = 'code',
  layer = 'layer',
  output = 'output',
}

export enum Mode {
  native = 'native',
  layer = 'layer',
  efs = 'efs',
  headless = 'headless',
  image = 'image',
}

export interface Size {
  pub: number
  server: number
  deps: number
  code: number
  static: number
}

export interface Project {
  id: number
  // front-end url of our project minus the domain
  url: string
  name: string
  region: string
  framework: string
  structure: string
  detail?: ProjectDetail
}

export interface ProjectDetail {
  architecture?: string
}

export interface Env {
  id: number
  team_id: number
  // front-end url of our env minus the domain
  url: string
  name: string
  detail: EnvDetail
  variables: Array<Variable>
}

export interface EnvDetail {
  hash: string
  DistributionId: string
}

export interface Variable {
  id: number
  env_id: number
  name: string
  value: string
  private: boolean
  is_synced: boolean
}

export interface Entry {
  id: number
  team_id: number
  dep_url: string
  status: string
  firstDeploy: boolean
  project: Project
  env: Env
}

export interface Inquiry {
  key: string
  name: string
}
