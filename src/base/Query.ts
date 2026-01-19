import {
  columnType,
  QueryWhereCondition,
  QueryIsEqualParameter,
  TableColumnInfo,
  QueryComparisonParameters,
  QueryConstructorType,
  RecordFactory,
} from '@core/types/index.js';
import { Container, Record, IDatabaseAdapter } from '@core/index.js';
import UnknownTableError from '@core/helpers/Errors/TableErrors/UnknownTableError.js';
import UnexpectedEmptyQueryError from '@core/helpers/Errors/QueryErrors/UnexpectedEmptyQueryError.js';
import QueryCache from '@core/runtime/QueryCache.js';

/** Query class for executing custom SQL queries */
export default class Query {
  public readonly TableName: string;

  private readonly _adapter: IDatabaseAdapter;
  private readonly _recordFactory: RecordFactory;
  private readonly _queryCache: QueryCache;
  private _query?: string = '';
  private _parameters: QueryWhereCondition = {};

  public get Parameters(): QueryWhereCondition {
    return this._parameters;
  }

  constructor({
    tableName,
    query,
    parameters,
    adapterName,
    recordFactory = (table, values, adapter) =>
      new Record(table, values, adapter),
  }: QueryConstructorType) {
    this.TableName = tableName;
    this._query = query;

    // eslint-disable-next-line no-undef
    if (Container.getInstance().logging) this._query ? console.info(this._query) : console.info("No query found, probably checking if a table exists or getting the table column information.");
    if (parameters) this._parameters = this.ConvertParamsToObject(parameters);

    this._adapter = Container.getInstance().getAdapter(adapterName);
    this._queryCache = QueryCache.getInstance();
    this._recordFactory = recordFactory;
  }

  private async throwIfTableNotExists(): Promise<void> {
    if (!this._queryCache.doesTableExist(this.TableName)) {
      const exists = await this.DoesTableExist();
      if (!exists) {
        throw new UnknownTableError(this.TableName);
      }

      this._queryCache.addExistingTable(this.TableName);
    }
  }

  /** Execute a non-SELECT query (INSERT, UPDATE, DELETE, etc.) */
  public async Run<Type>(): Promise<Type> {
    await this.throwIfTableNotExists();
    if (!this._query) {
      throw new UnexpectedEmptyQueryError();
    }

    const stmt = await this._adapter.prepare(this._query);
    return (await stmt.run(this.Parameters)) as Type;
  }

  /** Execute a SELECT query and return all matching rows */
  public async All<Type extends columnType>(): Promise<Record<Type>[]> {
    await this.throwIfTableNotExists();
    if (!this._query) {
      throw new Error('No query defined to run.');
    }

    const stmt = await this._adapter.prepare(this._query);
    const results = (await stmt.all(this.Parameters)) as Type[];
    return results.map((res) => this._recordFactory<Type>(this.TableName, res));
  }

  /** Execute a SELECT query and return the first matching row */
  public async Get<Type extends columnType>(): Promise<
    Record<Type> | undefined
  > {
    await this.throwIfTableNotExists();
    if (!this._query) {
      throw new Error('No query defined to run.');
    }

    const stmt = await this._adapter.prepare(this._query);
    const results = (await stmt.get(this.Parameters)) as Type | undefined;
    return results
      ? this._recordFactory<Type>(this.TableName, results)
      : undefined;
  }

  public async TableColumnInformation(
    tableName: string,
  ): Promise<TableColumnInfo[]> {
    let tableColumnInfo = this._queryCache.getTableColumnInformation(tableName);
    if (tableColumnInfo) return tableColumnInfo

    tableColumnInfo = await this._adapter.tableColumnInformation(tableName);
    this._queryCache.setTableColumnInformation(tableName, tableColumnInfo);

    return tableColumnInfo;
  }

  public async DoesTableExist(): Promise<boolean> {
    if (this._queryCache.doesTableExist(this.TableName)) {
      return true;
    }

    const exists = await this._adapter.tableExists(this.TableName);
    if (exists) {
      this._queryCache.addExistingTable(this.TableName);
    }

    return exists;
  }

  public async Count(): Promise<number> {
    await this.throwIfTableNotExists();
    if (!this._query) {
      throw new Error('No query defined to run.');
    }

    const stmt = await this._adapter.prepare(this._query);
    const result = (await stmt.get(this.Parameters)) as { count: string };
    return parseInt(result.count) || 0;
  }

  public ConvertParamsToArray(
    params: QueryWhereCondition,
  ): QueryComparisonParameters[] {
    const paramArray: QueryComparisonParameters[] = [];

    if (Array.isArray(params)) {
      return params;
    } else {
      Object.entries(params).forEach(([key, value]) => {
        return paramArray.push({
          column: key,
          operator: '=',
          value,
        });
      });
    }

    return paramArray;
  }

  /** Convert various parameter formats to a consistent object format */
  public ConvertParamsToObject(
    params: QueryWhereCondition,
  ): QueryIsEqualParameter {
    const paramObject: QueryIsEqualParameter = {};
    if (Array.isArray(params)) {
      params.forEach((param) => {
        paramObject[param.column] = param.value;
      });
    } else {
      Object.assign(paramObject, params);
    }

    return this.ConvertValueToString(paramObject);
  }

  /** Databases don't like numeric values when inserting with a query */
  public ConvertValueToString(
    params: QueryIsEqualParameter,
  ): QueryIsEqualParameter {
    return Object.entries(params)
      .map(([key, value]) => {
        return {
          [key]:
            value !== null && !(value instanceof Date) && value !== undefined
              ? value.toString()
              : value,
        };
      })
      .reduce((acc, curr) => ({ ...acc, ...curr }), {});
  }
}
