import convertSettings from "../helpers/conversions-helper.js";
import reduceInputsConfig from "../helpers/reduce-inputs-config.js";
import { loadYaml, stringifyYaml } from "../helpers/yaml-helper.js";

const validExtensions = {
	yml: true,
	yaml: true,
	toml: true,
	json: true,
	md: true,
	markdown: true,
	html: true,
};

function getEnabledEditors(extension, hideBody) {
	if (extension === "html" || extension === "htm") {
		return ["visual", "data"];
	}

	if (hideBody) {
		return ["data"];
	}

	return ["content"];
}

function processFields(migrator, fields, parentConfigPath) {
	const contents = {};
	let inputConfig = {};
	let bodyFormat = "markdown";

	fields.forEach((field) => {
		// This special field represents the section of
		// the document (usually markdown) that comes after the frontmatter.
		if (field.name === "body") {
			bodyFormat = field.widget;
			return;
		}

		if (field.comment) {
			console.log("NYI comments:", field);
		}
		const safeConfigPath = parentConfigPath
			? `${parentConfigPath}.${field.name}`
			: field.name;

		switch (field.widget || "string") {
			case "string":
				contents[field.name] = field.default || "";
				inputConfig[safeConfigPath] = {
					type: "text",
					label: field.label,
				};
				break;
			case "text":
				contents[field.name] = field.default || "";
				inputConfig[safeConfigPath] = {
					type: "textarea",
					label: field.label,
				};
				break;
			case "hidden":
				contents[field.name] = field.default || null;
				inputConfig[safeConfigPath] = {
					type: "text",
					label: field.label,
					hidden: true,
				};
				break;
			case "boolean":
				contents[field.name] = field.default || false;
				inputConfig[safeConfigPath] = {
					type: "switch",
					label: field.label,
				};
				break;
			case "number":
				contents[field.name] = field.default || null;
				inputConfig[safeConfigPath] = {
					type: "number",
					label: field.label,
				};
				break;
			case "datetime":
				contents[field.name] = field.default || null;
				inputConfig[safeConfigPath] = {
					type: "datetime",
					label: field.label,
				};

				if (field.format) {
					// TODO warn about format console.log('datetime', field);
				}
				break;
			case "date":
				contents[field.name] = field.default || null;
				inputConfig[safeConfigPath] = {
					type: "date",
					label: field.label,
				};

				if (field.format) {
					// TODO warn about format console.log('date', field);
				}
				break;

			case "image":
				contents[field.name] = field.default || null;
				inputConfig[safeConfigPath] = {
					type: "image",
					label: field.label,
				};
				break;
			case "markdown":
				contents[field.name] = field.default || "";
				inputConfig[safeConfigPath] = {
					type: "markdown",
					label: field.label,
				};
				break;
			case "mdx":
				// TODO warn about config or add mdx snippets
				contents[field.name] = field.default || "";
				inputConfig[safeConfigPath] = {
					type: "markdown",
					label: field.label,
				};
				break;
			case "list":
				contents[field.name] = field.default || [];
				inputConfig[safeConfigPath] = {
					type: "array",
					label: field.label,
				};

				if (field.fields) {
					const recursiveContent = processFields(migrator, field.fields, null);

					inputConfig[safeConfigPath].structures = [
						{
							value: recursiveContent.contents,
							_inputs: recursiveContent.inputConfig,
						},
					];
				}
				break;
			case "object": {
				const recursiveContent = processFields(
					migrator,
					field.fields,
					safeConfigPath,
				);

				contents[field.name] = recursiveContent.contents;

				inputConfig = {
					...inputConfig,
					...recursiveContent.inputConfig,
				};
				break;
			}
			case "select":
				contents[field.name] = field.default || (field.multiple ? [] : null);
				inputConfig[safeConfigPath] = {
					type: field.multiple ? "multiselect" : "select",
					label: field.label,
					options: {
						values: field.options,
						allow_create: field.create || false,
						allow_empty: true,
					},
				};
				break;
			case "relation": {
				contents[field.name] = field.default || (field.multiple ? [] : null);
				let options = null;
				if (field.collection) {
					options = {
						values: `collection.${field.collection}`,
						value_key: field.valueField,
					};
				} else {
					console.log("unkown relation type", field);
				}

				inputConfig[safeConfigPath] = {
					type: field.multiple ? "multiselect" : "select",
					label: field.label,
					options: options,
				};
				break;
			}
			case "color": {
				inputConfig[safeConfigPath] = {
					type: "color",
					options: {
						format: field.enableAlpha ? "rgba" : "rgb",
					},
				};
				break;
			}
			case "file":
				inputConfig[safeConfigPath] = {
					type: "file",
				};
				break;
			default:
				migrator.addWarning(`Unknown field widget ${field.widget}`, {
					level: "high",
					field: field,
				});
				break;
		}
	});

	return {
		contents: contents,
		inputConfig: reduceInputsConfig(inputConfig),
		bodyFormat: bodyFormat,
	};
}

