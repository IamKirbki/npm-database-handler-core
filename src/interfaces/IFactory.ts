/* eslint-disable no-unused-vars */
export default interface IFactory<ClassType, PropsType> {
    create(props: PropsType): ClassType;
}