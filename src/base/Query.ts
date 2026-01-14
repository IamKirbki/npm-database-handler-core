import { columnType, QueryWhereCondition, QueryIsEqualParameter, TableColumnInfo, QueryComparisonParameters } from "@core/types/index.js";
import { Container, Record, IDatabaseAdapter } from "@core/index.js";

export type QueryConstructorType = {
  tableName: string;
  query: string;
  parameters?: QueryWhereCondition;
  adapterName?: string;
};

/** Query class for executing custom SQL queries */
export default class Query {
  public readonly TableName: string;

  private readonly _adapter: IDatabaseAdapter;
  private _query: string = "";
  private _parameters: QueryWhereCondition = {};

  public get Parameters(): QueryWhereCondition {
    return this._parameters;
  }

  constructor({
    tableName,
    query,
    parameters,
    adapterName
  }: QueryConstructorType) {
    this.TableName = tableName;
    this._query = query;

    if (parameters)
      this._parameters = Query.ConvertParamsToObject(parameters);

    this._adapter = Container.getInstance().getAdapter(adapterName)
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
    return results.map(res => new Record<Type>(this.TableName, res));
  }

  /** Execute a SELECT query and return the first matching row */
  public async Get<Type extends columnType>(): Promise<Record<Type> | undefined> {
    const stmt = await this._adapter.prepare(this._query);
    const results = await stmt.get(this.Parameters) as Type | undefined;
    return results ? new Record<Type>(this.TableName, results) : undefined;
  }

  public static async tableColumnInformation(tableName: string, customAdapter?: string): Promise<TableColumnInfo[]> {
    return Container.getInstance().getAdapter(customAdapter).tableColumnInformation(tableName);
  }

  public async Count(): Promise<number> {
    const stmt = await this._adapter.prepare(this._query);
    const result = await stmt.get(this.Parameters) as { count: string };
    return parseInt(result.count) || 0;
  }

  public static ConvertParamsToArray(params: QueryWhereCondition): QueryComparisonParameters[] {
    const paramArray: QueryComparisonParameters[] = [];

    if (Array.isArray(params)) {
      return params;
    } else {
      Object.entries(params).forEach(([key, value]) => {
        return paramArray.push({
          column: key,
          operator: "=",
          value
        })
      })
    }

    return paramArray;
  }

  /** Convert various parameter formats to a consistent object format */
  public static ConvertParamsToObject(params: QueryWhereCondition): QueryIsEqualParameter {
    const paramObject: QueryIsEqualParameter = {};
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
  public static ConvertValueToString(params: QueryIsEqualParameter): QueryIsEqualParameter {
    return Object.entries(params).map(([key, value]) => {
      return { [key]: value !== null && !(value instanceof Date) && value !== undefined ? value.toString() : value };
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
  }
}
