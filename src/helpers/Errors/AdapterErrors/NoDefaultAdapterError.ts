export default class NoDefaultAdapterError extends Error {
    constructor() {
        super("No default adapter set");
        this.name = "NoDefaultAdapterError";
    }
}