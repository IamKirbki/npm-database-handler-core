import { expressionClause, Join, PossibleBaseExpressions, PossibleExpressions, PossiblePrettyExpressions, RecordFactory } from "@core/index.js";

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
    orderBy?: OrderByDefinition[];
    limit?: number;
    offset?: number;
    groupBy?: string[];

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
    orderBy?: OrderByDefinition[];

    expressions?: PossibleBaseExpressions[];

    select?: string[];
    joinsSelect?: string[];
    expressionsSelect?: string[];
}

export type PrettyQueryOptions = {
    expressions?: PossiblePrettyExpressions[];

    groupBy?: string[];
    having?: QueryComparisonParameters[];
    where?: QueryComparisonParameters[];

    select?: string[];
}

export type FinalQueryOptions = {
    orderBy?: OrderByDefinition[];

    limit?: number;
    offset?: number;

    blacklistTables?: string[];

    select?: string[];
    groupBy?: string[];
}

export type OrderByDirection = 'ASC' | 'DESC';

export type OrderByDefinition = {
    column: string;
    direction: OrderByDirection;
}

export type QueryContext = {
    from?: string;
    select?: string[];
    joinsSelect?: string[];
    expressionSelect?: string[];

    joins?: string[];

    conditions?: {
        where?: QueryComparisonParameters[];
        having?: QueryComparisonParameters[];
    }

    expressions?: expressionClause[];

    groupBy?: string[];
    orderBy?: OrderByDefinition[];

    limit?: number;
    offset?: number;
}