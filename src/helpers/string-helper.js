const abbreviations = {
	api: "API",
	guuid: "GUUID",
	uuid: "UUID",
	id: "ID",
	faq: "FAQ",
	faqs: "FAQs",
	cta: "CTA",
	ctas: "CTAs",
	ssl: "SSL",
	html: "HTML",
	css: "CSS",
	hsv: "HSV",
	hsva: "HSVA",
	hsl: "HSL",
	hsla: "HSLA",
	rgb: "RGB",
	rgba: "RGBA",
	url: "URL",
	urls: "URLs",
	github: "GitHub",
	gitlab: "GitLab",
	youtube: "YouTube",
	cloudcannon: "CloudCannon",
	cms: "CMS",
	seo: "SEO",
	ssg: "SSG",
	ssgs: "SSGs",
	json: "JSON",
	toml: "TOML",
	yaml: "YAML",
	javascript: "JavaScript",
};

const smallWords =
	/^(a|an|and|as|at|but|by|en|for|if|in|nor|of|on|or|per|the|to|vs?\.?|via)$/i;

export function toTitleCase(str) {
	return str?.replace?.(
		/[A-Za-z0-9\u00C0-\u00FF]+[^\s-]*/g,
		(match, index, title) => {
			if (
				index > 0 &&
				index + match.length !== title.length &&
				match.search(smallWords) > -1 &&
				title.charAt(index - 2) !== ":" &&
				(title.charAt(index + match.length) !== "-" ||
					title.charAt(index - 1) === "-") &&
				title.charAt(index - 1).search(/[^\s-]/) < 0
			) {
				return match.toLowerCase();
			}

			if (match.substr(1).search(/[A-Z]|\../) > -1) {
				return match;
			}

			return match.charAt(0).toUpperCase() + match.substr(1);
		},
	);
}

export function titleise(str) {
	if (!str) {
		return str;
	}

	const tokens = str
		.replace(/([a-z])([A-Z])/g, "$1 $2") // Split up camelCase words
		.split(/[-_\s]+/);

	for (let i = 0; i < tokens.length; i += 1) {
		tokens[i] = abbreviations[tokens[i].toLowerCase()] || tokens[i];
	}

	return toTitleCase(tokens.join(" "));
}

export function capitalise(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function stripHTML(html) {
	const doc = new DOMParser().parseFromString(html, "text/html");
	return doc.body.textContent || "";
}

export function tryString(str) {
	if (typeof str === "string") {
		return str;
	}
}

export function uncapitalise(str) {
	return str.charAt(0).toLowerCase() + str.slice(1);
}

export function indexOfRegex(str, regex, fromIndex = 0) {
	const segment = fromIndex ? str.substring(fromIndex) : str;
	const match = segment.match(regex);
	return match ? segment.indexOf(match[0]) + fromIndex : -1;
}
