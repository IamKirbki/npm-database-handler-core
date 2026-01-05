/** Model configuration and types */

import Model from "@core/abstract/Model";
import { columnType } from "./index";

export type ModelEventType = 
    | 'retrieved'
    | 'creating'
    | 'created'
    | 'updating'
    | 'updated'
    | 'saving'
    | 'saved'
    | 'deleting'
    | 'deleted'
    | 'restoring'
    | 'restored'
    | 'forceDeleting'
    | 'forceDeleted';

export type ModelEventHandler<T> = (model: T) => void | Promise<void>;

export interface ModelObserver<T> {
    retrieved?(model: T): void | Promise<void>;
    creating?(model: T): void | Promise<void>;
    created?(model: T): void | Promise<void>;
    updating?(model: T): void | Promise<void>;
    updated?(model: T): void | Promise<void>;
    saving?(model: T): void | Promise<void>;
    saved?(model: T): void | Promise<void>;
    deleting?(model: T): void | Promise<void>;
    deleted?(model: T): void | Promise<void>;
    restoring?(model: T): void | Promise<void>;
    restored?(model: T): void | Promise<void>;
    forceDeleting?(model: T): void | Promise<void>;
    forceDeleted?(model: T): void | Promise<void>;
}

export interface ModelScope {
    (query: any): void;
}

export interface ModelConfig {
    /** Table name - defaults to lowercase class name */
    table: string;
    
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
    type: 'hasOne' | 'hasMany' | 'belongsTo';
    model: unknown & Model<columnType>;
    foreignKey: string;
    localKey?: string;
}

export interface SoftDeletable {
    deleted_at?: string | Date | null;
}

export type ModelWithTimestamps = {
    created_at?: string;
    updated_at?: string;
}