import assert from 'node:assert';
import { test } from 'node:test';
import MigrationClient from '../src/MigrationClient.js';

function getConfigMigrationId(files) {
	const client = new MigrationClient(files);
	return client.getConfigMigration()?.id;
}

test('CloudCannon migration detection', () => {
	const id = getConfigMigrationId(['cloudcannon.config.json']);
	assert.strictEqual(id, 'cloudcannon');
});

test('Forestry migration detection', () => {
	const id = getConfigMigrationId(['.forestry/settings.yml']);
	assert.strictEqual(id, 'forestry');
});

test('NetlifyCMS migration detection', () => {
	const id = getConfigMigrationId(['static/admin/config.yml']);
	assert.strictEqual(id, 'netlifycms');
});
