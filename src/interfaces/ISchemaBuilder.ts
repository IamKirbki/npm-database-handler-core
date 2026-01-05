import SchemaTableBuilder from "@core/abstract/SchemaTableBuilder.js";

export default interface AbstractSchemaBuilder {
    createTable(
        name: string,
        callback: (table: SchemaTableBuilder) => void
    ): Promise<void>;

    dropTable(
        name: string
    ): Promise<void>;

    alterTable(
        oldName: string,
        callback: (table: SchemaTableBuilder) => void
    ): Promise<void>;
}