import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import { QueryContext, QueryWhereConditionType } from "@core/types/query.js";
import QueryDecorator from "./QueryDecorator.js";
import QueryStatementBuilder from "../QueryStatementBuilder.js";

export default class WhereDecorator extends QueryDecorator {
    private conditions: QueryWhereConditionType;

    constructor(
        component: IQueryBuilder,
        conditions: QueryWhereConditionType
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