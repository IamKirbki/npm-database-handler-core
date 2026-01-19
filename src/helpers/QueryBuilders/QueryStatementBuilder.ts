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
        options: DefaultQueryParameters & ExtraQueryParameters = { select: "*" },
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
            options.expressions ?? [],
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
                options,
            );

        /**
         * Build SELECT clause.
         * This may include:
         * - raw column selections
         * - projection expression aliases
         */
        const selectClause = QueryExpressionBuilder.buildSelectClause(
            syncedOptions.select,
            expressions,
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
        const { fromClause, hasWrapping } = QueryExpressionBuilder.buildFromClause(
            tableName,
            expressions,
            // syncedOptions.where,
        );

        queryParts.push(fromClause);

        /**
         * Base WHERE clause applies only to:
         * - literal column filters
         * - base expressions
         * 
         * For wrapped queries, expression conditions are applied in outer query.
         */
        const skipExpressionConditions = hasWrapping;
        const baseWhere = this.BuildWhere(
            syncedOptions.where,
            expressions,
            skipExpressionConditions,
        );

        /**
         * For wrapped queries with expression conditions,
         * build the WHERE clause with proper alias extraction.
         */
        let whereClause = "";

        if (hasWrapping && syncedOptions.where) {
            const whereParts: string[] = [];

            // Add expression-based WHERE conditions
            const whereArray = Array.isArray(syncedOptions.where)
                ? syncedOptions.where
                : Object.entries(syncedOptions.where).map(([column, value]) => ({
                    column,
                    operator: "=" as const,
                    value,
                }));

            whereArray.forEach((condition) => {
                const matchedExpression = expressions?.find(
                    (expr) => expr.whereClauseKeyword === condition.column,
                );
                if (matchedExpression) {
                    const alias = condition.column.split("_")[0];
                    const operator = condition.operator || "=";
                    whereParts.push(`${alias} ${operator} @${condition.column}`);
                }
            });

            // Add literal WHERE conditions
            if (syncedOptions.literalWhere?.length) {
                whereParts.push(...syncedOptions.literalWhere);
            }

            whereClause = whereParts.length > 0
                ? `WHERE ${whereParts.join(" AND ")}`
                : "";
        } else {
            // Non-wrapped query uses standard WHERE building
            whereClause = QueryExpressionBuilder.buildWhereWithLiterals(
                baseWhere,
                syncedOptions.literalWhere,
            );
        }

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

        return queryParts.filter((part) => part && part.trim() !== "").join(" ");
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
            !Array.isArray(where) && typeof where === "object" && where !== null;

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
        const normalizeBlacklist = options?.expressions
            ?.map((expr) => {
                if (
                    expr.type === "textRelevance" &&
                    expr.parameters.whereClauseKeyword
                ) {
                    return expr.parameters.whereClauseKeyword;
                } else {
                    return "";
                }
            })
            .filter((e) => e !== "");

        if (options?.where) {
            options.where = this.normalizeAndQualifyConditions(
                options.where,
                fromTableName,
                normalizeBlacklist,
            );
        }

        const expressions = QueryExpressionBuilder.buildExpressionsPart(
            options?.expressions ?? [],
        );

        const syncedOptions =
            QueryExpressionBuilder.SyncQueryOptionsWithExpressions(
                expressions,
                options ?? {},
            );

        const shouldWrap = QueryExpressionBuilder.shouldWrapJoinQuery(expressions);

        return shouldWrap
            ? await this.buildWrappedJoinQuery(
                fromTableName,
                joins,
                query,
                expressions,
                syncedOptions,
            )
            : await this.buildSimpleJoinQuery(
                fromTableName,
                joins,
                query,
                syncedOptions,
            );
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
        // Step 1: Normalize WHERE into an array of comparison objects.
        // This removes branching logic later in the query builder.
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
        options: DefaultQueryParameters &
            ExtraQueryParameters & {
                literalWhere?: string[];
            },
    ): Promise<string> {
        const selectClause = await QueryStatementBuilder.BuildJoinSelect(
            fromTableName,
            joins,
            query,
        );

        const baseWhere = this.BuildWhere(options.where);
        const whereClause = QueryExpressionBuilder.buildWhereWithLiterals(
            baseWhere,
            options.literalWhere,
        );

        return [
            `SELECT ${selectClause}`,
            `FROM "${fromTableName}"`,
            this.BuildJoinPart(fromTableName, joins),
            whereClause,
            this.BuildQueryOptions(options),
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
        options: DefaultQueryParameters &
            ExtraQueryParameters & {
                literalWhere?: string[];
            },
    ): Promise<string> {
        const innerQueryParts: string[] = [];

        const selectClause = await QueryStatementBuilder.BuildJoinSelect(
            fromTableName,
            joins,
            query,
        );

        const projectionExpressions =
            QueryExpressionBuilder.filterExpressionsByPhase(
                expressions,
                "projection",
            );

        const expressionClauses = projectionExpressions
            .map((expr) => expr.baseExpressionClause)
            .filter(Boolean)
            .join(", ");

        innerQueryParts.push("SELECT");

        if (expressionClauses) {
            innerQueryParts.push(`${selectClause}, ${expressionClauses}`);
        } else {
            innerQueryParts.push(selectClause);
        }

        innerQueryParts.push(`FROM "${fromTableName}"`);
        innerQueryParts.push(this.BuildJoinPart(fromTableName, joins));

        const baseWhere = this.BuildWhere(options.where, expressions, true);
        if (baseWhere) {
            innerQueryParts.push(baseWhere);
        }

        /**
         * Extract column aliases from the inner SELECT.
         * These are the ONLY columns visible to the outer query.
         */
        const columnAliases = selectClause.split(", ").map((col) => {
            const match = col.match(/AS "([^"]+)"/);
            return match ? match[1] : col;
        });

        const outerSelectClause = QueryExpressionBuilder.buildJoinOuterSelectClause(
            columnAliases,
            expressions,
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
        query: Query,
    ): Promise<string> {
        const mainTableCols = await query.TableColumnInformation(fromTableName);

        const mainTableSelect = mainTableCols
            .map(
                (col) =>
                    `"${fromTableName}"."${col.name}" AS "${QueryStatementBuilder.convertSingleJoinSelect(
                        `${fromTableName}.${col.name}`,
                    )}"`,
            )
            .join(", ");

        const joinArray = Array.isArray(joins) ? joins : [joins];

        const joinedSelects = await Promise.all(
            joinArray.map(async (join) => {
                const cols = await query.TableColumnInformation(join.fromTable);

                return cols
                    .map(
                        (col) =>
                            `"${join.fromTable}"."${col.name}" AS "${QueryStatementBuilder.convertSingleJoinSelect(
                                `${join.fromTable}.${col.name}`,
                            )}"`,
                    )
                    .join(", ");
            }),
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
        joins: Join | Join[],
    ): string {
        const joinArray = Array.isArray(joins) ? joins : [joins];

        return joinArray
            .map((join) => {
                const baseTable = join.baseTable || fromTableName;

                return [
                    `${join.joinType} JOIN "${join.fromTable}"`,
                    this.BuildJoinOnPart(baseTable, join.fromTable, join.on),
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
        on: QueryIsEqualParameter | QueryIsEqualParameter[],
    ): string {
        const onArray = Array.isArray(on) ? on : [on];

        return onArray
            .map(
                (part) =>
                    `ON ${tableName}.${Object.values(part)[0]} = ${joinTableName}.${Object.keys(part)[0]}`,
            )
            .join(" AND ");
    }

    /**
     * Build ORDER BY / LIMIT / OFFSET clauses.
     *
     * Expression-based ORDER BY clauses should already be injected
     * before this function runs.
     */
    public static BuildQueryOptions(options: ExtraQueryParameters): string {
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
