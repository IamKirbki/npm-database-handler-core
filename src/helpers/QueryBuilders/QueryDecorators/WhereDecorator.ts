import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import { QueryComparisonParameters, QueryWhereCondition } from "@core/types/query.js";
import QueryDecorator from "./QueryDecorator.js";
import ExpressionDecorator from "./ExpressionDecorator.js";

export default class WhereDecorator extends QueryDecorator {
    private conditions: QueryWhereCondition;
    private skipExpressionConditions: boolean = false;
    private _extraOrderByClauses?: string[];
    private _expressionWhereClauses?: QueryWhereCondition[];

    public get expressionWhereClauses(): QueryWhereCondition[] {
        return this._expressionWhereClauses || [];
    }

    public get extraOrderByClauses(): string[] {
        return this._extraOrderByClauses || [];
    }

    constructor(
        component: IQueryBuilder,
        conditions: QueryWhereCondition,
        skipExpressionConditions?: boolean
    ) {
        super(component);
        this.conditions = conditions;
        this.skipExpressionConditions = skipExpressionConditions ?? false;

        const expressionDecorator = this.findDecoratorInChain(ExpressionDecorator);
        if (expressionDecorator) {
            this._extraOrderByClauses = expressionDecorator.orderByClauses;
            this._expressionWhereClauses = expressionDecorator.whereClauses;
        }
    }

    async build(): Promise<string> {
        const baseQuery = await this.component.build();
        const expressionWhereClauses = this.expressionWhereClauses.flatMap(exprWhere => {
            const normalized: (QueryComparisonParameters & { fromOperator?: boolean })[] = this.normalizeConditions(exprWhere);
            normalized.map(norm => norm.fromOperator = true)
            return normalized;
        });

        const combinedConditions = [...this.normalizeConditions(this.conditions), ...expressionWhereClauses];
        const whereClause = this.processWhere(combinedConditions);

        if (whereClause) {
            return `${baseQuery} ${whereClause}`;
        }

        return baseQuery;
    }

    private processWhere(conditions: (QueryComparisonParameters & { fromOperator?: boolean })[]): string {
        if (
            !conditions ||
            Object.keys(conditions).length === 0 ||
            conditions instanceof Date
        ) {
            return "";
        }

        return `WHERE ${this.buildWhereWithOperators(conditions)}`;
    }

    private buildWhereWithOperators(where: (QueryComparisonParameters & { fromOperator?: boolean })[]): string {
        return where
            .map((condition) => {
                const colName = condition.column.trim();

                if (condition.fromOperator) {
                    if (this.skipExpressionConditions) return null;

                    const alias = colName.split("_")[0];
                    return `${alias} ${condition.operator} @${colName}`;
                }

                // Extract column name for parameter (remove table prefix if present)
                // const paramName = colName.includes(".") ? colName.split(".").pop() : colName;
                return `${colName} ${condition.operator} @${colName}`;
            })
            .filter(Boolean)
            .join(" AND ");
    }

    private normalizeConditions(
        conditions: QueryWhereCondition,
    ): QueryComparisonParameters[] {
        if (Array.isArray(conditions)) {
            return conditions;
        }

        return Object.entries(conditions).map(([column, value]) => ({
            column,
            operator: '=' as const,
            value,
        }));
    }
}