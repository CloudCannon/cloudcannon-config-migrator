# CloudCannon Config Migrator

[<img src="https://img.shields.io/npm/v/cloudcannon-config-migrator?logo=npm" alt="version badge">](https://www.npmjs.com/package/cloudcannon-config-migrator)
[<img src="https://img.shields.io/npm/dt/cloudcannon-config-migrator" alt="downloads badge">](https://www.npmjs.com/package/cloudcannon-config-migrator)


Migrate your existing forestry or netlifycms configuration into CloudCannon config.

To run in the current directory:

```
npx cloudcannon-config-migrator --source .
```

This will read the files in the current directory and make the following updates:

1. Add `cloudcannon.config.yml` which defines your collections, inputs, structures and select_data
2. Add `.cloudcannon/schemas/*` which contains the default file contents for your collections
3. Update any files that are not using default schemas to add a `_schema` value
4. Update any files that have `_inputs` that are only scoped to that file (e.g. data files)

