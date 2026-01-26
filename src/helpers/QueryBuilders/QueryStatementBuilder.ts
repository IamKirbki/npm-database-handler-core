import {
    QueryWhereCondition,
    QueryComparisonParameters,
    QueryLayers,
    QueryContext,
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
import { Query } from "@core/index.js";
import SqlRenderer from "./SqlRenderer.js";

export default class QueryStatementBuilder {
    private layers: QueryLayers;
    private contexts: {
        base?: QueryContext;
        pretty?: QueryContext;
        final?: QueryContext;
    } = {};
    private valueClauseKeywords: Set<string> = new Set();

    constructor(queryLayers: QueryLayers) {
        this.layers = queryLayers;
    }

    public async build(): Promise<string> {
        let sql = await this.buildBaseLayer();

        if (this.layers.pretty) {
            sql = await this.buildPrettyLayer(sql);
        }

        if (this.layers.final) {
            sql = await this.buildFinalLayer(sql);
        }

        return sql;
    }

    private async buildBaseLayer(): Promise<string> {
        if (!this.layers.base.from) {
            throw new Error("Base layer must specify 'from' table name.");
        }

        let builder: IQueryBuilder = new BaseSelectQueryBuilder(this.layers.base.from, this.layers.base.select || [], this.layers.base.joinsSelect || [], this.layers.base.expressionsSelect || []);

        if (this.layers.base.joins && this.layers.base.joins.length > 0) {
            builder = new JoinDecorator(builder, { base: this.layers.base, pretty: this.layers.pretty, final: this.layers.final }, new Query({ tableName: this.layers.base.from }));
        }

        if (this.layers.base.expressions && this.layers.base.expressions.length > 0) {
            const expressions = QueryExpressionBuilder.buildExpressionsPart(this.layers.base.expressions || []);
            builder = new ExpressionDecorator(builder, expressions || []);
            if (builder instanceof ExpressionDecorator) {
                this.valueClauseKeywords = new Set([...this.valueClauseKeywords, ...builder.valueClauseKeywords]);

                this.layers.pretty ??= {};
                this.layers.final ??= {};

                this.layers.pretty.where = this.addUnique(this.layers.pretty.where, builder.whereClauses);
                this.layers.pretty.groupBy = this.addUnique(this.layers.pretty.groupBy, builder.groupByClauses);
                this.layers.pretty.having = this.addUnique(this.layers.pretty.having, builder.havingClauses);
                // this.layers.final.orderBy = this.addUnique(this.layers.final.orderBy?.map(ob => ({ column: `BASE_QUERY.${ob.column}`, direction: ob.direction })), builder.orderByClauses);
            }

            if (this.layers.base.where) {
                builder = new WhereDecorator(builder, this.layers.base.joins ? QueryStatementBuilder.normalizeAndQualifyConditions(this.layers.base.where, this.layers.base.from) : this.layers.base.where);
            }
        } else if (this.layers.base.where) {
            builder = new WhereDecorator(builder, this.layers.base.joins ? QueryStatementBuilder.normalizeAndQualifyConditions(this.layers.base.where, this.layers.base.from) : this.layers.base.where);
        }

        this.contexts.base = await builder.build();
        const renderer = new SqlRenderer(this.contexts.base);
        return renderer.build();
    }

    private async buildPrettyLayer(sql: string): Promise<string> {
        let builder: IQueryBuilder = new BaseSelectQueryBuilder(`( ${sql} ) AS BASE_QUERY`, [...this.contexts.base?.select || [], ...this.layers.pretty?.select || []], this.contexts.base?.joinsSelect?.map(j => j.split("AS")[1].trim()) || []);

        if (this.layers.pretty) {
            const expressions = this.layers.pretty.expressions?.length
                ? QueryExpressionBuilder.buildExpressionsPart(this.layers.pretty.expressions)
                : [];

            if (expressions.length > 0) {
                builder = new ExpressionDecorator(builder, expressions);
                if (builder instanceof ExpressionDecorator) {
                    this.layers.pretty.where = this.addUnique(this.layers.pretty.where, builder.whereClauses);
                    this.layers.pretty.groupBy = this.addUnique(this.layers.pretty.groupBy, builder.groupByClauses);
                    this.layers.pretty.having = this.addUnique(this.layers.pretty.having, builder.havingClauses);
                    this.layers.final ??= {};
                    // this.layers.final.orderBy = this.addUnique(this.layers.final.orderBy?.map(ob => ({ column: `BASE_QUERY.${ob.column}`, direction: ob.direction })), builder.orderByClauses);
                }

                if (this.layers.pretty.where) {
                    builder = new WhereDecorator(
                        builder,
                        QueryStatementBuilder.normalizeAndQualifyConditions(this.layers.pretty.where, "BASE_QUERY", [], this.valueClauseKeywords),
                    );
                }
            } else if (this.layers.pretty.where) {
                builder = new WhereDecorator(
                    builder,
                    QueryStatementBuilder.normalizeAndQualifyConditions(this.layers.pretty.where, "BASE_QUERY", [], this.valueClauseKeywords),
                );
            }

            if (this.layers.pretty.groupBy) {
                builder = new GroupByDecorator(builder, this.layers.pretty.groupBy);
            }

            if (this.layers.pretty.having) {
                builder = new WhereDecorator(
                    builder,
                    QueryStatementBuilder.normalizeAndQualifyConditions(this.layers.pretty.having, "BASE_QUERY"),
                );
            }
        }

        this.contexts.pretty = await builder.build();
        const renderer = new SqlRenderer(this.contexts.pretty);
        return renderer.build();
    }

    private async buildFinalLayer(sql: string): Promise<string> {
        let builder: IQueryBuilder = new BaseSelectQueryBuilder(`( ${sql} ) AS PRETTY_QUERY`, this.layers.final?.select || []);
        if (this.layers.final) {
            if (this.layers.final.orderBy) {
                builder = new OrderByDecorator(builder, this.layers.final.orderBy);
            }

            if (this.layers.final.limit) {
                builder = new LimitDecorator(builder, this.layers.final.limit, this.layers.final.offset);
            }
        }

        this.contexts.final = await builder.build();
        const renderer = new SqlRenderer(this.contexts.final);
        return renderer.build();
    }

    public static normalizeAndQualifyConditions(
        where: QueryWhereCondition,
        tableName: string,
        normalizeBlacklist: string[] = [],
        valueClauseKeywords: Set<string> = new Set(),
    ): QueryComparisonParameters[] {
        const conditions = this.normalizeQueryConditions(where);

        // Step 2: Qualify column names with the base table.
        // Skip qualification if:
        // - Column is in the blacklist (e.g., expression aliases like "Relevance")
        // - Column already contains a dot (already qualified)
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
