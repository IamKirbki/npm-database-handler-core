import { columnType, joinedEntity, ModelConfig, QueryComparisonParameters, QueryWhereCondition, relation } from "@core/types/index.js";
import Model from "@core/abstract/Model.js";
import Repository from '../../runtime/Repository';

export default abstract class ModelRelations<Type extends columnType> {
    protected joinedEntities: joinedEntity[] = [];
    protected relations: relation[] = [];
    
    abstract get Configuration(): ModelConfig;
    protected abstract get repository(): Repository<Type, Model<Type>>;

    public get JoinedEntities(): joinedEntity[] {
        return this.joinedEntities;
    }

    public get Relations(): relation[] {
        return this.relations;
    }

    public async insertRecordIntoPivotTable(
        otherTable: string,
        foreignKey: string
    ): Promise<void> {
        await this.callRelationMethod(otherTable);

        const relation = this.relations[this.relations.length - 1];
        this.relations.pop();

        await this.repository.insertRecordIntoPivotTable(foreignKey, this, relation);
    }

    protected async ManyToMany<modelType extends Model<Type>>(
        model: modelType,
        pivotTable: string = [this.Configuration.table, model.Configuration.table].sort().join('_'),
        localKey: string = this.Configuration.primaryKey,
        foreignKey: string = model.Configuration.primaryKey,
        pivotForeignKey: string = `${this.Configuration.table}_${localKey}`,
        pivotLocalKey: string = `${model.Configuration.table}_${foreignKey}`,
    ): Promise<this> {
        const relation = await this.repository.getManyToManyRelation({
            type: 'manyToMany',
            model: model,
            pivotTable: pivotTable,
            foreignKey: foreignKey,
            pivotForeignKey: pivotForeignKey,
            localKey: localKey,
            pivotLocalKey: pivotLocalKey,
        });

        this.relations.push(relation!);

        return this;
    }

    protected hasMany<modelType extends Model<columnType>>(
        model: modelType,
        foreignKey: string = `${this.Configuration.table}_${this.Configuration.primaryKey}`,
        localKey: string = this.Configuration.primaryKey
    ): this {
        this.relations.push({
            type: 'hasMany',
            model: model,
            foreignKey: foreignKey,
            localKey: localKey,
        });
        return this;
    }

    protected hasOne<modelType extends Model<columnType>>(
        model: modelType,
        foreignKey: string = `${model.Configuration.primaryKey}`,
        localKey: string = `${model.Configuration.table}_${model.Configuration.primaryKey}`
    ): this {
        this.relations.push({
            type: 'hasOne',
            model: model,
            foreignKey: foreignKey,
            localKey: localKey,
        });
        return this;
    }

    protected belongsTo<modelType extends Model<columnType>>(
        model: modelType,
        foreignKey: string = `${model.Configuration.table}_${model.Configuration.primaryKey}`,
        localKey: string = model.Configuration.primaryKey
    ): this {
        this.relations.push({
            type: 'belongsTo',
            model: model,
            foreignKey: foreignKey,
            localKey: localKey,
        });
        return this;
    }

    public static with<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        relation: string,
        queryScopes?: QueryWhereCondition
    ): ParamterModelType {
        const instance = new this();
        return instance.with(relation, queryScopes);
    }

    public with(relation: string, queryScopes?: QueryWhereCondition): this {
        const result = this.callRelationMethod(relation);
        
        if (result instanceof Promise) {
            throw new Error(
                `Relation method '${relation}' is asynchronous. Use asyncWith() instead of with().`
            );
        }

        const lastRelation = this.relations[this.relations.length - 1];
        const tableName = lastRelation.model.Configuration.table;

        const normalizedScopes = this.normalizeQueryScopes(queryScopes, tableName);

        this.joinedEntities.push({
            relation: relation,
            queryScopes: normalizedScopes
        });

        return this;
    }

    public async asyncWith(relation: string, queryScopes?: QueryWhereCondition): Promise<this> {
        await this.callRelationMethod(relation);

        const lastRelation = this.relations[this.relations.length - 1];
        const tableName = lastRelation.model.Configuration.table;

        const normalizedScopes = this.normalizeQueryScopes(queryScopes, tableName);

        this.joinedEntities.push({
            relation: relation,
            queryScopes: normalizedScopes
        });

        return this;
    }

    public callRelationMethod(relation: string): void | Promise<void> {
        const method = Reflect.get(this, relation);
        if (typeof method !== 'function') {
            throw new Error(`Relation method '${relation}' does not exist`);
        }
        const result = method.call(this);
        
        //@TODO: check if method is not static 
        // Only return promise if the method is actually async
        return result instanceof Promise ? result : undefined;
    }

    private normalizeQueryScopes(
        queryScopes: QueryWhereCondition | undefined,
        tableName: string
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
            : this.repository.ConvertParamsToArray(queryScopes);

        return scopesArray.map(scope => ({
            ...scope,
            column: `${tableName}.${scope.column}`
        }));
    }
}