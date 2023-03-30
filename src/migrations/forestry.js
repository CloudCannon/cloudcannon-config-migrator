/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
import slugify from 'slugify';
import globToRegExp from 'glob-to-regexp';
import { loadYaml, stringifyYaml } from '../helpers/yaml-helper.js';
import convertSettings from '../helpers/conversions-helper.js';
import reduceInputsConfig from '../helpers/reduce-inputs-config.js';

function getExtension(filename) {
	return filename.split('.').pop().toLowerCase();
}

function checkEmpty(obj) {
	return obj && Object.keys(obj).length > 0
		? obj
		: undefined;
}

const configFileName = '.forestry/settings.yml';
const supportedExtensions = {
	md: true, json: true, yaml: true, yml: true, html: true, htm: true, toml: true
};

function getEnabledEditors(extension, hideBody) {
	if (extension === 'html' || extension === 'htm') {
		return ['visual', 'data'];
	}

	if (hideBody) {
		return ['data'];
	}

	return ['content'];
}

const supportedExtensionsFilter = (filename) => {
	const extension = getExtension(filename);

	supportedExtensions[extension] = supportedExtensions[extension] || false;
	return supportedExtensions[extension];
};

function getSSG(settings) {
	if (settings.build?.instant_preview_command?.includes('hugo')) {
		return 'hugo';
	}

	return 'unknown';
}

function getCollectionsReferenced(pages, collections) {
	const collectionsReferenced = {};
	const collectionKeys = Object.keys(collections);
	pages.forEach((filepath) => {
		if (filepath.endsWith('/_index.md')) {
			return;
		}

		const collectionMatches = [];
		collectionKeys.forEach((collectionKey) => {
			if (filepath.startsWith(collections[collectionKey].path)) {
				collectionMatches.push(collectionKey);
			}
		});

		let bestCollection = null;
		if (collectionMatches.length === 0) {
			return;
		}

		bestCollection = collectionMatches.reduce((currentBest, key) => {
			if (collections[key].path.length > collections[currentBest].path.length) {
				return key;
			}
			return currentBest;
		}, collectionMatches[0]);

		collectionsReferenced[bestCollection] = collectionsReferenced[bestCollection] || 0;
		collectionsReferenced[bestCollection] += 1;
	});

	return Object.keys(collectionsReferenced);
}

function formatStructuresObject(structuresObj) {
	const structures = Object.values(structuresObj);
	if (structures.length === 0) {
		return null;
	}

	return structures.reduce((memo, def) => {
		memo[def.name] = {
			id_key: def.id_key,
			values: def.values
		};
		return memo;
	}, {});
}

function getUnclashedConfigName(initialName, configObj) {
	let name = initialName;
	let clashCount = 0;
	let clashingStructure;
	const configs = Object.values(configObj);
	do {
		clashingStructure = configs.find((def) => def.name === name);
		if (clashingStructure) {
			clashCount += 1;
			name = `${initialName}-${clashCount}`;
		}
	} while (clashingStructure);

	return name;
}

async function loadTemplate(migrator, templateName) {
	// TODO support subpaths on .forestry
	const templatePath = `.forestry/front_matter/templates/${templateName}.yml`;
	return loadYaml(await migrator.readFile(templatePath));
}

function arrayEquals(first, second) {
	return first.sort().join(',') === second.sort().join(',');
}

