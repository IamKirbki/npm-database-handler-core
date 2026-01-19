import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";

export default class BaseQueryBuilder implements IQueryBuilder {
    private tableName: string;
    private select: string;

    constructor(tableName: string, select: string = "*") {
        this.tableName = tableName;
        this.select = select;
    }

    async build(): Promise<string> {
        return `SELECT ${this.select} FROM "${this.tableName}"`;
    }
}