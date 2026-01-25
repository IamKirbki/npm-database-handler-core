import {
    QueryWhereCondition,
    QueryComparisonParameters,
    BaseQueryOptions,
    PrettyQueryOptions,
    FinalQueryOptions,
    QueryLayers,
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

export default class QueryStatementBuilder {
    private base: BaseQueryOptions;
    private pretty?: PrettyQueryOptions;
    private final?: FinalQueryOptions;

    constructor(queryLayers: QueryLayers) {
        this.base = queryLayers.base;
        this.pretty = queryLayers.pretty;
        this.final = queryLayers.final;
    }

    public async build(): Promise<string> {
        let sql = await this.buildBaseLayer();

        if (this.pretty) {
            sql = await this.buildPrettyLayer(sql);
        }

        if (this.final) {
            sql = await this.buildFinalLayer(sql);
        }

        return sql;
    }

    private async buildBaseLayer(): Promise<string> {
        if (!this.base.from) {
            throw new Error("Base layer must specify 'from' table name.");
        }

        let builder: IQueryBuilder = new BaseSelectQueryBuilder(this.base.from, this.base.select || "*");

        if (this.base.joins && this.base.joins.length > 0) {
            builder = new JoinDecorator(builder, { base: this.base, pretty: this.pretty, final: this.final }, new Query({ tableName: this.base.from }));
        }

        if (this.base.expressions && this.base.expressions.length > 0) {
            const expressions = QueryExpressionBuilder.buildExpressionsPart(this.base.expressions || []);
            builder = new ExpressionDecorator(builder, expressions || []);

            if (this.base.where) {
                builder = new WhereDecorator(builder, this.base.joins ? QueryStatementBuilder.normalizeAndQualifyConditions(this.base.where, this.base.from) : this.base.where);
            }
        } else if (this.base.where) {
            builder = new WhereDecorator(builder, this.base.joins ? QueryStatementBuilder.normalizeAndQualifyConditions(this.base.where, this.base.from) : this.base.where);
        }

        return await builder.build();
    }

    private async buildPrettyLayer(sql: string): Promise<string> {
        let builder: IQueryBuilder = new BaseSelectQueryBuilder(`( ${sql} ) AS BASE_QUERY`, this.pretty?.select || "*");

        if (this.pretty) {
            const expressions = this.pretty.expressions?.length
                ? QueryExpressionBuilder.buildExpressionsPart(this.pretty.expressions)
                : [];

            if (expressions.length > 0) {
                builder = new ExpressionDecorator(builder, expressions);

                if (this.pretty.where) {
                    builder = new WhereDecorator(
                        builder,
                        QueryStatementBuilder.normalizeAndQualifyConditions(this.pretty.where, "BASE_QUERY"),
                    );
                }
            } else if (this.pretty.where) {
                builder = new WhereDecorator(
                    builder,
                    QueryStatementBuilder.normalizeAndQualifyConditions(this.pretty.where, "BASE_QUERY"),
                );
            }

            if (this.pretty.groupBy) {
                builder = new GroupByDecorator(builder, this.pretty.groupBy);
            }

            if (this.pretty.having) {
                builder = new WhereDecorator(
                    builder,
                    QueryStatementBuilder.normalizeAndQualifyConditions(this.pretty.having, "BASE_QUERY"),
                );
            }
        }

        return await builder.build();
    }

    private async buildFinalLayer(sql: string): Promise<string> {
        let builder: IQueryBuilder = new BaseSelectQueryBuilder(`( ${sql} ) AS PRETTY_QUERY`, this.final?.select || "*");

        if (this.final) {
            if (this.final.orderBy) {
                builder = new OrderByDecorator(builder, this.final.orderBy);
            }

            if (this.final.limit) {
                builder = new LimitDecorator(builder, this.final.limit, this.final.offset);
            }
        }

        return await builder.build();
    }

    private static normalizeAndQualifyConditions(
        where: QueryWhereCondition,
        tableName: string,
        normalizeBlacklist: string[] = [],
    ): QueryComparisonParameters[] {
        let conditions: QueryComparisonParameters[];

        if (Array.isArray(where)) {
            conditions = where;
        } else {
            conditions = Object.entries(where).map(([column, value]) => ({
                column,
                operator: "=" as const,
                value,
            }));
        }

        // Step 2: Qualify column names with the base table.
        // Skip qualification if:
        // - Column is in the blacklist (e.g., expression aliases like "Relevance")
        // - Column already contains a dot (already qualified)
        return conditions.map((condition) => {
            const shouldSkipQualification =
                normalizeBlacklist.some((blk) => condition.column.includes(blk)) ||
                condition.column.includes(".");

            return {
                ...condition,
                column: shouldSkipQualification
                    ? condition.column
                    : `${tableName}.${condition.column}`,
            };
        });
    }
}
