import { QueryContext } from "@core/types/query";

export default interface IQueryBuilder {
    build(): Promise<QueryContext>;
}