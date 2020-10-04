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
fume-cli/0.0.1 darwin-x64 node-v12.18.0
$ fume --help [COMMAND]
USAGE
  $ fume COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`fume deploy ENVIRONMENT`](#fume-deploy-environment)
* [`fume help [COMMAND]`](#fume-help-command)
* [`fume init`](#fume-init)
* [`fume purge [FILE]`](#fume-purge-file)

## `fume deploy ENVIRONMENT`

Deploy an Environment

```
USAGE
  $ fume deploy ENVIRONMENT

EXAMPLE
  $ fume deploy staging
```

_See code: [src/commands/deploy.ts](https://github.com/fumeapp/fume-cli/blob/v0.0.1/src/commands/deploy.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.0/src/commands/help.ts)_

## `fume init`

Initialize your fume project

```
USAGE
  $ fume init

OPTIONS
  --name=name  Project Name (sets default environments)
```

_See code: [src/commands/init.ts](https://github.com/fumeapp/fume-cli/blob/v0.0.1/src/commands/init.ts)_

## `fume purge [FILE]`

describe the command here

```
USAGE
  $ fume purge [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print
```

_See code: [src/commands/purge.ts](https://github.com/fumeapp/fume-cli/blob/v0.0.1/src/commands/purge.ts)_
<!-- commandsstop -->
