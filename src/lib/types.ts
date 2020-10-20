export interface YamlConfig {
  id: number;
  team_id: number;
  name: string;
  environments: Environment;
}

export interface Entry {
  status: string;
  id: number;
}

export interface Environment {
  memory: number;
  domain: string | boolean;
}

export interface Project {
  id: number;
  region: string;
}

export interface AwsClientConfig {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  region: string;
}
