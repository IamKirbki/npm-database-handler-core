import Table from "@core/base/Table.js";
import { TableConstructorType } from "@core/types/table.js";
import IFactory from "../interfaces/IFactory.js";

export default class TableFactory implements IFactory<Table, TableConstructorType> {
    create(props: TableConstructorType): Table {
        return new Table(props);
    }
}
