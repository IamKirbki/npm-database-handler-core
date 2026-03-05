import type Model from '@core/abstract/Model.js';
import Query from '@core/base/Query.js';
import {
  columnType,
  Join,
  QueryWhereCondition,
  relation,
  QueryComparisonParameters,
  QueryIsEqualParameter,
  QueryLayers,
  TableColumnInfo,
} from '@core/types/index.js';
import QueryStatementBuilder from '@core/helpers/QueryBuilders/QueryStatementBuilder.js';
import { Container, IDatabaseAdapter } from '@core/index.js';
import QueryCache from '@core/runtime/QueryCache.js';
import { QueryFactory } from '@core/types/factories';

export default class Repository<
  Type extends columnType,
  ModelType extends Model<Type>,
> {
  private static _instances: Map<
    string,
    Repository<columnType, Model<columnType>>
  > = new Map();
  private models: Map<string, ModelType> = new Map();
  private manyToManyRelations: Map<string, relation> = new Map();
  private customDatabaseAdapter?: string;
  private queryFactory: QueryFactory;
  private tableName: string;
  private queryCache: QueryCache;

  constructor(
    tableName: string,
    ModelClass: ModelType,
    customDatabaseAdapter?: string,
    queryFactory: QueryFactory = (config) => new Query(config),
  ) {
    const modelPk =
      ModelClass.primaryKey?.toString() || ModelClass.constructor.name;
    this.models.set(modelPk, ModelClass);
    this.queryFactory = queryFactory;
    this.tableName = tableName;
    this.customDatabaseAdapter = customDatabaseAdapter;
    this.queryCache = QueryCache.getInstance();
  }

  public static getInstance<ModelType extends columnType>(
    ModelClass: new () => Model<ModelType>,
    tableName: string,
    customDatabaseAdapter?: string,
    queryFactory?: QueryFactory,
  ): Repository<ModelType, Model<ModelType>> {
    const key = tableName || ModelClass.name;
    const existing = this._instances.get(key);
    if (!existing) {
      const instance = new Repository<ModelType, Model<ModelType>>(
        tableName,
        new ModelClass(),
        customDatabaseAdapter,
        queryFactory,
      );
      this._instances.set(
        key,
        instance,
      );
      return instance;
    }

    return existing as Repository<ModelType, Model<ModelType>>;
  }

  public static clearInstances(): void {
    this._instances.clear();
  }

  private getAdapter(): IDatabaseAdapter {
    return Container.getInstance().getAdapter(this.customDatabaseAdapter);
  }

  private generatePivotTableKeys(
    foreignKey: string,
    modelOfOrigin: ModelType,
    relation: relation,
  ) {
    const isLocal = !relation.pivotLocalKey?.includes(
      modelOfOrigin.Configuration.table,
    );

    return {
      [relation.pivotLocalKey!]: isLocal
        ? foreignKey
        : modelOfOrigin.values[relation.foreignKey]!,
      [relation.pivotForeignKey!]: isLocal
        ? modelOfOrigin.values[relation.foreignKey]!
        : foreignKey,
    };
  }

  public async insertRecordIntoPivotTable(
    foreignKey: string,
    modelOfOrigin: ModelType,
    relation: relation,
  ): Promise<void> {
    const keys = this.generatePivotTableKeys(
      foreignKey,
      modelOfOrigin,
      relation,
    );
    const queryStr = await this.buildInsertQuery(relation.pivotTable!, keys);

    const query = this.queryFactory({
      tableName: relation.pivotTable!,
      query: queryStr,
      parameters: keys,
      adapterName: this.customDatabaseAdapter,
    });
    await query.Run();
  }

  public async deleteRecordFromPivotTable(
    foreignKey: string,
    modelOfOrigin: ModelType,
    relation: relation,
  ): Promise<void> {
    const keys = this.generatePivotTableKeys(
      foreignKey,
      modelOfOrigin,
      relation,
    );
    const queryStr = await this.buildDeleteQuery(relation.pivotTable!, keys);

    const query = this.queryFactory({
      tableName: relation.pivotTable!,
      query: queryStr,
      parameters: keys,
      adapterName: this.customDatabaseAdapter,
    });
    await query.Run();
  }

  public async getManyToManyRelation(
    relation: relation,
  ): Promise<relation | undefined> {
    if (
      relation.pivotTable &&
      this.manyToManyRelations.has(relation.pivotTable)
    ) {
      return this.manyToManyRelations.get(relation.pivotTable);
    }

    if (await this.doesTableExist(relation.pivotTable!)) {
      this.manyToManyRelations.set(relation.pivotTable!, relation);
      return relation;
    } else {
      throw new Error(
        `Pivot table ${relation.pivotTable} does not exist. Create it in alphabetical order before using many-to-many relationships.`,
      );
    }
  }

  public async doesTableExist(name: string): Promise<boolean> {
    if (this.queryCache.doesTableExist(name)) {
      return true;
    }
    const adapter = this.getAdapter();
    const exists = await adapter.tableExists(name);
    if (exists) {
      this.queryCache.addExistingTable(name);
    }
    return exists;
  }

  public syncModel(model: ModelType): void {
    const modelPk = model.primaryKey?.toString() || model.constructor.name;
    this.models.set(modelPk, model);
  }

  public getModel(name: string): ModelType | undefined {
    return this.models.get(name);
  }

  public async save(attributes: Type): Promise<void> {
    const queryStr = await this.buildInsertQuery(this.tableName, attributes);
    const query = this.queryFactory({
      tableName: this.tableName,
      query: queryStr,
      parameters: attributes,
      adapterName: this.customDatabaseAdapter,
    });
    await query.Run();
  }

  public async first(
    queryLayers: QueryLayers,
    Model: Model<Type>,
  ): Promise<Type | undefined> {
    let record;
    if (Model.JoinedEntities.length > 0) {
      const result = (
        await this.join(Model, {
          ...queryLayers,
          final: { ...queryLayers.final, limit: 1 },
        })
      )[0];
      record = result;
    } else {
      record = await this.getRecord(queryLayers, true);
    }

    return record;
  }

  public async get(
    QueryLayers: QueryLayers,
    Model: Model<Type>,
  ): Promise<Type[]> {
    if (Model.JoinedEntities.length > 0) {
      return await this.join(Model, QueryLayers);
    } else {
      return await this.getRecords(QueryLayers);
    }
  }

  public async all(
    Model: Model<Type>,
    QueryLayers: QueryLayers,
  ): Promise<Type[]> {
    return this.get(QueryLayers, Model);
  }

  public async update(
    primaryKey: QueryIsEqualParameter,
    newAttributes: Partial<Type>,
    table: string,
  ): Promise<Type | undefined> {
    const queryStr = await this.buildUpdateQuery(
      table,
      newAttributes,
      primaryKey,
    );

    const params = { ...newAttributes, ...primaryKey };

    const query = this.queryFactory({
      tableName: table,
      query: queryStr,
      parameters: params,
      adapterName: this.customDatabaseAdapter,
    });

    await query.Run();

    const updatedRecord = await this.getRecord(
      { base: { from: table, where: primaryKey } },
      true,
    );
    return updatedRecord;
  }

  private async getRecords(queryLayers: QueryLayers): Promise<Type[]> {
    const builder = new QueryStatementBuilder(queryLayers);
    const queryStr = await builder.build();

    let params = {};
    if (
      queryLayers?.base?.where &&
      Object.keys(queryLayers.base.where).length > 0
    ) {
      params = this.convertParamsToObject(queryLayers.base.where);
    }
    if (
      queryLayers?.pretty?.where &&
      Object.keys(queryLayers.pretty.where).length > 0
    ) {
      params = { ...params, ...queryLayers.pretty.where };
    }

    const query = this.queryFactory({
      tableName: this.tableName,
      query: queryStr,
      parameters: params,
      adapterName: this.customDatabaseAdapter,
    });

    const results = await query.All<Type>();
    return results.map((r: { values: Type }) => r.values);
  }

  private async getRecord(
    queryLayers: QueryLayers,
    limitOne: boolean = false,
  ): Promise<Type | undefined> {
    const layers = limitOne
      ? { ...queryLayers, final: { ...queryLayers?.final, limit: 1 } }
      : queryLayers;

    const records = await this.getRecords(layers);
    return records[0];
  }

  private async join(
    Model: Model<Type>,
    queryLayers: QueryLayers,
  ): Promise<Type[]> {
    const { joins, queryLayers: nextLayers } = this.buildJoinObject(
      Model,
      queryLayers,
    );

    nextLayers.base.joins = joins;

    const records = await this.getJoinRecords(nextLayers);
    return records;
  }

  private async getJoinRecords(queryLayers: QueryLayers): Promise<Type[]> {
    if (
      queryLayers.base.joins === undefined ||
      (Array.isArray(queryLayers.base.joins) &&
        queryLayers.base.joins.length === 0)
    ) {
      throw new Error('No joins defined for the Join operation.');
    }

    const joinedTables = queryLayers.base.joins.map((j) => j.fromTable);
    const tableColumnCache = new Map<string, TableColumnInfo[]>();
    const adapter = this.getAdapter();

    const columnInfo = await adapter.tableColumnInformation(this.tableName);
    tableColumnCache.set(this.tableName, columnInfo);

    for (const tableName of joinedTables) {
      const columnInfo = await adapter.tableColumnInformation(tableName);
      tableColumnCache.set(tableName, columnInfo);
    }

    const builder = new QueryStatementBuilder(queryLayers, tableColumnCache);
    const queryString = await builder.build();

    let params = {};
    if (queryLayers?.base?.where) {
      params = this.convertParamsToObject(queryLayers.base.where);
    }
    if (queryLayers?.pretty?.where) {
      params = {
        ...params,
        ...this.convertParamsToObject(queryLayers.pretty.where),
      };
    }

    const query = this.queryFactory({
      tableName: this.tableName,
      query: queryString,
      parameters: params,
      adapterName: this.customDatabaseAdapter,
    });

    const records = await query.All<Type>();
    const splitTables = await this.splitJoinValues<Type>(
      records,
      joinedTables,
      queryLayers.base.joins,
    );
    return splitTables;
  }

  private async splitJoinValues<Type extends columnType>(
    records: { values: Type }[],
    joinedTables: string[],
    joins: Join[],
  ): Promise<Type[]> {
    return records.map((record) => {
      const mainTableData: columnType = {};
      const joinedTableData: { [tableName: string]: columnType } = {};

      for (const [aliasedKey, value] of Object.entries(record.values)) {
        if (aliasedKey.includes('__')) {
          const [tableName, columnName] = aliasedKey.split('__');

          if (tableName === this.tableName) {
            mainTableData[columnName] = value;
          } else if (joinedTables.includes(tableName)) {
            const currentJoin = joins.find((j) => j.fromTable === tableName);
            const aliasedTableName = currentJoin?.name || tableName;
            joinedTableData[aliasedTableName] ??= {};
            joinedTableData[aliasedTableName][columnName] = value;
          }
        } else {
          mainTableData[aliasedKey] = value;
        }
      }

      const filteredJoinedData = Object.fromEntries(
        Object.entries(joinedTableData).filter(
          ([, data]) => Object.keys(data).length > 0,
        ),
      );

      const combinedData = {
        ...mainTableData,
        ...filteredJoinedData,
      } as Type;
      return combinedData;
    });
  }

  public async toSql(
    queryLayers: QueryLayers,
    Model: Model<Type>,
  ): Promise<string> {
    let nextLayers = queryLayers;

    if (Model.JoinedEntities.length > 0) {
      const result = this.buildJoinObject(Model, queryLayers);
      nextLayers = result.queryLayers;
      nextLayers.base.joins = result.joins;
    }

    return this.buildQueryString(nextLayers);
  }

  private async buildQueryString(queryLayers: QueryLayers): Promise<string> {
    if (queryLayers.base.joins && queryLayers.base.joins.length > 0) {
      const joinedTables = queryLayers.base.joins.map((j) => j.fromTable);
      const tableColumnCache = new Map<string, TableColumnInfo[]>();
      const adapter = this.getAdapter();

      const columnInfo = await adapter.tableColumnInformation(this.tableName);
      tableColumnCache.set(this.tableName, columnInfo);

      for (const tableName of joinedTables) {
        const columnInfo = await adapter.tableColumnInformation(tableName);
        tableColumnCache.set(tableName, columnInfo);
      }

      const builder = new QueryStatementBuilder(queryLayers, tableColumnCache);
      return await builder.build();
    } else {
      const builder = new QueryStatementBuilder(queryLayers);
      return await builder.build();
    }
  }

  private buildJoinObject(
    Model: Model<Type>,
    inputLayers: QueryLayers,
  ): { joins: Join[]; queryLayers: QueryLayers } {
    const queryLayers: QueryLayers = {
      ...inputLayers,
      base: {
        ...inputLayers.base,
      },
      final: inputLayers.final ? { ...inputLayers.final } : undefined,
    };

    const joins: Join[] = Model.JoinedEntities.flatMap((join) => {
      let relation = Model.Relations.find(
        (rel) =>
          rel.model.Configuration.table.replace('_', '').toLowerCase() ===
          join.relation.toLowerCase(),
      );

      if (!relation) {
        relation = Model.Relations.find(
          (rel) => rel.path.split('.')[1] === join.path.split('.')[1],
        );
      }

      if (!relation) {
        throw new Error(
          `Relation for joined entity ${join.relation} not found.`,
        );
      }

      if (join.queryScopes && queryLayers.base.where) {
        queryLayers.base.where = this.mergeQueryWhereConditions(
          queryLayers.base.where,
          join.queryScopes,
        );
      } else if (join.queryScopes) {
        queryLayers.base.where = join.queryScopes;
      }

      if (relation.type !== 'manyToMany') {
        const joinType =
          relation.type === 'hasOne' || relation.type === 'belongsTo'
            ? 'INNER'
            : 'LEFT';

        let baseTable: string | undefined;
        let targetTable: string | undefined;
        let baseKey: string | undefined;

        const [firstPathSegment, secondPathSegment] = relation.path.split('.');

        if (firstPathSegment !== Model.Configuration.table) {
          baseTable = firstPathSegment;
          targetTable = secondPathSegment;
        } else {
          baseTable = Model.Configuration.table;

          if (relation.localKey.includes('.')) {
            [baseTable, baseKey] = relation.localKey.split('.');
          } else {
            baseKey = relation.localKey;
          }
        }

        return [
          {
            fromTable: targetTable
              ? targetTable
              : relation.model.Configuration.table,
            baseTable: baseTable ? baseTable : Model.Configuration.table,
            joinType,
            name: relation.name,
            on: [
              { [relation.foreignKey!]: baseKey ? baseKey : relation.localKey },
            ],
          },
        ];
      }

      queryLayers.final ??= {};
      queryLayers.final.blacklistTables ??= [];

      queryLayers.final.blacklistTables = [
        ...queryLayers.final.blacklistTables,
        relation.pivotTable!,
      ];

      return [
        {
          fromTable: relation.pivotTable!,
          baseTable: Model.Configuration.table,
          joinType: 'INNER',
          name: relation.name,
          on: [{ [relation.pivotForeignKey!]: relation.localKey }],
        },
        {
          fromTable: relation.model.Configuration.table,
          baseTable: relation.pivotTable!,
          joinType: 'INNER',
          name: relation.name,
          on: [{ [relation.foreignKey!]: relation.pivotLocalKey! }],
        },
      ];
    });

    return { joins, queryLayers };
  }

  public mergeQueryWhereConditions(
    base: QueryWhereCondition,
    additional: QueryWhereCondition,
  ): QueryComparisonParameters[] {
    return [
      ...this.convertParamsToArray(base),
      ...this.convertParamsToArray(additional),
    ];
  }

  public ConvertParamsToArray(
    params: QueryWhereCondition,
  ): QueryComparisonParameters[] {
    return this.convertParamsToArray(params);
  }

  private convertParamsToArray(
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

  private convertParamsToObject(params: QueryWhereCondition): columnType {
    const paramObject: columnType = {};

    if (Array.isArray(params)) {
      params.forEach((param) => {
        paramObject[param.column] = param.value;
      });
    } else {
      Object.assign(paramObject, params);
    }

    return paramObject;
  }

  private async buildInsertQuery(
    tableName: string,
    data: columnType,
  ): Promise<string> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `@value${i}`).join(', ');
    const columnList = columns.join(', ');

    const query = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

    const params: columnType = {};
    values.forEach((value, index) => {
      params[`value${index}`] = value;
    });

    return query;
  }

  private async buildUpdateQuery(
    tableName: string,
    data: Partial<columnType>,
    where: QueryIsEqualParameter,
  ): Promise<string> {
    const sets = Object.keys(data)
      .map((key) => `"${key}" = @${key}`)
      .join(', ');
    const whereClauses = Object.keys(where)
      .map((key) => `"${key}" = @where_${key}`)
      .join(' AND ');

    return `UPDATE "${tableName}" SET ${sets} WHERE ${whereClauses}`;
  }

  private async buildDeleteQuery(
    tableName: string,
    where: QueryIsEqualParameter,
  ): Promise<string> {
    const whereClauses = Object.keys(where)
      .map((key) => `"${key}" = @${key}`)
      .join(' AND ');

    return `DELETE FROM "${tableName}" WHERE ${whereClauses}`;
  }
}
