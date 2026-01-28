import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import { QueryContext, QueryWhereCondition } from "@core/types/query.js";
import QueryDecorator from "./QueryDecorator.js";
import QueryStatementBuilder from "../QueryStatementBuilder.js";

export default class WhereDecorator extends QueryDecorator {
    private conditions: QueryWhereCondition;

    constructor(
        component: IQueryBuilder,
        conditions: QueryWhereCondition
    ) {
        super(component);
        this.conditions = conditions;
    }

    async build(): Promise<QueryContext> {
        const context = await this.component.build();
        const combinedConditions = [...QueryStatementBuilder.normalizeQueryConditions(this.conditions)];

        context.conditions ??= {};
        context.conditions.where ??= [];
        context.conditions.where.push(...combinedConditions);

        return context;
    }
}