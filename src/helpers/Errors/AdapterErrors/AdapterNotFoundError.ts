export default class AdapterNotFoundError extends Error {
    constructor(adapterName: string) {
        super(`Adapter not found: ${adapterName}`);
        this.name = "AdapterNotFoundError";
    }
}