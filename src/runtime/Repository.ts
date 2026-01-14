import type Model from "@core/abstract/Model.js";
import Record from "@core/base/Record.js";
import Table from "@core/base/Table.js";
import { columnType, Join, QueryWhereCondition, ExtraQueryParameters, relation, QueryComparisonParameters, QueryIsEqualParameter, TableFactory } from "@core/types/index.js";

export default class Repository<Type extends columnType, ModelType extends Model<Type>> {
    private static _instances: Map<string, Repository<columnType, Model<columnType>>> = new Map();
    private models: Map<string, ModelType> = new Map();
    private manyToManyRelations: Map<string, relation> = new Map();
    private Table: Table
    private customDatabaseAdapter?: string;
    private tableFactory: TableFactory;

    constructor(
        tableName: string, 
        ModelClass: ModelType, 
        customDatabaseAdapter?: string,
        tableFactory: TableFactory = (name, adapter) => new Table(name, adapter)
    ) {
        const modelPk = ModelClass.primaryKey?.toString() || ModelClass.constructor.name;
        this.models.set(modelPk, ModelClass);
        this.tableFactory = tableFactory;
        this.Table = this.tableFactory(tableName, customDatabaseAdapter);
        this.customDatabaseAdapter = customDatabaseAdapter;
    }

    public static getInstance<ModelType extends columnType>(
        ModelClass: new () => Model<ModelType>,
        tableName: string,
        customDatabaseAdapter?: string,
        tableFactory?: TableFactory
    ): Repository<ModelType, Model<ModelType>> {
        const className = ModelClass.name;
        if (!this._instances.has(className)) {
            const instance = new Repository<ModelType, Model<ModelType>>(
                tableName, 
                new ModelClass(), 
                customDatabaseAdapter, 
                tableFactory
            );
            this._instances.set(className, instance);
            return instance;
        }

        return this._instances.get(className) as Repository<ModelType, Model<ModelType>>;
    }

    public static clearInstances(): void {
        this._instances.clear();
    }

    private generatePivotTableKeys(
        foreignKey: string,
        modelOfOrigin: ModelType,
        relation: relation
    ) {
        const isLocal = !relation.pivotLocalKey?.includes(modelOfOrigin.Configuration.table);

        return {
            [relation.pivotLocalKey!]: isLocal ? foreignKey : modelOfOrigin.values[relation.foreignKey]!,
            [relation.pivotForeignKey!]: isLocal ? modelOfOrigin.values[relation.foreignKey]! : foreignKey
        }
    }

    public async insertRecordIntoPivotTable(
        foreignKey: string,
        modelOfOrigin: ModelType,
        relation: relation
    ): Promise<void> {
        const table = this.tableFactory(relation.pivotTable!, this.customDatabaseAdapter);
        await table.Insert(this.generatePivotTableKeys(foreignKey, modelOfOrigin, relation));
    }

    public async deleteRecordFromPivotTable(
        foreignKey: string,
        modelOfOrigin: ModelType,
        relation: relation
    ): Promise<void> {
        const table = this.tableFactory(relation.pivotTable!, this.customDatabaseAdapter);
        const record = await table.Record(this.generatePivotTableKeys(foreignKey, modelOfOrigin, relation));
        await record?.Delete();
    }

    public async getManyToManyRelation(relation: relation): Promise<relation | undefined> {
        if (relation.pivotTable && this.manyToManyRelations.has(relation.pivotTable)) {
            return this.manyToManyRelations.get(relation.pivotTable);
        }

        if (await this.doesTableExist(relation.pivotTable!)) {
            this.manyToManyRelations.set(relation.pivotTable!, relation);
            return relation;
        } else {
            throw new Error(`Pivot table ${relation.pivotTable} does not exist. Create it in alphabetical order before using many-to-many relationships.`);
        }
    }

    public async doesTableExist(name: string): Promise<boolean> {
        const table = this.tableFactory(name, this.customDatabaseAdapter);
        return await table.exists();
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

    public async first(conditions: QueryWhereCondition, Model: Model<Type>): Promise<Type | null> {
        let record;
        if (Model.JoinedEntities.length > 0) {
            const results = await this.join(Model, conditions, { limit: 1 });
            record = results[0] ? { values: results[0] } : undefined;
        } else {
            record = await this.Table.Record<Type>({ where: conditions });
        }

        return record ? record.values : null;
    }

    public async get(conditions: QueryWhereCondition, queryOptions: ExtraQueryParameters, Model: Model<Type>): Promise<Type[]> {
        if (Model.JoinedEntities.length > 0) {
            return await this.join(Model, conditions, queryOptions);
        } else {
            const records = await this.Table.Records<Type>({ where: conditions, ...queryOptions });
            return records.map(record => record.values);
        }
    }

    public async all(Model: Model<Type>, queryscopes?: QueryWhereCondition, queryOptions?: ExtraQueryParameters): Promise<Type[]> {
        if (Model.JoinedEntities.length > 0) {
            return await this.join(Model);
        } else {
            const records = await this.Table.Records<Type>({ where: queryscopes, ...queryOptions });
            return records.map(record => record.values);
        }
    }

    public async update(primaryKey: QueryIsEqualParameter, newAttributes: Partial<Type>): Promise<Record<Type> | undefined> {
        const record = await this.Table.Record<Type>({ where: primaryKey as QueryWhereCondition });
        if (record) {
            return await record.Update(newAttributes, primaryKey);
        }
    }

    private async join(Model: Model<Type>, conditions?: QueryWhereCondition, queryOptions?: ExtraQueryParameters): Promise<Type[]> {
        const Join: Join[] = Model.JoinedEntities.flatMap(join => {
            const relation: relation | undefined = Model.Relations.find(rel => rel.model.Configuration.table.replace("_", "").toLowerCase() === join.relation.toLowerCase());
            if (join.queryScopes) {
                conditions = this.mergeQueryWhereConditions(conditions || {}, join.queryScopes);
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

    public mergeQueryWhereConditions(base: QueryWhereCondition, additional: QueryWhereCondition): QueryComparisonParameters[] {
        const query = this.Table.QueryHelperObject;
        return [...query.ConvertParamsToArray(base), ...query.ConvertParamsToArray(additional)];
    }

    public ConvertParamsToArray(params: QueryWhereCondition): QueryComparisonParameters[] {
        const query = this.Table.QueryHelperObject;
        return query.ConvertParamsToArray(params);
    }
}
