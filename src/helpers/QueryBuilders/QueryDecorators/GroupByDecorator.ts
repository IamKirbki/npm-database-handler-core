import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import QueryDecorator from "./QueryDecorator.js";
import ExpressionDecorator from "./ExpressionDecorator.js";

export default class GroupByDecorator extends QueryDecorator {
    private groupByColumns?: string;
    private _extraOrderByClauses?: string[];

    public get extraOrderByClauses(): string[] {
        return this._extraOrderByClauses || [];
    }

    constructor(component: IQueryBuilder, groupByColumns?: string) {
        super(component);
        this.groupByColumns = groupByColumns;

        const expressionDecorator = this.findDecoratorInChain(ExpressionDecorator);
        if (expressionDecorator) {
            this._extraOrderByClauses = expressionDecorator.orderByClauses;
        }
    }

    async build(): Promise<string> {
        const baseQuery = await this.component.build();
        const groupByClause = this.processGroupBy(this.groupByColumns);
        if (!groupByClause) return baseQuery;

        return `${baseQuery} ${groupByClause}`;
    }

    processGroupBy(groupBy?: string): string {
        const allGroupBys = [groupBy].filter(g => g && g.trim() !== "");

        if (allGroupBys.length === 0) {
            return "";
        }

        return `GROUP BY ${allGroupBys.join(", ")}`;
    }
}