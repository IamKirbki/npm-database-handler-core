export type QueryWhereParameters = {
    [key: string]: QueryValues;
}

export type QueryParameters = {
    column: string;
    operator: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE' | 'IN' | 'NOT IN';
    value: QueryValues;
};

export type QueryCondition = QueryWhereParameters | QueryParameters[];

export type QueryValues = string | number | boolean | null | bigint

export type DefaultQueryOptions = {
    select?: string;
    where?: QueryCondition;
}

export type QueryOptions = {
    orderBy?: string;
    limit?: number;
    offset?: number;
};