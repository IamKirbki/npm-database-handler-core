/* eslint-disable no-unused-vars */
export interface IFactory<ClassType, PropsType> {
    create(props: PropsType): ClassType;
}