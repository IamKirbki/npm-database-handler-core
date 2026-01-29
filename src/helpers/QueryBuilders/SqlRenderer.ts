import { QueryComparisonParameters, QueryContext } from "@core/types/query.js";

export default class SqlRenderer {
    private _context: QueryContext;

    constructor(context: QueryContext) {
        this._context = context;
    }

    public build(): string {
        return [
            this.renderSelect(),
            this.renderFrom(),
            this._context.joins?.join(" "),
            this.renderWhere(),
            this.renderGroupBy(),
            this.renderOrderBy(),
            this.renderLimit(),
            this.renderOffset()
        ].map(e => e?.trim()).filter(e => e !== "").join(" ");
    }

    private renderSelect(): string {
        const selects: string[] = [];
        if (this._context.select && this._context.select.length > 0) {
            selects.push(...this._context.select);
        } else if (!this._context.joinsSelect || this._context.joinsSelect.length === 0) {
            selects.push('*');
        }

        selects.push(...(this._context.joinsSelect || []));
        selects.push(...(this._context.expressionSelect || []));
        return selects.length > 0 ? `SELECT ${selects.join(", ")}` : "SELECT *";
    }

    private renderFrom(): string {
        return this._context.from ? `FROM ${this._context.from}` : "";
    }

    private renderWhere(): string {
        if (
            !this._context.conditions?.where ||
            Object.keys(this._context.conditions.where).length === 0
        ) {
            return "";
        }

        return `WHERE ${this.buildWhereWithOperators(this._context.conditions.where)}`;
    }

    private buildWhereWithOperators(where: (QueryComparisonParameters & { fromOperator?: boolean })[]): string {
        return where
            .map((condition) => {
                const colName = condition.column.trim();
                const paramName = colName.includes(".") ? colName.split(".").pop()?.trim() : colName;
                return `${colName} ${condition.operator} @${paramName}`;
            })
            .filter(Boolean)
            .join(" AND ");
    }

    private renderOrderBy(): string {
        if (!this._context.orderBy || this._context.orderBy.length === 0) {
            return "";
        }

        const orderByClauses = this._context.orderBy.map(ob => {
            return `${ob.column} ${ob.direction}`;
        });

        return `ORDER BY ${orderByClauses.join(", ")}`;
    }

    private renderGroupBy(): string {
        if (!this._context.groupBy || this._context.groupBy.length === 0) {
            return "";
        }

        return `GROUP BY ${this._context.groupBy.join(", ")}`;
    }

    private renderLimit(): string {
        if (!this._context.limit) {
            return "";
        }

        return `LIMIT ${this._context.limit}`;
    }

    private renderOffset(): string {
        if (!this._context.offset) {
            return "";
        }

        return `OFFSET ${this._context.offset}`;
    }
}