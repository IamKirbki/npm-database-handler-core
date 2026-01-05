import { columnType, QueryCondition, QueryWhereParameters, TableColumnInfo } from "@core/types/index.js";
import { Container, Record, IDatabaseAdapter } from "@core/index.js";

/** Query class for executing custom SQL queries */
export default class Query {
  public readonly TableName: string;

  private readonly _adapter: IDatabaseAdapter = Container.getInstance().getAdapter();
  private _query: string = "";
  private _parameters: QueryCondition = {};

  public get Parameters(): QueryCondition {
    return this._parameters;
  }

  public set Parameters(value: QueryCondition) {
    this._parameters = Query.ConvertParamsToObject(value);
  }

  constructor(TableName: string, Query: string) {
    this.TableName = TableName;
    this._query = Query;
  }

  /** Execute a non-SELECT query (INSERT, UPDATE, DELETE, etc.) */
  public async Run<Type>(): Promise<Type> {
    const stmt = await this._adapter.prepare(this._query);
    return await stmt.run(this.Parameters) as Type;
  }

  /** Execute a SELECT query and return all matching rows */
  public async All<Type extends columnType>(): Promise<Record<Type>[]> {
    const stmt = await this._adapter.prepare(this._query);
    const results = await stmt.all(this.Parameters) as Type[];
    return results.map(res => new Record<Type>(res, this.TableName));
  }

  /** Execute a SELECT query and return the first matching row */
  public async Get<Type extends columnType>(): Promise<Record<Type> | undefined> {
    const stmt = await this._adapter.prepare(this._query);
    const results = await stmt.get(this.Parameters) as Type | undefined;
    return results ? new Record<Type>(results, this.TableName) : undefined;
  }

  public static async tableColumnInformation(tableName: string) : Promise<TableColumnInfo[]> {
    return Container.getInstance().getAdapter().tableColumnInformation(tableName);
  }

  public async Count(): Promise<number> {
    const stmt = await this._adapter.prepare(this._query);
    const result = await stmt.get(this.Parameters) as { count: string };
    return parseInt(result.count) || 0;
  }

  /** Convert various parameter formats to a consistent object format */
  public static ConvertParamsToObject(params: QueryCondition): QueryWhereParameters {
    const paramObject: QueryWhereParameters = {};
    if (Array.isArray(params)) {
      params.forEach(param => {
        paramObject[param.column] = param.value;
      });
    } else {
      Object.assign(paramObject, params);
    }

    return this.ConvertValueToString(paramObject);
  }

  /** Databases don't like numeric values when inserting with a query */
  public static ConvertValueToString(params: QueryWhereParameters): QueryWhereParameters {
    return Object.entries(params).map(([key, value]) => {
      return { [key]: value !== null && value !== undefined ? value.toString() : value };
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
  }
}
