import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import QueryDecorator from "./QueryDecorator.js";
import { QueryContext } from "@core/types/query.js";

export default class LimitDecorator extends QueryDecorator {
    private limitCount: number;
    private offsetCount?: number;

    constructor(component: IQueryBuilder, limitCount: number, offsetCount?: number) {
        super(component);
        this.limitCount = limitCount;
        this.offsetCount = offsetCount;
    }

    async build(): Promise<QueryContext> {
        const context = await this.component.build();
        if (this.limitCount) {
            context.limit = this.limitCount;
        }

        if (this.offsetCount) {
            context.offset = this.offsetCount;
        }

        return context;
    }
}