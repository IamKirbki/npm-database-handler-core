import { SchemaTableBuilder } from "@core/abstract/SchemaTableBuilder.js";

export interface ISchemaBuilder {
    createTable(
        name: string,
        callback: (table: SchemaTableBuilder) => void
    ): Promise<void>;

    dropTable(
        name: string, 
        cascade?: boolean
    ): Promise<void>;

    alterTable(
        oldName: string,
        callback: (table: SchemaTableBuilder) => void
    ): Promise<void>;
}