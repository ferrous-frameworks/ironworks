
interface IOAuthOptions {
    validateFunc:(token:string, callback:(error:Error, approved:boolean, userInfo:any)=>void)=>void;
    clientSecret:string;
}

export = IOAuthOptions;
