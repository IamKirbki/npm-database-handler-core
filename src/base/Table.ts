import {
    DefaultQueryParameters,
    Join,
    ExtraQueryParameters,
    ReadableTableColumnInfo,
    TableColumnInfo,
    columnType,
    QueryFactory,
    RecordFactory,
} from "@core/types/index.js";
import QueryStatementBuilder from "@core/helpers/QueryBuilders/QueryStatementBuilder.js";
import { Record, Query } from "@core/index.js";

/** Table class for interacting with a database table */
export default class Table {
    private readonly _query: Query;
    private readonly _customAdapter?: string;
    private readonly _name: string;
    private readonly _queryFactory: QueryFactory;
    private readonly _recordFactory: RecordFactory;

    /** Private constructor - use Table.create() */
    constructor(
        name: string,
        customAdapter?: string,
        queryFactory: QueryFactory = (config) => new Query(config),
        recordFactory: RecordFactory = (table, values, adapter) => new Record(table, values, adapter)
    ) {
        this._name = name;
        this._customAdapter = customAdapter;
        this._queryFactory = queryFactory;
        this._recordFactory = recordFactory;

        this._query = this._queryFactory({
            tableName: this._name,
            adapterName: this._customAdapter,
            recordFactory: this._recordFactory
        });
    }

    public get QueryHelperObject(): Query {
        return this._query;
    }

    /** Get raw column information */
    public async TableColumnInformation(tableName?: string): Promise<TableColumnInfo[]> {
        return this._query.TableColumnInformation(tableName || this._name);
    }

    /** Get readable, formatted column information */
    public async ReadableTableColumnInformation(): Promise<ReadableTableColumnInfo[]> {
        const columns = await this.TableColumnInformation(this._name);
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
        const query = this._queryFactory({
            tableName: this._name,
            query: queryStr,
            adapterName: this._customAdapter,
            recordFactory: this._recordFactory
        });
        await query.Run();
    }

    /** Fetch records with optional filtering, ordering, and pagination */
    public async Records<Type extends columnType>(
        options?: DefaultQueryParameters & ExtraQueryParameters
    ): Promise<Record<Type>[]> {
        const queryStr = await QueryStatementBuilder.BuildSelect(this._name, {
            select: options?.select,
            where: options?.where,
            orderBy: options?.orderBy,
            limit: options?.limit,
            offset: options?.offset,
            expressions: options?.expressions
        });

        let params = {}
        if (options?.where && Object.keys(options.where).length > 0)
            params = options.where;

        const query = this._queryFactory({
            tableName: this._name,
            query: queryStr,
            parameters: params,
            recordFactory: this._recordFactory
        });
        const results = await query.All<Type>();
        return results;
    }

    /** Fetch a single record from the table */
    public async Record<Type extends columnType>(
        options?: DefaultQueryParameters & ExtraQueryParameters
    ): Promise<Record<Type> | undefined> {
        const results = await this.Records<Type>({
            select: options?.select,
            where: options?.where,
            orderBy: options?.orderBy,
            limit: 1
        });

        return results[0];
    }

    /** Get the total count of records */
    public async RecordsCount(): Promise<number> {
        const query = this._queryFactory({
            tableName: this._name,
            query: `SELECT COUNT(*) as count FROM "${this._name}"`,
            recordFactory: this._recordFactory
        });
        const count = await query.Count();
        return count || 0;
    }

    public async exists(): Promise<boolean> {
        const query = this._queryFactory({
            tableName: this._name,
            adapterName: this._customAdapter,
            recordFactory: this._recordFactory
        })

        return await query.DoesTableExist();
    }

    /** Insert a record into the table */
    public async Insert<Type extends columnType>(values: Type): Promise<Record<Type> | undefined> {
        const record = this._recordFactory(this._name, values, this._customAdapter);
        await record.Insert();
        return record;
    }

    /** Perform JOIN operations with other tables */
    public async Join<Type extends columnType>(
        Joins: Join | Join[],
        options?: DefaultQueryParameters & ExtraQueryParameters
    ): Promise<Record<Type>[]> {
        const queryString = await QueryStatementBuilder.BuildJoin(this._name, Joins, this.QueryHelperObject, options);

        let params = {}
        if (options?.where)
            params = options.where

        const query = this._queryFactory({
            tableName: this._name,
            query: queryString,
            parameters: params,
            recordFactory: this._recordFactory
        });

        const joinedTables = Array.isArray(Joins) ? Joins.map(j => j.fromTable) : [Joins.fromTable];
        if (options) {
            options.select = joinedTables.map(table => `${table}.*`).join(', ');
        }
        const records = await query.All<Type>();
        const splitTables = await this.splitJoinValues<Type>(records, joinedTables);
        return splitTables;
    }

    private async splitJoinValues<Type extends columnType>(records: Record<Type>[], joinedTables: string[]): Promise<Record<Type>[]> {
        return records.map(record => {
            if (!record.values) return record;

            const mainTableData: columnType = {};
            const joinedTableData: { [tableName: string]: columnType } = {};

            for (const [aliasedKey, value] of Object.entries(record.values)) {
                if (aliasedKey.includes('__')) {
                    const [tableName, columnName] = aliasedKey.split('__');

                    if (tableName === this._name) {
                        mainTableData[columnName] = value;
                    }
                    else if (joinedTables.includes(tableName)) {
                        if (!joinedTableData[tableName]) {
                            joinedTableData[tableName] = {};
                        }
                        joinedTableData[tableName][columnName] = value;
                    }
                } else {
                    mainTableData[aliasedKey] = value;
                }
            }

            const filteredJoinedData = Object.fromEntries(
                Object.entries(joinedTableData).filter(([_, data]) => Object.keys(data).length > 0)
            );

            const combinedData: Type = { ...mainTableData, ...filteredJoinedData } as Type;

            return this._recordFactory<Type>(this._name, combinedData, this._customAdapter);
        });
    }
}
