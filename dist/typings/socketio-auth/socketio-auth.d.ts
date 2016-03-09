///<reference path='../tsd/socket.io/socket.io.d.ts' />

interface CallbackResults {
    (e: Error, s?: boolean): any;
}

interface ISocketioAuthOptions<T> {
    authenticate : (data:T,callback:CallbackResults)=>CallbackResults;
    postAuthenticate : (socket:SocketIO.Socket, data:T)=>void;
    timeout: number;
}

interface SocketioAuth{
    <T>(io:SocketIO.Server,options: ISocketioAuthOptions<T>):void;
}

declare module "socketio-auth" {
    var sioa: SocketioAuth;
    export = sioa;
}