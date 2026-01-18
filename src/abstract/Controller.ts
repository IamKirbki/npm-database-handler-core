export default abstract class Controller<Type extends columnType> {
    abstract async index(): Promise<Model<Type>[]>;
    abstract async show(value: string | number): Promise<Model<Type>>;
    abstract async edit(value: string | number): Promise<Model<Type>>;
    abstract async update(id: string | number | UUIDType, newValues: Type): Promise<Model<Type>>;
    abstract async create(data: Type): Promise<Model<Type>>;
    abstract astnc delete(id: string | number | UUIDType): Promise<boolean>;
}