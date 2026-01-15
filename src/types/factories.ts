import type Table from "@core/base/Table";
import type { columnType, Model, Query, QueryConstructorType, Record, Repository } from "@core/index.js";

export type TableFactory = (name: string, adapter?: string) => Table;
export type QueryFactory = (config: QueryConstructorType) => Query;
export type RecordFactory = <T extends columnType>(
    table: string, 
    values: T, 
    adapter?: string, 
    queryFactory?: QueryFactory, 
    recordFactory?: RecordFactory
) => Record<T>;

export type RepositoryFactory<ModelType extends columnType> = (
    model: Model<ModelType>
) => Repository<ModelType, Model<ModelType>>