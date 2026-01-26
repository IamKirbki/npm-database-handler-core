import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import QueryDecorator from "./QueryDecorator.js";
import { QueryContext } from "@core/types/query.js";

export default class GroupByDecorator extends QueryDecorator {
    private groupByColumns?: string[];

    constructor(component: IQueryBuilder, groupByColumns?: string[]) {
        super(component);
        this.groupByColumns = groupByColumns;
    }

    async build(): Promise<QueryContext> {
        const context = await this.component.build();
        if (this.groupByColumns) {
            context.groupBy = context.groupBy || [];
            context.groupBy.push(...this.groupByColumns);
        }

        return context;
    }
}