import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { stringifyYaml } from './helpers/yaml-helper.js';
import log from './util/logger.js';
import DiskMigrationClient from './DiskMigrationClient.js';

const warningLevels = {
	info: {
		prefix: '🗒️',
		color: chalk.grey,
		order: 1
	},
	low: {
		prefix: '📝',
		color: chalk.blue,
		order: 2
	},
	medium: {
		prefix: '😒',
		color: chalk.red,
		order: 3
	},
	high: {
		prefix: '⛔️',
		color: chalk.redBright,
		order: 4
	},
	critical: {
		prefix: '🏴',
		color: chalk.magentaBright,
		order: 5
	}
};

export default {
	run: async (flags) => {
		log(`⭐️ Starting ${chalk.blue('cloudcannon-config-migrator')}`);
		const client = new DiskMigrationClient(flags.source);

		const destFolder = path.resolve(process.cwd(), flags.output || flags.source);
		log(`💡 Using ${chalk.blue(client.getConfigMigration().id)} migration`);
		const migration = await client.generateMigration();

		log(chalk.blue(`Writing to: ${destFolder}`));
		async function saveToOutput(file) {
			const fullpath = path.join(destFolder, file.path);
			log(chalk.blue(`📄 New file: ${file.path}`));
			await fs.mkdir(path.dirname(fullpath), { recursive: true });
			await fs.writeFile(fullpath, file.contents);
		}

		log(chalk.bold('\nNew files:'));
		let empty = true;
		if (migration?.siteConfig) {
			empty = false;
			const configContents = stringifyYaml(migration?.siteConfig || {});
			await saveToOutput({
				path: 'cloudcannon.config.yml',
				contents: configContents
			});
		}

		if (migration?.buildConfig) {
			empty = false;
			await saveToOutput({
				path: path.join('.cloudcannon', 'initial-site-settings.json'),
				contents: JSON.stringify(migration?.buildConfig || {}, null, '\t')
			});
		}

		if (client.extraFiles.length > 0) {
			empty = false;
			await Promise.all(client.extraFiles.map(saveToOutput));
		}

		if (empty) {
			log(chalk.green('No files added'));
		}

		log(chalk.bold('\nWarnings:'));
		if (client.warnings.length) {
			client.warnings
				.sort((a, b) => warningLevels[b.level].order - warningLevels[a.level].order)
				.forEach((warning) => {
					const details = warningLevels[warning.level] || {
						prefix: warning.level,
						color: chalk.yellow
					};

					log(details.color(`${details.prefix} : ${warning.message}`));
				});
		} else {
			log(chalk.green('No warnings'));
		}

		return {
			client: client,
			migration: migration
		};
	}
};
