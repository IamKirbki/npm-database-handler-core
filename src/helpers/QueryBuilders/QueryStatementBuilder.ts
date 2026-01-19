import { Query } from "@core/index.js";
import {
    DefaultQueryParameters,
    ExtraQueryParameters,
    QueryWhereCondition,
    Join,
    QueryComparisonParameters,
    QueryIsEqualParameter,
    expressionClause,
} from "@core/types/index.js";
import QueryExpressionBuilder from "./QueryExpressionBuilder.js";
import LimitDecorator from "./QueryDecorators/LimitDecorator.js";
import WhereDecorator from "./QueryDecorators/WhereDecorator.js";
import ExpressionDecorator from "./QueryDecorators/ExpressionDecorator.js";
import JoinDecorator from "./QueryDecorators/JoinDecorator.js";
import BaseSelectQueryBuilder from "./BaseQueryBuilders/BaseSelectQueryBuilder.js";
import IQueryBuilder from "@core/interfaces/IQueryBuilder.js";
import OrderByDecorator from "./QueryDecorators/OrderByDecorator.js";
import GroupByDecorator from "./QueryDecorators/GroupByDecorator.js";

/**
 * Utility class responsible for converting structured query intent
 * into concrete SQL statements.
 *
 * This builder is expression-aware:
 * - It understands base vs projection expressions
 * - It knows when a query must be wrapped
 * - It coordinates WHERE / ORDER BY placement across query layers
 *
 * IMPORTANT MENTAL MODEL:
 * - Base query = tables + joins + base expressions
 * - Projection query = computed expressions that require SELECT aliasing
 */
export default class QueryStatementBuilder {
    /**
     * Build a SELECT SQL statement.
     *
     * This method supports:
     * - Literal WHERE conditions
     * - Computed expressions (base + projection)
     * - Automatic query wrapping when projection expressions are present
     *
     * The actual query shape (flat vs wrapped) is delegated to the
     * QueryExpressionBuilder.
     */
    public static async BuildSelect(
        tableName: string,
        options: DefaultQueryParameters & ExtraQueryParameters = { select: "*" },
    ): Promise<string> {
        let builder: IQueryBuilder = new BaseSelectQueryBuilder(tableName, options.select);
        builder = new ExpressionDecorator(builder, options.expressions || []);

        if (options?.where) {
            const expressions = QueryExpressionBuilder.buildExpressionsPart(options?.expressions ?? []);
            builder = new WhereDecorator(builder, options.where, expressions);
        }

        builder = new GroupByDecorator(builder, options.groupBy);
        if (options.limit) {
            builder = new LimitDecorator(builder, options.limit, options.offset);
        }

        builder = new OrderByDecorator(builder, options.orderBy);
        return await builder.build();
    }

    /**
     * Build an INSERT statement with named placeholders.
     *
     * Values are not inlined — parameter binding happens later.
     */
    public static BuildInsert(
        tableName: string,
        record: QueryIsEqualParameter,
    ): string {
        const columns = Object.keys(record);
        const placeholders = columns.map((col) => `@${col}`);

        return [
            `INSERT INTO "${tableName}"`,
            `(${columns.map((c) => `"${c}"`).join(", ")})`,
            `VALUES (${placeholders.join(", ")})`,
        ].join(" ");
    }

    /**
     * Build an UPDATE statement.
     *
     * NOTE:
     * WHERE parameters are namespaced with `where_` to avoid
     * collisions with SET parameters.
     */
    public static BuildUpdate(
        tableName: string,
        record: QueryWhereCondition,
        where: QueryWhereCondition,
    ): string {
        const setClauses = Object.keys(record).map((col) => `${col} = @${col}`);

        return [
            `UPDATE "${tableName}"`,
            `SET ${setClauses.join(", ")}`,
            this.BuildWhere(where).replace(/@(\w+)/g, "@where_$1"),
        ].join(" ");
    }

    /**
     * Build a DELETE statement.
     */
    public static BuildDelete(
        tableName: string,
        where: QueryWhereCondition,
    ): string {
        return [`DELETE FROM "${tableName}"`, this.BuildWhere(where)].join(" ");
    }

    /**
     * Build a COUNT query.
     *
     * This is intentionally expression-agnostic.
     * Projection expressions should not affect counts unless explicitly wrapped.
     */
    public static BuildCount(
        tableName: string,
        where?: QueryWhereCondition,
    ): string {
        return [
            `SELECT COUNT(*) as count FROM "${tableName}"`,
            this.BuildWhere(where),
        ].join(" ");
    }

