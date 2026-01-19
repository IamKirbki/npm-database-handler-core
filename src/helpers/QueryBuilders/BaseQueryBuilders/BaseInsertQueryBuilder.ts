import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";

export default class BaseInsertQueryBuilder implements IQueryBuilder {
    private tableName: string;

    constructor(tableName: string) {
        this.tableName = tableName;
    }

    async build(): Promise<string> {
        return `INSERT INTO "${this.tableName}"`;
    }
}