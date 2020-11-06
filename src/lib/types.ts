export interface FumeAuth {
  token: string;
}

export interface FumeEnvironment {
  env: string;
  web: string;
  api: string;
}

export interface YamlConfig {
  id: number;
  /*
  team_id: number;
  name: string;
  environments: Partial<Record<'staging' | 'production', Environment>>;
 */
}

export interface Environment {
  memory: number;
  domain: string | boolean;
}

export interface AwsClientConfig {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  region: string;
}

export interface S3Config {
  file: string;
  path: string;
  bucket: string;
  headless: string;
}

export interface Project {
  id: number;
  region: string;
  structure: string;
}

export interface Entry {
  status: string;
  id: number;
  team_id: number;
  project: Project;
}
