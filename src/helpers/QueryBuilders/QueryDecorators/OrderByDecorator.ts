import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import QueryDecorator from "./QueryDecorator.js";
import { OrderByDefinition, QueryContext } from "@core/types/query.js";

export default class OrderByDecorator extends QueryDecorator {
    private orderByColumns?: OrderByDefinition[];

    constructor(component: IQueryBuilder, orderByColumns?: OrderByDefinition[]) {
        super(component);
        this.orderByColumns = orderByColumns;
    }

    async build(): Promise<QueryContext> {
        const context = await this.component.build();
        if (this.orderByColumns) {
            context.orderBy ??= [];
            context.orderBy.push(...this.orderByColumns);
        }

        return context;
    }
}