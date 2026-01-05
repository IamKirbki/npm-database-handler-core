import Repository from "@core/runtime/Repository.js";
import { columnType, QueryCondition, QueryValues, ModelConfig, relation, QueryOptions } from "@core/types/index.js";

/** Abstract Model class for ORM-style database interactions */
export default abstract class Model<ModelType extends columnType> {
    private _repository?: Repository<ModelType, Model<ModelType>>;

    protected get repository(): Repository<ModelType, Model<ModelType>> {
        if (!this._repository) {
            this._repository = Repository.getInstance<ModelType>(
                this.constructor as new () => Model<ModelType>,
                this.Configuration.table
            );
        }
        return this._repository;
    }

    protected configuration: ModelConfig = {
        table: '',  // Must be set by subclass
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
    protected queryScopes?: QueryCondition;
    protected queryOptions: QueryOptions = {};

    public get primaryKeyColumn(): string {
        return this.configuration.primaryKey;
    }

    public get primaryKey(): QueryValues | undefined {
        return this.attributes[this.configuration.primaryKey];
    }

    public get values(): Partial<ModelType> | ModelType {
        return this.attributes;
    }

    public static limit<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        value: number
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
        value: number
    ): ParamterModelType {
        const instance = new this();
        return instance.offset(value);
    }

    public offset(value: number): this {
        if (!this.queryOptions.limit) {
            throw new Error("Offset cannot be set without a limit.");
        }

        this.queryOptions.offset = value;
        return this;
    }

    public static orderBy<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        column: string,
        direction: 'ASC' | 'DESC' = 'ASC'
    ): ParamterModelType {
        const instance = new this();
        return instance.orderBy(column, direction);
    }

    public orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
        this.queryOptions.orderBy = column + " " + direction;
        return this;
    }

    public static where<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        conditions: QueryCondition
    ): ParamterModelType {
        const instance = new this();
        return instance.where(conditions);
    }

    public where(conditions: QueryCondition): this {
        this.queryScopes = conditions;
        return this;
    }

    public static whereId<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        id: QueryValues
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
        primaryKeyValue: QueryValues
    ): ParamterModelType {
        const instance = new this();
        return instance.find(primaryKeyValue);
    }

    public find(primaryKeyValue: QueryValues): this {
        this.queryScopes = { [this.primaryKeyColumn]: primaryKeyValue };
        return this;
    }

    public static findOrFail<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        primaryKeyValue: QueryValues
    ): Partial<columnType> {
        const instance = new this();
        return instance.findOrFail(primaryKeyValue);
    }

    public findOrFail(primaryKeyValue?: QueryValues): Partial<ModelType> | ModelType {
        if (primaryKeyValue) {
            this.queryScopes = { [this.primaryKeyColumn]: primaryKeyValue };
        }

        const query = this.queryScopes || {};

        this.repository?.first(query, this).then((record) => {
            if (!record) {
                throw new Error(
                    `Record with primary key ${primaryKeyValue} not found.`
                );
            }

            this.set(record as ModelType);
        });

        return this.attributes;
    }

    public static async first<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        primaryKeyValue?: string | number
    ): Promise<Partial<columnType> | ParamterModelType> {
        const instance = new this();
        return instance.first(primaryKeyValue);
    }

    public async first(primaryKeyValue?: string | number): Promise<Partial<ModelType>> {
        this.attributes = await this.repository?.first(primaryKeyValue ? { [this.configuration.primaryKey]: primaryKeyValue } : {}, this) as Partial<ModelType>;
        return this.attributes;
    }

    public async get(): Promise<Partial<ModelType>[]> {
        return this.repository.get(this.queryScopes || {}, this.queryOptions, this) as Promise<Partial<ModelType>[]>;
    }

    public static all<ParamterModelType extends Model<columnType>>(
        // eslint-disable-next-line no-unused-vars
        this: new () => ParamterModelType
    ): Promise<Partial<columnType>[]> {
        const instance = new this();
        return instance.all();
    }

    public all(): Promise<Partial<ModelType>[]> {
        return this.repository.all(this, this.queryOptions) as Promise<Partial<ModelType>[]>;
    }

    public static set<ParamterModelType extends Model<columnType>>(
        this: new () => ParamterModelType,
        attributes: Partial<columnType>
    ): ParamterModelType {
        const instance = new this();
        return instance.set(attributes);
    }

    public set(attributes: Partial<ModelType>): this {
        if (attributes[this.primaryKeyColumn] !== undefined && !this.exists) {
            this.repository.syncModel(this)
        }
        this.attributes = { ...this.attributes, ...attributes };
        this.dirty = true;
        return this;
    }

    public save(): this {
        this.originalAttributes = { ...this.originalAttributes, ...this.attributes };
        this.repository.save(this.originalAttributes as ModelType);
        this.exists = true;
        this.dirty = false;
        return this;
    }

    public update(attributes: Partial<ModelType>): this {
        if (!this.exists) {
            throw new Error("Cannot update a model that does not exist in the database.");
        }

        this.repository?.update(attributes);
        return this;
    }

    protected joinedEntities: string[] = [];
    protected relations: relation[] = [];

    public get JoinedEntities(): string[] {
        return this.joinedEntities;
    }

    public get Relations(): relation[] {
        return this.relations;
    }

    public hasMany<modelType extends Model<columnType>>(
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

    public hasOne<modelType extends Model<columnType>>(
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

    public belongsTo<modelType extends Model<columnType>>(
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
        tableName: string
    ): ParamterModelType {
        const instance = new this();
        return instance.with(tableName);
    }

    public with(relationName: string): this {
        this.joinedEntities.push(relationName);

        const method = Reflect.get(this, relationName);
        if (typeof method === 'function') {
            method.call(this);
        } else {
            throw new Error(
                `Relation method '${relationName}' does not exist on ${this.constructor.name}`
            );
        }

        return this;
    }
}