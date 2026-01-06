import { DefaultQueryOptions, QueryOptions, QueryCondition, Join, QueryParameters, QueryWhereParameters } from "@core/types/index.js";

/** Utility class for building SQL query strings */
export default class QueryStatementBuilder {
    /**
     * Build a SELECT SQL statement with optional filtering, ordering, and pagination
     * 
     * @param table - The table to select from
     * @param options - Query options including select columns, where conditions, orderBy, limit, offset
     * @returns Complete SELECT SQL statement string
     * 
     * @example
     * ```typescript
     * // Select all columns
     * const query = QueryStatementBuilder.BuildSelect(usersTable);
     * // "SELECT * FROM users"
     * 
     * // Select specific columns with filtering
     * const query = QueryStatementBuilder.BuildSelect(usersTable, {
     *   select: 'id, name, email',
     *   where: { status: 'active', age: 25 },
     *   orderBy: 'created_at DESC',
     *   limit: 10,
     *   offset: 20
     * });
     * // "SELECT id, name, email FROM users WHERE status = @status AND age = @age ORDER BY created_at DESC LIMIT 10 OFFSET 20"
     * ```
     */
    public static BuildSelect(tableName: string, options?: DefaultQueryOptions & QueryOptions): string {
        const queryParts: string[] = [];

        queryParts.push(`SELECT ${options?.select ?? "*"}`);
        queryParts.push(`FROM "${tableName}"`);
        queryParts.push(this.BuildWhere(options?.where));
        queryParts.push(this.BuildQueryOptions(options ?? {}));

        return queryParts.join(" ");
    }

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
    public static BuildInsert(tableName: string, record: QueryWhereParameters): string {
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
    public static BuildUpdate(tableName: string, record: QueryCondition, where: QueryCondition): string {
        const queryParts: string[] = [];
        const setClauses = Object.keys(record).map(col => `${col} = @${col}`);

        queryParts.push(`UPDATE "${tableName}"`);
        queryParts.push(`SET ${setClauses.join(", ")}`);
        queryParts.push(this.BuildWhere(where));

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
    public static BuildDelete(tableName: string, where: QueryCondition): string {
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
    public static BuildCount(tableName: string, where?: QueryCondition): string {
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
    public static BuildWhere(where?: QueryCondition): string {
        if (!where || (Array.isArray(where) && where.length === 0) || Object.keys(where).length === 0) return "";
        const isSimpleObject = !Array.isArray(where) && typeof where === 'object' && where !== null;

        const queryParts: string[] = [];
        queryParts.push("WHERE");

        if (isSimpleObject) {
            queryParts.push(this.buildWhereSimple(where as QueryWhereParameters));
        } else {
            queryParts.push(this.buildWhereWithOperators(where as QueryParameters[]));
        }

        return queryParts.join(" ");
    }

    private static buildWhereWithOperators(where: QueryParameters[]): string {
        const queryParts: string[] = where.map(condition => {
            const operator = condition.operator || "=";
            return `${condition.column} ${operator} @${condition.column.trim()}`;
        });

        return queryParts.join(" AND ");
    }

    private static buildWhereSimple(where: QueryWhereParameters): string {
        const queryParts: string[] = Object.keys(where).map(col => `${col} = @${col}`);
        return queryParts.join(" AND ");
    }

    /**
     * Build a SELECT statement with JOIN operations (INNER, LEFT, RIGHT, FULL)
     * 
     * Supports single or multiple joins, including nested joins.
     * Combines the base SELECT with JOIN clauses and query options.
     * The join type (INNER, LEFT, RIGHT, FULL) is specified in each Join object.
     * 
     * @param fromTable - The primary table to select from
     * @param joins - Single Join object or array of Join objects defining the join operations
     * @param options - Query options including select columns, orderBy, limit, offset
     * @returns Complete SELECT statement with JOIN clauses
     * 
     * @example
     * ```typescript
     * // Single INNER JOIN
     * const query = QueryStatementBuilder.BuildJoin(
     *   usersTable,
     *   { fromTable: ordersTable, joinType: 'INNER', on: { user_id: 'id' } },
     *   { select: 'users.*, orders.total' }
     * );
     * // "SELECT users.*, orders.total FROM users INNER JOIN orders ON users.id = orders.user_id"
     * 
     * // Multiple joins with different types
     * const query = QueryStatementBuilder.BuildJoin(
     *   usersTable,
     *   [
     *     { fromTable: ordersTable, joinType: 'INNER', on: { user_id: 'id' } },
     *     { fromTable: addressesTable, joinType: 'LEFT', on: { address_id: 'id' } }
     *   ],
     *   { orderBy: 'users.created_at DESC', limit: 10 }
     * );
     * 
     * // Nested JOIN
     * const query = QueryStatementBuilder.BuildJoin(
     *   usersTable,
     *   {
     *     fromTable: ordersTable,
     *     joinType: 'INNER',
     *     on: { user_id: 'id' },
     *     join: { fromTable: productsTable, joinType: 'INNER', on: { product_id: 'id' } }
     *   }
     * );
     * ```
     */
    public static BuildJoin(
        fromTableName: string,
        joins: Join | Join[],
        options?: DefaultQueryOptions & QueryOptions
    ): string {
        const queryParts: string[] = [];
        queryParts.push(`SELECT ${options?.select ?? "*"}`);
        queryParts.push(`FROM "${fromTableName}"`);
        queryParts.push(this.BuildJoinPart(fromTableName, joins));
        queryParts.push(this.BuildWhere(options?.where));
        queryParts.push(this.BuildQueryOptions(options ?? {}));

        return queryParts.join(" ");
    }

    /**
     * Build JOIN clause(s) recursively (helper method)
     * 
     * Processes single or multiple join definitions and handles nested joins.
     * Each join includes the JOIN clause (INNER, LEFT, RIGHT, FULL) and ON conditions.
     * 
     * @param fromTable - The table being joined from (for ON clause context)
     * @param joins - Single Join object or array of Join objects
     * @returns JOIN clause(s) as a string
     * 
     * @example
     * ```typescript
     * // Single INNER JOIN
     * const joinClause = QueryStatementBuilder.BuildJoinPart(
     *   usersTable,
     *   { fromTable: ordersTable, joinType: 'INNER', on: { user_id: 'id' } }
     * );
     * // "INNER JOIN orders ON users.id = orders.user_id"
     * 
     * // LEFT JOIN
     * const joinClause = QueryStatementBuilder.BuildJoinPart(
     *   usersTable,
     *   { fromTable: profilesTable, joinType: 'LEFT', on: { profile_id: 'id' } }
     * );
     * // "LEFT JOIN profiles ON users.id = profiles.profile_id"
     * 
     * // Nested join
     * const joinClause = QueryStatementBuilder.BuildJoinPart(
     *   usersTable,
     *   {
     *     fromTable: ordersTable,
     *     joinType: 'INNER',
     *     on: { user_id: 'id' },
     *     join: { fromTable: productsTable, joinType: 'INNER', on: { product_id: 'id' } }
     *   }
     * );
     * // "INNER JOIN orders ON users.id = orders.user_id INNER JOIN products ON orders.id = products.product_id"
     * ```
     */
    public static BuildJoinPart(
        fromTableName: string,
        joins: Join | Join[],
    ): string {
        const queryParts: string[] = [];
        const joinsArray = Array.isArray(joins) ? joins : [joins];

        let currentTableName = fromTableName;
        for (const join of joinsArray) {
            queryParts.push(`${join.joinType} JOIN "${join.fromTable}"`);
            queryParts.push(this.BuildJoinOnPart(currentTableName, join.fromTable, join.on));
            currentTableName = join.fromTable;
        }

        return queryParts.join(" ");
    }

    /**
     * Build ON clause for JOIN operations (helper method)
     * 
     * Creates ON conditions for join operations.
     * Compares the foreign key column in the joined table with the primary key in the source table.
     * Multiple conditions are joined with AND operator.
     * 
     * @param table - The source table (left side of the join)
     * @param joinTable - The table being joined (right side of the join)
     * @param on - QueryCondition object where key is the foreign key in joinTable and value is the primary key in table
     * @returns ON clause string for JOIN operations
     * 
     * @example
     * ```typescript
     * // Single ON condition
     * // Key: column in joinTable (orders), Value: column in table (users)
     * const onClause = QueryStatementBuilder.BuildJoinOnPart(
     *   usersTable,
     *   ordersTable,
     *   { user_id: 'id' }
     * );
     * // "ON users.id = orders.user_id"
     * 
     * // Multiple ON conditions
     * const onClause = QueryStatementBuilder.BuildJoinOnPart(
     *   usersTable,
     *   ordersTable,
     *   [{ user_id: 'id' }, { company_id: 'company_id' }]
     * );
     * // "ON users.id = orders.user_id AND users.company_id = orders.company_id"
     * ```
     */
    public static BuildJoinOnPart(
        tableName: string,
        joinTableName: string,
        on: QueryWhereParameters | QueryWhereParameters[],
    ): string {
        const queryParts: string[] = [];
        const onArray = Array.isArray(on) ? on : [on];

        for (const onPart of onArray) {
            queryParts.push(`ON ${tableName}.${Object.values(onPart)[0]} = ${joinTableName}.${Object.keys(onPart)[0]}`);
        }

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
    public static BuildQueryOptions(options: QueryOptions): string {
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