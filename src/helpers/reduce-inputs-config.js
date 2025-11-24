import moment from 'moment';
import { titleise } from './string-helper.js';

const keyOverrides = {
	date: 'datetime',
};

const keySuffixes = {
	date: 'date',
	at: 'datetime',
	datetime: 'datetime',
	time: 'time',
	color: 'color',
	colour: 'color',
	hex: 'color',
	hsv: 'color',
	hsva: 'color',
	hsl: 'color',
	hsla: 'color',
	rgb: 'color',
	rgba: 'color',
	image: 'image',
	image_path: 'image',
	thumbnail: 'image',
	thumbnail_path: 'image',
	document: 'document',
	path: 'file',
	twitter_url: 'twitter',
	twitter: 'twitter',
	twitter_username: 'twitter',
	github_url: 'github',
	github: 'github',
	github_username: 'github',
	facebook_url: 'facebook',
	facebook: 'facebook',
	facebook_username: 'facebook',
	instagram_url: 'instagram',
	instagram: 'instagram',
	instagram_username: 'instagram',
	pinterest_url: 'pinterest',
	pinterest: 'pinterest',
	pinterest_username: 'pinterest',
	email: 'email',
	email_address: 'email',
	html: 'html',
	markdown: 'markdown',
	code_block: 'code',
	url: 'url',
	link: 'url',
	number: 'number',
	textarea: 'textarea',
	description: 'textarea',
};

function normaliseKey(key) {
	return (key || '')
		.replace(/-/g, '_')
		.replace(/([a-z])([A-Z])/g, '$1_$2')
		.replace(/_+/, '_')
		.replace(/^_/, '')
		.toLowerCase();
}

function getInputTypeFromKey(key) {
	key = normaliseKey(key);
	const parts = key.split('_');
	let type = keyOverrides[key];

	for (let i = 0; i < parts.length && !type; i += 1) {
		const partKey = parts.slice(i).join('_');
		type = keySuffixes[partKey];
	}

	return type;
}

function getInputType(key, value, inputConfig) {
	if (inputConfig?.type) {
		return inputConfig?.type;
	}

	if (typeof value === 'boolean') {
		return 'checkbox';
	}

	if (typeof value === 'number') {
		return 'number';
	}

	if (moment.isMoment(value)) {
		const normalised = normaliseKey(key);
		if (normalised.match(/(_|^)time$/i)) {
			return 'time';
		}

		if (normalised.match(/_date$/i)) {
			return 'date';
		}

		return 'datetime';
	}

	if (inputConfig?.options?.values) {
		return 'select';
	}

	return getInputTypeFromKey(key) || 'text';
}

function getLabel(key, inputConfig) {
	const label = typeof inputConfig?.label === 'string' ? inputConfig?.label : '';
	return label || titleise(key);
}

function isHiddenByDefault(key, inputConfig) {
	return inputConfig?.hidden ?? key?.charAt?.(0) === '_';
}

// Inputs from external partners to our equivalent types
const reducedTypes = {
	text: {
		textarea: true,
		email: true,
		file: true,
		url: true,
	},
	textarea: {
		text: true,
	},
	file: {
		image: true,
	},
};

function keysWithValue(obj) {
	return Object.keys(obj).filter((key) => !!obj[key]).length;
}

export default function reduceInputsConfig(inputConfig) {
	const keys = Object.keys(inputConfig);

	const reducedConfig = {};
	keys.forEach((key) => {
		const def = inputConfig[key];
		const parts = key.split('.');
		const labelKey = parts[parts.length - 1];

		if (def.label) {
			const label = getLabel(labelKey);
			if (def.label.toLowerCase() === label.toLowerCase() || def.label === labelKey) {
				delete def.label;
			}
		}

		if (def.type) {
			const type = getInputType(labelKey);
			if (def.type === type || reducedTypes[def.type]?.[type]) {
				delete def.type;
			}

			// Do we assume the value in the file will be boolean?
			if (def.type === 'switch') {
				delete def.type;
			}
		}

		const hidden = isHiddenByDefault(labelKey);
		if (def.hidden && def.hidden === hidden) {
			delete def.hidden;
		}

		if (keysWithValue(def) > 0) {
			reducedConfig[key] = def;
		}
	});

	return keysWithValue(reducedConfig) > 0 ? reducedConfig : undefined;
}
