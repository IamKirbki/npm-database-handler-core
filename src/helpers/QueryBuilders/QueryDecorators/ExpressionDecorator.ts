import { PossibleExpressions, expressionClause } from "@core/types/index.js";
import QueryDecorator from "./QueryDecorator.js";
import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import QueryExpressionBuilder from "../QueryExpressionBuilder.js";

export default class ExpressionDecorator extends QueryDecorator {
    private parsedExpressions: expressionClause[];
    private _extraWhereClauses?: string[];
    private _extraOrderByClauses?: string[];

    public get extraWhereClauses(): string[] {
        return this._extraWhereClauses || [];
    }

    public get extraOrderByClauses(): string[] {
        return this._extraOrderByClauses || [];
    }

    constructor(
        component: IQueryBuilder,
        rawExpressions: PossibleExpressions[]
    ) {
        super(component);
        this.parsedExpressions = QueryExpressionBuilder.buildExpressionsPart(rawExpressions);
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
        const baseExpressions = QueryExpressionBuilder.filterExpressionsByPhase(this.parsedExpressions, "base");
        if (baseExpressions.length === 0) return sql;

        const clauses = baseExpressions.map(e => e.baseExpressionClause).join(", ");
        return sql.replace(/\bFROM\b/i, `, ${clauses} FROM`);
    }

    private wrapQuery(innerSql: string): string {
        const projectionExpressions = QueryExpressionBuilder.filterExpressionsByPhase(this.parsedExpressions, "projection");
        const projectionClauses = projectionExpressions.map(e => e.baseExpressionClause).join(", ");

        const sqlBeforeFromMatch = innerSql.match(/SELECT\s+(.*?)\s+FROM/i);
        if (!sqlBeforeFromMatch) {
            throw new Error("Could not find SELECT ... FROM clause in the inner SQL.");
        }

        return `SELECT * FROM (
            ${sqlBeforeFromMatch[0].replace(" FROM", "")}, ${projectionClauses}
            ${innerSql.slice(sqlBeforeFromMatch.index! + sqlBeforeFromMatch[0].length - 5)}
            GROUP BY ${QueryExpressionBuilder.buildGroupByFromExpressions(this.parsedExpressions)}
        )`;
    }

    private appendExpressionClauses(): void {
        const orderBy = QueryExpressionBuilder.buildOrderByFromExpressions(this.parsedExpressions);

        const expressionWheres = this.parsedExpressions
            .filter(expr => expr.whereClause)
            .map(expr => expr.whereClause);

        if (expressionWheres.length > 0) {
            this._extraWhereClauses ??= [];
            this._extraWhereClauses.push(...expressionWheres.filter(w => w !== undefined));
        }

        if (orderBy) {
            this._extraOrderByClauses ??= [];
            this._extraOrderByClauses.push(orderBy);
        }
    }
}