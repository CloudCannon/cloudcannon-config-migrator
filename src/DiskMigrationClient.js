import fs from 'fs';
import path from 'path';
import MigrationClient from './MigrationClient.js';

const getAllFiles = function (directory, result) {
	const files = fs.readdirSync(directory);

	result = result || [];

	files.forEach((file) => {
		const dirPath = path.join(directory, file);
		if (fs.statSync(dirPath).isDirectory()) {
			result = getAllFiles(dirPath, result);
		} else {
			result.push(dirPath);
		}
	});

	return result;
};

export default class DiskMigrationClient extends MigrationClient {
	constructor(directory) {
		const absolutePath = path.resolve(process.cwd(), directory);
		const files = getAllFiles(absolutePath)
			.map((filename) => filename.substring(absolutePath.length + 1)
				.replace(/\\/g, '/'));
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