async function readSource(field, safeConfigPath, templateName, migrator) {
	let options;
	if (field.config?.source?.type === 'simple') {
		let selectName = field.name;
		if (migrator.globalSelectData[selectName]) {
			if (!arrayEquals(migrator.globalSelectData[selectName], field.config?.options)) {
				selectName = `${templateName}-${selectName}`;
			}
		}
		migrator.globalSelectData[selectName] = field.config?.options;
		return {
			values: `_select_data.${selectName}`
		};
	}
	if (field.config?.source?.type === 'pages') {
		return {
			values: `collections.${field.config?.source?.section}`,
			value_key: 'content_path'
		};
	}

	let dataName;
	if (field.config?.source?.type === 'documents') {
		const subkey = field.config?.source?.path || field.config?.source?.section || '';
		const filename = (field.config?.source?.file || '')
			.replace(/^.*\//, '')
			.replace(/\.[a-z]+$/, '')
			.replace('forestry', '');

		dataName = filename !== subkey
			? [filename, subkey].join(' ').trim().replace(/ +/g, '_')
			: filename;

		if (subkey) {
			const dataFileContents = await loadYaml(await migrator.readFile(field.config?.source?.file));
			migrator.addWarning('select data on a subkey is not supported: translating to simple select', {
				safeConfigPath: safeConfigPath,
				level: 'info'
			});

			let selectName = dataName;
			if (migrator.globalSelectData[selectName]) {
				if (!arrayEquals(migrator.globalSelectData[selectName], dataFileContents[subkey])) {
					selectName = `${templateName}-${selectName}`;
				}
			}

			migrator.globalSelectData[selectName] = dataFileContents[subkey];
			return {
				values: `_select_data.${selectName}`
			};
		}
	}

	migrator.addWarning(`${field.config?.source?.type} select source not yet implemented ${safeConfigPath} ${dataName}`, {
		safeConfigPath: safeConfigPath,
		level: 'critical'
	});

	return options;
}
async function processFields(templateName, migrator, fields, parentConfigPath) {
	const contents = {};
	let inputConfig = {};

	for (let i = 0; i < fields.length; i += 1) {
		const field = fields[i];
		const safeConfigPath = parentConfigPath
			? `${parentConfigPath}.${field.name}`
			: field.name;
		let value = field.default ?? null;
		let type = null;
		let options;
		const extraParams = {};

		try {
			switch (field.type) {
			case 'text':
				value = value || '';
				type = 'text';
				break;
			case 'boolean':
				type = 'switch';
				value = !!value;
				break;
			case 'color': {
				const colorFormat = field.config?.color_format?.toLowerCase();
				if (colorFormat && colorFormat !== 'rgb' && colorFormat !== 'hex') {
					throw new Error(`${safeConfigPath}: Unknown color format ${colorFormat}`);
				}
				type = 'color';
				options = {
					format: colorFormat.toLowerCase()
				};
				break;
			}
			case 'datetime':
				type = field.type;
				value = null;

				if (field.config?.export_format) {
					if (field.config?.export_format === 'YYYY-MM-DD') {
						type = 'date';
					} else {
						migrator.addWarning(`Unsupported export date format: ${field.config?.export_format}`, {
							safeConfigPath: safeConfigPath,
							level: 'medium'
						});
					}
				}

				if (field.default === 'now') {
					value = null;
					extraParams.instance_value = 'NOW';
				}
				break;
			case 'number':
				type = field.type;
				if (Number.isInteger(field.config?.min)
                        && Number.isInteger(field.config?.max)
                        && Number.isInteger(field.config?.step)) {
					type = 'range';
					options = {
						min: field.config.min,
						max: field.config.max,
						step: field.config.step
					};
				}
				break;
			case 'textarea':
				value = value || '';
				if (field.wysiwyg || field.config?.wysiwyg) {
					if (field.config?.schema?.format && field.config?.schema?.format === 'markdown') {
						type = 'markdown';
					} else {
						type = 'html';
					}
					break;
				}
				type = field.type;
				break;
			case 'file':
				type = field.type;
				migrator.addUnsupportedKeysWarning(field.type, field.config, [
					'maxSize'
				], { safeConfigPath: safeConfigPath }, 'low');
				// Unsupported fields:
				// config: { maxSize: 64 },
				break;
			case 'include': {
				const templateKey = `template-${field.template}`;
				if (!migrator.downloadMemos[templateKey]) {
					migrator.downloadMemos[templateKey] = (async () => {
						const templateContents = await loadTemplate(migrator, field.template);
						const childField = await processFields(field.template, migrator, templateContents.fields, '===');
						return childField;
					})();
				}
				const childField = await migrator.downloadMemos[templateKey];

				if (childField.inputConfig) {
					Object.keys(childField.inputConfig).forEach((key) => {
						const newKey = parentConfigPath
							? key.replace(/===/, parentConfigPath)
							: key.replace(/===\./, '');

						inputConfig[newKey] = childField.inputConfig[key];
					});
				}

				Object.keys(childField.contents).forEach((key) => {
					contents[key] = JSON.parse(JSON.stringify(childField.contents[key]));
				});
				break;
			}
			case 'tag_list':
				type = 'multiselect';
				options = {
					values: [],
					allow_create: true,
					allow_empty: true
				};
				break;
			case 'image_gallery':
				type = 'array';
				value = [];
				inputConfig[`${safeConfigPath}[*]`] = {
					type: 'image'
				};
				break;
			case 'select':
				type = 'select';
				if (Array.isArray(value)) {
					type = 'multiselect';
				}
				options = await readSource(field, safeConfigPath, templateName, migrator);
				break;
			case 'list':
				if (!field.config?.use_select) {
					type = 'array';
					value = [];
					break;
				}

				type = 'multiselect';
				value = value || [];
				options = await readSource(field, safeConfigPath, templateName, migrator);
				break;
			case 'blocks': {
				type = 'array';
				value = [];

				const structuresId = field.template_types.join();
				if (!migrator.globalStructures[structuresId]) {
					migrator.globalStructures[structuresId] = {
						id_key: 'template',
						name: getUnclashedConfigName(field.name, migrator.globalStructures),
						pendingTemplates: {
							templateName,
							templates: field.template_types
						}
					};
				}

				options = {
					structures: `_structures.${migrator.globalStructures[structuresId].name}`
				};
				break;
			}
			case 'field_group_list': {
				type = 'array';
				value = [];

				const structuresId = field.fields.map((entry) => entry.name).join(',');
				if (!migrator.globalStructures[structuresId]) {
					migrator.globalStructures[structuresId] = {
						name: getUnclashedConfigName(field.name, migrator.globalStructures)
					};
					const childField = await processFields(templateName, migrator, field.fields, null);
					const structuresDef = [
						{
							value: childField.contents,
							_inputs: childField.inputConfig
						}
					];

					migrator.globalStructures[structuresId].values = structuresDef;
				}

				options = {
					structures: `_structures.${migrator.globalStructures[structuresId].name}`
				};
				break;
			}
			case 'field_group': {
				const childField = await processFields(
					templateName, migrator, field.fields, safeConfigPath
				);

				contents[field.name] = childField.contents;
				inputConfig = {
					...inputConfig,
					...childField.inputConfig
				};
				break;
			}
			default:
				break;
			}
		} catch (error) {
			console.error('Failed to parse field', field, error);
			throw error;
		}

		if (type) {
			contents[field.name] = value;
			inputConfig[safeConfigPath] = {
				...extraParams,
				hidden: field.hidden || undefined,
				type: type,
				label: field.label,
				comment: field.description,
				options: options
			};
		}
	}

	return {
		contents: contents,
		inputConfig: reduceInputsConfig(inputConfig)
	};
}

async function buildSchema(migrator, templatePath, extension) {
	extension = extension || 'md';
	const memoKey = `${templatePath}-${extension}`;
	if (!migrator.schemas[memoKey]) {
		migrator.schemas[memoKey] = new Promise(async (resolve, reject) => {
			try {
				const templateName = templatePath
					.replace(/^.forestry\/front_matter\/templates\//, '')
					.replace(/\.yml$/, '');
				const templateContents = loadYaml(await migrator.readFile(templatePath));
				const filePath = `.cloudcannon/schemas/${templateName}.${extension}`;
				const schema = await processFields(templateName, migrator, templateContents.fields, '$');

				const schemaFile = {
					path: filePath,
					contents: `---\n${stringifyYaml(schema.contents)}---`.replace(/: null/img, ':')
				};

				const schemaDef = {
					path: filePath,
					name: templateContents.label,
					_enabled_editors: getEnabledEditors(extension, templateContents.hide_body),
					_inputs: schema.inputConfig
				};

				if (templateContents.display_field) {
					schemaDef.text_key = templateContents.display_field;
				}

				resolve({
					name: templateName,
					def: schemaDef,
					file: schemaFile
				});
			} catch (error) {
				reject(error);
			}
		});
	}
	return migrator.schemas[memoKey];
}

// https://forestry.io/docs/settings/config-files/
const conversions = {
	new_page_extension: {
		description: 'Allows you to configure whether new pages are created as .md or .html files.',
		ignoredReason: 'This setting is set per collection item instead'
	},
	auto_deploy: {
		description: 'Allows you to configure if publishing should be triggered when a commit is made to the source repository.',
		ignoredReason: 'CloudCannon always builds, contact support about pinned builds.'
	},
	admin_path: {
		description: 'Allows you to configure the path where the Remote Admin will be deployed.',
		ignoredReason: 'CloudCannon has no remote admin.'
	},
	webhook_url: {
		description: 'Allows you to provide a webhook to be triggered when events occur in Forestry.',
		ignoredReason: 'Webhooks are achieved using postbuild scripts'
	},
	version: {
		description: 'This allows you to configure the version of Hugo your site uses. This is limited to the latest versions of Hugo supported by Forestry.',
		ignoredReason: 'CloudCannon has a full CI with configurable Hugo versions.'
	},
	frontmatter_file_url_template: {
		name: 'Front Matter File URL',
		description: 'Allows you to configure the path that is set when adding images to Front Matter Fields. Note: this value is set at upload time.'
	},
	body_file_url_template: {
		name: 'Body File URL Template',
		description: 'Allows you to configure the path that is used when adding images to the body of a page. Note: this value is set at upload time'
	},
	front_matter_path: {
		ignoredReason: 'Not listed in Forestry documentation.'
	},
	use_front_matter_path: {
		ignoredReason: 'Not listed in Forestry documentation.'
	},
	file_template: {
		ignoredReason: 'Not listed in Forestry documentation.'
	},
	build: {
		ignoredReason: 'Not listed in Forestry documentation.'
	},
	public_path: {
		description: 'The public_path option specifies the folder path where the files uploaded by the media library will be accessed.',
		usedInternally: true
	},
	upload_dir: {
		description: 'Allows you to configure the path where media assets are uploaded',
		converter: (uploadDir, migrator, forestrySettings) => {
			if (uploadDir.indexOf(':') >= 0) {
				migrator.addWarning('upload_dir key contains placeholders which are not migrated automatically', {
					level: 'high'
				});
			}

			const publicPath = (forestrySettings.public_path || '').replace(/^\/+/, '');
			if (!uploadDir.endsWith(publicPath)) {
				migrator.addWarning('upload_dir does not share a path with public_path', {
					publicPath,
					uploadDir,
					level: 'critical'
				});

				return;
			}

			return {
				config: {
					paths: {
						static: uploadDir.substring(0, uploadDir.length - publicPath.length),
						uploads: publicPath.replace(/^\/+/, '')
					}
				}
			};
		}
	},

	// https://forestry.io/docs/settings/content-sections/
	sections: {
		converter: async (sections, migrator) => {
			function addCollectionGroup(heading) {
				migrator.collectionGroups.push({
					heading: heading,
					collections: []
				});
			}

			async function addCollection(section) {
				if (migrator.collectionGroups.length === 0) {
					addCollectionGroup('Content');
				}

				if (!('path' in section)) {
					migrator.addWarning(`Section config 'path' missing on "${section.label}"`, {
						level: 'critical'
					});
					return;
				}

				const id = slugify(section.label).toLowerCase();
				migrator.collections[id] = {
					name: section.label,
					path: section.path
				};

				if (section.create === 'none') {
					migrator.collections[id].add_options = [];
				}

				if (section.templates && section.templates.length > 0) {
					for (let index = 0; index < section.templates.length; index += 1) {
						const templateName = section.templates[index];
						const templatePath = `.forestry/front_matter/templates/${templateName}.yml`;
						try {
							const schema = await buildSchema(migrator, templatePath, section.new_doc_ext);
							const templateId = index === 0
								? 'default'
								: schema.name;

							migrator.addFile(schema.file);
							migrator.collections[id].schemas = {};

							migrator.collections[id].schemas[templateId] = schema.def;
						} catch (schemaErr) {
							migrator.addWarning(`Section template "${templateName}" not found for section "${section.label}" at ${templatePath}`, {
								level: 'medium'
							});
						}
					}
				}

				const match = section.match || '**/*';
				const regex = globToRegExp(match, { globstar: true, extended: true });
				const filesInPath = migrator.files.filter((filename) => filename.startsWith(section.path))
					.filter(supportedExtensionsFilter)
					.map((filename) => filename.substring(section.path.length).replace(/^\/+/, ''))
					.filter((filename) => {
						const parts = filename.split('/');
						const firstChar = filename.charAt(0);

						return parts.length === 1 || (firstChar !== '.' && firstChar !== '_');
					});

				let filesMatched = filesInPath.filter((filename) => regex.test(filename));
				let filesNotMatched = filesInPath.filter((filename) => !regex.test(filename));
				let excludedFiles = [];
				if (section.exclude) {
					const excludeRegex = globToRegExp(section.exclude, { globstar: true });

					excludedFiles = filesInPath.filter((filename) => !excludeRegex.test(filename));
					if (excludedFiles.length === 0) {
						migrator.addWarning('Section config \'exclude\' ignored as it had zero matches', {
							level: 'info'
						});
					}

					filesMatched = filesMatched.filter((filename) => !excludeRegex.test(filename));
					filesNotMatched = filesInPath.filter(
						(filename) => !regex.test(filename) && excludeRegex.test(filename)
					);
				}

				if (filesNotMatched.length > 0) {
					migrator.collections[id].filter = {
						exclude: filesNotMatched
					};
				} else {
					const excluded = filesInPath.filter((filename) => filename !== '_index.md' && !filesMatched.includes(filename));
					if (excluded.length > 0) {
						migrator.collections[id].filter = {
							exclude: excluded
						};
					}
				}

				if (filesMatched.length === 0) {
					migrator.addWarning(`Section "${section.label}" found nothing using match and exclude`, {
						section: section,
						filesInPath: filesInPath,
						filesNotMatched: filesNotMatched,
						level: 'low'
					});
				}

				if (section.read_only) {
					migrator.addWarning(`Section config 'read_only' unsupported on "${section.label}"`, {
						level: 'medium'
					});
				}

				migrator.collectionGroups[migrator.collectionGroups.length - 1].collections.push(id);
			}

			const jeykllConfigFile = migrator.files.find((filename) => filename.replace(/.*\//, '') === '_config.yml') || '_config.yml';
			const jekyllConfigPathParts = jeykllConfigFile.split('/');
			jekyllConfigPathParts.pop();
			const jekyllConfigPath = jekyllConfigPathParts.join('/');
			for (let i = 0; i < sections.length; i += 1) {
				const section = sections[i];

				// directory is the default type
				if (!section.type || section.type === 'directory') {
					await addCollection(section);
				} else if (section.type === 'jekyll-posts') {
					await addCollection({
						...section,
						type: 'directory',
						path: `${jekyllConfigPath}_posts`
					});
				} else if (section.type === 'jekyll-pages') {
					await addCollection({
						...section,
						type: 'directory',
						path: jekyllConfigPath
					});
				} else if (section.type === 'heading') {
					addCollectionGroup(section.label);
				} else if (section.type === 'document') {
					if (section.read_only) {
						migrator.addWarning(`Section "${section.label}" is a read_only document which is unsupported and not on our roadmap`, {
							section: section,
							level: 'low'
						});
					} else {
						migrator.addWarning(`Section "${section.label}" is a document which is unsupported`, {
							section: section,
							level: 'low'
						});
					}
				} else {
					migrator.addWarning(`Section "${section.label}" has unknown type ${section.type}`, {
						section: section,
						level: 'high'
					});
				}
			}

			const filteredGroups = migrator.collectionGroups
				.filter((group) => group.collections.length > 0);

			return {
				config: {
					collections_config: migrator.collections,
					collection_groups: filteredGroups.length > 0
						? filteredGroups
						: undefined
				}
			};
		}
	}
};

async function fetchAllPendingStructures(migrator) {
	let hasPendingTemplates = false;
	const structureKeys = Object.keys(migrator.globalStructures);

	for (let y = 0; y < structureKeys.length; y += 1) {
		const key = structureKeys[y];
		const value = migrator.globalStructures[key];

		if (value.pendingTemplates) {
			hasPendingTemplates = true;

			const structuresDef = [];
			for (let j = 0; j < value.pendingTemplates.templates.length; j += 1) {
				const template = value.pendingTemplates.templates[j];
				const templateContents = await loadTemplate(migrator, template);

				const childField = await processFields(
					template, migrator, templateContents.fields, null
				);

				structuresDef.push({
					label: templateContents.label,
					value: {
						template: template,
						...childField.contents
					},
					text_key: templateContents.display_field,
					_inputs: childField.inputConfig
				});
			}

			delete value.pendingTemplates;
			value.values = structuresDef;
		}
	}

	if (hasPendingTemplates) {
		return fetchAllPendingStructures(migrator);
	}
}

function detect(migrator) {
	// TODO this could exist within a subfolder
	return migrator.files.includes(configFileName);
}

async function migrate(migrator) {
	const forestrySettings = loadYaml(await migrator.readFile(configFileName));

	const { siteConfig } = await convertSettings(forestrySettings, conversions, migrator);

	siteConfig.collections_config = siteConfig.collections_config || {};

	const ssg = getSSG(forestrySettings);
	if (ssg === 'hugo') {
		siteConfig.collections_config.default_hugo_pages = {
			name: 'Pages',
			path: 'content/'
		};
	}

	// TODO support subpaths on .forestry
	await Promise.all(migrator.files.map(async (filePath) => {
		if (!filePath.startsWith('.forestry/front_matter/templates/')) {
			return null;
		}

		const templateContents = loadYaml(await migrator.readFile(filePath));

		if (!templateContents.pages || templateContents.pages.length === 0) {
			return null;
		}

		const schemaDef = await buildSchema(migrator, filePath);
		const collectionsReferenced = getCollectionsReferenced(
			templateContents.pages,
			siteConfig.collections_config
		);
		let schemaId = schemaDef.name;
		if (collectionsReferenced.length > 0) {
			collectionsReferenced.forEach((key) => {
				const collection = siteConfig.collections_config[key];

				collection.schemas = collection.schemas || {};
				const existingId = Object.keys(collection.schemas)
					.find((schemaKey) => collection.schemas[schemaKey].path === schemaDef.def.path);

				if (existingId) {
					schemaId = existingId;
				} else {
					collection.schemas[schemaId] = schemaDef.def;
				}
			});

			migrator.addFile(schemaDef.file);

			if (schemaId !== 'default') {
				await migrator.appendDataToFiles(templateContents.pages, {
					_schema: schemaId
				});
			}
		} else if (!(ssg === 'hugo' && templateContents.pages[0] === 'config.toml')) {
			const options = {
				_inputs: schemaDef.def._inputs,
				_enabled_editors: schemaDef.def.__enabled_editors
			};

			if (options.__enabled_editors || options._inputs) {
				await migrator.appendDataToFiles(templateContents.pages, options);
			}
		}
	}));

	await fetchAllPendingStructures(migrator);

	siteConfig.data_config = checkEmpty(migrator.dataConfig);
	siteConfig._select_data = checkEmpty(migrator.globalSelectData);
	siteConfig._structures = checkEmpty(formatStructuresObject(migrator.globalStructures));

	// Used as the id_key for blocks
	siteConfig._inputs = {
		...migrator.globalInputs,
		template: {
			hidden: true
		}
	};

	return {
		siteConfig: siteConfig
	};
}

export default {
	id: 'forestry',
	detect: detect,
	migrate: migrate
};
