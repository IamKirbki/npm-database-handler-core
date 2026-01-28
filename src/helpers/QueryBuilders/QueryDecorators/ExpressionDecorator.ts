import { expressionClause, OrderByDefinition, QueryComparisonParameters, QueryContext } from "@core/types/index.js";
import QueryDecorator from "./QueryDecorator.js";
import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import QueryStatementBuilder from "../QueryStatementBuilder.js";

export default class ExpressionDecorator extends QueryDecorator {
    private parsedExpressions: expressionClause[];
    public whereClauses?: QueryComparisonParameters[];
    public orderByClauses?: OrderByDefinition[];
    public groupByClauses?: string[];
    public havingClauses?: QueryComparisonParameters[];
    public valueClauseKeywords: Set<string> = new Set();

    constructor(
        component: IQueryBuilder,
        expressions: expressionClause[]
    ) {
        super(component);
        this.parsedExpressions = expressions;
        this.setWhereClauses();
        this.setOrderByClauses();
        this.setGroupByClauses();
        this.setHavingClauses();
        this.setValueClauseKeywords();
    }

    async build(): Promise<QueryContext> {
        const context: QueryContext = await this.component.build();

        context.expressionSelect ??= [];
        context.expressionSelect.push(...this.parsedExpressions.map(e => e.baseExpressionClause));
        context.conditions ??= {};

        return context;
    }

    public setWhereClauses(): void {
        this.whereClauses = this.parsedExpressions
            .flatMap(expr =>
                expr.whereClause
                    ? QueryStatementBuilder.normalizeQueryConditions(expr.whereClause)
                    : []
            );
    }

    public setOrderByClauses(): void {
        this.orderByClauses = this.parsedExpressions.map(expr => expr.orderByClause).filter(o => o !== undefined);
    }

    public setGroupByClauses(): void {
        this.groupByClauses = this.parsedExpressions.map(expr => expr.groupByClause).filter(g => g !== undefined);
    }

    public setHavingClauses(): void {
        this.havingClauses = this.parsedExpressions
            .flatMap(expr =>
                expr.havingClause
                    ? QueryStatementBuilder.normalizeQueryConditions(expr.havingClause)
                    : []
            );
    }

    public setValueClauseKeywords(): void {
        this.parsedExpressions.forEach(expr => {
            if (expr.valueClauseKeywords && expr.valueClauseKeywords.length > 0) {
                for (const keyword of expr.valueClauseKeywords) {
                    this.valueClauseKeywords.add(keyword);
                }
            }
        });
    }
}