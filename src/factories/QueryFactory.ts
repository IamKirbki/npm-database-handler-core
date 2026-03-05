import Query from "@core/base/Query.js";
import { QueryConstructorType } from "@core/types/index";
import IFactory from "../interfaces/IFactory.js";

export default class QueryFactory implements IFactory<Query, QueryConstructorType> {
    create(props: QueryConstructorType): Query {
        return new Query(props);
    }
}