const conversions = {
	// https://www.netlifycms.org/docs/configuration-options/
	site_url: {
		description:
			"The site_url setting should provide a URL to your published site. May be used by the CMS for various functionality. Used together with a collection's preview_path to create links to live content.",
		ignoredReason: "N/A",
	},

	show_preview_links: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	search: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	backend: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	publish_mode: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	local_backend: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	localhost_development: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	media_library: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	editor: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	display_url: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	logo_url: {
		description: "Unknown",
		ignoredReason: "N/A",
	},

	collections: {
		converter: async (input, migrator) => {
			await Promise.all(
				input.map(async (section) => {
					if (!section.name) {
						migrator.addWarning("Section has no name defined", {
							section: section,
							level: "critical",
						});
						return;
					}
					/*
                name (required): unique identifier for the collection,
                used as the key when referenced in other contexts (like the relation widget)
                identifier_field: see detailed description below
				label: label for the collection in the editor UI; defaults to the value of name
				label_singular: singular label for certain elements in the editor;
                defaults to the value of label
				description: optional text, displayed below the label when viewing a collection
				files or folder (requires one of these): specifies the collection type and
                location; details in Collection Types
				filter: optional filter for folder collections; details in Collection Types
				create: for folder collections only; true allows users to create new items
                in the collection; defaults to false
				publish: for publish_mode: editorial_workflow only; false hides UI publishing
                controls for a collection; defaults to true
				hide: true hides a collection in the CMS UI; defaults to false. Useful when using
                the relation widget to hide referenced collections.
				delete: false prevents users from deleting items in a collection; defaults to true
				extension: see detailed description below
				format: see detailed description below
				frontmatter_delimiter: see detailed description under format
				slug: see detailed description below
				preview_path: see detailed description below
				preview_path_date_field: see detailed description below
				fields (required): see detailed description below
				editor: see detailed description below
				summary: see detailed description below
				sortable_fields: see detailed description below
				view_filters: see detailed description below
				view_groups: see detailed description below
                */

					if (!("folder" in section) && !("files" in section)) {
						migrator.addWarning("Section has no files or folder defined", {
							section: section,
							level: "critical",
						});
						return;
					}

					const id = section.name;
					migrator.collections[id] = {
						name: section.label,
					};

					if ("files" in section) {
						await Promise.all(
							section.files.map(async (fileDef) => {
								const schema = processFields(migrator, fileDef.fields, "$");

								const extension = "md"; // TODO read from fileDef.file
								const schemaId = fileDef.name;
								const filePath = `.cloudcannon/schemas/${section.name}/${schemaId}.${extension}`;

								const schemaFile = {
									path: filePath,
									contents: await migrator.readFile(fileDef.file),
								};

								const enabledEditors = getEnabledEditors(extension, false);
								const schemaDef = {
									path: filePath,
									name: section.name,
									_enabled_editors: enabledEditors,
									_inputs: schema.inputConfig,
								};

								migrator.addFile(schemaFile);
								migrator.collections[id].schemas =
									migrator.collections[id].schemas || {};
								migrator.collections[id].schemas[schemaId] = schemaDef;

								if (schemaId !== "default") {
									await migrator.appendDataToFiles([fileDef.file], {
										_schema: schemaId,
									});
								}
							}),
						);

						migrator.collections[id].filter = {
							base: "none",
							include: section.files.map((files) => files.file),
						};
					} else {
						migrator.collections[id].path = section.folder;

						if (section.fields && section.fields.length > 0) {
							if (section.frontmatter_delimiter) {
								// If you have an explicit frontmatter format declared, this option
								// allows you to specify a custom delimiter like ~~~. If you need
								// different beginning and ending delimiters, you can use an array
								// like ["(", ")"].
								migrator.addWarning(
									`Section has custom frontmatter_delimiter "${section.frontmatter_delimiter}`,
									{
										section: section,
										level: "critical",
									},
								);
							}

							const schema = processFields(migrator, section.fields, "$");

							let { extension } = section;
							const format =
								section.format || section.extension || "frontmatter";
							let frontmatterDelimiter = section.frontmatter_delimiter;
							let stringifiedContents;
							switch (format) {
								case "yml":
								case "yaml":
									// parses and saves files as YAML-formatted data files; saves with yml
									// extension by default
									extension = extension || "yml";
									frontmatterDelimiter = null;
									stringifiedContents = stringifyYaml(schema.contents).replace(
										/: null/gim,
										":",
									);
									break;
								case "json":
									// parses and saves files as JSON-formatted data files; saves with json
									// extension by default
									extension = extension || "json";
									frontmatterDelimiter = null;
									stringifiedContents = JSON.stringify(
										schema.contents,
										null,
										"\t",
									);
									break;
								case "md":
								case "markdown":
								case "frontmatter":
									extension = extension || "md";
									frontmatterDelimiter = frontmatterDelimiter || "---";
									stringifiedContents = stringifyYaml(schema.contents);
									// parses files and saves files with data frontmatter followed by an unparsed body
									// text (edited using a body field); saves with md extension by default;
									// default for collections that can't be inferred. Collections with
									// frontmatter format (either inferred or explicitly set) can parse files
									// with frontmatter in YAML, TOML, or JSON format. However, they will be saved
									// with YAML frontmatter.
									break;
								case "yaml-frontmatter":
									frontmatterDelimiter = frontmatterDelimiter || "---";
									stringifiedContents = stringifyYaml(schema.contents);
									// same as the frontmatter format above, except frontmatter will be both
									// parsed and saved only as YAML, followed by unparsed body text. The
									// default delimiter for this option is ---.
									break;
								default:
									migrator.addWarning(
										`Section has unknown collection file format "${format}`,
										{
											level: "critical",
										},
									);
									break;
							}

							if (schema.bodyFormat !== "markdown") {
								migrator.addWarning(
									`Section has unknown body format "${schema.bodyFormat}`,
									{
										level: "critical",
									},
								);
							}

							const filePath = `.cloudcannon/schemas/${section.name}.${extension.replace(/\.+/, ".")}`;

							const schemaFile = {
								path: filePath,
								contents: frontmatterDelimiter
									? `${frontmatterDelimiter}\n${stringifiedContents}${frontmatterDelimiter}`
									: stringifiedContents,
							};

							const enabledEditors = getEnabledEditors(
								extension,
								!frontmatterDelimiter,
							);
							const schemaDef = {
								path: filePath,
								name: section.label,
								_enabled_editors: enabledEditors,
								_inputs: schema.inputConfig,
							};

							migrator.addFile(schemaFile);
							migrator.collections[id].schemas = {};
							migrator.collections[id].schemas.default = schemaDef;
						}
					}

					if (!section.create) {
						migrator.collections[id].add_options = [];
					}

					if (
						section.extension &&
						!validExtensions[section.extension] &&
						!section.format
					) {
						throw new Error("Custom format with no format parser");
					}

					const identifierField = section.identifier_field || "title";
					// Netlify CMS expects every entry to provide a field named "title" that serves
					// as an identifier for the entry. The identifier field serves as an entry's
					// title when viewing a list of entries, and is used in slug creation. If you
					// would like to use a field other than "title" as the identifier, you can set
					// identifier_field to the name of the other field.
					migrator.collections[id].text_key = identifierField;

					if (section.preview_path) {
						// preview_path_date_field
						// The name of a date field for parsing date-based template tags from preview_path.
						// If this field is not provided and preview_path contains date-based template
						// tags (eg. {{year}}), Netlify CMS will attempt to infer a usable date field
						// by checking for common date field names, such as date. If you find that you
						// need to specify a date field, you can use preview_path_date_field
						// to tell Netlify CMS which field to use for preview path template tags.
						const previewDate = section.preview_path_date_field || "date";

						// preview_path
						// A string representing the path where content in this collection can be found
						// on the live site. This allows deploy preview links to direct to lead to a
						// specific piece of content rather than the site root of a deploy preview.
						const ccTemplate = section.preview_path
							// {{extension}} excludes the dot and [ext] includes it
							.replace(/\.{{extension}}/g, "[ext]")
							.replace(/{{(.*)}}/g, (_template, param) => {
								// {{slug}} is the entire slug for the current entry (not
								// just the url-safe identifier, as is the case with slug configuration)
								if (param === "slug") {
									return `{${identifierField}|slugify}`;
								}

								// {{filename}} The file name without the extension part.
								if (param === "filename") {
									return "[slug]";
								}

								// {{dirname}} The path to the file's parent directory, relative to the
								// collection's folder.
								if (param === "dirname") {
									return "[relative_base_path]";
								}

								// {{extension}} The file extension.
								if (param === "extension") {
									throw new Error(
										"Unsupported preview path extension, [ext] will add an extra dot",
									);
								}

								// {{year}}: 4-digit year of the file creation date
								// {{month}}: 2-digit month of the file creation date
								// {{day}}: 2-digit day of the month of the file creation date
								if (param === "year" || param === "month" || param === "day") {
									return `{${previewDate}|${param}}`;
								}

								// {{hour}}: 2-digit hour of the file creation date
								// {{minute}}: 2-digit minute of the file creation date
								// {{second}}: 2-digit second of the file creation date
								if (
									param === "hour" ||
									param === "minute" ||
									param === "second"
								) {
									throw new Error(`Unsupported preview path param ${param}`);
								}

								return `{${param.replace(/^field\./, "")}}`;
								// The slug template can also reference a field value by name, eg. {{title}}.
								// If a field name conflicts with a built in template tag name - for example,
								// if you have a field named slug, and would like to reference that field
								// via {{slug}}, you can do so by adding the explicit fields. prefix,
								// eg. {{fields.slug}}.
							});

						migrator.collections[id].url = ccTemplate;
						migrator.collections[id].output = true;
					}

					if (section.delete) {
						migrator.collections[id].disable_file_actions = true;
					}

					if (section.editor) {
						migrator.addWarning("Collections config 'editor' unsupported", {
							section: section,
							level: "info",
						});
					}
				}),
			);

			return {
				config: {
					collections_config: migrator.collections,
				},
			};
		},
	},

	media_folder: {
		description:
			"The media_folder option specifies the folder path where uploaded files should be saved, relative to the base of the repo.",
		usedInternally: true,
	},
	public_folder: {
		description:
			"The public_folder option specifies the folder path where the files uploaded by the media library will be accessed.",
		usedInternally: true,
	},

	// TODO editor:
	// This setting changes options for the editor view of a collection or a file inside a
	// files collection. It has one option so far:

	// preview: set to false to disable the preview pane for this collection or file; defaults to true
	// Setting this as a top level configuration will set the default for all collections

	//     summary

	// This setting allows the customization of the collection list view. Similar to the slug
	// field, a string with templates can be used to include values of different fields,
	// e.g. {{title}}. This option over-rides the default of title field and identifier_field.

	// Available template tags:

	// Template tags are the same as those for slug, with the following additions:

	//     {{dirname}} The path to the file's parent directory, relative to the collection's folder.
	//     {{filename}} The file name without the extension part.
	//     {{extension}} The file extension.
	//     {{commit_date}} The file commit date on supported backends (git based backends).
	//     {{commit_author}} The file author date on supported backends (git based backends).

	// Example

	//     summary: "Version: {{version}} - {{title}}"

	// sortable_fields

	// An optional list of sort fields to show in the UI.

	// Defaults to inferring title, date, author and description fields and will also show
	// Update On sort field in git based backends.

	// When author field can't be inferred commit author will be used.

	// Example

	//     # use dot notation for nested fields
	//     sortable_fields: ['commit_date', 'title', 'commit_author', 'language.en']

	// view_filters

	// An optional list of predefined view filters to show in the UI.

	// Defaults to an empty list.

	// Example

	//     view_filters:
	//       - label: "Alice's and Bob's Posts"
	//         field: author
	//         pattern: 'Alice|Bob'
	//       - label: 'Posts published in 2020'
	//         field: date
	//         pattern: '2020'
	//       - label: Drafts
	//         field: draft
	//         pattern: true

	// view_groups

	// An optional list of predefined view groups to show in the UI.

	// Defaults to an empty list.

	// Example

	//     view_groups:
	//       - label: Year
	//         field: date
	//         # groups items based on the value matched by the pattern
	//         pattern: \d{4}
	//       - label: Drafts
	//         field: draft
};

