import { QueryContext } from "@core/index";
import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";

export default class BaseSelectQueryBuilder implements IQueryBuilder {
    private tableName: string;
    private select: string[];
    private joinsSelect?: string[];
    private expressionsSelect?: string[];

    constructor(tableName: string, select: string[], joinsSelect?: string[], expressionsSelect?: string[]) {
        this.tableName = tableName;
        this.select = select;
        this.joinsSelect = joinsSelect;
        this.expressionsSelect = expressionsSelect;
    }

    async build(): Promise<QueryContext> {
        return {
            select: this.select,
            joinsSelect: this.joinsSelect,
            from: this.tableName,
            expressionSelect: this.expressionsSelect,
        }
    }
}