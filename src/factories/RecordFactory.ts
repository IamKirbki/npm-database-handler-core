import Record from "@core/base/Record.js";
import { RecordConstructorType } from "@core/types/record.js";
import IFactory from "../interfaces/IFactory.js";
import { columnType } from "@core/types/table.js";

export default class RecordFactory<ColumnValuesType extends columnType> implements IFactory<Record<ColumnValuesType>, RecordConstructorType<ColumnValuesType>> {
    create(props: RecordConstructorType<ColumnValuesType>): Record<ColumnValuesType> {
        return new Record(props);
    }
}