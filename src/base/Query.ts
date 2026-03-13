import {
  columnType,
  QueryIsEqualParameter,
  TableColumnInfo,
  QueryConstructorType,
} from '@core/types/index.js';
import { Container, Record, IDatabaseAdapter } from '@core/index.js';
import { UnknownTableError } from '@core/helpers/Errors/TableErrors/UnknownTableError.js';
import { UnexpectedEmptyQueryError } from '@core/helpers/Errors/QueryErrors/UnexpectedEmptyQueryError.js';
import { QueryExecutionError } from '@core/helpers/Errors/QueryErrors/QueryExecutionError.js';
import { QueryCache } from '@core/runtime/QueryCache.js';
import { RecordFactory } from '@core/factories/RecordFactory.js';

/** Query class for executing custom SQL queries */
export class Query {
  public readonly TableName: string;

  private readonly _adapter: IDatabaseAdapter;
  private readonly _recordFactory: RecordFactory<columnType>;
  private readonly _queryCache: QueryCache;

  private _query?: string;
  private _parameters: QueryIsEqualParameter = {};

  public get Parameters(): QueryIsEqualParameter {
    return this._parameters;
  }

  constructor({
    tableName,
    query,
    parameters,
    adapterName,
    recordFactory = new RecordFactory<columnType>(),
  }: QueryConstructorType) {
    this.TableName = tableName;
    this._query = query;

    if (parameters) this._parameters = parameters;
    // eslint-disable-next-line no-undef
    if (Container.getInstance().logging)
      this._query
        ? console.info(this._query, '\n', this._parameters)
        : console.info(
            'No query found, probably checking if a table exists or getting the table column information.',
          );

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

    try {
      const stmt = await this._adapter.prepare(this._query);
      return (await stmt.run(this.Parameters)) as Type;
    } catch (error) {
      throw new QueryExecutionError(this._query, error);
    }
  }

  /** Execute a SELECT query and return all matching rows */
  public async All<Type extends columnType>(): Promise<Record<Type>[]> {
    await this.throwIfTableNotExists();
    if (!this._query) {
      throw new UnexpectedEmptyQueryError();
    }

    try {
      const stmt = await this._adapter.prepare(this._query);
      const results = (await stmt.all(this.Parameters)) as Type[];
      return results.map((res) =>
        this._recordFactory.create({
          table: this.TableName,
          values: res,
        }),
      ) as Record<Type>[];
    } catch (error) {
      throw new QueryExecutionError(this._query, error);
    }
  }

  /** Execute a SELECT query and return the first matching row */
  public async Get<Type extends columnType>(): Promise<
    Record<Type> | undefined
  > {
    await this.throwIfTableNotExists();
    if (!this._query) {
      throw new UnexpectedEmptyQueryError();
    }

    try {
      const stmt = await this._adapter.prepare(this._query);
      const results = (await stmt.get(this.Parameters)) as Type | undefined;
      return results
        ? (this._recordFactory.create({
            table: this.TableName,
            values: results,
          }) as Record<Type>)
        : undefined;
    } catch (error) {
      throw new QueryExecutionError(this._query, error);
    }
  }

  public async TableColumnInformation(
    tableName: string,
  ): Promise<TableColumnInfo[]> {
    let tableColumnInfo = this._queryCache.getTableColumnInformation(tableName);
    if (tableColumnInfo) return tableColumnInfo;

    try {
      tableColumnInfo = await this._adapter.tableColumnInformation(tableName);
      this._queryCache.setTableColumnInformation(tableName, tableColumnInfo);

      return tableColumnInfo;
    } catch (error) {
      throw new QueryExecutionError(
        `TableColumnInformation for ${tableName}`,
        error,
      );
    }
  }

  public async DoesTableExist(): Promise<boolean> {
    if (this._queryCache.doesTableExist(this.TableName)) {
      return true;
    }

    try {
      const exists = await this._adapter.tableExists(this.TableName);
      if (exists) {
        this._queryCache.addExistingTable(this.TableName);
      }

      return exists;
    } catch (error) {
      throw new QueryExecutionError(
        `DoesTableExist for ${this.TableName}`,
        error,
      );
    }
  }

  public async Count(): Promise<number> {
    await this.throwIfTableNotExists();
    if (!this._query) {
      throw new UnexpectedEmptyQueryError();
    }

    try {
      const stmt = await this._adapter.prepare(this._query);
      const result = (await stmt.get(this.Parameters)) as { count: string };
      return parseInt(result.count) || 0;
    } catch (error) {
      throw new QueryExecutionError(this._query, error);
    }
  }
}
