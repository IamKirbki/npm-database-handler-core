import Repository from '@core/runtime/Repository.js';
import ModelRelations from '@core/abstract/model/ModelRelation.js';
import {
    columnType,
    QueryWhereCondition,
    QueryValues,
    ModelConfig,
    ExtraQueryParameters,
    SpatialPoint,
    SpatialPointColumns,
    SpatialQueryExpression,
    TextRelevanceQueryExpression,
    QueryComparisonParameters,
    JsonAggregateQueryExpression,
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
    protected queryScopes?: QueryWhereCondition;
    protected queryOptions: ExtraQueryParameters = {};

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
        this.queryOptions.limit = value;
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
        if (!this.queryOptions.limit) {
            throw new Error('Offset cannot be set without a limit.');
        }

        this.queryOptions.offset = value;
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
        this.queryOptions.orderBy = column + ' ' + direction;
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

        if (!this.queryScopes) {
            this.queryScopes = normalized;
        } else {
            const existing = this.normalizeConditions(this.queryScopes);
            this.queryScopes = [...existing, ...normalized];
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
        this.queryScopes = { id: id };
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
        this.queryScopes = { [this.primaryKeyColumn]: primaryKeyValue };
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
            this.queryScopes = { [this.primaryKeyColumn]: primaryKeyValue };
        }

        const query = this.queryScopes || {};

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
        const attributes = (await this.repository?.first(
            primaryKeyValue
                ? { [this.configuration.primaryKey]: primaryKeyValue }
                : this.queryScopes || {},
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
            this.queryScopes || {},
            this.queryOptions,
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
            this.queryScopes,
            this.queryOptions,
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

    public near(
        referencePoint: SpatialPoint,
        targetColumns: SpatialPointColumns,
        maxDistance: number,
        unit: 'km' | 'miles',
        orderByDistance: 'ASC' | 'DESC',
        alias: string = 'distance',
    ): this {
        const expression: SpatialQueryExpression = {
            type: 'spatialDistance',
            requirements: {
                phase: 'projection',
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

        this.queryOptions.expressions ??= [];
        this.queryOptions.expressions.push(expression);

        return this;
    }

    public isTextRelevant(
        targetColumns: string[],
        searchTerm: string,
        minimumRelevance?: number,
        alias: string = 'relevance',
        orderByRelevance: 'ASC' | 'DESC' = 'ASC',
    ): this {
        const whereClauseKeyword = `${alias}_searchTerm`;
        const expression: TextRelevanceQueryExpression = {
            type: 'textRelevance',
            requirements: {
                phase: 'projection',
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
                whereClauseKeyword: whereClauseKeyword,
            },
        };

        this.queryOptions.expressions ??= [];
        this.queryOptions.expressions.push(expression);

        this.where({
            [whereClauseKeyword]: searchTerm,
        });

        return this;
    }

    public JsonAggregate(
        targetColumns: string[],
        targetTable: string,
        groupByColumns: string[] = [],
        alias: string = targetTable
    ): this {
        const expression: JsonAggregateQueryExpression = {
            type: 'jsonAggregate',
            requirements: {
                phase: 'projection',
                cardinality: 'row',
                requiresAlias: true,
                requiresSelectWrapping: true,
            },
            parameters: {
                targetColumns: targetColumns,
                targetTable: targetTable,
                groupByColumns: groupByColumns,
                alias: alias,
            },
        };

        this.queryOptions.expressions ??= [];
        this.queryOptions.expressions.push(expression);

        this.queryOptions.blacklistTables ??= [];
        this.queryOptions.blacklistTables.push(targetTable);

        return this;
    }

    public toJSON(): Partial<ModelType> | ModelType {
        return this.attributes;
    }

    public toObject(): Partial<ModelType> | ModelType {
        return this.attributes;
    }
}
