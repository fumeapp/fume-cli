fume-cli
========

fume command line interface

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/fume-cli.svg)](https://npmjs.org/package/fume-cli)
[![Codecov](https://codecov.io/gh/fumeapp/fume-cli/branch/master/graph/badge.svg)](https://codecov.io/gh/fumeapp/fume-cli)
[![Downloads/week](https://img.shields.io/npm/dw/fume-cli.svg)](https://npmjs.org/package/fume-cli)
[![License](https://img.shields.io/npm/l/fume-cli.svg)](https://github.com/fumeapp/fume-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g fume-cli
$ fume COMMAND
running command...
$ fume (-v|--version|version)
fume-cli/0.0.36 darwin-x64 node-v14.15.1
$ fume --help [COMMAND]
USAGE
  $ fume COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`fume auth:login`](#fume-authlogin)
* [`fume auth:logout`](#fume-authlogout)
* [`fume auth:status`](#fume-authstatus)
* [`fume config`](#fume-config)
* [`fume deploy ENVIRONMENT`](#fume-deploy-environment)
* [`fume help [COMMAND]`](#fume-help-command)
* [`fume purge ENVIRONMENT`](#fume-purge-environment)

## `fume auth:login`

Login to fume

```
USAGE
  $ fume auth:login

ALIASES
  $ fume login
```

_See code: [src/commands/auth/login.ts](https://github.com/fumeapp/fume-cli/blob/v0.0.36/src/commands/auth/login.ts)_

## `fume auth:logout`

Invalidate token and remove credentials

```
USAGE
  $ fume auth:logout

ALIASES
  $ fume logout
```

_See code: [src/commands/auth/logout.ts](https://github.com/fumeapp/fume-cli/blob/v0.0.36/src/commands/auth/logout.ts)_

## `fume auth:status`

View authentication status

```
USAGE
  $ fume auth:status
```

_See code: [src/commands/auth/status.ts](https://github.com/fumeapp/fume-cli/blob/v0.0.36/src/commands/auth/status.ts)_

## `fume config`

Generate a fume.yml config

```
USAGE
  $ fume config

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/config.ts](https://github.com/fumeapp/fume-cli/blob/v0.0.36/src/commands/config.ts)_

## `fume deploy ENVIRONMENT`

Deploy an Environment

```
USAGE
  $ fume deploy ENVIRONMENT

ARGUMENTS
  ENVIRONMENT  environment to deploy to (ex: staging)

EXAMPLE
  $ fume deploy staging
```

_See code: [src/commands/deploy.ts](https://github.com/fumeapp/fume-cli/blob/v0.0.36/src/commands/deploy.ts)_

## `fume help [COMMAND]`

display help for fume

```
USAGE
  $ fume help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.1/src/commands/help.ts)_

## `fume purge ENVIRONMENT`

Purge an environment

```
USAGE
  $ fume purge ENVIRONMENT

EXAMPLE
  $ fume purge staging
```

_See code: [src/commands/purge.ts](https://github.com/fumeapp/fume-cli/blob/v0.0.36/src/commands/purge.ts)_
<!-- commandsstop -->
