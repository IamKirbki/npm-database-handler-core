import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import { QueryComparisonParameters, QueryWhereCondition } from "@core/types/query.js";
import QueryDecorator from "./QueryDecorator.js";
import { expressionClause } from "@core/index";
import { QueryIsEqualParameter } from "@core/types/index.js";
import ExpressionDecorator from "./ExpressionDecorator.js";

export default class WhereDecorator extends QueryDecorator {
    private conditions: QueryWhereCondition;
    private expressions?: expressionClause[];
    private skipExpressionConditions: boolean = false;
    private _extraOrderByClauses?: string[];

    public get extraOrderByClauses(): string[] {
        return this._extraOrderByClauses || [];
    }


    constructor(
        component: IQueryBuilder,
        conditions: QueryWhereCondition,
        expressions?: expressionClause[],
        skipExpressionConditions?: boolean
    ) {
        super(component);
        this.conditions = conditions;
        this.expressions = expressions;
        this.skipExpressionConditions = skipExpressionConditions ?? false;

        const expressionDecorator = this.findDecoratorInChain(ExpressionDecorator);
        if (expressionDecorator) {
            this._extraOrderByClauses = expressionDecorator.extraOrderByClauses;
        }
    }

    async build(): Promise<string> {
        const baseQuery = await this.component.build();
        const whereClause = this.processWhere(this.conditions);
        let extraWhereClause = "";

        const expressionDecorator = this.findDecoratorInChain(ExpressionDecorator);
        if (expressionDecorator) {
            const extraWheres = expressionDecorator.extraWhereClauses.filter(clause => clause !== "");
            if (extraWheres.length > 0) {
                extraWhereClause = extraWheres.join(" AND ");
            }
        }

        if (whereClause && extraWhereClause) {
            return `${baseQuery} ${whereClause} AND ${extraWhereClause}`;
        } else if (whereClause) {
            return `${baseQuery} ${whereClause}`;
        } else if (extraWhereClause) {
            return `${baseQuery} WHERE ${extraWhereClause}`;
        }

        return baseQuery;
    }

    private processWhere(conditions: QueryWhereCondition): string {
        if (
            !conditions ||
            (Array.isArray(conditions) && conditions.length === 0) ||
            Object.keys(conditions).length === 0 ||
            conditions instanceof Date
        ) {
            return "";
        }

        const isSimpleObject =
            !Array.isArray(conditions) && typeof conditions === "object" && conditions !== null;

        return [
            "WHERE",
            isSimpleObject
                ? this.buildWhereSimple(conditions)
                : this.buildWhereWithOperators(conditions),
        ].join(" ");
    }

    private buildWhereWithOperators(where: QueryComparisonParameters[]): string {
        return where
            .map((condition) => {
                const colName = condition.column.trim();
                const matchedExpression = this.expressions?.find(
                    (expr) => expr.whereClauseKeyword === colName,
                );

                if (matchedExpression) {
                    if (this.skipExpressionConditions) return null;

                    // Gebruik alias voor SQL, maar volledige naam voor de parameter
                    const alias = colName.split("_")[0];
                    return `${alias} ${condition.operator} @${colName}`;
                }

                return `${colName} ${condition.operator} @${colName}`;
            })
            .filter(Boolean)
            .join(" AND ");
    }

    private buildWhereSimple(where: QueryIsEqualParameter): string {
        return Object.keys(where)
            .map((col) => {
                const matchedExpression = this.expressions?.find(
                    (expr) => expr.whereClauseKeyword === col,
                );

                if (matchedExpression) {
                    if (this.skipExpressionConditions) return null;

                    const alias = col.split("_")[0];
                    return `${alias} = @${col}`;
                }

                return `${col} = @${col}`;
            })
            .filter(Boolean)
            .join(" AND ");
    }
}