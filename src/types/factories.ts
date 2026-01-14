import type Table from "@core/base/Table";
import type { columnType, Query, QueryConstructorType, Record } from "@core/index.js";

export type TableFactory = (name: string, adapter?: string) => Table;
export type QueryFactory = (config: QueryConstructorType) => Query;
export type RecordFactory = <T extends columnType>(
    table: string, 
    values: T, 
    adapter?: string, 
    queryFactory?: QueryFactory, 
    recordFactory?: RecordFactory
) => Record<T>;
