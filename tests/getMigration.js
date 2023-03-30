// eslint-disable-next-line import/no-unresolved
import test from 'ava';
import MigrationClient from '../src/MigrationClient.js';

function getConfigMigrationId(files) {
	const client = new MigrationClient(files);
	return client.getConfigMigration()?.id;
}

test('CloudCannon migration detection', (t) => {
	const id = getConfigMigrationId([
		'cloudcannon.config.json'
	]);
	t.is(id, 'cloudcannon');
});

test('Forestry migration detection', (t) => {
	const id = getConfigMigrationId([
		'.forestry/settings.yml'
	]);
	t.is(id, 'forestry');
});

test('NetlifyCMS migration detection', (t) => {
	const id = getConfigMigrationId([
		'static/admin/config.yml'
	]);
	t.is(id, 'netlifycms');
});
