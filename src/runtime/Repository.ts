import type Model from "@core/abstract/Model.js";
import Record from "@core/base/Record.js";
import Table from "@core/base/Table.js";
import TableFactory from "@core/factories/TableFactory.js";
import { columnType, Join, QueryWhereCondition, relation, QueryComparisonParameters, QueryIsEqualParameter, QueryLayers } from "@core/types/index.js";
import { RepositoryConstructorType } from "@core/types/index";

export default class Repository<Type extends columnType, ModelType extends Model<Type>> {
    private static _instances: Map<string, Repository<columnType, Model<columnType>>> = new Map();
    private models: Map<string, ModelType> = new Map();
    private manyToManyRelations: Map<string, relation> = new Map();
    private Table: Table
    private adapter?: string;
    private tableFactory: TableFactory;

    constructor({
        tableName,
        ModelClass,
        adapter,
        tableFactory = new TableFactory()
    }: RepositoryConstructorType<ModelType>) {
        const modelPk = ModelClass.primaryKey?.toString() || ModelClass.constructor.name;
        this.models.set(modelPk, ModelClass);
        this.tableFactory = tableFactory;
        this.Table = this.tableFactory.create({ name: tableName, adapter: adapter });
        this.adapter = adapter;
    }

    public static getInstance<ModelType extends columnType>(
        ModelClass: new () => Model<ModelType>,
        tableName: string,
        adapter?: string,
        tableFactory?: TableFactory
    ): Repository<ModelType, Model<ModelType>> {
        // Use tableName as key to differentiate instances for different tables
        const key = tableName || ModelClass.name;
        if (!this._instances.has(key)) {
            const instance = new Repository<ModelType, Model<ModelType>>({
                tableName,
                ModelClass: new ModelClass(),
                adapter,
                tableFactory
            });
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
        const table = this.tableFactory.create({name: relation.pivotTable!, adapter: this.adapter});
        await table.Insert(this.generatePivotTableKeys(foreignKey, modelOfOrigin, relation));
    }

    public async deleteRecordFromPivotTable(
        foreignKey: string,
        modelOfOrigin: ModelType,
        relation: relation
    ): Promise<void> {
        const table = this.tableFactory.create({name: relation.pivotTable!, adapter: this.adapter});
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
        const table = this.tableFactory.create({name, adapter: this.adapter});
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

    public async first(queryLayers: QueryLayers, Model: Model<Type>): Promise<Type | undefined> {
        let record;
        if (Model.JoinedEntities.length > 0) {
            const result = (await this.join(Model, { ...queryLayers, final: { ...queryLayers.final, limit: 1 } }))[0];
            record = result ? { values: result } : undefined;
        } else {
            record = await this.Table.Record<Type>(queryLayers);
        }

        return record?.values;
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
        return this.get(QueryLayers, Model);
    }

    public async update(primaryKey: QueryIsEqualParameter, newAttributes: Partial<Type>): Promise<Record<Type> | undefined> {
        const record = await this.Table.Record<Type>({ base: { where: primaryKey } });
        if (record) {
            return await record.Update(newAttributes, primaryKey);
        }
    }

    private async join(
        Model: Model<Type>,
        queryLayers: QueryLayers
    ): Promise<Type[]> {
        const { joins, queryLayers: nextLayers } =
            this.buildJoinObject(Model, queryLayers);

        nextLayers.base.joins = joins;

        const records = await this.Table.Join<Type>(nextLayers);
        return records.map(record => record.values);
    }

    public async toSql(
        queryLayers: QueryLayers,
        Model: Model<Type>
    ): Promise<string> {
        let nextLayers = queryLayers;

        if (Model.JoinedEntities.length > 0) {
            const result = this.buildJoinObject(Model, queryLayers);
            nextLayers = result.queryLayers;
            nextLayers.base.joins = result.joins;
        }

        return this.Table.toSql(nextLayers);
    }

    private buildJoinObject(
        Model: Model<Type>,
        inputLayers: QueryLayers
    ): { joins: Join[]; queryLayers: QueryLayers } {
        const queryLayers: QueryLayers = {
            ...inputLayers,
            base: {
                ...inputLayers.base,
                where: { ...(inputLayers.base.where ?? {}) }
            },
            final: inputLayers.final
                ? { ...inputLayers.final }
                : undefined
        };

        const joins: Join[] = Model.JoinedEntities.flatMap(join => {
            const relation = Model.Relations.find(
                rel =>
                    rel.model.Configuration.table
                        .replace("_", "")
                        .toLowerCase() === join.relation.toLowerCase()
            );

            if (!relation) {
                throw new Error(
                    `Relation for joined entity ${join.relation} not found.`
                );
            }

            if (join.queryScopes && queryLayers.base.where) {
                queryLayers.base.where = this.mergeQueryWhereConditions(
                    queryLayers.base.where,
                    join.queryScopes
                );
            } else {
                queryLayers.base.where = join.queryScopes;
            }

            if (relation.type !== 'manyToMany') {
                const joinType =
                    relation.type === 'hasOne' || relation.type === 'belongsTo'
                        ? 'INNER'
                        : 'LEFT';

                const [baseTable, baseKey] = relation.localKey.includes('.')
                    ? relation.localKey.split('.')
                    : [Model.Configuration.table, relation.localKey];

                return [
                    {
                        fromTable: relation.model.Configuration.table,
                        baseTable,
                        joinType,
                        on: [
                            { [relation.foreignKey!]: baseKey! }
                        ]
                    }
                ];
            }

            // many to many
            queryLayers.final ??= {};
            queryLayers.final.blacklistTables ??= [];

            queryLayers.final.blacklistTables = [
                ...queryLayers.final.blacklistTables,
                relation.pivotTable!
            ];

            return [
                {
                    fromTable: relation.pivotTable!,
                    baseTable: Model.Configuration.table,
                    joinType: 'INNER',
                    on: [
                        { [relation.pivotForeignKey!]: relation.localKey }
                    ]
                },
                {
                    fromTable: relation.model.Configuration.table,
                    baseTable: relation.pivotTable!,
                    joinType: 'INNER',
                    on: [
                        { [relation.foreignKey!]: relation.pivotLocalKey! }
                    ]
                }
            ];
        });

        return { joins, queryLayers };
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
