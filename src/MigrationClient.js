import TOML from "@iarna/toml";
import NotYetImplementedError from "./errors/NotYetImplementedError.js";
import { stringifyYaml } from "./helpers/yaml-helper.js";
import cloudcannonMigration from "./migrations/cloudcannon.js";
import forestryMigration from "./migrations/forestry.js";
import netlifycmsMigration from "./migrations/netlifycms.js";

function getExtension(filename) {
	return filename.split(".").pop();
}

const configMigrations = [
	cloudcannonMigration,
	forestryMigration,
	netlifycmsMigration,
];

export default class MigrationClient {
	constructor(files) {
		this.files = files;
		this.downloadMemos = {};
		this.warnings = [];
		this.extraFiles = [];
		this.collections = {};
		this.collectionGroups = [];
		this.globalStructures = {};
		this.globalInputs = {};
		this.globalSelectData = {};
		this.dataConfig = {};
		this.schemas = {};
	}

	getConfigMigration() {
		for (let i = 0; i < configMigrations.length; i += 1) {
			const migrator = configMigrations[i];

			if (migrator.detect(this)) {
				return migrator;
			}
		}
		return null;
	}

	async generateMigration() {
		const migrator = this.getConfigMigration();
		if (migrator?.detect(this)) {
			const contents = await migrator.migrate(this);
			contents.id = migrator.id;
			return contents;
		}

		return {};
	}

	addFile(file) {
		const existingFile = this.extraFiles.find(
			(existing) => existing.path === file.path,
		);
		if (!existingFile) {
			this.extraFiles.push(file);
		} else if (existingFile.contents !== file.contents) {
			throw new Error("File collision", {
				existingFile: existingFile,
				file: file,
			});
		}
	}

	addWarning(message, options) {
		this.warnings.push({
			...options,
			message: message,
		});
	}

	async appendDataToFile(file, extraData) {
		const extension = getExtension(file);
		let contents;
		try {
			contents = await this.readFile(file);
		} catch (_readError) {
			this.addWarning(`${file} could not be opened to append new data`, {
				level: "low",
				extraData: extraData,
			});
			return;
		}

		const lines = contents.split("\n");

		let updatedContents = null;
		switch (extension) {
			case "md":
				if (lines[0] === "+++") {
					lines[1] = `${TOML.stringify(extraData)}${lines[1]}`;
				} else if (lines[0] === "---") {
					lines[1] = `${stringifyYaml(extraData)}${lines[1]}`;
				} else {
					console.warn(file, "unknown front matter format");
					break;
				}
				updatedContents = lines.join("\n");
				break;
			case "json":
				try {
					const parsed = JSON.parse(contents);

					if (contents.trim().charAt(0) !== "{") {
						this.addWarning(
							`${file} could not append inputs to a non-object json file`,
							{
								level: "medium",
								extraData: extraData,
							},
						);
					} else {
						// TODO detect original indentation
						const indentation = "\t";
						updatedContents = JSON.stringify(
							{
								...parsed,
								...extraData,
							},
							null,
							indentation,
						);
					}
				} catch (error) {
					console.warn(file, "failed to parse", error);
				}
				break;
			case "yaml":
				lines.push(stringifyYaml(extraData));
				updatedContents = lines.join("\n");
				break;
			default:
				break;
		}

		if (updatedContents) {
			this.addFile({
				path: file,
				contents: updatedContents,
			});
		} else {
			// console.log(file, extension);
		}
	}

	async appendDataToFiles(files, extraData) {
		return Promise.all(
			files.map((file) => this.appendDataToFile(file, extraData)),
		);
	}

	addUnsupportedKeysWarning(
		parentId,
		config,
		keys,
		extraOptions,
		level = "medium",
	) {
		keys.forEach((key) => {
			if (config?.[key]) {
				this.addWarning(`"${parentId}" ${key} config is not supported`, {
					...extraOptions,
					level: level,
					config: config,
				});
			}
		});
	}

	readFile() {
		throw new NotYetImplementedError("readFile");
	}
}
