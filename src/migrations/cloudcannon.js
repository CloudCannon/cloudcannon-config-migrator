const id = 'cloudcannon';
const configFilenames = [
	'cloudcannon.config.json',
	'cloudcannon.config.yaml',
	'cloudcannon.config.yml',
	'cloudcannon.config.js',
	'cloudcannon.config.cjs'
];

function detect(migrator) {
	return migrator.files.reduce((memo, filename) => memo
            || configFilenames.includes(filename), false);
}

async function migrate() {
	return {};
}

export default {
	id: id,
	detect: detect,
	migrate: migrate
};
