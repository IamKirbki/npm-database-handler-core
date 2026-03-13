import { QueryContext } from "@core/types/query";

export interface IQueryBuilder {
    build(): Promise<QueryContext>;
}