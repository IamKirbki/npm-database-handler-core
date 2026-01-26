import type Model from "@core/abstract/Model.js";
import Record from "@core/base/Record.js";
import Table from "@core/base/Table.js";
import { columnType, Join, QueryWhereCondition, relation, QueryComparisonParameters, QueryIsEqualParameter, TableFactory, QueryLayers } from "@core/types/index.js";

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
        // Use tableName as key to differentiate instances for different tables
        const key = tableName || ModelClass.name;
        if (!this._instances.has(key)) {
            const instance = new Repository<ModelType, Model<ModelType>>(
                tableName,
                new ModelClass(),
                customDatabaseAdapter,
                tableFactory
            );
            this._instances.set(key, instance);
            return instance;
        }

        return this._instances.get(key) as Repository<ModelType, Model<ModelType>>;
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
        const record = await table.Record({ base: { where: this.generatePivotTableKeys(foreignKey, modelOfOrigin, relation) } });
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

    public async first(queryLayers: QueryLayers, Model: Model<Type>): Promise<Type | null> {
        let record;
        if (Model.JoinedEntities.length > 0) {
            const results = await this.join(Model, { base: { from: Model.Configuration.table, where: queryLayers.base.where }, final: { limit: 1 } });
            record = results[0] ? { values: results[0] } : undefined;
        } else {
            record = await this.Table.Record<Type>(queryLayers);
        }

        return record ? record.values : null;
    }

    public async get(QueryLayers: QueryLayers, Model: Model<Type>): Promise<Type[]> {
        if (Model.JoinedEntities.length > 0) {
            return await this.join(Model, QueryLayers);
        } else {
            const records = await this.Table.Records<Type>(QueryLayers);
            return records.map(record => record.values);
        }
    }

    public async all(Model: Model<Type>, QueryLayers: QueryLayers): Promise<Type[]> {
        if (Model.JoinedEntities.length > 0) {
            return await this.join(Model, QueryLayers);
        } else {
            const records = await this.Table.Records<Type>(QueryLayers);
            return records.map(record => record.values);
        }
    }

    public async update(primaryKey: QueryIsEqualParameter, newAttributes: Partial<Type>): Promise<Record<Type> | undefined> {
        const record = await this.Table.Record<Type>({ base: { where: primaryKey } });
        if (record) {
            return await record.Update(newAttributes, primaryKey);
        }
    }

    private async join(Model: Model<Type>, queryLayers: QueryLayers): Promise<Type[]> {
        const Joins: Join[] = Model.JoinedEntities.flatMap(join => {
            const relation: relation | undefined = Model.Relations.find(rel => rel.model.Configuration.table.replace("_", "").toLowerCase() === join.relation.toLowerCase());
            if (join.queryScopes) {
                queryLayers.base.where = this.mergeQueryWhereConditions(queryLayers.base.where || {}, join.queryScopes);
            }

            if (!relation) {
                throw new Error(`Relation for joined entity ${join} not found.`);
            }

            if (relation.type === 'manyToMany') {

                queryLayers.final ??= {};
                queryLayers.final.blacklistTables ??= [];

                queryLayers.final.blacklistTables.push(relation.pivotTable!);

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
                baseTable: relation.localKey.includes('.') ? relation.localKey.split('.')[0] : Model.Configuration.table,
                joinType: JoinType,
                on: [
                    { [relation.foreignKey!]: relation.localKey.includes('.') ? relation.localKey.split('.')[1] : relation.localKey! }
                ]
            }] as Join[];
        });

        queryLayers.base.joins = Joins;
        const records = await this.Table.Join<Type>(queryLayers);
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
