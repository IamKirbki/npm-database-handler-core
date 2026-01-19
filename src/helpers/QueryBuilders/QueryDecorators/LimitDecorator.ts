import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import QueryDecorator from "./QueryDecorator.js";

export default class LimitDecorator extends QueryDecorator {
    private limitCount: number;
    private offsetCount?: number;

    constructor(component: IQueryBuilder, limitCount: number, offsetCount?: number) {
        super(component);
        this.limitCount = limitCount;
        this.offsetCount = offsetCount;
    }

    async build(): Promise<string> {
        const baseQuery = await this.component.build();
        let sql = `${baseQuery} LIMIT ${this.limitCount}`;
        this.offsetCount ? sql += ` OFFSET ${this.offsetCount}` : null;

        return sql;
    }
}