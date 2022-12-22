import fs from 'fs';
import path from 'path';
import MigrationClient from './MigrationClient.js';

const getAllFiles = function (directory, result) {
	const files = fs.readdirSync(directory);

	result = result || [];

	files.forEach((file) => {
		if (fs.statSync(`${directory}/${file}`).isDirectory()) {
			result = getAllFiles(`${directory}/${file}`, result);
		} else {
			result.push(path.join(directory, file));
		}
	});

	return result;
};

export default class DiskMigrationClient extends MigrationClient {
	constructor(directory) {
		const absolutePath = path.resolve(process.cwd(), directory);
		const files = getAllFiles(absolutePath)
			.map((filename) => filename.substring(absolutePath.length + 1));
		super(files);
		this.downloadCounts = {};
		this.directory = directory;
	}

	readFile(filename) {
		this.downloadCounts[filename] = this.downloadCounts[filename] || 0;
		this.downloadCounts[filename] += 1;
		return fs.readFileSync(path.join(this.directory, filename)).toString('utf-8');
	}
}
