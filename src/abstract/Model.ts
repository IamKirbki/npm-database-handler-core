import Repository from '@core/runtime/Repository.js';
import ModelRelations from '@core/abstract/model/ModelRelation.js';
import {
    columnType,
    QueryWhereCondition,
    QueryValues,
    ModelConfig,
    SpatialPoint,
    SpatialPointColumns,
    SpatialQueryExpression,
    TextRelevanceQueryExpression,
    QueryComparisonParameters,
    JsonAggregateQueryExpression,
    NestedJsonAggregateDefinition,
    QueryEvaluationPhase,
    QueryLayers,
} from '@core/types/index.js';

/** Abstract Model class for ORM-style database interactions */
export default abstract class Model<
    ModelType extends columnType,
> extends ModelRelations<ModelType> {
    private _repository?: Repository<ModelType, Model<ModelType>>;

    protected get repository(): Repository<ModelType, Model<ModelType>> {
        if (!this._repository) {
            this._repository = Repository.getInstance<ModelType>(
                this.constructor as new () => Model<ModelType>,
                this.Configuration.table,
                this.Configuration.customAdapter,
            );
        }

        return this._repository;
    }

    protected get self(): Model<ModelType> {
        return this;
    }

    protected configuration: ModelConfig = {
        table: '', // Must be set by subclass
        primaryKey: 'id',
        incrementing: true,
        keyType: 'number',
        timestamps: true,
        createdAtColumn: 'created_at',
        updatedAtColumn: 'updated_at',
        guarded: ['*'],
    };

    public get Configuration(): ModelConfig {
        return this.configuration;
    }

    protected originalAttributes: Partial<ModelType> = {};
    protected attributes: Partial<ModelType> = {};
    protected exists: boolean = false;
    protected dirty: boolean = false;
    protected queryLayers: QueryLayers = {
        base: {
            from: this.Configuration.table,
        },
        pretty: {
        },
        final: {
        }
    };

    public get primaryKeyColumn(): string {
        return this.configuration.primaryKey;
    }

    public get primaryKey(): QueryValues | undefined {
        return this.originalAttributes[this.configuration.primaryKey];
    }

    public get values(): Partial<ModelType> | ModelType {
        return this.attributes;
    }

    public static limit<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        value: number,
    ): ParamterModelType {
        const instance = new this();
        return instance.limit(value);
    }

    public limit(value: number): this {
        this.queryLayers.final ??= {};
        this.queryLayers.final.limit = value;
        return this;
    }

    public static offset<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        value: number,
    ): ParamterModelType {
        const instance = new this();
        return instance.offset(value);
    }

    public offset(value: number): this {
        if (!this.queryLayers.final?.limit) {
            throw new Error('Offset cannot be set without a limit.');
        }

        this.queryLayers.final.offset = value;
        return this;
    }

    public static orderBy<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        column: string,
        direction: 'ASC' | 'DESC' = 'ASC',
    ): ParamterModelType {
        const instance = new this();
        return instance.orderBy(column, direction);
    }

    public orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
        this.queryLayers.final ??= {};
        this.queryLayers.final.orderBy ??= [];
        this.queryLayers.final.orderBy.push({ column, direction });
        return this;
    }

    public static where<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        conditions: QueryWhereCondition,
    ): ParamterModelType {
        const instance = new this();
        return instance.where(conditions);
    }

    private normalizeConditions(
        conditions: QueryWhereCondition,
    ): QueryComparisonParameters[] {
        if (Array.isArray(conditions)) {
            return conditions;
        }

        return Object.entries(conditions).map(([column, value]) => ({
            column,
            operator: '=' as const,
            value,
        }));
    }

    public where(conditions: QueryWhereCondition): this {
        const normalized = this.normalizeConditions(conditions);

        if (!this.queryLayers.base.where) {
            this.queryLayers.base.where = normalized;
        } else {
            const existing = this.normalizeConditions(this.queryLayers.base.where);
            this.queryLayers.base.where = [...existing, ...normalized];
        }

        return this;
    }

    public static whereId<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        id: QueryValues,
    ): ParamterModelType {
        const instance = new this();
        return instance.whereId(id);
    }

    public whereId(id: QueryValues): this {
        this.queryLayers.base.where = [{ column: this.primaryKeyColumn, operator: '=', value: id }];
        return this;
    }

    public static find<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        primaryKeyValue: QueryValues,
    ): ParamterModelType {
        const instance = new this();
        return instance.find(primaryKeyValue);
    }

    public find(primaryKeyValue: QueryValues): this {
        this.queryLayers.base.where = [{ column: this.primaryKeyColumn, operator: '=', value: primaryKeyValue }];
        return this;
    }

    public static async findOrFail<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        primaryKeyValue: QueryValues,
    ): Promise<ParamterModelType> {
        const instance = new this();
        return (await instance.findOrFail(primaryKeyValue)) as ParamterModelType;
    }

    public async findOrFail(primaryKeyValue?: QueryValues): Promise<this> {
        if (primaryKeyValue) {
            this.queryLayers.base.where = [{ column: this.primaryKeyColumn, operator: '=', value: primaryKeyValue }];
        }

        const query = this.queryLayers;

        const record = await this.repository?.first(query, this);
        if (!record) {
            throw new Error(`Record with primary key ${primaryKeyValue} not found.`);
        }

        this.attributes = record as Partial<ModelType>;
        this.originalAttributes = { ...this.attributes };
        this.exists = true;
        return this;
    }

    public static async first<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        primaryKeyValue?: string | number,
    ): Promise<ParamterModelType> {
        const instance = new this();
        return instance.first(primaryKeyValue) as Promise<ParamterModelType>;
    }

    public async first(primaryKeyValue?: string | number): Promise<this> {
        if (primaryKeyValue !== undefined) {
            this.queryLayers.base.where = [{ column: this.primaryKeyColumn, operator: '=', value: primaryKeyValue }, ...this.normalizeConditions(this.queryLayers.base.where || [])];
        }
        const attributes = (await this.repository?.first(
            {
                ...this.queryLayers,
                base: {
                    ...this.queryLayers.base,
                    from: this.Configuration.table,
                    where: this.normalizeConditions(this.queryLayers.base.where || []),
                }
            },
            this,
        )) as Partial<ModelType>;
        if (attributes) {
            this.attributes = attributes;
            this.originalAttributes = { ...attributes };
            this.exists = true;
        }

        return this;
    }

    public async get(): Promise<this[]> {
        const records = await this.repository.get(
            {
                ...this.queryLayers,
                base: {
                    ...this.queryLayers.base,
                    from: this.Configuration.table,
                }
            },
            this,
        );
        return records.map((record) => {
            const instance = new (this.constructor as new () => this)();
            instance.set(record);
            instance.exists = true;
            instance.originalAttributes = { ...record };
            instance.attributes = { ...record };
            return instance;
        });
    }

    public static all<ParamterModelType extends Model<columnType>>(
        // eslint-disable-next-line no-unused-vars
        this: new () => ParamterModelType,
    ): Promise<ParamterModelType[]> {
        const instance = new this();
        return instance.all() as Promise<ParamterModelType[]>;
    }

    public async all(): Promise<this[]> {
        const records = await this.repository.all(
            this,
            {
                ...this.queryLayers,
                base: {
                    ...this.queryLayers.base,
                    from: this.Configuration.table,
                }
            }
        );
        return records.map((record) => {
            const instance = new (this.constructor as new () => this)();
            instance.set(record);
            instance.exists = true;
            instance.originalAttributes = { ...record };
            instance.attributes = { ...record };
            return instance;
        });
    }

    public static set<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        attributes: Partial<columnType>,
    ): ParamterModelType {
        const instance = new this();
        return instance.set(attributes);
    }

    public set(attributes: Partial<ModelType>): this {
        if (attributes[this.primaryKeyColumn] !== undefined && !this.exists) {
            this.repository.syncModel(this);
        }
        this.attributes = { ...this.attributes, ...attributes };
        this.dirty = true;
        return this;
    }

    public async save(): Promise<this> {
        this.originalAttributes = {
            ...this.originalAttributes,
            ...this.attributes,
        };
        await this.repository.save(this.originalAttributes as ModelType);
        this.exists = true;
        this.dirty = false;
        return this;
    }

    public async update(attributes: Partial<ModelType>): Promise<this> {
        if (!this.exists) {
            throw new Error(
                'Cannot update a model that does not exist in the database.',
            );
        }

        if (this.primaryKey === undefined) {
            throw new Error(
                'Primary key value is undefined. Cannot update record without a valid primary key.',
            );
        }

        const newRecord = await this.repository?.update(
            { [this.primaryKeyColumn]: this.primaryKey },
            attributes,
        );

        if (newRecord) {
            this.originalAttributes = newRecord.values;
            this.exists = true;
        }

        return this;
    }

    public near(params: {
        referencePoint: SpatialPoint,
        targetColumns: SpatialPointColumns,
        maxDistance: number,
        unit: 'km' | 'miles',
        orderByDistance: 'ASC' | 'DESC',
        alias?: string,
    }): this {
        const { referencePoint, targetColumns, maxDistance, unit, orderByDistance, alias = 'distance' } = params;

        const expression: SpatialQueryExpression = {
            type: 'spatialDistance',
            requirements: {
                phase: QueryEvaluationPhase.PROJECTION,
                cardinality: 'row',
                requiresAlias: true,
                requiresSelectWrapping: true,
            },
            parameters: {
                referencePoint: referencePoint,
                targetColumns: targetColumns,
                alias: alias,
                maxDistance: maxDistance,
                orderByDistance: orderByDistance,
                unit: unit,
            },
        };

        this.queryLayers.base.expressions ??= [];
        this.queryLayers.base.expressions.push(expression);

        this.queryLayers.pretty ??= {};
        if (!Array.isArray(this.queryLayers.pretty.where)) {
            this.queryLayers.pretty.where = [];
        }

        return this;
    }

    public isTextRelevant(params: {
        targetColumns: string[],
        searchTerm: string,
        minimumRelevance?: number,
        alias?: string,
        orderByRelevance?: 'ASC' | 'DESC',
    }): this {
        const { targetColumns, searchTerm, minimumRelevance, alias = 'relevance', orderByRelevance = "ASC" } = params;
        const valueClauseKeyword = `${alias}_searchTerm`;

        const expression: TextRelevanceQueryExpression = {
            type: 'textRelevance',
            requirements: {
                phase: QueryEvaluationPhase.PROJECTION,
                cardinality: 'row',
                requiresAlias: true,
                requiresSelectWrapping: true,
            },
            parameters: {
                targetColumns: targetColumns,
                searchTerm: searchTerm,
                alias: alias,
                minimumRelevance: minimumRelevance,
                orderByRelevance: orderByRelevance,
                valueClauseKeyword: valueClauseKeyword,
                where: {
                    [valueClauseKeyword]: searchTerm,
                    // [alias]: minimumRelevance || 1
                }
            },
        };

        this.queryLayers.base.expressions ??= [];
        this.queryLayers.base.expressions.push(expression);

        this.queryLayers.pretty ??= {};
        this.queryLayers.pretty.where ??= [];
        this.queryLayers.pretty.where.push({
            column: alias,
            operator: '>=',
            value: minimumRelevance || 1,
        });

        this.queryLayers.pretty.select ??= [];
        this.queryLayers.pretty.select.push(alias);

        return this;
    }

    public JsonAggregate(params: {
        table: string,
        columns: string[],
        groupByColumns?: string[],
        alias?: string,
        nested?: NestedJsonAggregateDefinition<string>[],
        having?: QueryWhereCondition,
    }): this {
        const {
            table,
            columns,
            groupByColumns = [],
            alias = table,
            nested,
            having,
        } = params;

        const expression: JsonAggregateQueryExpression = {
            type: 'jsonAggregate',
            requirements: {
                phase: QueryEvaluationPhase.PROJECTION,
                cardinality: 'row',
                requiresAlias: true,
                requiresSelectWrapping: true,
            },
            parameters: {
                columns: columns,
                table: table,
                groupByColumns: groupByColumns,
                alias: alias,
                nested: nested,
                having: having,
            },
        };

        this.queryLayers.base.expressionsSelect ??= [];
        const selectAliases = this.collectSelectAliases({
            table,
            columns,
            nested: nested || [],
        });

        this.queryLayers.base.expressionsSelect.push(...selectAliases);

        this.queryLayers.pretty ??= {};
        this.queryLayers.pretty.expressions ??= [];
        this.queryLayers.pretty.expressions.push(expression);

        this.queryLayers.final ??= {};
        this.queryLayers.final.blacklistTables ??= [];
        this.queryLayers.final.blacklistTables.push(...Array.from(new Set(this.collectTables({ table, nested: nested || [] }))));

        return this;
    }

    private collectSelectAliases(def: { table: string; columns: string[]; nested?: NestedJsonAggregateDefinition<string>[] }): string[] {
        const columnAliases = def.columns.map(col => `${def.table}.${col} AS ${def.table}_${col}`);

        if (def.nested) {
            for (const child of def.nested) {
                columnAliases.push(...this.collectSelectAliases(child));
            }
        }

        return columnAliases;
    }

    private collectTables(def: { table: string; nested?: NestedJsonAggregateDefinition<string>[] }): string[] {
        const result = [def.table];

        if (def.nested) {
            for (const child of def.nested) {
                result.push(...this.collectTables(child));
            }
        }

        return result;
    }


    public toJSON(): Partial<ModelType> | ModelType {
        return this.attributes;
    }

    public toObject(): Partial<ModelType> | ModelType {
        return this.attributes;
    }
}
