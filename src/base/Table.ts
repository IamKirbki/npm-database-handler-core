import {
    DefaultQueryOptions,
    Join,
    QueryOptions,
    ReadableTableColumnInfo,
    TableColumnInfo,
    columnType,
} from "@core/types/index.js";
import QueryStatementBuilder from "@core/helpers/QueryStatementBuilder.js";
import { Record, Query } from "@core/index.js";

/** Table class for interacting with a database table */
export default class Table {
    private readonly _name: string;

    /** Private constructor - use Table.create() */
    constructor(name: string) {
        this._name = name;
    }

    /** Get raw column information */
    public async TableColumnInformation(): Promise<TableColumnInfo[]> {
        return Query.tableColumnInformation(this._name);
    }

    /** Get readable, formatted column information */
    public async ReadableTableColumnInformation(): Promise<ReadableTableColumnInfo[]> {
        const columns = await this.TableColumnInformation();
        return columns.map((col) => ({
            name: col.name,
            type: col.type,
            nullable: col.notnull === 0,
            isPrimaryKey: col.pk === 1,
            defaultValue: col.dflt_value,
        }));
    }

    public async Drop(): Promise<void> {
        const queryStr = `DROP TABLE IF EXISTS "${this._name}";`;
        const query = new Query(this._name, queryStr);
        await query.Run();
    }

    /** Fetch records with optional filtering, ordering, and pagination */
    public async Records<Type extends columnType>(
        options?: DefaultQueryOptions & QueryOptions
    ): Promise<Record<Type>[]> {
        const queryStr = QueryStatementBuilder.BuildSelect(this._name, {
            select: options?.select,
            where: options?.where,
            orderBy: options?.orderBy,
            limit: options?.limit,
            offset: options?.offset,
        });

        const query = new Query(this._name, queryStr);

        if (options?.where && Object.keys(options.where).length > 0)
            query.Parameters = options.where;

        const results: Record<Type>[] = await query.All();
        return results;
    }

    /** Fetch a single record from the table */
    public async Record<Type extends columnType>(
        options?: DefaultQueryOptions & QueryOptions
    ): Promise<Record<Type> | undefined> {
        const results = await this.Records({
            select: options?.select,
            where: options?.where,
            orderBy: options?.orderBy,
            limit: 1
        });

        return results[0] as Record<Type> | undefined;
    }

    /** Get the total count of records */
    public async RecordsCount(): Promise<number> {
        const query = new Query(this._name, `SELECT COUNT(*) as count FROM "${this._name}";`);
        const count = await query.Count();
        return count || 0;
    }

    /** Insert a record into the table */
    public async Insert<Type extends columnType>(values: Type): Promise<Record<Type> | undefined> {
        const record = new Record<Type>(values, this._name);
        await record.Insert();
        return record;
    }

    /** Perform JOIN operations with other tables */
    public async Join<Type extends columnType>(
        Joins: Join | Join[],
        options?: DefaultQueryOptions & QueryOptions,
    ): Promise<Record<Type>[]> {
        const queryString = QueryStatementBuilder.BuildJoin(this._name, Joins, options);
        const query = new Query(this._name, queryString);

        // Set parameters if WHERE clause is present
        if (options?.where) {
            query.Parameters = options.where;
        }

        const joinedTables = Array.isArray(Joins) ? Joins.map(j => j.fromTable) : [Joins.fromTable];
        const records = await query.All();
        return await this.splitJoinValues(records, joinedTables) as Record<Type>[];
    }

    private async splitJoinValues(records: Record<columnType>[], joinedTables: string[]): Promise<Record<columnType>[]> {
        const thisRecordColumns = (await this.TableColumnInformation()).map(col => col.name);
        const tableColumnsMap = new Map<string, string[]>();
        
        for (const tableName of joinedTables) {
            const columns = (await Query.tableColumnInformation(tableName)).map(col => col.name);
            tableColumnsMap.set(tableName, columns);
        }

        return records.map(record => {
            if (!record.values) return record;

            const thisRecordEntries = thisRecordColumns
                .map(colName => [colName, record.values[colName]])
                .filter(([, value]) => value !== undefined);

            const joinedRecords: { [tableName: string]: columnType } = {};
            for (const [tableName, tableColumns] of tableColumnsMap) {
                const joinedRecordEntries = Object.entries(record.values)
                    .filter(([key]) => tableColumns.includes(key));
                joinedRecords[tableName] = Object.fromEntries(joinedRecordEntries);
            }

            return new Record<columnType>({ ...Object.fromEntries(thisRecordEntries), ...joinedRecords }, this._name);
        });
    }
}
