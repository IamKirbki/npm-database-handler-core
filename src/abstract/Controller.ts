export default abstract class Controller<Type extends columnType> {
    abstract async index(): Promise<Model<Type>[]>;
    abstract async show(value: string | number | UUIDType): Promise<Model<Type>>;
    abstract async edit(value: string | number | UUIDType): Promise<Model<Type>>;
    abstract async update(id: string | number | UUIDType, newValues: Type): Promise<Model<Type>>;
    abstract async create(data: Type): Promise<Model<Type>>;
    abstract astnc delete(id: string | number | UUIDType): Promise<boolean>;

    public static async index<StaticType extends columnType>(
        this: new () => Controller<StaticType>
    ): Model<StaticType> {
        const instance = new this();
        return await instance.index();
    }
}