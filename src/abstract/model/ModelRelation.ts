import {
  columnType,
  joinedEntity,
  ModelConfig,
  QueryComparisonParameters,
  QueryWhereCondition,
  relation,
} from '@core/types/index.js';
import Model from '@core/abstract/Model.js';
import Repository from '@core/runtime/Repository.js';
import RelationError from '@core/helpers/Errors/ModelErrors/RelationError.js';
import InvalidOperationError from '@core/helpers/Errors/ModelErrors/InvalidOperationError.js';

export default abstract class ModelRelations<
  Type extends columnType,
  Self extends Model<Type> = Model<Type>,
> {
  protected joinedEntities: joinedEntity[] = [];
  protected relations: relation[] = [];

  abstract get Configuration(): ModelConfig;
  protected abstract get repository(): Repository<Type, Self>;
  protected abstract get self(): Self;

  public get JoinedEntities(): joinedEntity[] {
    return this.joinedEntities;
  }

  public get Relations(): relation[] {
    return this.relations;
  }

  public async insertRecordIntoPivotTable(
    otherTable: string,
    foreignKey: string,
  ): Promise<void> {
    await this.callRelationMethod(otherTable);

    const relation = this.relations.pop();

    if (!relation) {
      throw new RelationError('pivot table insertion', 'Relation not found');
    }

    await this.repository.insertRecordIntoPivotTable(
      foreignKey,
      this.self,
      relation,
    );
  }

  protected async ManyToMany<modelType extends Model<columnType>>(
    model: modelType,
    pivotTable: string = [this.Configuration.table, model.Configuration.table]
      .sort()
      .join('_'),
    localKey: string = this.Configuration.primaryKey,
    foreignKey: string = model.Configuration.primaryKey,
    pivotForeignKey: string = `${this.Configuration.table}_${localKey}`,
    pivotLocalKey: string = `${model.Configuration.table}_${foreignKey}`,
    path: string = pivotTable,
    name: string = path.split('.')[1],
  ): Promise<this> {
    const relation = await this.repository.getManyToManyRelation({
      type: 'manyToMany',
      model: model,
      pivotTable: pivotTable,
      path: path,
      name: name,
      foreignKey: foreignKey,
      pivotForeignKey: pivotForeignKey,
      localKey: localKey,
      pivotLocalKey: pivotLocalKey,
    });

    if (!relation) {
      throw new RelationError(
        model.Configuration.table,
        'Failed to create many-to-many relation',
      );
    }

    this.relations.push(relation);

    return this;
  }

  protected hasMany<modelType extends Model<columnType>>(
    model: modelType,
    foreignKey: string = `${this.Configuration.table}_${this.Configuration.primaryKey}`,
    localKey: string = this.Configuration.primaryKey,
    path: string = `${this.Configuration.table}.${model.Configuration.table}`,
    name: string = path.split('.')[1],
  ): this {
    this.relations.push({
      type: 'hasMany',
      model: model,
      foreignKey: foreignKey,
      localKey: localKey,
      path: path,
      name: name,
    });
    return this;
  }

  protected hasOne<modelType extends Model<columnType>>(
    model: modelType,
    foreignKey: string = `${model.Configuration.primaryKey}`,
    localKey: string = `${model.Configuration.table}_${model.Configuration.primaryKey}`,
    path: string = `${this.Configuration.table}.${model.Configuration.table}`,
    name: string = path.split('.')[1],
  ): this {
    this.relations.push({
      type: 'hasOne',
      model: model,
      foreignKey: foreignKey,
      localKey: localKey,
      path: path,
      name: name,
    });
    return this;
  }

  protected belongsTo<modelType extends Model<columnType>>(
    model: modelType,
    foreignKey: string = `${model.Configuration.table}_${model.Configuration.primaryKey}`,
    localKey: string = model.Configuration.primaryKey,
    path: string = `${this.Configuration.table}.${model.Configuration.table}`,
    name: string = path.split('.')[1],
  ): this {
    this.relations.push({
      type: 'belongsTo',
      model: model,
      foreignKey: foreignKey,
      localKey: localKey,
      path: path,
      name: name,
    });
    return this;
  }

  public static with<ParameterModelType extends Model<columnType>>(
    this: new () => ParameterModelType,
    relation: string,
    queryScopes?: QueryWhereCondition,
  ): ParameterModelType {
    const instance = new this();
    return instance.with(relation, queryScopes);
  }

  public with(relation: string, queryScopes?: QueryWhereCondition): this {
    const [relationName, alias] = relation.split(' as ').map((s) => s.trim());
    const result = this.callRelationMethod(relationName);

    if (result instanceof Promise) {
      throw new InvalidOperationError(
        `Relation method '${relationName}' is asynchronous. Use asyncWith() instead of with().`,
      );
    }

    return this.finishWith(alias, relationName, queryScopes);
  }

  public async asyncWith(
    relation: string,
    queryScopes?: QueryWhereCondition,
  ): Promise<this> {
    const [relationName, alias] = relation.split(' as ').map((s) => s.trim());
    await this.callRelationMethod(relationName);
    return this.finishWith(alias, relationName, queryScopes);
  }

  private finishWith(
    alias: string,
    relationName: string,
    queryScopes?: QueryWhereCondition,
  ): this {
    const lastRelation = this.relations[this.relations.length - 1];
    const tableName = alias || lastRelation.model.Configuration.table;

    const normalizedScopes = this.normalizeQueryScopes(queryScopes, tableName);

    this.joinedEntities.push({
      relation: relationName,
      alias: alias,
      path: lastRelation.path,
      queryScopes: normalizedScopes,
    });

    return this;
  }

  public callRelationMethod(relation: string): void | Promise<void> {
    const method = Reflect.get(this, relation);
    if (typeof method !== 'function') {
      throw new RelationError(relation, 'Relation method does not exist');
    }
    const result = method.call(this);

    //@TODO: check if method is not static
    // Only return promise if the method is actually async
    return result instanceof Promise ? result : undefined;
  }

  private normalizeQueryScopes(
    queryScopes: QueryWhereCondition | undefined,
    tableName: string,
  ): QueryComparisonParameters[] | undefined {
    if (!queryScopes) {
      return undefined;
    }

    const isSingleParameter =
      Object.keys(queryScopes).length === 3 &&
      'column' in queryScopes &&
      'operator' in queryScopes &&
      'value' in queryScopes;

    const scopesArray = isSingleParameter
      ? [queryScopes as QueryComparisonParameters]
      : ((Array.isArray(queryScopes)
          ? queryScopes
          : Object.entries(queryScopes).map(([key, value]) => ({
              column: key,
              operator: '=',
              value,
            }))) as QueryComparisonParameters[]);

    return scopesArray.map((scope) => ({
      ...scope,
      column: `${tableName}.${scope.column}`,
    }));
  }
}
