/* eslint-disable no-unused-vars */
import Model from './Model.js';
import { columnType } from '@core/types/index.js';

export default abstract class Controller<Type extends columnType> {
  abstract index(): Promise<Model<Type>[]>;
  abstract show(value: string | number): Promise<Model<Type>>;
  abstract edit(value: string | number): Promise<Model<Type>>;
  abstract update(id: string | number, newValues: Type): Promise<Model<Type>>;
  abstract create(data: Type): Promise<Model<Type>>;
  abstract delete(id: string | number): Promise<boolean>;

  public static async index<StaticType extends columnType>(
    this: new () => Controller<StaticType>,
  ): Promise<Model<StaticType>[]> {
    const instance = new this();
    return await instance.index();
  }

  public static async show<StaticType extends columnType>(
    this: new () => Controller<StaticType>,
    value: string | number,
  ): Promise<Model<StaticType>> {
    const instance = new this();
    return await instance.show(value);
  }

  public static async edit<StaticType extends columnType>(
    this: new () => Controller<StaticType>,
    value: string | number,
  ): Promise<Model<StaticType>> {
    const instance = new this();
    return await instance.edit(value);
  }

  public static async update<StaticType extends columnType>(
    this: new () => Controller<StaticType>,
    id: string | number,
    newValues: StaticType,
  ): Promise<Model<StaticType>> {
    const instance = new this();
    return await instance.update(id, newValues);
  }

  public static async create<StaticType extends columnType>(
    this: new () => Controller<StaticType>,
    data: StaticType,
  ): Promise<Model<StaticType>> {
    const instance = new this();
    return await instance.create(data);
  }

  public static async delete<StaticType extends columnType>(
    this: new () => Controller<StaticType>,
    id: string | number,
  ): Promise<boolean> {
    const instance = new this();
    return await instance.delete(id);
  }
}
