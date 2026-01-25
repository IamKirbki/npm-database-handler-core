import { expressionClause, QueryEvaluationPhase } from "@core/types/index.js";
import QueryDecorator from "./QueryDecorator.js";
import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import QueryExpressionBuilder from "../QueryExpressionBuilder.js";
import { QueryWhereCondition } from "@core/types/index.js";

export default class ExpressionDecorator extends QueryDecorator {
    private parsedExpressions: expressionClause[];
    private _whereClauses?: QueryWhereCondition[];
    private _orderByClauses?: string[];

    public get whereClauses(): QueryWhereCondition[] {
        return this._whereClauses || [];
    }

    public get orderByClauses(): string[] {
        return this._orderByClauses || [];
    }

    constructor(
        component: IQueryBuilder,
        expressions: expressionClause[]
    ) {
        super(component);
        this.parsedExpressions = expressions;
    }

    async build(): Promise<string> {
        let sql = await this.component.build();
        const needsWrapping = QueryExpressionBuilder.shouldWrapJoinQuery(this.parsedExpressions);

        this.appendExpressionClauses();

        if (needsWrapping) {
            sql = this.wrapQuery(sql);
        } else {
            sql = this.injectBaseExpressions(sql);
        }

        return sql;
    }

    private injectBaseExpressions(sql: string): string {
        const baseExpressions = QueryExpressionBuilder.filterExpressionsByPhase(this.parsedExpressions, QueryEvaluationPhase.BASE);
        if (baseExpressions.length === 0) return sql;

        const clauses = baseExpressions.map(e => e.baseExpressionClause).join(", ");
        return sql.replace(/\bFROM\b/i, `, ${clauses} FROM`);
    }

    private wrapQuery(innerSql: string): string {
        const projectionExpressions = QueryExpressionBuilder.filterExpressionsByPhase(this.parsedExpressions, QueryEvaluationPhase.PROJECTION);
        const projectionClauses = projectionExpressions.map(e => e.baseExpressionClause).join(", ");

        const sqlBeforeFromMatch = innerSql.match(/SELECT\s+(.*?)\s+FROM/i);
        if (!sqlBeforeFromMatch) {
            throw new Error("Could not find SELECT ... FROM clause in the inner SQL.");
        }

        const groupBy = QueryExpressionBuilder.buildGroupByFromExpressions(this.parsedExpressions).trim();
        const having = QueryExpressionBuilder.buildHavingFromExpressions(this.parsedExpressions).trim();

        return `${sqlBeforeFromMatch[0].replace(" FROM", "")}, ${projectionClauses}
            ${innerSql.slice(sqlBeforeFromMatch.index! + sqlBeforeFromMatch[0].length - 5)}
            ${groupBy != "" ? "GROUP BY " + groupBy : ""}
            ${having != "" ? "HAVING " + having : ""}`;
    }

    private appendExpressionClauses(): void {
        const orderBy = QueryExpressionBuilder.buildOrderByFromExpressions(this.parsedExpressions);

        const expressionWheres = this.parsedExpressions
            .filter(expr => expr.whereClause)
            .map(expr => expr.whereClause);

        if (expressionWheres.length > 0) {
            this._whereClauses ??= [];
            this._whereClauses.push(...expressionWheres.filter(w => w !== undefined));
        }

        if (orderBy) {
            this._orderByClauses ??= [];
            this._orderByClauses.push(orderBy);
        }
    }
}