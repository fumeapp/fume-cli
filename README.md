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
fume-cli/0.0.1 darwin-x64 node-v12.16.3
$ fume --help [COMMAND]
USAGE
  $ fume COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`fume help [COMMAND]`](#fume-help-command)
* [`fume init`](#fume-init)

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.0.1/src/commands/help.ts)_

## `fume init`

Initialize your project with fume

```
USAGE
  $ fume init

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Creates your fume.yml
```

_See code: [src/commands/init.js](https://github.com/fumeapp/fume-cli/blob/v0.0.1/src/commands/init.js)_
<!-- commandsstop -->
