import IQueryBuilder from "@core/interfaces/IQueryBuilder";
import { QueryContext } from "@core/types/query";

export default abstract class QueryDecorator implements IQueryBuilder {
    protected component: IQueryBuilder;

    constructor(component: IQueryBuilder) {
        this.component = component;
    }

    abstract build(): Promise<QueryContext>;
}