import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import QueryDecorator from "./QueryDecorator.js";
import ExpressionDecorator from "./ExpressionDecorator.js";

export default class OrderByDecorator extends QueryDecorator {
    private orderByColumns?: string;
    private _extraOrderByClauses?: string[];

    public get extraOrderByClauses(): string[] {
        return this._extraOrderByClauses || [];
    }

    constructor(component: IQueryBuilder, orderByColumns?: string) {
        super(component);
        this.orderByColumns = orderByColumns;

        // Extract extra clauses from ExpressionDecorator if present in the chain
        const expressionDecorator = this.findDecoratorInChain(ExpressionDecorator);
        if (expressionDecorator) {
            this._extraOrderByClauses = expressionDecorator.extraOrderByClauses;
        }
    }

    async build(): Promise<string> {
        const baseQuery = await this.component.build();
        let extraOrderBy = "";

        // Find ExpressionDecorator in the chain to get extra ORDER BY clauses
        const expressionDecorator = this.findDecoratorInChain(ExpressionDecorator);
        if (expressionDecorator) {
            const extraClauses = expressionDecorator.extraOrderByClauses.filter(clause => clause !== "");
            if (extraClauses.length > 0) {
                extraOrderBy = extraClauses.join(", ");
            }
        }

        const orderByClause = this.processOrderBy(this.orderByColumns, extraOrderBy);

        if (!orderByClause) return baseQuery;

        return `${baseQuery} ${orderByClause}`;
    }

    processOrderBy(orderBy?: string, extraOrderBy?: string): string {
        const allOrderBys = [orderBy, extraOrderBy].filter(o => o && o.trim() !== "");

        if (allOrderBys.length === 0) {
            return "";
        }

        return `ORDER BY ${allOrderBys.join(", ")}`;
    }
}