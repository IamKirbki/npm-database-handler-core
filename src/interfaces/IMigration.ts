import { IDatabaseAdapter } from "./IDatabaseAdapter.js";

export interface IMigration<T extends IDatabaseAdapter = IDatabaseAdapter> {
    up(db: T): Promise<void>;
    down(db: T): Promise<void>;
}