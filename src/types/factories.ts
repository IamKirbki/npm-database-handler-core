import type { Table } from '@core/base/Table.js';
import type { Record } from '@core/base/Record.js';
import type { Query } from '@core/base/Query.js';
import type {
  columnType,
  Model,
  QueryConstructorType,
  Repository,
} from '@core/index.js';

export type TableFactory = (name: string, adapter?: string) => Table;
export type QueryFactory = (config: QueryConstructorType) => Query;
export type RecordFactory = <T extends columnType>(
  table: string,
  values: T,
  adapter?: string,
  queryFactory?: QueryFactory,
  recordFactory?: RecordFactory,
) => Record<T>;

export type RepositoryFactory<ModelType extends columnType> = (
  model: Model<ModelType>,
  queryFactory?: QueryFactory,
) => Repository<ModelType, Model<ModelType>>;
