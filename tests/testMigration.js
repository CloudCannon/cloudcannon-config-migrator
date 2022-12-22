// eslint-disable-next-line import/no-unresolved
import test from 'ava';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import childProcess from 'child_process';
import { loadYaml } from '../src/helpers/yaml-helper.js';
import runner from '../src/runner.js';
import { toggleLogging } from '../src/util/logger.js';

toggleLogging(false);

const ignoredWarningLevels = {
	info: true,
	low: true
};

const exec = promisify(childProcess.exec);

const forestryStarters = loadYaml(fs.readFileSync('./tests/forestry-starters.yml'));
const netlifycmsStarters = loadYaml(fs.readFileSync('./tests/netlifycms-starters.yml'));

const clonedReposPath = './cloned';

const testMigration = async (t, srcFolder, destFolder, {
	fileTests, migratorId, expectedWarnings
}) => {
	const { client, migration } = await runner.run({
		source: srcFolder,
		output: destFolder,
		quiet: true
	});

	t.is(migration.id, migratorId);

	// t.is(client.extraFiles?.length, expectedFiles)
	fileTests.forEach((fileTest) => {
		const newFile = client.extraFiles.find((file) => file.path === fileTest.path);
		t.assert(newFile, `${fileTest.path} does not exist`);

		t.is(newFile?.contents, fileTest.contents, `${fileTest.path} does not match expected output`);
	});

	const noLevelWarnings = client.warnings.filter((warning) => !warning.level);
	t.is(noLevelWarnings.length, 0, 'Warnings should all have levels attached');

	const badWarnings = client.warnings.filter((warning) => !ignoredWarningLevels[warning.level]);
	t.deepEqual(badWarnings, expectedWarnings || []);
};

const runGitTest = async (t, owner, repo, options) => {
	t.timeout(60000);
	const parentFolder = path.join(clonedReposPath, owner);
	await fs.promises.mkdir(parentFolder, { recursive: true });
	try {
		await fs.promises.access(path.join(parentFolder, repo));
	} catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}

		await exec(`git clone https://github.com/${owner}/${repo}`, {
			stdio: [0, 1, 2], // we need this so node will print the command output
			cwd: parentFolder // path to where you want to save the file
		});
	}

	const srcFolder = path.join(parentFolder, repo);
	const destFolder = path.join('./output/', owner, repo);
	try {
		await fs.promises.rm(destFolder, { recursive: true });
	} catch (error) {
		if (error.code !== 'ENOENT') {
			console.warn(error);
		}
	}

	await fs.promises.cp(srcFolder, destFolder, { recursive: true });

	return testMigration(t, srcFolder, destFolder, options);
};

forestryStarters.repos.forEach((row) => {
	const [owner, name] = row.repo.split('/');
	test(`https://github.com/${row.repo}`, async (t) => runGitTest(t, owner, name, {
		...row,
		fileTests: [],
		migratorId: 'forestry'
	}));
});

netlifycmsStarters.repos.forEach((row) => {
	const [owner, name] = row.repo.split('/');
	test(`https://github.com/${row.repo}`, async (t) => runGitTest(t, owner, name, {
		...row,
		fileTests: [],
		migratorId: 'netlifycms'
	}));
});
