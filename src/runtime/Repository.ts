import type Model from "@core/abstract/Model.js";
import Table from "@core/base/Table.js";
import { columnType, Join, QueryCondition, QueryOptions, relation } from "@core/types/index";

export default class Repository<Type extends columnType, ModelType extends Model<Type>> {
    private static _instances: Map<string, Repository<columnType, Model<columnType>>> = new Map();
    private models: Map<string, ModelType> = new Map();
    private Table: Table

    constructor(tableName: string, ModelClass: ModelType) {
        const modelPk = ModelClass.primaryKey?.toString() || ModelClass.constructor.name;
        this.models.set(modelPk, ModelClass);
        this.Table = new Table(tableName);
    }

    public static getInstance<ModelType extends columnType>(
        ModelClass: new () => Model<ModelType>,
        tableName: string
    ): Repository<ModelType, Model<ModelType>> {
        const className = ModelClass.name;
        if (!this._instances.has(className)) {
            const instance = new Repository<ModelType, Model<ModelType>>(tableName, new ModelClass());
            this._instances.set(className, instance);
            return instance;
        }

        return this._instances.get(className) as Repository<ModelType, Model<ModelType>>;
    }

    public syncModel(model: ModelType): void {
        const modelPk = model.primaryKey?.toString() || model.constructor.name;
        this.models.set(modelPk, model);
    }

    public getModel(name: string): ModelType {
        return this.models.get(name) as ModelType;
    }

    public async save(attributes: Type): Promise<void> {
        await this.Table.Insert(attributes);
    }

    public async first(conditions: QueryCondition, Model: Model<Type>): Promise<Type | null> {
        let record;
        if (Model.JoinedEntities.length > 0) {
            record = await this.join(Model, conditions, { limit: 1 }).then(results => results[0]);
        } else {
            record = await this.Table.Record({ where: conditions });
        }

        return record ? record.values as Type : null;
    }

    public async get(conditions: QueryCondition, queryOptions: QueryOptions, Model: Model<Type>): Promise<Type[]> {
        if (Model.JoinedEntities.length > 0) {
            return await this.join(Model, conditions, queryOptions);
        } else {
            return await this.Table.Records({ where: conditions, ...queryOptions }).then(records => records.map(record => record.values as Type));
        }
    }

    public async all(Model: Model<Type>, queryOptions?: QueryOptions): Promise<Type[]> {
        if (Model.JoinedEntities.length > 0) {
            return await this.join(Model);
        } else {
            return await this.Table.Records(queryOptions).then(records => records.map(record => record.values as Type));
        }
    }

    public async update(attributes: Partial<Type>): Promise<this> {
        const primaryKey = (this.models.values().next().value as Model<Type>).Configuration.primaryKey;
        const pkValue = attributes[primaryKey];
        if (pkValue) {
            const record = await this.Table.Record({ where: { [primaryKey]: pkValue } });
            if (record) {
                await record.Update(attributes);
            }
        } else {
            throw new Error("Primary key value is required for update.");
        }

        return this;
    }

    private async join(Model: Model<Type>, conditions?: QueryCondition, queryOptions?: QueryOptions): Promise<Type[]> {
        const Join: Join[] = Model.JoinedEntities.map(join => {
            const relation: relation | undefined = Model.Relations.find(rel => rel.model.Configuration.table.toLowerCase() === join.toLowerCase());
            if (!relation) {
                throw new Error(`Relation for joined entity ${join} not found.`);
            }

            const JoinType = relation.type === 'hasOne' || relation.type === 'belongsTo' ? 'INNER' : 'LEFT';

            return {
                fromTable: relation.model.Configuration.table,
                joinType: JoinType,
                on: [
                    { [relation.foreignKey]: relation.localKey as string }
                ]
            }
        })
      
        return (await this.Table.Join(Join, { where: conditions, ...queryOptions })).map(record => record.values as Type);
    }
}