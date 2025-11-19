import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import assert from "node:assert";
import { loadYaml, stringifyYaml } from "../src/helpers/yaml-helper.js";
import runner from "../src/runner.js";
import { toggleLogging } from "../src/util/logger.js";

toggleLogging(process.env.LOGGING);

const ignoredWarningLevels = {
	info: true,
	low: true,
};

const exec = promisify(childProcess.exec);

const forestryStarters = loadYaml(
	fs.readFileSync("./tests/forestry-starters.yml"),
);
const netlifycmsStarters = loadYaml(
	fs.readFileSync("./tests/netlifycms-starters.yml"),
);

const clonedReposPath = "./cloned";

const readFixtures = async (destFolder) => {
	let items;
	try {
		items = await fs.promises.readdir(destFolder);
	} catch (err) {
		if (err.code !== "ENOENT") {
			throw err;
		}
		items = [];
	}

	const files = await Promise.all(
		items.map(async (pathname) => {
			const fullPath = path.join(destFolder, pathname);
			const stat = await fs.promises.stat(fullPath);

			if (stat.isFile()) {
				const contents = await (await fs.promises.readFile(fullPath)).toString(
					"utf-8",
				);
				return {
					path: pathname,
					contents,
				};
			}

			const subfiles = await readFixtures(fullPath);
			return subfiles.map((file) => ({
				...file,
				path: path.join(pathname, file.path),
			}));
		}),
	);

	return files.flat();
};

const testMigration = async (
	srcFolder,
	destFolder,
	fixturesFolder,
	{ migratorId, expectedWarnings },
) => {
	const { client, migration } = await runner.run({
		source: srcFolder,
		output: destFolder,
		quiet: true,
	});

	let fileTests = await readFixtures(fixturesFolder);
	if (fileTests.length === 0) {
		await fs.promises.cp(destFolder, fixturesFolder, { recursive: true });
		fileTests = await readFixtures(fixturesFolder);
	}

	assert.strictEqual(migration.id, migratorId);

	fileTests.forEach((fileTest) => {
		if (fileTest.path === "cloudcannon.config.yml") {
			assert.strictEqual(
				stringifyYaml(migration?.siteConfig || {}),
				fileTest.contents,
				`${fileTest.path} does not match expected output`,
			);
			return;
		}
		const newFile = client.extraFiles.find(
			(file) => file.path === fileTest.path,
		);
		assert.ok(newFile, `${fileTest.path} does not exist`);

		assert.strictEqual(
			newFile?.contents,
			fileTest.contents,
			`${fileTest.path} does not match expected output`,
		);
	});

	assert.strictEqual(client.extraFiles?.length, fileTests.length - 1);

	const noLevelWarnings = client.warnings.filter((warning) => !warning.level);
	assert.strictEqual(noLevelWarnings.length, 0, "Warnings should all have levels attached");

	const badWarnings = client.warnings
		.filter((warning) => !ignoredWarningLevels[warning.level])
		.map((warning) => ({ level: warning.level, message: warning.message }));
	assert.deepStrictEqual(badWarnings, expectedWarnings || []);
};

const runGitTest = async (owner, repo, options) => {
	const parentFolder = path.join(clonedReposPath, owner);
	await fs.promises.mkdir(parentFolder, { recursive: true });
	try {
		await fs.promises.access(path.join(parentFolder, repo));
	} catch (error) {
		if (error.code !== "ENOENT") {
			throw error;
		}

		await exec(`git clone https://github.com/${owner}/${repo}`, {
			stdio: [0, 1, 2], // we need this so node will print the command output
			cwd: parentFolder, // path to where you want to save the file
		});
	}

	const srcFolder = path.join(parentFolder, repo);
	const fixturesFolder = path.join("./fixtures/", owner, repo);
	const destFolder = path.join("./output/", owner, repo);
	try {
		await fs.promises.rm(destFolder, { recursive: true });
	} catch (error) {
		if (error.code !== "ENOENT") {
			console.warn(error);
		}
	}

	await testMigration(srcFolder, destFolder, fixturesFolder, options);
};

forestryStarters.repos.forEach((row) => {
	const [owner, name] = row.repo.split("/");
	test(`https://github.com/${row.repo}`, { timeout: 60000 }, async () =>
		runGitTest(owner, name, {
			...row,
			migratorId: "forestry",
		}));
});

netlifycmsStarters.repos.forEach((row) => {
	const [owner, name] = row.repo.split("/");
	test(`https://github.com/${row.repo}`, { timeout: 60000 }, async () =>
		runGitTest(owner, name, {
			...row,
			migratorId: "netlifycms",
		}));
});
