import IDatabaseAdapter from "./IDatabaseAdapter.js";

export default interface IMigration {
    up(db: IDatabaseAdapter): Promise<void>;
    down(db: IDatabaseAdapter): Promise<void>;
}