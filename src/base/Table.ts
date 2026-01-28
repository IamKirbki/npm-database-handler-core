import {
    ReadableTableColumnInfo,
    TableColumnInfo,
    columnType,
    QueryFactory,
    RecordFactory,
    QueryLayers,
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
        queryLayers: QueryLayers
    ): Promise<Record<Type>[]> {
        const builder = new QueryStatementBuilder(queryLayers);
        const queryStr = await builder.build();

        let params = {}
        if (queryLayers?.base?.where && Object.keys(queryLayers.base.where).length > 0)
            params = queryLayers.base.where;

        if (queryLayers?.pretty?.where && Object.keys(queryLayers.pretty.where).length > 0)
            params = { ...params, ...queryLayers.pretty.where };

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
        queryLayers: QueryLayers
    ): Promise<Record<Type> | undefined> {
        const results = await this.Records<Type>({
            ...queryLayers,
            final: {
                ...queryLayers?.final,
                limit: 1,
            },
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
        queryLayers: QueryLayers
    ): Promise<Record<Type>[]> {
        if (queryLayers.base.joins === undefined || (Array.isArray(queryLayers.base.joins) && queryLayers.base.joins.length === 0)) {
            throw new Error("No joins defined for the Join operation.");
        }

        const joinedTables = queryLayers.base.joins.map(j => j.fromTable);
        const tableColumnCache = new Map<string, TableColumnInfo[]>();

        const columnInfo = await this._query.TableColumnInformation(this._name);
        tableColumnCache.set(this._name, columnInfo);

        for (const tableName of joinedTables) {
            const columnInfo = await this._query.TableColumnInformation(tableName);
            tableColumnCache.set(tableName, columnInfo);
        }

        const builder = new QueryStatementBuilder(queryLayers, tableColumnCache);
        const queryString = await builder.build();

        let params = {}
        if (queryLayers?.base?.where)
            params = this.QueryHelperObject.ConvertParamsToObject(queryLayers.base.where);

        if (queryLayers?.pretty?.where)
            params = { ...params, ...this.QueryHelperObject.ConvertParamsToObject(queryLayers.pretty.where) };

        const query = this._queryFactory({
            tableName: this._name,
            query: queryString,
            parameters: params,
            recordFactory: this._recordFactory
        });

        if (queryLayers) {
            queryLayers.base.select = joinedTables
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
                // eslint-disable-next-line no-unused-vars
                Object.entries(joinedTableData).filter(([_, data]) => Object.keys(data).length > 0)
            );

            const combinedData: Type = { ...mainTableData, ...filteredJoinedData } as Type;

            return this._recordFactory<Type>(this._name, combinedData, this._customAdapter);
        });
    }

    public async toSql(queryLayers: QueryLayers): Promise<string> {
        const builder = new QueryStatementBuilder(queryLayers);
        return await builder.build();
    }
}
