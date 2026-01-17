import { Query } from "@core/index.js";
import {
    DefaultQueryParameters,
    ExtraQueryParameters,
    QueryWhereCondition,
    Join,
    QueryComparisonParameters,
    QueryIsEqualParameter,
    expressionClause
} from "@core/types/index.js";
import QueryExpressionBuilder from "./QueryExpressionBuilder.js";

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
    public static BuildSelect(
        tableName: string,
        options: DefaultQueryParameters & ExtraQueryParameters = { select: "*" }
    ): string {
        const queryParts: string[] = [];

        /**
         * Normalize expression definitions into executable SQL fragments.
         * This step determines:
         * - which expressions exist
         * - their phase (base vs projection)
         * - whether wrapping is required
         */
        const expressions = QueryExpressionBuilder.buildExpressionsPart(
            options.expressions ?? []
        );

        /**
         * Sync query options with expression requirements.
         *
         * Examples:
         * - Move distance filters into literal WHERE (outer query)
         * - Remove ORDER BY if expression defines its own ordering
         */
        const syncedOptions =
            QueryExpressionBuilder.SyncQueryOptionsWithExpressions(
                expressions,
                options
            );

        /**
         * Build SELECT clause.
         * This may include:
         * - raw column selections
         * - projection expression aliases
         */
        const selectClause =
            QueryExpressionBuilder.buildSelectClause(
                syncedOptions.select,
                expressions
            );

        queryParts.push(`SELECT ${selectClause}`);

        /**
         * Build FROM clause.
         *
         * If projection expressions exist, this will emit:
         *   FROM ( <inner query> ) AS wrapped
         *
         * Otherwise:
         *   FROM "table"
         */
        queryParts.push(
            QueryExpressionBuilder.buildFromClause(
                tableName,
                expressions
            )
        );

        /**
         * Base WHERE clause applies only to:
         * - literal column filters
         * - base expressions
         */
        const baseWhere = this.BuildWhere(syncedOptions.where);

        /**
         * Literal WHERE clauses (e.g. distance filters) are injected
         * after expression evaluation.
         */
        const whereClause =
            QueryExpressionBuilder.buildWhereWithLiterals(
                baseWhere,
                syncedOptions.literalWhere
            );

        if (whereClause) {
            queryParts.push(whereClause);
        }

        /**
         * ORDER BY derived from expressions (e.g. distance ASC)
         * takes precedence over user-defined ordering.
         */
        const expressionOrderBy =
            QueryExpressionBuilder.buildOrderByFromExpressions(expressions);

        if (expressionOrderBy) {
            queryParts.push(expressionOrderBy);
        }

        /**
         * Append LIMIT / OFFSET / remaining ORDER BY
         */
        queryParts.push(this.BuildQueryOptions(syncedOptions));

        return queryParts
            .filter(part => part && part.trim() !== "")
            .join(" ");
    }

    /**
     * Build an INSERT statement with named placeholders.
     *
     * Values are not inlined — parameter binding happens later.
     */
    public static BuildInsert(
        tableName: string,
        record: QueryIsEqualParameter
    ): string {
        const columns = Object.keys(record);
        const placeholders = columns.map(col => `@${col}`);

        return [
            `INSERT INTO "${tableName}"`,
            `(${columns.map(c => `"${c}"`).join(", ")})`,
            `VALUES (${placeholders.join(", ")})`
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
        where: QueryWhereCondition
    ): string {
        const setClauses = Object.keys(record)
            .map(col => `${col} = @${col}`);

        return [
            `UPDATE "${tableName}"`,
            `SET ${setClauses.join(", ")}`,
            this.BuildWhere(where)
                .replace(/@(\w+)/g, '@where_$1')
        ].join(" ");
    }

    /**
     * Build a DELETE statement.
     */
    public static BuildDelete(
        tableName: string,
        where: QueryWhereCondition
    ): string {
        return [
            `DELETE FROM "${tableName}"`,
            this.BuildWhere(where)
        ].join(" ");
    }

    /**
     * Build a COUNT query.
     *
     * This is intentionally expression-agnostic.
     * Projection expressions should not affect counts unless explicitly wrapped.
     */
    public static BuildCount(
        tableName: string,
        where?: QueryWhereCondition
    ): string {
        return [
            `SELECT COUNT(*) as count FROM "${tableName}"`,
            this.BuildWhere(where)
        ].join(" ");
    }

    /**
     * Build a WHERE clause from structured conditions.
     *
     * Supports:
     * - simple equality objects
     * - operator-based condition arrays
     */
    public static BuildWhere(where?: QueryWhereCondition): string {
        if (
            !where ||
            (Array.isArray(where) && where.length === 0) ||
            Object.keys(where).length === 0 || 
            where instanceof Date
        ) {
            return "";
        }

        const isSimpleObject =
            !Array.isArray(where) &&
            typeof where === "object" &&
            where !== null;

        return [
            "WHERE",
            isSimpleObject
                ? this.buildWhereSimple(where as QueryIsEqualParameter)
                : this.buildWhereWithOperators(
                    where as QueryComparisonParameters[]
                )
        ].join(" ");
    }

    private static buildWhereWithOperators(
        where: QueryComparisonParameters[]
    ): string {
        return where
            .map(condition =>
                `${condition.column} ${condition.operator} @${condition.column.trim()}`
            )
            .join(" AND ");
    }

    private static buildWhereSimple(
        where: QueryIsEqualParameter
    ): string {
        return Object.keys(where)
            .map(col => `${col} = @${col}`)
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
        options?: DefaultQueryParameters & ExtraQueryParameters
    ): Promise<string> {
        const expressions =
            QueryExpressionBuilder.buildExpressionsPart(
                options?.expressions ?? []
            );

        const syncedOptions =
            QueryExpressionBuilder.SyncQueryOptionsWithExpressions(
                expressions,
                options ?? {}
            );

        const shouldWrap =
            QueryExpressionBuilder.shouldWrapJoinQuery(expressions);

        return shouldWrap
            ? this.buildWrappedJoinQuery(
                fromTableName,
                joins,
                query,
                expressions,
                syncedOptions
            )
            : this.buildSimpleJoinQuery(
                fromTableName,
                joins,
                query,
                syncedOptions
            );
    }

    /**
     * Build a non-wrapped JOIN query.
     *
     * Used when:
     * - no projection expressions exist
     * - all expressions can run in base phase
     */
    private static async buildSimpleJoinQuery(
        fromTableName: string,
        joins: Join | Join[],
        query: Query,
        options: DefaultQueryParameters & ExtraQueryParameters & {
            literalWhere?: string[]
        }
    ): Promise<string> {
        const selectClause =
            await QueryStatementBuilder.BuildJoinSelect(
                fromTableName,
                joins,
                query
            );

        const baseWhere = this.BuildWhere(options.where);
        const whereClause =
            QueryExpressionBuilder.buildWhereWithLiterals(
                baseWhere,
                options.literalWhere
            );

        return [
            `SELECT ${selectClause}`,
            `FROM "${fromTableName}"`,
            this.BuildJoinPart(fromTableName, joins),
            whereClause,
            this.BuildQueryOptions(options)
        ]
            .filter(Boolean)
            .join(" ");
    }

    /**
     * Build a wrapped JOIN query.
     *
     * Structure:
     * - Inner query: joins + base expressions + raw columns
     * - Outer query: projection expressions + filtering + ordering
     *
     * This is REQUIRED for expressions like:
     * - spatial distance
     * - window functions
     * - computed aliases used in WHERE / ORDER BY
     */
    private static async buildWrappedJoinQuery(
        fromTableName: string,
        joins: Join | Join[],
        query: Query,
        expressions: expressionClause[],
        options: DefaultQueryParameters & ExtraQueryParameters & {
            literalWhere?: string[]
        }
    ): Promise<string> {
        const innerQueryParts: string[] = [];

        const selectClause =
            await QueryStatementBuilder.BuildJoinSelect(
                fromTableName,
                joins,
                query
            );

        const projectionExpressions =
            QueryExpressionBuilder.filterExpressionsByPhase(
                expressions,
                "projection"
            );

        const expressionClauses = projectionExpressions
            .map(expr => expr.baseExpressionClause)
            .filter(Boolean)
            .join(", ");

        innerQueryParts.push("SELECT");

        if (expressionClauses) {
            innerQueryParts.push(
                `${selectClause}, ${expressionClauses}`
            );
        } else {
            innerQueryParts.push(selectClause);
        }

        innerQueryParts.push(`FROM "${fromTableName}"`);
        innerQueryParts.push(this.BuildJoinPart(fromTableName, joins));

        const baseWhere = this.BuildWhere(options.where);
        if (baseWhere) {
            innerQueryParts.push(baseWhere);
        }

        /**
         * Extract column aliases from the inner SELECT.
         * These are the ONLY columns visible to the outer query.
         */
        const columnAliases = selectClause
            .split(", ")
            .map(col => {
                const match = col.match(/AS "([^"]+)"/);
                return match ? match[1] : col;
            });

        const outerSelectClause =
            QueryExpressionBuilder.buildJoinOuterSelectClause(
                columnAliases,
                expressions
            );

        return [
            "SELECT",
            outerSelectClause,
            "FROM (",
            innerQueryParts.join("\n"),
            ") AS wrapped",
            options.literalWhere?.length
                ? `WHERE ${options.literalWhere.join(" AND ")}`
                : "",
            QueryExpressionBuilder.buildOrderByFromExpressions(expressions)
        ]
            .filter(Boolean)
            .join("\n");
    }

    /**
     * Build SELECT clause for JOIN queries.
     *
     * All selected columns are aliased using:
     *   table.column → table__column
     *
     * This guarantees:
     * - no name collisions
     * - safe outer query access after wrapping
     */
    public static async BuildJoinSelect(
        fromTableName: string,
        joins: Join | Join[],
        query: Query
    ): Promise<string> {
        const mainTableCols =
            await query.TableColumnInformation(fromTableName);

        const mainTableSelect = mainTableCols
            .map(col =>
                `"${fromTableName}"."${col.name}" AS "${QueryStatementBuilder.convertSingleJoinSelect(
                    `${fromTableName}.${col.name}`
                )}"`
            )
            .join(", ");

        const joinArray = Array.isArray(joins) ? joins : [joins];

        const joinedSelects = await Promise.all(
            joinArray.map(async join => {
                const cols =
                    await query.TableColumnInformation(join.fromTable);

                return cols
                    .map(col =>
                        `"${join.fromTable}"."${col.name}" AS "${QueryStatementBuilder.convertSingleJoinSelect(
                            `${join.fromTable}.${col.name}`
                        )}"`
                    )
                    .join(", ");
            })
        );

        return [mainTableSelect, ...joinedSelects].join(", ");
    }

    /**
     * Convert dotted column paths into safe aliases.
     *
     * Example:
     *   users.id → users__id
     */
    public static convertSingleJoinSelect(select: string): string {
        return select.replace(/\./g, "__");
    }

    /**
     * Build JOIN clauses recursively.
     *
     * This function is intentionally dumb:
     * - it does not inspect expressions
     * - it does not care about wrapping
     *
     * It only emits valid JOIN syntax.
     */
    public static BuildJoinPart(
        fromTableName: string,
        joins: Join | Join[]
    ): string {
        const joinArray = Array.isArray(joins) ? joins : [joins];

        return joinArray
            .map(join => {
                const baseTable =
                    join.baseTable || fromTableName;

                return [
                    `${join.joinType} JOIN "${join.fromTable}"`,
                    this.BuildJoinOnPart(
                        baseTable,
                        join.fromTable,
                        join.on
                    )
                ].join(" ");
            })
            .join(" ");
    }

    /**
     * Build ON clause for JOINs.
     *
     * Supports multiple conditions joined by AND.
     */
    public static BuildJoinOnPart(
        tableName: string,
        joinTableName: string,
        on: QueryIsEqualParameter | QueryIsEqualParameter[]
    ): string {
        const onArray = Array.isArray(on) ? on : [on];

        return onArray
            .map(
                part =>
                    `ON ${tableName}.${Object.values(part)[0]} = ${joinTableName}.${Object.keys(part)[0]}`
            )
            .join(" AND ");
    }

    /**
     * Build ORDER BY / LIMIT / OFFSET clauses.
     *
     * Expression-based ORDER BY clauses should already be injected
     * before this function runs.
     */
    public static BuildQueryOptions(
        options: ExtraQueryParameters
    ): string {
        const queryParts: string[] = [];

        if (options?.orderBy) {
            queryParts.push(`ORDER BY ${options.orderBy}`);
        }

        if (options?.limit) {
            queryParts.push(`LIMIT ${options.limit}`);

            if (options?.offset) {
                queryParts.push(`OFFSET ${options.offset}`);
            }
        }

        return queryParts.join(" ");
    }
}