    /**
     * Build a WHERE clause from structured conditions.
     *
     * Supports:
     * - simple equality objects
     * - operator-based condition arrays
     *
     * @param skipExpressionConditions - If true, skip conditions that match expression whereClauseKeywords.
     *                                    Used in inner queries where expression aliases don't exist yet.
     */
    public static BuildWhere(
        where?: QueryWhereCondition,
        expressions?: expressionClause[],
        skipExpressionConditions?: boolean,
    ): string {
        if (
            !where ||
            (Array.isArray(where) && where.length === 0) ||
            Object.keys(where).length === 0 ||
            where instanceof Date
        ) {
            return "";
        }

        const isSimpleObject =
            !Array.isArray(where) && typeof where === "object";

        return [
            "WHERE",
            isSimpleObject
                ? this.buildWhereSimple(where as QueryIsEqualParameter, expressions, skipExpressionConditions)
                : this.buildWhereWithOperators(
                    where as QueryComparisonParameters[],
                    expressions,
                    skipExpressionConditions,
                ),
        ].join(" ");
    }

    private static buildWhereWithOperators(
        where: QueryComparisonParameters[],
        expressions?: expressionClause[],
        skipExpressionConditions?: boolean,
    ): string {
        return where
            .map((condition) => {
                const matchedExpression = expressions?.find(
                    (expr) => expr.whereClauseKeyword === condition.column,
                );
                if (matchedExpression) {
                    // Skip expression conditions in inner query (they go in literalWhere/outer query)
                    if (skipExpressionConditions) {
                        return null;
                    }
                    const alias = condition.column.split("_")[0];
                    return `${alias} ${condition.operator} @${condition.column.trim()}`;
                } else {
                    return `${condition.column} ${condition.operator} @${condition.column.trim()}`;
                }
            })
            .filter(Boolean)
            .join(" AND ");
    }

    private static buildWhereSimple(
        where: QueryIsEqualParameter,
        expressions?: expressionClause[],
        skipExpressionConditions?: boolean,
    ): string {
        return Object.keys(where)
            .map((col) => {
                const matchedExpression = expressions?.find(
                    (expr) => expr.whereClauseKeyword === col,
                );
                if (matchedExpression) {
                    if (skipExpressionConditions) {
                        return null;
                    }

                    const alias = col.split("_")[0];
                    return `${alias} = @${col}`;
                } else {
                    return `${col} = @${col}`;
                }
            })
            .filter(Boolean)
            .join(" AND ");
    }

    /**
     * Build a SELECT query with JOINs.
     *
     * This method is expression-aware and will automatically
     * switch to a wrapped query if projection expressions are present.
     */
    public static async BuildJoin(
        fromTableName: string,
        joins: Join | Join[],
        query: Query,
        options?: DefaultQueryParameters & ExtraQueryParameters,
    ): Promise<string> {
        const expressions = QueryExpressionBuilder.buildExpressionsPart(options?.expressions ?? []);

        let builder: IQueryBuilder = new BaseSelectQueryBuilder(fromTableName);
        builder = new JoinDecorator(builder, fromTableName, joins, query, options);

        if (options?.where) {
            const qualifiedWhere = this.normalizeAndQualifyConditions(options.where, fromTableName);
            builder = new WhereDecorator(builder, qualifiedWhere, expressions);
        }

        builder = new ExpressionDecorator(builder, options?.expressions ?? []);
        builder = new WhereDecorator(builder, {}, expressions);
        builder = new GroupByDecorator(builder);

        if (options?.limit) {
            builder = new LimitDecorator(builder, options.limit, options.offset);
        }

        builder = new OrderByDecorator(builder, options?.orderBy);
        return await builder.build();
    }

    /**
     * Normalizes and qualifies WHERE conditions for JOIN queries.
     *
     * This function exists because JOIN queries are a lawless wasteland:
     * unqualified column names WILL collide, ambiguity WILL happen,
     * and Postgres WILL scream at you in ALL CAPS.
     *
     * Responsibilities:
     * 1. Normalize WHERE input into a comparison-array format
     *    - Object form: { id: 1 }
     *    - Array form:  [{ column, operator, value }]
     *
     * 2. Qualify column names with the base table
     *    - Prevents "column reference is ambiguous"
     *    - Preserves already-qualified columns
     *
     * This ensures WHERE clauses are:
     * - structurally consistent
     * - safe for JOIN-heavy queries
     * - predictable for expression injection later
     *
     * @param where - WHERE conditions in object or comparison-array form
     * @param tableName - Base table name used to qualify unscoped columns
     *
     * @returns Array of fully-qualified comparison conditions
     *
     * @example
     * // Input (object form)
     * { id: 5, status: 'active' }
     *
     * // Output
     * [
     *   { column: '"users"."id"', operator: '=', value: 5 },
     *   { column: '"users"."status"', operator: '=', value: 'active' }
     * ]
     *
     * @example
     * // Input (already qualified)
     * [{ column: 'orders.id', operator: '>', value: 10 }]
     *
     * // Output (unchanged)
     * [{ column: 'orders.id', operator: '>', value: 10 }]
     */
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