function findConfigFile(migrator) {
	// These generators store static files in
	// Jekyll, GitBook / (project root)
	// Hugo, Gatsby, Nuxt 2, Gridsome, Zola, Sapper /static
	// Next, Nuxt 3 /public
	// Hexo, Middleman, Jigsaw /source
	// Spike /views
	// Wyam /input
	// Pelican /content
	// VuePress /.vuepress/public
	// Elmstatic /_site
	// 11ty /_site
	// preact-cli /src/static
	// Docusaurus /static
	const candidates = migrator.files.filter((filename) =>
		filename.endsWith("admin/config.yml"),
	);

	if (candidates.length > 1) {
		throw new Error("Too many netlifycms config candidates");
	}

	return candidates.length === 1 ? candidates[0] : null;
}

function detect(migrator) {
	return findConfigFile(migrator);
}

async function migrate(migrator) {
	const configPath = findConfigFile(migrator);
	const netlifySettings = loadYaml(await migrator.readFile(configPath));

	const { siteConfig } = await convertSettings(
		netlifySettings,
		conversions,
		migrator,
	);

	const mediaFolder = (netlifySettings.media_folder || "").replace(/\/+$/, "");
	if (mediaFolder) {
		const publicFolder = (netlifySettings.public_folder || "").replace(
			/\/+$/,
			"",
		);

		if (mediaFolder.endsWith(publicFolder)) {
			const staticFolder = mediaFolder
				.substring(0, mediaFolder.length - publicFolder.length)
				.replace(/\/+$/, "");
			siteConfig.paths = {
				static: staticFolder,
				uploads: `${staticFolder}/${publicFolder}`
					.replace(/\/+/g, "/")
					.replace(/\/$/, ""),
			};
		} else {
			console.log("Unknown media folder format", mediaFolder, publicFolder);
		}
	}

	return {
		files: [],
		siteConfig: siteConfig,
	};
}

export default {
	id: "netlifycms",
	detect: detect,
	migrate: migrate,
};
