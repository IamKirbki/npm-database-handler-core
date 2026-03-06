import type Model from '@core/abstract/Model.js';
import Query from '@core/base/Query.js';
import {
  columnType,
  Join,
  relation,
  QueryComparisonParameters,
  QueryIsEqualParameter,
  QueryLayers,
  TableColumnInfo,
  QueryValues,
} from '@core/types/index.js';
import QueryStatementBuilder from '@core/helpers/QueryBuilders/QueryStatementBuilder.js';
import { Container, IDatabaseAdapter } from '@core/index.js';
import QueryCache from '@core/runtime/QueryCache.js';
import { QueryFactory } from '@core/types/factories';
import RelationError from '@core/helpers/Errors/ModelErrors/RelationError.js';
import InvalidOperationError from '@core/helpers/Errors/ModelErrors/InvalidOperationError.js';
import UnknownTableError from '@core/helpers/Errors/TableErrors/UnknownTableError.js';
import DepricatedQueryStatementBuilder from '@core/helpers/QueryBuilders/depricatedQueryStatementBuilder.js';

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
    const modelNameKey = tableName || ModelClass.name;
    const existing = this._instances.get(modelNameKey);
    if (!existing) {
      const instance = new Repository<ModelType, Model<ModelType>>(
        tableName,
        new ModelClass(),
        customDatabaseAdapter,
        queryFactory,
      );
      this._instances.set(modelNameKey, instance);
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
      throw new UnknownTableError(
        relation.pivotTable!,
        'Create it in alphabetical order before using many-to-many relationships.',
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

    const normalizedPrimaryKey = Object.entries(primaryKey).map(
      ([column, value]) => ({
        column,
        operator: '=' as const,
        value,
      }),
    );

    const updatedRecord = await this.getRecord(
      { base: { from: table, where: normalizedPrimaryKey } },
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
      throw new InvalidOperationError(
        'No joins defined for the Join operation.',
      );
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
    const rawMapped = await this.mapJoinedResults<Type>(
      records,
      queryLayers.base.joins,
    );
    const joinAliases = queryLayers.base.joins.map(
      (j) => j.name || j.fromTable,
    );
    const splitTables = this.hydrateJoinedRecords<Type>(rawMapped, joinAliases);
    return splitTables;
  }

  private async mapJoinedResults<Type extends columnType>(
    records: { values: Type }[],
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
          } else {
            // Check if tableName matches any join alias or table name
            const currentJoin = joins.find(
              (j) => (j.name || j.fromTable) === tableName,
            );
            if (currentJoin) {
              const aliasedTableName =
                currentJoin.name || currentJoin.fromTable;
              joinedTableData[aliasedTableName] ??= {};
              joinedTableData[aliasedTableName][columnName] = value;
            }
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

  private hydrateJoinedRecords<Type extends columnType>(
    records: Type[],
    joinedTables: string[],
    primaryKey: string = 'id',
  ): Type[] {
    const parentMap = new Map<
      unknown,
      {
        parent: columnType;
        childMaps: { [table: string]: Map<unknown, columnType> };
      }
    >();

    for (const values of records) {
      const parentId = values[primaryKey];
      const parentData: columnType = {};
      const childData: { [table: string]: columnType } = {};

      for (const [key, val] of Object.entries(values)) {
        if (joinedTables.includes(key)) {
          childData[key] = val as unknown as columnType;
        } else {
          parentData[key] = val;
        }
      }

      if (!parentMap.has(parentId)) {
        const childMaps: { [table: string]: Map<unknown, columnType> } = {};
        for (const table of joinedTables) {
          childMaps[table] = new Map();
        }
        parentMap.set(parentId, { parent: parentData, childMaps });
      }

      const entry = parentMap.get(parentId)!;
      for (const [table, child] of Object.entries(childData)) {
        const childId =
          child[primaryKey] ??
          Object.values(child)
            .filter((v) => v !== null)
            .join('__');
        if (childId !== undefined && childId !== '') {
          entry.childMaps[table].set(childId, child);
        }
      }
    }

    return Array.from(parentMap.values()).map(({ parent, childMaps }) => {
      const merged: columnType = { ...parent };
      for (const [table, childMap] of Object.entries(childMaps)) {
        merged[table] = Array.from(childMap.values()) as unknown as QueryValues;
      }
      return merged as Type;
    });
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
        relation = Model.Relations.find((rel) => rel.path === join.path);
      }

      if (!relation) {
        throw new RelationError(join.relation, 'Relation not found.');
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

        const relationName = join.alias || relation.name;

        return [
          {
            fromTable: targetTable
              ? targetTable
              : relation.model.Configuration.table,
            baseTable: baseTable ? baseTable : Model.Configuration.table,
            joinType,
            name: relationName,
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
    base: QueryComparisonParameters[],
    additional: QueryComparisonParameters[],
  ): QueryComparisonParameters[] {
    return [...base, ...additional];
  }

  private convertParamsToObject(
    params: QueryComparisonParameters[],
  ): columnType {
    const paramObject: columnType = {};

    params.forEach((param) => {
      paramObject[param.column] = param.value;
    });

    return paramObject;
  }

  private async buildInsertQuery(
    tableName: string,
    data: columnType,
  ): Promise<string> {
    const query = DepricatedQueryStatementBuilder.BuildInsert(tableName, data);
    const values = Object.values(data);

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
