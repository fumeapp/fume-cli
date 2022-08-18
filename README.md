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
$ fume (--version)
fume-cli/0.2.8 darwin-arm64 node-v16.13.1
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
* [`fume deploy [ENVIRONMENT]`](#fume-deploy-environment)
* [`fume help [COMMAND]`](#fume-help-command)
* [`fume login`](#fume-login)
* [`fume logout`](#fume-logout)
* [`fume plugins`](#fume-plugins)
* [`fume plugins:install PLUGIN...`](#fume-pluginsinstall-plugin)
* [`fume plugins:inspect PLUGIN...`](#fume-pluginsinspect-plugin)
* [`fume plugins:install PLUGIN...`](#fume-pluginsinstall-plugin-1)
* [`fume plugins:link PLUGIN`](#fume-pluginslink-plugin)
* [`fume plugins:uninstall PLUGIN...`](#fume-pluginsuninstall-plugin)
* [`fume plugins:uninstall PLUGIN...`](#fume-pluginsuninstall-plugin-1)
* [`fume plugins:uninstall PLUGIN...`](#fume-pluginsuninstall-plugin-2)
* [`fume plugins:update`](#fume-pluginsupdate)
* [`fume status`](#fume-status)

## `fume auth:login`

Login to fume

```
USAGE
  $ fume auth:login

DESCRIPTION
  Login to fume

ALIASES
  $ fume login
```

_See code: [dist/commands/auth/login.ts](https://github.com/fumeapp/fume-cli/blob/v0.2.8/dist/commands/auth/login.ts)_

## `fume auth:logout`

Invalidate token and remove credentials

```
USAGE
  $ fume auth:logout

DESCRIPTION
  Invalidate token and remove credentials

ALIASES
  $ fume logout
```

_See code: [dist/commands/auth/logout.ts](https://github.com/fumeapp/fume-cli/blob/v0.2.8/dist/commands/auth/logout.ts)_

## `fume auth:status`

View authentication status

```
USAGE
  $ fume auth:status

DESCRIPTION
  View authentication status

ALIASES
  $ fume status
```

_See code: [dist/commands/auth/status.ts](https://github.com/fumeapp/fume-cli/blob/v0.2.8/dist/commands/auth/status.ts)_

## `fume config`

Generate a fume.yml config

```
USAGE
  $ fume config [-h]

FLAGS
  -h, --help  Show CLI help.

DESCRIPTION
  Generate a fume.yml config
```

_See code: [dist/commands/config.ts](https://github.com/fumeapp/fume-cli/blob/v0.2.8/dist/commands/config.ts)_

## `fume deploy [ENVIRONMENT]`

Deploy an Environment

```
USAGE
  $ fume deploy [ENVIRONMENT] [-h]

ARGUMENTS
  ENVIRONMENT  environment to deploy to (ex: staging)

FLAGS
  -h, --help  Show CLI help.

DESCRIPTION
  Deploy an Environment

EXAMPLES
  $ fume deploy staging
```

_See code: [dist/commands/deploy.ts](https://github.com/fumeapp/fume-cli/blob/v0.2.8/dist/commands/deploy.ts)_

## `fume help [COMMAND]`

Display help for fume.

```
USAGE
  $ fume help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for fume.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.12/src/commands/help.ts)_

## `fume login`

Login to fume

```
USAGE
  $ fume login

DESCRIPTION
  Login to fume

ALIASES
  $ fume login
```

## `fume logout`

Invalidate token and remove credentials

```
USAGE
  $ fume logout

DESCRIPTION
  Invalidate token and remove credentials

ALIASES
  $ fume logout
```

## `fume plugins`

List installed plugins.

```
USAGE
  $ fume plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ fume plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/index.ts)_

## `fume plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ fume plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ fume plugins:add

EXAMPLES
  $ fume plugins:install myplugin 

  $ fume plugins:install https://github.com/someuser/someplugin

  $ fume plugins:install someuser/someplugin
```

## `fume plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ fume plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ fume plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/inspect.ts)_

## `fume plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ fume plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ fume plugins:add

EXAMPLES
  $ fume plugins:install myplugin 

  $ fume plugins:install https://github.com/someuser/someplugin

  $ fume plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/install.ts)_

## `fume plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ fume plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.

EXAMPLES
  $ fume plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/link.ts)_

## `fume plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ fume plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ fume plugins:unlink
  $ fume plugins:remove
```

## `fume plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ fume plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ fume plugins:unlink
  $ fume plugins:remove
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/uninstall.ts)_

## `fume plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ fume plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ fume plugins:unlink
  $ fume plugins:remove
```

## `fume plugins:update`

Update installed plugins.

```
USAGE
  $ fume plugins:update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/update.ts)_

## `fume status`

View authentication status

```
USAGE
  $ fume status

DESCRIPTION
  View authentication status

ALIASES
  $ fume status
```
<!-- commandsstop -->
