import { ColumnDefinition } from "@core/types/index";

export default abstract class SchemaTableBuilder {
    protected columns: ColumnDefinition[] = [];

    protected addColumn(data: ColumnDefinition): this {
        if (data.name) {
            this.columns.push({
                ...data,
                constraints: ['NOT NULL', ...(data.constraints ?? [])],
            });
        } else {
            const lastColumn = this.columns[this.columns.length - 1];

            if (data.constraints?.includes("NULLABLE")) {
                lastColumn.constraints = lastColumn.constraints?.filter(constraint => constraint !== "NOT NULL") ?? [];
            }

            this.columns[this.columns.length - 1] = {
                name: lastColumn.name,
                datatype: lastColumn.datatype ?? data.datatype,
                constraints: [
                    ...(lastColumn.constraints ?? []),
                    ...(data.constraints ?? [])
                ],
                autoincrement: lastColumn.autoincrement ?? data.autoincrement ?? false,
            };
        }

        return this;
    }

    abstract build(): string;

    abstract increments(): this;
    abstract primaryKey(): this;
    abstract nullable(): this;
    abstract unique(): this;
    abstract defaultTo(value: unknown): this;
    abstract foreignKey(referenceTable: string, referenceColumn: string): this;

    abstract uuid(name: string): this;
    abstract enum(name: string, values: string[]): this;
    abstract json(name: string): this;
    abstract boolean(name: string): this;

    abstract text(name: string): this;
    abstract string(name: string, length?: number): this;

    abstract integer(name: string): this;
    abstract decimal(name: string, precision?: number, scale?: number): this;
    abstract float(name: string): this;

    abstract time(name: string): this;
    abstract timestamp(name: string): this;
    abstract timestamps(): this;

    abstract softDeletes(): this;
    abstract morphs(name: string): this;
}