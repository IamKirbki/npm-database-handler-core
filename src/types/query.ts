import { Join, PossibleBaseExpressions, PossibleExpressions, PossiblePrettyExpressions, RecordFactory } from "@core/index.js";

export type QueryIsEqualParameter = {
    [key: string]: QueryValues;
};

export type QueryComparisonParameters = {
    column: string;
    operator: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE' | 'IN' | 'NOT IN';
    value: QueryValues;
};

export type QueryWhereCondition = QueryIsEqualParameter | QueryComparisonParameters[];

export type QueryValues = string | number | boolean | null | bigint | Date;

export type DefaultQueryParameters = {
    select?: string;
    where?: QueryWhereCondition;
};

export type ExtraQueryParameters = {
    orderBy?: string;
    limit?: number;
    offset?: number;
    groupBy?: string;

    expressions?: PossibleExpressions[];
    blacklistTables?: string[];
};

export type QueryConstructorType = {
    tableName: string;
    query?: string;
    parameters?: QueryWhereCondition;
    adapterName?: string;
    recordFactory?: RecordFactory;
};

export type QueryLayers = {
    base: BaseQueryOptions;
    pretty?: PrettyQueryOptions;
    final?: FinalQueryOptions;
}

export type BaseQueryOptions = {
    from?: string;
    joins?: Join[];
    where?: QueryWhereCondition;

    expressions?: PossibleBaseExpressions[];

    select?: string;
}

export type PrettyQueryOptions = {
    expressions?: PossiblePrettyExpressions[];

    groupBy?: string;
    having?: QueryWhereCondition;
    where?: QueryWhereCondition;

    select?: string;
}

export type FinalQueryOptions = {
    orderBy?: string;

    limit?: number;
    offset?: number;

    blacklistTables?: string[];

    select?: string;
}