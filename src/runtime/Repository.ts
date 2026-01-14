import type Model from "@core/abstract/Model.js";
import Record from "@core/base/Record.js";
import Query from "@core/base/Query.js";
import Table from "@core/base/Table.js";
import { columnType, Join, QueryCondition, QueryOptions, relation, QueryParameters, QueryWhereParameters } from "@core/types/index.js";

export default class Repository<Type extends columnType, ModelType extends Model<Type>> {
    private static _instances: Map<string, Repository<columnType, Model<columnType>>> = new Map();
    private models: Map<string, ModelType> = new Map();
    private manyToManyRelations: Map<string, relation> = new Map();
    private Table: Table

    constructor(tableName: string, ModelClass: ModelType, customAdapter?: string) {
        const modelPk = ModelClass.primaryKey?.toString() || ModelClass.constructor.name;
        this.models.set(modelPk, ModelClass);
        this.Table = new Table(tableName, customAdapter);
    }

    public static getInstance<ModelType extends columnType>(
        ModelClass: new () => Model<ModelType>,
        tableName: string,
        customAdapter?: string
    ): Repository<ModelType, Model<ModelType>> {
        const className = ModelClass.name;
        if (!this._instances.has(className)) {
            const instance = new Repository<ModelType, Model<ModelType>>(tableName, new ModelClass(), customAdapter);
            this._instances.set(className, instance);
            return instance;
        }

        return this._instances.get(className) as Repository<ModelType, Model<ModelType>>;
    }

    private generateManyToManyKeys(
        foreignKey: string,
        modelOfOrigin: ModelType,
        relation: relation
    ) {
        const reversed = relation.pivotTable === `${relation.model.Configuration.table}_${modelOfOrigin.Configuration.table}`;

        return {
            [relation.pivotLocalKey!]: !reversed ? foreignKey : modelOfOrigin.values[relation.foreignKey]!,
            [relation.pivotForeignKey!]: !reversed ? modelOfOrigin.values[relation.foreignKey]! : foreignKey
        }
    }

    public async linkManyToMany(
        foreignKey: string,
        modelOfOrigin: ModelType,
        relation: relation
    ): Promise<void> {
        const table = new Table(relation.pivotTable!);
        await table.Insert(this.generateManyToManyKeys(foreignKey, modelOfOrigin, relation));
    }

    public async unlinkManyToMany(
        foreignKey: string,
        modelOfOrigin: ModelType,
        relation: relation
    ): Promise<void> {
        const table = new Table(relation.pivotTable!);
        const record = await table.Record(this.generateManyToManyKeys(foreignKey, modelOfOrigin, relation));
        await record?.Delete();
    }

    public async getManyToManyRelation(relation: relation, modelOfOrigin: ModelType): Promise<relation | undefined> {
        const oneWayTable = relation.pivotTable
            ?.replace(`${relation.model.Configuration.table}_`, '')
            .replace(`_${relation.model.Configuration.table}`, '');

        const otherWayTable = relation.pivotTable
            ?.replace(`${modelOfOrigin.Configuration.table}_`, '')
            .replace(`_${modelOfOrigin.Configuration.table}`, '');

        if (oneWayTable && this.manyToManyRelations.has(oneWayTable)) {
            return this.manyToManyRelations.get(oneWayTable);
        } else if (otherWayTable && this.manyToManyRelations.has(otherWayTable)) {
            return this.manyToManyRelations.get(otherWayTable);
        }

        if (await this.doesTableExist(oneWayTable!)) {
            this.manyToManyRelations.set(oneWayTable!, relation);
            return relation;
        } else {
            throw new Error(`Pivot table ${oneWayTable} does not exist in the database. (Can also be named ${otherWayTable})`);
        }
    }

    public doesTableExist(name: string): Promise<boolean> {
        const table = new Table(name);
        return table.exists();
    }

    public syncModel(model: ModelType): void {
        const modelPk = model.primaryKey?.toString() || model.constructor.name;
        this.models.set(modelPk, model);
    }

    public getModel(name: string): ModelType {
        return this.models.get(name) as ModelType;
    }

    public async save(attributes: Type): Promise<void> {
        await this.Table.Insert<Type>(attributes);
    }

    public async first(conditions: QueryCondition, Model: Model<Type>): Promise<Type | null> {
        let record;
        if (Model.JoinedEntities.length > 0) {
            const results = await this.join(Model, conditions, { limit: 1 });
            record = results[0] ? { values: results[0] } : undefined;
        } else {
            record = await this.Table.Record<Type>({ where: conditions });
        }

        return record ? record.values : null;
    }

    public async get(conditions: QueryCondition, queryOptions: QueryOptions, Model: Model<Type>): Promise<Type[]> {
        if (Model.JoinedEntities.length > 0) {
            return await this.join(Model, conditions, queryOptions);
        } else {
            const records = await this.Table.Records<Type>({ where: conditions, ...queryOptions });
            return records.map(record => record.values);
        }
    }

    public async all(Model: Model<Type>, queryscopes?: QueryCondition, queryOptions?: QueryOptions): Promise<Type[]> {
        if (Model.JoinedEntities.length > 0) {
            return await this.join(Model);
        } else {
            const records = await this.Table.Records<Type>({ where: queryscopes, ...queryOptions });
            return records.map(record => record.values);
        }
    }

    public async update(primaryKey: QueryWhereParameters, newAttributes: Partial<Type>): Promise<Record<Type> | undefined> {
        const record = await this.Table.Record<Type>({ where: primaryKey as QueryCondition });
        if (record) {
            return await record.Update(newAttributes, primaryKey);
        }
    }

    private async join(Model: Model<Type>, conditions?: QueryCondition, queryOptions?: QueryOptions): Promise<Type[]> {
        const Join: Join[] = Model.JoinedEntities.flatMap(join => {
            const relation: relation | undefined = Model.Relations.find(rel => rel.model.Configuration.table.toLowerCase() === join.relation.toLowerCase());
            if (join.queryScopes) {
                conditions = this.mergeQueryConditions(conditions || {}, join.queryScopes);
            }

            if (!relation) {
                throw new Error(`Relation for joined entity ${join} not found.`);
            }

            if (relation.type === 'manyToMany') {
                return [
                    {
                        fromTable: relation.pivotTable,
                        baseTable: Model.Configuration.table,
                        joinType: 'INNER',
                        on: [
                            { [relation.pivotForeignKey!]: relation.localKey }
                        ]
                    },
                    {
                        fromTable: relation.model.Configuration.table,
                        baseTable: relation.pivotTable,
                        joinType: 'INNER',
                        on: [
                            { [relation.foreignKey!]: relation.pivotLocalKey! }
                        ]
                    }
                ] as Join[];
            }

            const JoinType = relation.type === 'hasOne' || relation.type === 'belongsTo' ? 'INNER' : 'LEFT';

            return [{
                fromTable: relation.model.Configuration.table,
                baseTable: Model.Configuration.table,
                joinType: JoinType,
                on: [
                    { [relation.foreignKey!]: relation.localKey! }
                ]
            }] as Join[];
        });

        const records = await this.Table.Join<Type>(Join, { where: conditions, ...queryOptions });
        return records.map(record => record.values);
    }

    private mergeQueryConditions(base: QueryCondition, additional: QueryCondition): QueryParameters[] {
        return [...Query.ConvertParamsToArray(base), ...Query.ConvertParamsToArray(additional)];
    }
}
