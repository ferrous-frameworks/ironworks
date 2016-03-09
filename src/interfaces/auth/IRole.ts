
interface IRoleObjectValue {
    value: any;
}

interface IRoleObjectProp extends IRoleObjectValue {
    name: string;
}

interface IRole {
    name: string;
    emittedObject?: {
        required?: {
            properties?: IRoleObjectProp[],
            value?: any
        }
    }
}

export = IRole;
