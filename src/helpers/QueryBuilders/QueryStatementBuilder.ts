import {
    QueryWhereCondition,
    QueryComparisonParameters,
    QueryLayers,
    QueryContext,
    TableColumnInfo,
} from "@core/types/index.js";
import BaseSelectQueryBuilder from "./BaseQueryBuilders/BaseSelectQueryBuilder.js";
import ExpressionDecorator from "./QueryDecorators/ExpressionDecorator.js";
import QueryExpressionBuilder from "./QueryExpressionBuilder.js";
import WhereDecorator from "./QueryDecorators/WhereDecorator.js";
import JoinDecorator from "./QueryDecorators/JoinDecorator.js";
import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import GroupByDecorator from "./QueryDecorators/GroupByDecorator.js";
import OrderByDecorator from "./QueryDecorators/OrderByDecorator.js";
import LimitDecorator from "./QueryDecorators/LimitDecorator.js";
import SqlRenderer from "./SqlRenderer.js";

export default class QueryStatementBuilder {
    private _layers: QueryLayers;
    private _contexts: {
        base?: QueryContext;
        pretty?: QueryContext;
        final?: QueryContext;
    } = {};

    private _tableColumnsCache: Map<string, TableColumnInfo[]> = new Map();
    private _valueClauseKeywords: Set<string> = new Set();

    constructor(queryLayers: QueryLayers, tableColumnInformation?: Map<string, TableColumnInfo[]>) {
        this._layers = queryLayers;

        if (tableColumnInformation) {
            this._tableColumnsCache = tableColumnInformation;
        }
    }

    public async build(): Promise<string> {
        let sql = await this.buildBaseLayer();

        if (this._layers.pretty) {
            sql = await this.buildPrettyLayer(sql);
        }

        if (this._layers.final) {
            sql = await this.buildFinalLayer(sql);
        }

        return sql;
    }

    private async buildBaseLayer(): Promise<string> {
        if (!this._layers.base.from) {
            throw new Error("Base layer must specify 'from' table name.");
        }

        let builder: IQueryBuilder = new BaseSelectQueryBuilder(this._layers.base.from, this._layers.base.select || [], this._layers.base.joinsSelect || [], this._layers.base.expressionsSelect || []);

        if (this._layers.base.joins && this._layers.base.joins.length > 0) {
            builder = new JoinDecorator(builder, { base: this._layers.base, pretty: this._layers.pretty, final: this._layers.final }, this._tableColumnsCache);
        }

        if (this._layers.base.expressions && this._layers.base.expressions.length > 0) {
            const expressions = QueryExpressionBuilder.buildExpressionsPart(this._layers.base.expressions || []);
            builder = new ExpressionDecorator(builder, expressions || []);
            if (builder instanceof ExpressionDecorator) {
                this._valueClauseKeywords = new Set([...this._valueClauseKeywords, ...builder.valueClauseKeywords]);

                this._layers.pretty ??= {};
                this._layers.final ??= {};

                this._layers.pretty.where = this.addUnique(this._layers.pretty.where, builder.whereClauses);
                this._layers.pretty.groupBy = this.addUnique(this._layers.pretty.groupBy, builder.groupByClauses);
                this._layers.pretty.having = this.addUnique(this._layers.pretty.having, builder.havingClauses);
                this._layers.base.orderBy = this.addUnique(this._layers.base.orderBy?.map(ob => ({ column: `${ob.column}`, direction: ob.direction })), builder.orderByClauses);
            }

            if (this._layers.base.where) {
                builder = new WhereDecorator(builder, this._layers.base.joins ? QueryStatementBuilder.normalizeAndQualifyConditions(this._layers.base.where, this._layers.base.from) : this._layers.base.where);
            }
        } else if (this._layers.base.where) {
            builder = new WhereDecorator(builder, this._layers.base.joins ? QueryStatementBuilder.normalizeAndQualifyConditions(this._layers.base.where, this._layers.base.from) : this._layers.base.where);
        }

        if (this._layers.base.orderBy) {
            builder = new OrderByDecorator(builder, this._layers.base.orderBy);
        }

        this._contexts.base = await builder.build();

        const renderer = new SqlRenderer(this._contexts.base);
        return renderer.build();
    }

