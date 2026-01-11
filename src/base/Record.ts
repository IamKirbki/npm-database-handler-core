import { inspect } from "util";
import Query from "./Query.js";
import { columnType, ModelWithTimestamps, QueryValues, QueryWhereParameters } from "@core/types/index.js";
import QueryStatementBuilder from "@core/helpers/QueryStatementBuilder.js";

/** Record class represents a single database row */
export default class Record<ColumnValuesType extends columnType> {
    private _values: ColumnValuesType = {} as ColumnValuesType;
    private readonly _tableName: string;
    private readonly _customAdapter?: string;

    constructor(table: string, values: ColumnValuesType, adapter?: string) {
        this._tableName = table;
        this._values = values;
        this._customAdapter = adapter;
    }

    /** Get the raw values object for this record */
    public get values(): ColumnValuesType {
        return this._values;
    };

    public async Insert(): Promise<this | undefined> {
        const columns = Object.keys(this._values);

        if (columns.length === 0) {
            throw new Error("Cannot insert record with no columns");
        }

        const queryStr = QueryStatementBuilder.BuildInsert(this._tableName, this._values);
        const query = new Query({
            tableName: this._tableName,
            query: queryStr,
            parameters: this._values,
            adapterName: this._customAdapter
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

        const queryStrSelect = QueryStatementBuilder.BuildSelect(this._tableName, { where: { ...this._values } });
        const querySelect = new Query({
            tableName: this._tableName,
            query: queryStrSelect,
            parameters: this._values,
            adapterName: this._customAdapter
        });

        const insertedRecord = await querySelect.All<ColumnValuesType>();
        if (insertedRecord.length > 0) {
            this._values = insertedRecord[insertedRecord.length - 1].values;
        }

        this._values = { ...this._values, id: recordId } as ColumnValuesType;
        return this;
    }

    /** Update this record in the database */
    public async Update(newValues: Partial<ColumnValuesType>, whereParameters: QueryWhereParameters): Promise<this> {
        const originalValues = this._values as Partial<ColumnValuesType>;
        if ((originalValues as object & ModelWithTimestamps).updated_at !== undefined) {
            (newValues as object & ModelWithTimestamps).updated_at = new Date().toISOString();
        }

        const queryStr = QueryStatementBuilder.BuildUpdate(this._tableName, newValues as QueryWhereParameters, whereParameters);

        // Merge newValues and originalValues for parameters (with 'where_' prefix for where clause)
        const params: Partial<ColumnValuesType> = { ...newValues };
        Object.entries(originalValues).forEach(([key, value]) => {
            params[`where_${key}` as keyof ColumnValuesType] = value;
        });

        const _query = new Query({ 
            tableName: this._tableName, 
            query: queryStr, 
            parameters: params as QueryWhereParameters, 
            adapterName: this._customAdapter 
        });
        await _query.Run();

        this._values = { ...this._values, ...newValues };
        return this;
    }

    /** Delete this record from the database */
    public async Delete(primaryKey: QueryWhereParameters): Promise<void> {
        const originalValues = this._values as Partial<ColumnValuesType>;
        if ((originalValues as object & ModelWithTimestamps).deleted_at !== undefined) {
            (this._values as object & ModelWithTimestamps).deleted_at = new Date().toISOString();
            this.Update(this._values, primaryKey);
            return;
        }

        const queryStr = QueryStatementBuilder.BuildDelete(this._tableName, this._values);
        const _query = new Query({ 
            tableName: this._tableName, 
            query: queryStr, parameters: 
            this.values, adapterName: 
            this._customAdapter 
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