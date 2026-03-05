/** Model configuration and types */

import Model from "@core/abstract/Model";
import { columnType, QueryWhereCondition } from "./index";

export type ModelConfig = {
    /** Table name - defaults to lowercase class name */
    table: string;

    /** Custom adapter name - defaults to default name */
    customAdapter?: string;

    /** Primary key column - defaults to 'id' */
    primaryKey: string;

    /** Whether to auto-increment primary key - defaults to true */
    incrementing?: boolean;

    /** Primary key type - defaults to 'number' */
    keyType?: 'string' | 'number';

    /** Enable automatic timestamp management - defaults to true */
    timestamps?: boolean;

    /** Created at column name - defaults to 'created_at' */
    createdAtColumn?: string;

    /** Updated at column name - defaults to 'updated_at' */
    updatedAtColumn?: string;

    /** Deleted at column name for soft deletes - defaults to 'deleted_at' */
    deletedAtColumn?: string;

    /** Database connection name */
    connection?: string;

    /** Mass assignable attributes (whitelist) */
    fillable?: string[];

    /** Guarded attributes (blacklist) - defaults to ['*'] if fillable is empty */
    guarded?: string[];

    /** Hidden attributes when serializing */
    hidden?: string[];

    /** Visible attributes when serializing (overrides hidden) */
    visible?: string[];

    /** Append computed attributes when serializing */
    appends?: string[];

    /** Default attribute values */
    attributes?: Record<string, any>;

    /** Date format for serialization */
    dateFormat?: string;
}

export type relation = {
    name: string;
    path: string;
    type: 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany';
    model: unknown & Model<columnType>;
    foreignKey: string;
    localKey: string;
    pivotTable?: string;
    pivotForeignKey?: string;
    pivotLocalKey?: string;
}

export type SoftDeletable = {
    deleted_at?: string | Date | null;
}

export type ModelWithTimestamps = {
    created_at?: string | number | Date;
    updated_at?: string | number | Date;
    deleted_at?: string | number | Date;
}

export type joinedEntity = {
    relation: string;
    alias?: string;
    path: string;
    queryScopes?: QueryWhereCondition;
}