    private async buildPrettyLayer(sql: string): Promise<string> {
        let builder: IQueryBuilder = new BaseSelectQueryBuilder(`( ${sql} ) AS BASE_QUERY`, [...this._contexts.base?.select || [], ...this._layers.pretty?.select || []], this._contexts.base?.joinsSelect?.map(j => j.split("AS")[1].trim()) || []);

        if (this._layers.pretty) {
            const expressions = this._layers.pretty.expressions?.length
                ? QueryExpressionBuilder.buildExpressionsPart(this._layers.pretty.expressions)
                : [];

            if (expressions.length > 0) {
                builder = new ExpressionDecorator(builder, expressions);
                if (builder instanceof ExpressionDecorator) {
                    this._layers.pretty.where = this.addUnique(this._layers.pretty.where, builder.whereClauses);
                    this._layers.pretty.groupBy = this.addUnique(this._layers.pretty.groupBy, builder.groupByClauses);
                    this._layers.pretty.having = this.addUnique(this._layers.pretty.having, builder.havingClauses);
                    this._layers.final ??= {};
                    this._layers.final.orderBy = this.addUnique(this._layers.final.orderBy?.map(ob => ({ column: `BASE_QUERY.${ob.column}`, direction: ob.direction })), builder.orderByClauses);
                }

                if (this._layers.pretty.where) {
                    builder = new WhereDecorator(
                        builder,
                        QueryStatementBuilder.normalizeAndQualifyConditions(this._layers.pretty.where, "BASE_QUERY", [], this._valueClauseKeywords),
                    );
                }
            } else if (this._layers.pretty.where) {
                builder = new WhereDecorator(
                    builder,
                    QueryStatementBuilder.normalizeAndQualifyConditions(this._layers.pretty.where, "BASE_QUERY", [], this._valueClauseKeywords),
                );
            }

            if (this._layers.pretty.groupBy) {
                builder = new GroupByDecorator(builder, this._layers.pretty.groupBy);
            }

            if (this._layers.pretty.having) {
                builder = new WhereDecorator(
                    builder,
                    QueryStatementBuilder.normalizeAndQualifyConditions(this._layers.pretty.having, "BASE_QUERY"),
                );
            }
        }

        this._contexts.pretty = await builder.build();
        const renderer = new SqlRenderer(this._contexts.pretty);
        return renderer.build();
    }

    private async buildFinalLayer(sql: string): Promise<string> {
        let builder: IQueryBuilder = new BaseSelectQueryBuilder(`( ${sql} ) AS PRETTY_QUERY`, this._layers.final?.select || []);
        if (this._layers.final) {
            if (this._layers.final.orderBy) {
                builder = new OrderByDecorator(builder, this._layers.final.orderBy);
            }

            if (this._layers.final.limit) {
                builder = new LimitDecorator(builder, this._layers.final.limit, this._layers.final.offset);
            }
        }

        this._contexts.final = await builder.build();
        const renderer = new SqlRenderer(this._contexts.final);
        return renderer.build();
    }

    public static normalizeAndQualifyConditions(
        where: QueryWhereCondition,
        tableName: string,
        normalizeBlacklist: string[] = [],
        valueClauseKeywords: Set<string> = new Set(),
    ): QueryComparisonParameters[] {
        const conditions = this.normalizeQueryConditions(where);
        return conditions.map((condition) => {
            const shouldSkipQualification =
                normalizeBlacklist.some((blk) => condition.column.includes(blk)) ||
                condition.column.includes(".");

            const isValueClauseKeyword = valueClauseKeywords.has(condition.column);
            if (isValueClauseKeyword) {
                return;
            }

            return {
                ...condition,
                column: shouldSkipQualification
                    ? condition.column
                    : `${tableName}.${condition.column}`,
            };
        }).filter(cond => cond !== undefined);
    }

    public static normalizeQueryConditions(
        where: QueryWhereCondition,
    ): QueryComparisonParameters[] {
        if (Array.isArray(where)) {
            return where;
        } else {
            return Object.entries(where).map(([column, value]) => ({
                column,
                operator: "=" as const,
                value,
            }));
        }
    }

    private addUnique<T>(target: T[] | undefined, values: T[] | undefined): T[] {
        if (!values?.length) return target ?? [];
        const set = new Set((target ?? []).map(v => JSON.stringify(v)));
        for (const v of values) {
            const key = JSON.stringify(v);
            if (!set.has(key)) set.add(key);
        }
        return Array.from(set).map(s => JSON.parse(s));
    };
}
