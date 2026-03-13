import { QueryFactory } from '@core/factories/QueryFactory';
import { columnType } from './table';
import { RecordFactory } from '@core/factories/RecordFactory';

export type RecordConstructorType<ColumnValuesType extends columnType> = {
  table: string;
  values: ColumnValuesType;
  adapter?: string;
  queryFactory?: QueryFactory;
  recordFactory?: RecordFactory<ColumnValuesType>;
};
