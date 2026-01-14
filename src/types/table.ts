import { QueryValues, QueryIsEqualParameter } from "index";

export type TableColumnInfo = {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
};

export type columnType = { [key: string]: QueryValues };

export type ReadableTableColumnInfo = {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: unknown;
    isPrimaryKey: boolean;
};

export type ColumnDefinition = {
    name?: string;
    datatype?: string;
    constraints?: string[];
    autoincrement?: boolean;
};

export type Join = {
    fromTable: string;
    baseTable: string;
    joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    on: QueryIsEqualParameter | QueryIsEqualParameter[];
    where?: QueryIsEqualParameter | QueryIsEqualParameter[];
}

// export type Join = RequireAtLeastOne<SingleJoin, 'table' | 'join'>;