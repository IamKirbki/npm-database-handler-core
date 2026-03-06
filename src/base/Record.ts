import { inspect } from "util";
import {
    columnType,
    ModelWithTimestamps,
    QueryValues,
    QueryIsEqualParameter,
    QueryComparisonParameters,
} from "@core/types/index.js";
import QueryStatementBuilder from "@core/helpers/QueryBuilders/QueryStatementBuilder.js";
import DepricatedQueryStatementBuilder from "@core/helpers/QueryBuilders/depricatedQueryStatementBuilder.js";
import QueryFactory from "@core/factories/QueryFactory.js";
import RecordFactory from "@core/factories/RecordFactory.js";
import { RecordConstructorType } from "@core/types/record.js";
import InvalidOperationError from "@core/helpers/Errors/ModelErrors/InvalidOperationError.js";

/** Record class represents a single database row */
export default class Record<ColumnValuesType extends columnType> {
    private _values: ColumnValuesType = {} as ColumnValuesType;
    private readonly _tableName: string;
    private readonly _customAdapter?: string;
    private readonly _queryFactory: QueryFactory;
    private readonly _recordFactory: RecordFactory<ColumnValuesType>;

    constructor({
        table,
        values,
        adapter,
        queryFactory = new QueryFactory(),
        recordFactory = new RecordFactory<ColumnValuesType>(),
    }: RecordConstructorType<ColumnValuesType>) {
        this._tableName = table;
        this._values = values;
        this._customAdapter = adapter;
        this._queryFactory = queryFactory;
        this._recordFactory = recordFactory;
    }

    /** Get the raw values object for this record */
    public get values(): ColumnValuesType {
        return this._values;
    };

    public async Insert(): Promise<this | undefined> {
        const columns = Object.keys(this._values);

        if (columns.length === 0) {
            throw new InvalidOperationError("Cannot insert record with no columns");
        }

        const queryStr = await DepricatedQueryStatementBuilder.BuildInsert(this._tableName, this._values);
        const query = this._queryFactory.create({
            tableName: this._tableName,
            query: queryStr,
            parameters: this._values,
            adapterName: this._customAdapter,
            recordFactory: this._recordFactory
        });

        const result = await query.Run<{ lastInsertRowid: number | bigint; changes: number }>();

        let recordId: QueryValues;

        // For PostgreSQL compatibility: use 'id' from values if lastInsertRowid is undefined
        if (Array.isArray(this._values)) {
            recordId = result?.lastInsertRowid ?? this._values.map(v => v.column === 'id' ? v.value : undefined);
        } else {
            recordId = result?.lastInsertRowid ?? this._values.id;
        }

        if (recordId === undefined) {
            return undefined;
        }

        const whereParams: QueryComparisonParameters[] = Object.entries(this._values).map(([column, value]) => ({
            column,
            operator: '=',
            value
        }));

        const builder = new QueryStatementBuilder({ base: { from: this._tableName, where: whereParams } });
        const queryStrSelect = await builder.build();
        const querySelect = this._queryFactory.create({
            tableName: this._tableName,
            query: queryStrSelect,
            parameters: this._values,
            adapterName: this._customAdapter,
            recordFactory: this._recordFactory
        });

        const insertedRecord = await querySelect.All<ColumnValuesType>();
        if (insertedRecord.length > 0) {
            this._values = insertedRecord[insertedRecord.length - 1].values;
        }

        this._values = { ...this._values, id: recordId } as ColumnValuesType;
        return this;
    }

    /** Update this record in the database */
    public async Update(newValues: Partial<ColumnValuesType>, whereParameters: QueryIsEqualParameter): Promise<this> {
        const originalValues = this._values as Partial<ColumnValuesType>;
        if ((originalValues as object & ModelWithTimestamps).updated_at !== undefined) {
            (newValues as object & ModelWithTimestamps).updated_at = new Date().toISOString();
        }

        const queryStr = await DepricatedQueryStatementBuilder.BuildUpdate(this._tableName, newValues as QueryIsEqualParameter, whereParameters);

        // Merge newValues and originalValues for parameters (with 'where_' prefix for where clause)
        const params: Partial<ColumnValuesType> = { ...newValues };
        Object.entries(originalValues).forEach(([key, value]) => {
            params[`where_${key}` as keyof ColumnValuesType] = value;
        });

        const _query = this._queryFactory.create({
            tableName: this._tableName,
            query: queryStr,
            parameters: params as QueryIsEqualParameter,
            adapterName: this._customAdapter,
            recordFactory: this._recordFactory
        });
        await _query.Run();

        this._values = { ...this._values, ...newValues };
        return this;
    }

    /** Delete this record from the database */
    public async Delete(primaryKey?: QueryIsEqualParameter): Promise<void> {
        const originalValues = this._values as Partial<ColumnValuesType>;
        if ((originalValues as object & ModelWithTimestamps).deleted_at !== undefined) {
            (this._values as object & ModelWithTimestamps).deleted_at = new Date().toISOString();
            await this.Update(this._values, this._values.id ? { id: this._values.id } : primaryKey || {});
            return;
        }

        const queryStr = await DepricatedQueryStatementBuilder.BuildDelete(this._tableName, this._values);
        const _query = this._queryFactory.create({
            tableName: this._tableName,
            query: queryStr,
            parameters: this.values,
            adapterName: this._customAdapter,
            recordFactory: this._recordFactory
        });
        await _query.Run();
    }

    /** Returns the values object for JSON.stringify() */
    public toJSON(): ColumnValuesType {
        return this._values;
    }

    /** Convert record to pretty-printed JSON string */
    public toString(): string {
        return JSON.stringify(this._values, null, 2);
    }

    /** Custom inspect for console.log() */
    [inspect.custom](): ColumnValuesType {
        return this._values;
    }
}