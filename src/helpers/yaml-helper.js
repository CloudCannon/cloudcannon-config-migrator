import yaml from 'js-yaml';

export const loadYaml = (str) => yaml.load(str);

export const stringifyYaml = (json) => yaml.dump(json);
