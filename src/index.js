#!/usr/bin/env node

import meow from 'meow';
import runner from './runner.js';
import { toggleLogging } from './util/logger.js';

const cli = meow(`
Usage
  $ cloudcannon-config-migrator [options]
Options
  --version     Print the current version
  --ssg, -g     Define your SSG: jekyll, hugo, 11ty, eleventy or other (default)
  --source, -s  Write to a different location than .
  --output, -o  Write to a different location than source
  --quiet, -q   Disable logging

Examples
  $ cloudcannon-config-migrator --config "cloudcannon.dev.config.json"
  $ cloudcannon-config-migrator --source "public"
  $ cloudcannon-config-migrator --source "public" --output "public"
`, {
	importMeta: import.meta,
	flags: {
		config: {
			type: 'string',
			alias: 'c'
		},
		source: {
			type: 'string',
			alias: 's'
		},
		output: {
			type: 'string',
			alias: 'o'
		},
		quiet: {
			type: 'boolean',
			alias: 'q'
		}
	}
});

if (cli.flags.quiet) {
	toggleLogging(false);
}

runner.run(cli.flags, cli.pkg);
