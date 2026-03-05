import Model from "@core/abstract/Model";
import IFactory from "../interfaces/IFactory";
import { columnType } from "@core/types/index";

export default class ModelFactory<
    ModelColumnType extends columnType,
    ModelType extends Model<ModelColumnType>,
    ModelConstructorType extends new () => ModelType
> implements IFactory<ModelType, ModelConstructorType> {
    create(model: ModelConstructorType): ModelType {
        return new model
    }
}

// Might be implemented later?