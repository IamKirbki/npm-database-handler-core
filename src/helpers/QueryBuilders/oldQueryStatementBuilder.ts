import { ExtraQueryParameters, QueryWhereCondition, QueryComparisonParameters, QueryIsEqualParameter } from "@core/types/index.js";

/** Utility class for building SQL query strings */
export default class oldQueryStatementBuilder {
    /**
     * Build an INSERT SQL statement with named parameter placeholders
     * 
     * @param table - The table to insert into
     * @param record - Object containing column names and their placeholder values
     * @returns Complete INSERT SQL statement string with @fieldName placeholders
     * 
     * @example
     * ```typescript
     * const query = QueryStatementBuilder.BuildInsert(usersTable, {
     *   name: 'John',
     *   email: 'john@example.com',
     *   age: 30
     * });
     * // "INSERT INTO users (name, email, age) VALUES (@name, @email, @age)"
     * 
     * // Note: The actual values will be bound separately using the Parameters object
     * ```
     */
    public static BuildInsert(tableName: string, record: QueryIsEqualParameter): string {
        const queryParts: string[] = [];
        const columns = Object.keys(record);
        const placeholders = columns.map(col => `@${col}`);

        queryParts.push(`INSERT INTO "${tableName}"`);
        queryParts.push(`(${columns.map(c => `"${c}"`).join(", ")})`);
        queryParts.push(`VALUES (${placeholders.join(", ")})`);

        return queryParts.join(" ");
    }

    /**
     * Build an UPDATE SQL statement with SET clause and WHERE conditions
     * 
     * @param table - The table to update
     * @param record - Object containing columns to update with their placeholder values
     * @param where - Object containing WHERE conditions for targeting specific rows
     * @returns Complete UPDATE SQL statement string with @fieldName placeholders
     * 
     * @example
     * ```typescript
     * const query = QueryStatementBuilder.BuildUpdate(
     *   usersTable,
     *   { name: 'John Doe', age: 31 },
     *   { id: 1 }
     * );
     * // "UPDATE users SET name = @name, age = @age WHERE id = @id"
     * 
     * // Multiple WHERE conditions
     * const query = QueryStatementBuilder.BuildUpdate(
     *   usersTable,
     *   { status: 'inactive' },
     *   { status: 'active', last_login: '2023-01-01' }
     * );
     * // "UPDATE users SET status = @status WHERE status = @status AND last_login = @last_login"
     * ```
     */
    public static BuildUpdate(tableName: string, record: QueryWhereCondition, where: QueryWhereCondition): string {
        const queryParts: string[] = [];
        const setClauses = Object.keys(record).map(col => `${col} = @${col}`);

        queryParts.push(`UPDATE "${tableName}"`);
        queryParts.push(`SET ${setClauses.join(", ")}`);
        queryParts.push(this.BuildWhere(where).replace(/@(\w+)/g, '@where_$1'))

        return queryParts.join(" ");
    }

    /**
     * Build a DELETE SQL statement with WHERE conditions
     * 
     * @param table - The table to delete from
     * @param where - Object containing WHERE conditions for targeting specific rows to delete
     * @returns Complete DELETE SQL statement string with @fieldName placeholders
     * 
     * @example
     * ```typescript
     * const query = QueryStatementBuilder.BuildDelete(usersTable, { id: 1 });
     * // "DELETE FROM users WHERE id = @id"
     * 
     * // Multiple WHERE conditions
     * const query = QueryStatementBuilder.BuildDelete(usersTable, {
     *   status: 'deleted',
     *   last_login: '2020-01-01'
     * });
     * // "DELETE FROM users WHERE status = @status AND last_login = @last_login"
     * ```
     */
    public static BuildDelete(tableName: string, where: QueryWhereCondition): string {
        const queryParts: string[] = [];

        queryParts.push(`DELETE FROM "${tableName}"`);
        queryParts.push(this.BuildWhere(where));

        return queryParts.join(" ");
    }

