import AdapterNotFoundError from "@core/helpers/Errors/AdapterErrors/AdapterNotFoundError.js";
import NoDefaultAdapterError from "@core/helpers/Errors/AdapterErrors/NoDefaultAdapterError.js";
import IDatabaseAdapter from "@core/interfaces/IDatabaseAdapter.js";

class Container {
    private static _instance: Container;
    private _adapters: Map<string, IDatabaseAdapter> = new Map();
    private _defaultAdapter?: IDatabaseAdapter;
    public logging: boolean = false;

    private constructor() { }

    public static getInstance(): Container {
        if (!Container._instance) {
            Container._instance = new Container();
        }
        return Container._instance;
    }

    public registerAdapter(name: string, adapter: IDatabaseAdapter, isDefault = false): void {
        this._adapters.set(name, adapter);
        if (isDefault || !this._defaultAdapter) {
            if (this._defaultAdapter) {
                // eslint-disable-next-line no-undef
                console.warn(`Setting default adapter to '${name}'`);
            }

            this._defaultAdapter = adapter;
        }
    }

    public getAdapter(name?: string): IDatabaseAdapter {
        if (name) {
            const adapter = this._adapters.get(name);
            if (!adapter) throw new AdapterNotFoundError(name);
            return adapter;
        }
        if (!this._defaultAdapter) throw new NoDefaultAdapterError();
        return this._defaultAdapter;
    }

    public clear(): void {
        this._adapters.clear();
        this._defaultAdapter = undefined;
    }

    public static resetInstance(): void {
        Container._instance = new Container();
    }
}

export default Container;