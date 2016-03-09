
interface IJsonStringifySafe {
    (obj: any, serializer?: any, indent?: any, decycler?: any): string;
}

declare module "json-stringify-safe" {
    var jss: IJsonStringifySafe;
    export = jss;
}
