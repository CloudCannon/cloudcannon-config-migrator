export default class NotYetImplementedError extends Error {
	constructor(message) {
		super(message);
		this.name = "NotYetImplementedError";
	}
}