    /**
     * Build a COUNT SQL statement to count rows, optionally with WHERE conditions
     * 
     * @param table - The table to count rows from
     * @param where - Optional object containing WHERE conditions to filter counted rows
     * @returns Complete COUNT SQL statement string with @fieldName placeholders
     * 
     * @example
     * ```typescript
     * // Count all rows
     * const query = QueryStatementBuilder.BuildCount(usersTable);
     * // "SELECT COUNT(*) as count FROM users"
     * 
     * // Count with conditions
     * const query = QueryStatementBuilder.BuildCount(usersTable, {
     *   status: 'active',
     *   age: 25
     * });
     * // "SELECT COUNT(*) as count FROM users WHERE status = @status AND age = @age"
     * ```
     */
    public static BuildCount(tableName: string, where?: QueryWhereCondition): string {
        const queryParts: string[] = [];
        queryParts.push(`SELECT COUNT(*) as count FROM "${tableName}"`);
        queryParts.push(this.BuildWhere(where));

        return queryParts.join(" ");
    }

    /**
     * Build a WHERE clause from parameter conditions (helper method)
     * 
     * Joins multiple conditions with AND operator.
     * Returns empty string if no conditions are provided.
     * 
     * @param where - Optional object containing WHERE conditions
     * @returns WHERE clause string with @fieldName placeholders, or empty string if no conditions
     * 
     * @example
     * ```typescript
     * // Single condition
     * const whereClause = QueryStatementBuilder.BuildWhere({ id: 1 });
     * // "WHERE id = @id"
     * 
     * // Multiple conditions (joined with AND)
     * const whereClause = QueryStatementBuilder.BuildWhere({
     *   status: 'active',
     *   age: 25,
     *   role: 'admin'
     * });
     * // "WHERE status = @status AND age = @age AND role = @role"
     * 
     * // No conditions
     * const whereClause = QueryStatementBuilder.BuildWhere();
     * // ""
     * ```
     */
    public static BuildWhere(where?: QueryWhereCondition): string {
        if (!where || (Array.isArray(where) && where.length === 0) || Object.keys(where).length === 0) return "";
        const isSimpleObject = !Array.isArray(where) && typeof where === 'object' && where !== null;

        const queryParts: string[] = [];
        queryParts.push("WHERE");

        if (isSimpleObject) {
            queryParts.push(this.buildWhereSimple(where as QueryIsEqualParameter));
        } else {
            queryParts.push(this.buildWhereWithOperators(where as QueryComparisonParameters[]));
        }

        return queryParts.join(" ");
    }

    private static buildWhereWithOperators(where: QueryComparisonParameters[]): string {
        const queryParts: string[] = where.map(condition => {
            const operator = condition.operator || "=";
            return `${condition.column} ${operator} @${condition.column.trim()}`;
        });

        return queryParts.join(" AND ");
    }

    private static buildWhereSimple(where: QueryIsEqualParameter): string {
        const queryParts: string[] = Object.keys(where).map(col => `${col} = @${col}`);
        return queryParts.join(" AND ");
    }

    /**
     * Build query options clause (ORDER BY, LIMIT, OFFSET) (helper method)
     * 
     * Processes query options and builds the corresponding SQL clauses.
     * Returns empty string if no options are provided.
     * 
     * @param options - Object containing orderBy, limit, and/or offset options
     * @returns Query options clause as a string
     * 
     * @example
     * ```typescript
     * // All options
     * const optionsClause = QueryStatementBuilder.BuildQueryOptions({
     *   orderBy: 'created_at DESC',
     *   limit: 10,
     *   offset: 20
     * });
     * // "ORDER BY created_at DESC LIMIT 10 OFFSET 20"
     * 
     * // Just ordering
     * const optionsClause = QueryStatementBuilder.BuildQueryOptions({
     *   orderBy: 'name ASC'
     * });
     * // "ORDER BY name ASC"
     * 
     * // Pagination only
     * const optionsClause = QueryStatementBuilder.BuildQueryOptions({
     *   limit: 25,
     *   offset: 50
     * });
     * // "LIMIT 25 OFFSET 50"
     * ```
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