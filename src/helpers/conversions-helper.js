export default async function convertSettings(json, conversions, migrator) {
	let result = {};

	for (let i = 0; i < Object.keys(json).length; i += 1) {
		const key = Object.keys(json)[i];

		if (!conversions[key]) {
			migrator.addWarning(`Unused root key ${key}`, { level: "medium" });
		} else if (conversions[key]?.converter) {
			const { config } =
				(await conversions[key].converter(json[key], migrator, json)) || {};
			if (config) {
				result = {
					...result,
					...config,
				};
			}
		} else if (!conversions[key].usedInternally) {
			migrator.addWarning(
				`Ignored setting ${key}: ${conversions[key].ignoredReason}`,
				{ level: "info" },
			);
		}
	}

	return {
		siteConfig: result,
	};
}
