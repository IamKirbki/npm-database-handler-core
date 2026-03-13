import { TableFactory } from '@core/factories/TableFactory.js';

export type RepositoryConstructorType<ModelType> = {
  tableName: string;
  ModelClass: ModelType;
  adapter?: string;
  tableFactory?: TableFactory;
};
