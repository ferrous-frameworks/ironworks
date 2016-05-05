///<reference path='../typings/main.d.ts' />

declare module "ironworks" {
    import hapi = require('hapi');

    import IronBeam = require('iron-beam');

    export module helpers {
        export module idHelper {
            export function newId(v4?: any): string;
        }
    }
    export module options {
        export class Options<I> {
            constructor(defaults: I);

            public get<getI>(dotDelimitedKey: string, root?: any): getI;

            public has(dotDelimitedKey: string): boolean;

            public beAdoptedBy<parentI>(parentDefs: I, childName: string): Options<I>;

            public merge(newOpts: I);
        }

        export interface IEventerOpts {
            ironBeamConfig?: {
                wildcard?: string
                delimiter?: string
                defaultMaxListeners?: number
            }
        }

        export interface ICollectionOpts {}

        export interface ICommOpts {
            prefix?: string
        }

        export interface IWorkerOpts {
            dependencies?: string[]
        }
        export interface IWorkerChildOpts {
            worker?: IWorkerOpts;
        }

        export interface IAuthWorkerOpts extends IWorkerChildOpts {
            socket?: {
                authentication?: {
                    timeout?: number;
                    secure?: boolean;
                    tokenEnvVarName?: string;
                }
            };
            http?: {
                authentication?: {
                    auto?: auth.HttpAutoAuthenticationType;
                    listenersToAuthenticate?: (eventing.ICommEventData|string)[];
                    listenersToNotAuthenticate?: (eventing.ICommEventData|string)[];
                    workersToAuthenticate?: string[];
                    workersToNotAuthenticate?: string[];
                };
                clientSecretEnvVarName?: string;
                accessTokenExpiration?: number;
                refreshTokenExpiration?: number;
            };
        }

        export interface IBroadcastWorkerOpts extends IWorkerChildOpts {}

        export interface IConnectorWorkerOpts extends IWorkerChildOpts {
            clientConnectionEventsLogLevel?: number;
            socketIoClient?: any
        }

        export interface IEnvironmentWorkerOpts extends IWorkerChildOpts {
            serviceConnections?: workers.IServiceConnection[];
            genericConnections?: workers.IGenericConnection[];
            environmentObject?: any;
        }

        export interface IHiveWorkerOpts {
            heartbeatFrequency?: number;
        }

        export interface IHttpServerWorkerOpts extends IWorkerChildOpts {
            host?
            port?: number;
            apiRoute?: string;
            rootSitePagePath?: string;
            hapi?: hapi.IServerOptions;
        }

        export interface ILogWorkerOpts extends IWorkerChildOpts {
            stdout?: Function;
            stderr?: Function;
            level?: number;
            defaultLevel?: number;
        }

        export interface IMetricWorkerOpts extends IWorkerChildOpts {
            ignored?: string[]
        }

        export interface IServiceOpts {
            version?: string;
            dependencyCheckTimeout?: number;
            dependencyCheckFrequency?: number;
            readyEventLogLevel?: number;
            availableListenersEventLogLevel?: number;
            listListeners?: {
                ignoreExternalWorkerNames?: string[];
                autoAnnotateInternalEmitNames?: string[];
            }
        }

        export interface ISocketWorkerOpts extends IWorkerChildOpts {
            secure?: boolean;
        }
    }
    export module auth {
        export enum HttpAutoAuthenticationType {
            none,
            iw_service_only,
            all
        }

        export interface IUser {
            username: string;
        }

        export interface ITokenAuthentication {
            token: string;
        }
        export interface IFailedAuthentication {
            message: string;
        }
        export interface ICredentials extends IUser {
            password: string;
        }
        export interface IUserAuth extends IUser {
            issuer: whoIAm.IAmVersioned;
            authentication?: {
                interservice: boolean;
            };
            authorization?: {
                user: {
                    roles: IRole[];
                }
            };
        }

        interface IRoleObjectValue {
            value: any;
        }

        interface IRoleObjectProp extends IRoleObjectValue {
            name: string;
        }

        export interface IRole {
            name: string;
            emittedObject?: {
                required?: {
                    properties?: IRoleObjectProp[],
                    value?: any
                }
            }
        }
        export interface IRoleTreeElement extends IRole {
            children?: IRoleTreeElement[];
        }
    }
    export module workers {
        export interface IDependency<T extends workers.IWorker> extends whoIAm.IWho {
            value?: T;
        }

        export interface IHiveHeartbeat {
            availableListeners: service.IServiceListener[];
        }

        export interface IHttpEndPoint {
            route: string;
            eventName: string;
        }

        export interface IHttpServerWorker extends IWorker {
            getCommEmitFromRequest(eventArray: string[], who?: whoIAm.IAm): eventing.ICommEmit;
            handleApiReq:(emit: eventing.ICommEmit, req: hapi.Request, reply: hapi.IReply, input: any, cb: (e: Error, ...args) => void) => void;
            apiRoute: string;
            httpServer: hapi.Server;
        }

        export interface ILogEntry {
            message: string;
            data?: any;
        }

        export interface IMetricDuration extends eventing.IEmitDuration {
            metricWorkerName: string;
        }

        export interface IMetricIncrement {
            emit: eventing.ICommEmit;
            metricWorkerName: string;
        }

        export interface IConnection {
            name: string;
            host: string;
            port: string;
        }

        export interface IGenericConnection extends IConnection {
            type: string;
            data?: any;
        }

        export interface IServiceConnection extends IConnection {
            protocol: string;
            url?: string;
            endPoints?: IHttpEndPoint[];
            token?: string;
        }

        export interface ISocketWorker extends workers.IWorker {
            socketServer: SocketIO.Server;
        }

        export interface IWorker extends whoIAm.IWho, eventing.IEventer {
            whoService: whoIAm.IAmVersioned;
            inited: boolean;
            postInited: boolean;
            preStarted: boolean;
            started: boolean;
            postStarted: boolean;

            preInit(comm:eventing.IComm, whoService:whoIAm.IAm, callback?:(e:Error) => void): IWorker;
            init(callback?:(e:Error) => void): IWorker;
            postInit(dependencies?:collection.ICollection<IWorker>, callback?:(e:Error) => void): IWorker;
            preStart(dependencies?:collection.ICollection<IWorker>, callback?:(e:Error) => void): IWorker;
            start(dependencies?:collection.ICollection<IWorker>, callback?:(e:Error) => void): IWorker;
            postStart(dependencies?:collection.ICollection<IWorker>, callback?:(e:Error) => void): IWorker;

            getDependencyNames(): string[];

            hasListener(event:eventing.ICommEventData|string, method?:string): boolean;
            allCommListeners(): eventing.ICommListener[];
            getCommEvent(event: eventing.ICommEventData|string, method?: string): eventing.ICommEvent;
            getCommEmit(event: eventing.ICommEventData|eventing.ICommEmitData|string, method?: string): eventing.ICommEmit;

            addDependency(name:string);

            tell(event:eventing.ICommEmitData|string, anno?: any): boolean;

            inform<infoType>(event:eventing.ICommEmitData|string,
                             info:infoType,
                             anno?: any): boolean;

            confirm(event:eventing.ICommEmitData|string,
                    callback:(e:Error, anno?:any) => void,
                    anno?: any): boolean;

            check<checkType>(event:eventing.ICommEmitData|string,
                             toCheck:checkType,
                             callback:(e:Error, anno?:any) => void,
                             anno?: any): boolean;

            ask<answerType>(event:eventing.ICommEmitData|string,
                            callback:(e:Error, answer?:answerType, anno?:any) => void,
                            anno?: any): boolean;

            request<requestType, responseType>(event:eventing.ICommEmitData|string,
                                               request:requestType,
                                               callback:(e:Error, response?:responseType, anno?:any) => void,
                                               anno?: any): boolean;

            listen(event:eventing.ICommEventData|string,
                   listener:(anno?:any, emit?:eventing.ICommEmit) => void): IWorker;

            info<infoType>(event:eventing.ICommEventData|string,
                           listener:(info:infoType, anno?:any, emit?:eventing.ICommEmit) => void): IWorker;

            ack(event:eventing.ICommEventData|string,
                listener:(callback:(e:Error) => void, anno?:any, emit?:eventing.ICommEmit) => void): IWorker;

            verify<checkType>(event:eventing.ICommEventData|string,
                              listener:(toCheck:checkType, callback:(e:Error) => void, anno?:any, emit?:eventing.ICommEmit) => void): IWorker;

            answer<answerType>(event:eventing.ICommEventData|string,
                               listener:(callback:(e:Error, answer?:answerType) => void, anno?:any, emit?:eventing.ICommEmit) => void): IWorker;

            respond<requestType, responseType>(event:eventing.ICommEventData|string,
                                               listener:(request:requestType, callback:(e:Error, response?:responseType) => void, anno?:any, emit?:eventing.ICommEmit) => void): IWorker;

            onlyOnce(): IWorker;

            setMaxListeners(max:number): IWorker;
            annotate(anno:any): IWorker;
            on(event:eventing.ICommEventData|string, method:Function): IWorker;
            addListener(event:eventing.ICommEventData|string, method:Function): IWorker;
            once(event:eventing.ICommEventData|string, method:Function): IWorker;
            removeListener(event:eventing.ICommEventData|string, method:Function): IWorker;
            removeAnnotatedListeners(event:eventing.ICommEventData|string, anno?:any): IWorker;
            removeAllListeners(event?:eventing.ICommEventData|string): IWorker;
            removeAllAnnotatedListeners(anno?:any, event?:eventing.ICommEventData|string): IWorker;

            intercept(event:eventing.ICommEventData|string, interceptors:IronBeam.IInterceptors): IWorker;
        }
        export class Worker implements IWorker {
            protected dependencies: collection.ICollection<IDependency<IWorker>>;
            protected useOnce: boolean;
            protected opts: options.Options<options.IWorkerChildOpts>;

            public whoService:whoIAm.IAmVersioned;
            public me:whoIAm.IAm;
            public comm:eventing.IComm;
            public inited:boolean;
            public postInited:boolean;
            public preStarted:boolean;
            public started:boolean;
            public postStarted:boolean;

            public defaultMaxListeners:number;

            constructor(dependencyNames:string[], whoAmI:whoIAm.IAm, opts:options.IWorkerChildOpts);

            public addDependency(name:string);

            public preInit(comm:eventing.IComm, whoService:whoIAm.IAmVersioned, callback?:(e:Error) => void):IWorker;

            public init(callback?:(e:Error) => void):IWorker;

            public postInit(dependencies?:collection.ICollection<IWorker>, callback?:(e:Error) => void):IWorker;

            public preStart(dependencies?:collection.ICollection<IWorker>, callback?:(e:Error) => void):IWorker;

            public start(dependencies?:collection.ICollection<IWorker>, callback?:(e:Error) => void):IWorker;

            public postStart(dependencies?:collection.ICollection<IWorker>, callback?:(e:Error) => void):IWorker;

            public getDependencyNames():string[];

            public getCommEvent(event:eventing.ICommEventData|string, method?:string):eventing.ICommEvent;

            public getCommEmit(event:eventing.ICommEventData|eventing.ICommEmitData|string, method?:string):eventing.ICommEmit;


            public tell(event:eventing.ICommEmitData|string, anno?: any):boolean;

            public inform<infoType>(event:eventing.ICommEmitData|string, info:infoType, anno?: any):boolean;

            public confirm(event:eventing.ICommEmitData|string, callback:(e:Error, anno?:any) => void, anno?: any):boolean;

            public check<checkType>(event:eventing.ICommEmitData|string, toCheck:checkType, callback:(e:Error, anno?:any) => void, anno?: any):boolean;

            public ask<answerType>(event:eventing.ICommEmitData|string, callback:(e:Error, answer?:answerType, anno?:any) => void, anno?: any):boolean;

            public request<requestType, responseType>(event:eventing.ICommEmitData|string, request:requestType, callback:(e:Error, response?:responseType, anno?:any) => void, anno?: any):boolean;


            public listen(event:eventing.ICommEventData|string, listener:(anno?:any, emit?:eventing.ICommEmit) => void):IWorker;

            public info<infoType>(event:eventing.ICommEventData|string, listener:(info:infoType, anno?:any, emit?:eventing.ICommEmit) => void):IWorker;

            public ack(event:eventing.ICommEventData|string, listener:(callback:(e:Error) => void, anno?:any, emit?:eventing.ICommEmit) => void):IWorker;

            public verify<checkType>(event:eventing.ICommEventData|string, listener:(toCheck:checkType, callback:(e:Error) => void, anno?:any, emit?:eventing.ICommEmit) => void):IWorker;

            public answer<answerType>(event:eventing.ICommEventData|string, listener:(callback:(e:Error, answer?:answerType) => void, anno?:any, emit?:eventing.ICommEmit) => void):IWorker;

            public respond<requestType, responseType>(event:eventing.ICommEventData|string, listener:(request:requestType, callback:(e:Error, response?:responseType) => void, anno?:any, emit?:eventing.ICommEmit) => void):IWorker;

            public annotate(anno:any):IWorker;

            public onlyOnce():IWorker;


            public setMaxListeners(max:number):IWorker;

            public on(eventName:eventing.ICommEventData|string, method:Function):IWorker;

            public addListener(eventName:eventing.ICommEventData|string, method:Function):IWorker;

            public once(eventName:eventing.ICommEventData|string, method:Function):IWorker;

            public emit(eventName:eventing.ICommEventData|string, ...args:any[]):boolean;

            public removeListener(eventName:eventing.ICommEventData|string, method:Function):IWorker;

            public removeAnnotatedListeners(eventName:string, anno?:any):IWorker;

            public removeAllListeners(eventName?:eventing.ICommEventData|string):IWorker;

            public removeAllAnnotatedListeners(anno?:any, eventName?:string):workers.IWorker;

            public listeners(eventName:eventing.ICommEventData|string):Function[];

            public annotatedListeners(eventName:string, anno?:any):IronBeam.IListener[];

            public allListeners():IronBeam.IListener[];

            public allCommListeners():eventing.ICommListener[];

            public allAnnotatedListeners(anno?:any, eventName?:string):IronBeam.IListener[];

            public allInterceptors():IronBeam.IInterceptors[];

            public hasListener(event:eventing.ICommEventData|string, method?:string):boolean;

            public intercept(eventName:eventing.ICommEventData|string, interceptors:IronBeam.IInterceptors):IWorker;


            public dispose(callback?:() => void);
        }

        export class AuthWorker extends Worker implements IWorker {
            constructor(opts?:options.IAuthWorkerOpts);
        }

        export class BroadcastWorker extends Worker implements IWorker {
            constructor(opts?:options.IBroadcastWorkerOpts);
        }

        export class ConnectorWorker extends Worker implements IWorker {
            constructor(opts?:options.IConnectorWorkerOpts);
        }

        export class EnvironmentWorker extends Worker implements IWorker {
            protected serviceConnections: IServiceConnection[];
            protected genericConnections: IGenericConnection[];
            protected environmentObject: any;

            constructor(name?:string, opts?:options.IEnvironmentWorkerOpts);

            public static getServiceConnectionUrl(srvConn:IServiceConnection):string;
        }

        export class HiveWorker extends Worker implements IWorker {
            constructor(opts?:options.IHiveWorkerOpts);
        }

        export class HttpServerWorker extends Worker implements IHttpServerWorker {
            public apiRoute:string;
            public httpServer:hapi.Server;

            constructor(opts?:options.IHttpServerWorkerOpts);

            public getCommEmitFromRequest(eventArray: string[], who?: whoIAm.IAm): eventing.ICommEmit;
            public handleApiReq:(emit: eventing.ICommEmit, req: hapi.Request, reply: hapi.IReply, input: any) => void;
        }

        export class LogWorker extends Worker implements IWorker {
            constructor(opts?:options.ILogWorkerOpts);
        }

        export class MetricWorker extends Worker implements IWorker {
            constructor(name?:string, opts?:options.IMetricWorkerOpts);
        }

        export class SocketWorker extends Worker implements ISocketWorker {
            public socketServer:any;

            constructor(opts?:options.ISocketWorkerOpts);
        }
    }
    export module service {
        export interface IService extends workers.IWorker {
            comm: eventing.IComm;

            use(worker: workers.IWorker): IService;
            get(workerQuery: whoIAm.IWhoQuery, callback: (e: Error, results: collection.ICollection<workers.IWorker>) => void): IService;
            getWorker(name: string, callback: (e: Error, worker?: workers.IWorker) => void);

            preInit(comm: eventing.IComm, whoService: whoIAm.IAm, callback?: (e: Error) => void): IService;
            init(callback?: (e: Error) => void): IService;
            preStart(dependencies?: collection.ICollection<workers.IWorker>, callback?: (e: Error) => void): IService;
            start(dependencies?: collection.ICollection<workers.IWorker>, callback?: (e: Error) => void): IService;
            postStart(dependencies?: collection.ICollection<workers.IWorker>, callback?: (e: Error) => void): IService;

            tell(
                event: eventing.ICommEmitData|string
            ): boolean;

            inform<infoType>(
                event: eventing.ICommEmitData|string,
                info: infoType
            ): boolean;

            confirm(
                event: eventing.ICommEmitData|string,
                callback: (e: Error, anno?: any) => void
            ): boolean;

            check<checkType>(
                event: eventing.ICommEmitData|string,
                toCheck: checkType,
                callback: (e: Error, anno?: any) => void
            ): boolean;

            ask<answerType>(
                event: eventing.ICommEmitData|string,
                callback: (e: Error, answer?: answerType, anno?: any) => void
            ): boolean;

            request<requestType, responseType>(
                event: eventing.ICommEmitData|string,
                request: requestType,
                callback: (e: Error, response?: responseType, anno?: any) => void
            ): boolean;

            listen(
                event: eventing.ICommEventData|string,
                listener:
                    (anno?: any, emit?: eventing.ICommEmit) => void
            ): workers.IWorker;

            info<infoType>(
                event: eventing.ICommEventData|string,
                listener:
                    (info: infoType, anno?: any, emit?: eventing.ICommEmit) => void
            ): workers.IWorker;

            ack(
                event: eventing.ICommEventData|string,
                listener:
                    (callback: (e: Error) => void, anno?: any, emit?: eventing.ICommEmit) => void
            ): workers.IWorker;

            verify<checkType>(
                event: eventing.ICommEventData|string,
                listener:
                    (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: eventing.ICommEmit) => void
            ): workers.IWorker;

            answer<answerType>(
                event: eventing.ICommEventData|string,
                listener:
                    (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: eventing.ICommEmit) => void
            ): workers.IWorker;

            respond<requestType, responseType>(
                event: eventing.ICommEventData|string,
                listener:
                    (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: eventing.ICommEmit) => void
            ): workers.IWorker;

            onlyOnce(): workers.IWorker;
        }
        export class Service extends workers.Worker implements IService {
            constructor(name: string, opts?: options.IServiceOpts);

            public preInit(comm: eventing.IComm, whoService: whoIAm.IAmVersioned, callback?: (e: Error) => void): IService;

            public init(callback?: (e: Error) => void): IService;

            public preStart(dependencies?: collection.ICollection<workers.IDependency<IService>>, callback?: (e: Error) => void): IService;

            public start(dependencies?: collection.ICollection<workers.IDependency<IService>>, callback?: (e: Error) => void): IService;

            public postStart(dependencies?: collection.ICollection<workers.IWorker>, callback?: (e: Error) => void): IService;

            public use(worker: workers.IWorker): IService;

            public get(workerQuery: whoIAm.IWhoQuery, callback: (e: Error, results: collection.ICollection<workers.IWorker>) => void): IService;

            public getWorker(name: string, callback: (e: Error, worker?: workers.IWorker) => void): IService;

            public dispose(cb?: () => void);
        }

        export interface IServiceListener {
            commEvent: eventing.ICommEventData;
            annotation: any;
        }
        export interface IServiceReady {
            service: IService
        }
    }
    export module eventing {
        export interface IBroadcast extends IEmitData {
            internal?: boolean;
            onlyToWorker?: string;
            name: string;
            info: any;
        }

        export class Eventer extends IronBeam.EventEmitter implements IEventer {
            private useOnce: boolean;

            protected event: string;
            protected opts: options.Options<options.IEventerOpts>;

            constructor(opts?: options.IEventerOpts);

            public getLastEvent(): string;


            public static getListenMethodName(emitMethodName: string): string;

            public tell(event: IEmitData|string, anno?: any): boolean;

            public inform<infoType>(event: IEmitData|string, info: infoType, anno?: any): boolean;

            public confirm(event: IEmitData|string, callback: (e: Error, anno?: any) => void, anno?: any): boolean;

            public check<checkType>(event: IEmitData|string, toCheck: checkType, callback: (e: Error, anno?: any) => void, anno?: any): boolean;

            public ask<answerType>(event: IEmitData|string, callback: (e: Error, answer?: answerType, anno?: any) => void, anno?: any): boolean;

            public request<requestType, responseType>(
                event: IEmitData|string, request: requestType, callback: (e: Error, response?: responseType, anno?: any) => void, anno?: any)
            : boolean;


            public listen(event: IEventData|string, listener: (anno?: any, emit?: IEmit) => void): IEventer;

            public info<infoType>(event: IEventData|string, listener: (info: infoType, anno?: any, emit?: IEmit) => void): IEventer;

            public ack(event: IEventData|string, listener: (callback: (e: Error) => void, anno?: any, emit?: IEmit) => void): IEventer;

            public verify<checkType>(
                event: IEventData|string, listener: (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: IEmit) => void)
            : IEventer;

            public answer<answerType>(
                event: IEventData|string, listener: (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: IEmit) => void)
            : IEventer;

            public respond<requestType, responseType>(
                event: IEventData|string,
                listener: (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: IEmit) => void)
            : IEventer;

            public onlyOnce(): IEventer;

            public setMaxListeners(max: number): IEventer;
            public annotate(anno: any): IEventer;
            public on(event: IEventData|string, method: Function): IEventer;
            public addListener(event: IEventData|string, method: Function): IEventer;
            public once(event: IEventData|string, method: Function): IEventer ;
            public removeListener(event: IEventData|string, method: Function): IEventer;
            public removeAnnotatedListeners(event: IEventData|string, anno?: any): IEventer;
            public removeAllListeners(event?: IEventData|string): IEventer;
            public removeAllAnnotatedListeners(anno?: any, event?: IEventData|string): IEventer;

            public intercept(event: IEventData|string, interceptors: IronBeam.IInterceptors): IEventer;

            public dispose(callback?: () => void);
        }

        export interface IComm extends IEventer {
            prefix(): string;
            hasListener(event: ICommEventData|string, method?: string): boolean;
            allCommListeners(): ICommListener[];

            listen(
                event: IEventData|string,
                listener:
                    (anno?: any, emit?: IEmit) => void
            ): IComm;

            info<infoType>(
                event: IEventData|string,
                listener:
                    (info: infoType, anno?: any, emit?: IEmit) => void
            ): IComm;

            ack(
                event: IEventData|string,
                listener:
                    (callback: (e: Error) => void, anno?: any, emit?: IEmit) => void
            ): IComm;

            verify<checkType>(
                event: IEventData|string,
                listener:
                    (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: IEmit) => void
            ): IComm;

            answer<answerType>(
                event: IEventData|string,
                listener:
                    (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: IEmit) => void
            ): IComm;

            respond<requestType, responseType>(
                event: IEventData|string,
                listener:
                    (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: IEmit) => void
            ): IComm;

            setMaxListeners(max: number): IComm;
            annotate(anno: any): IComm;
            on(event: ICommEventData|string, method: Function): IComm;
            addListener(event: ICommEventData|string, method: Function): IComm;
            once(event: ICommEventData|string, method: Function): IComm;
            removeListener(event: ICommEventData|string, method: Function): IComm;
            removeAnnotatedListeners(event: ICommEventData|string, anno?: any): IComm;
            removeAllListeners(event?: ICommEventData|string): IComm;
            removeAllAnnotatedListeners(anno?: any, event?: ICommEventData|string): IComm;
            onlyOnce(): IComm;

            intercept(event: ICommEventData|string, interceptors: IronBeam.IInterceptors): IComm;


            dispose(callback?: () => void);
        }
        export class Comm extends Eventer implements IComm {
            private whoService: whoIAm.IAm;
            private serviceWorkerName: string;

            public me: whoIAm.IAm;

            constructor(service: whoIAm.IAm, whoAmI: whoIAm.IAm, serviceWorkerName: string, opts?: options.ICommOpts);

            public prefix(): string;

            public allCommListeners(): ICommListener[];

            public tell(event: ICommEmitData|string): boolean;

            public inform<infoType>(event: ICommEmitData|string, info: infoType): boolean;

            public confirm(event: ICommEmitData|string, callback: (e: Error, anno?: any) => void): boolean;

            public check<checkType>(event: ICommEmitData|string, toCheck: checkType, callback: (e: Error, anno?: any) => void): boolean;

            public ask<answerType>(event: ICommEmitData|string, callback: (e: Error, answer?: answerType, anno?: any) => void): boolean;

            public request<requestType, responseType>(
                event: ICommEmitData|string, request: requestType, callback: (e: Error, response?: responseType, anno?: any) => void)
            : boolean;


            public listen(event: ICommEventData|string, listener: (anno?: any, emit?: ICommEmit) => void): IComm;

            public info<infoType>(event: ICommEventData|string, listener: (info: infoType, anno?: any, emit?: ICommEmit) => void): IComm;

            public ack(event: ICommEventData|string, listener: (callback: (e: Error) => void, anno?: any, emit?: ICommEmit) => void): IComm;

            public verify<checkType>(
                event: ICommEventData|string, listener: (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: ICommEmit) => void)
            : IComm;

            public answer<answerType>(
                event: ICommEventData|string, listener: (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: ICommEmit) => void
            ): IComm;

            public respond<requestType, responseType>(
                event: ICommEventData|string,
                listener: (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: ICommEmit) => void)
            : IComm;

            public onlyOnce(): IComm;


            public setMaxListeners(max: number): IComm;

            public annotate(anno: any): IComm;

            public on(event: ICommEventData|string, method: Function): IComm;

            public addListener(event: ICommEventData|string, method: Function): IComm;

            public once(event: ICommEventData|string, method: Function): IComm;

            public emit(event: ICommEventData|string, ...args: any[]): boolean;

            public removeListener(event: ICommEventData|string, method: Function): IComm;

            public removeAnnotatedListeners(event: string, anno?: any): IComm;

            public removeAllListeners(event?: ICommEventData|string): IComm;

            public removeAllAnnotatedListeners(anno?: any, event?: ICommEventData|string): IComm;

            public listeners(event: ICommEventData|string): Function[];

            public hasListener(event: ICommEventData|string, method?: string): boolean;

            public annotatedListeners(event: string, anno?: any): IronBeam.IListener[];

            public allAnnotatedListeners(anno?: any, event?: string): IronBeam.IListener[];

            public intercept(event: ICommEventData|string, interceptors: IronBeam.IInterceptors): IComm;

            public dispose(callback?: () => void);
        }

        export interface ICommEmit extends ICommEmitData, IEmit {}
        export class CommEmit extends CommEvent implements ICommEmit {
            public timestamp: number;
            public id: string;
            public emitter: whoIAm.IAm;
            public scoc: whoIAm.IAm[];

            constructor(data: ICommEmitData);
        }

        export interface ICommEmitData extends IEmitData, ICommEventData {
            scoc?: whoIAm.IAm[];
        }

        export interface ICommEvent extends ICommEventData, IEvent {}
        class CommEvent extends Event implements ICommEvent {
            prefix: string;
            service: string;
            method: string;
            worker: string;

            constructor(event: ICommEventData|string);

            public getText(): string;

            public equal(event: ICommEvent): boolean;

            public static equal(evt1: ICommEventData, evt2: ICommEventData): boolean;
        }

        export interface ICommEventData extends IEventData {
            prefix: string;
            service: string;
            method: string;
            worker: string;
        }

        export interface ICommListener extends IronBeam.IListener {
            commEvent: ICommEventData;
            annotation: any;
        }

        export interface IEmit extends IEmitData, IEvent {}
        export class Emit extends Event implements IEmit {
            timestamp: number;
            id: string;
            emitter: whoIAm.IAm;

            constructor(data: IEmitData);
        }

        export interface IEmitData extends IEventData {
            id: string;
            emitter: whoIAm.IAm;
            timestamp: number;
        }

        export interface IEmitDuration {
            emit: ICommEmit;
            duration: number;
        }

        export interface IEvent extends IEventData {
            getText(): string;
            equal(event: IEvent): boolean;
        }
        export class Event implements IEvent {
            name: string;

            constructor(data: IEventData);

            public getText(): string;
            public equal(event: IEvent): boolean;
        }

        export interface IEventData {
            name: string;
        }

        export interface IEventer extends IronBeam.IEventEmitter {
            tell(
                event: IEmitData|string,
                anno?: any
            ): boolean;

            inform<infoType>(
                event: IEmitData|string,
                info: infoType,
                anno?: any
            ): boolean;

            confirm(
                event: IEmitData|string,
                callback: (e: Error, anno?: any) => void,
                anno?: any
            ): boolean;

            check<checkType>(
                event: IEmitData|string,
                toCheck: checkType,
                callback: (e: Error, anno?: any) => void
            ): boolean;

            ask<answerType>(
                event: IEmitData|string,
                callback: (e: Error, answer?: answerType, anno?: any) => void,
                anno?: any
            ): boolean;

            request<requestType, responseType>(
                event: IEmitData|string,
                request: requestType,
                callback: (e: Error, response?: responseType, anno?: any) => void,
                anno?: any
            ): boolean;


            listen(
                event: IEventData|string,
                listener:
                    (anno?: any, emit?: IEmit) => void
            ): IEventer;

            info<infoType>(
                event: IEventData|string,
                listener:
                    (info: infoType, anno?: any, emit?: IEmit) => void
            ): IEventer;

            ack(
                event: IEventData|string,
                listener:
                    (callback: (e: Error) => void, anno?: any, emit?: IEmit) => void
            ): IEventer;

            verify<checkType>(
                event: IEventData|string,
                listener:
                    (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: IEmit) => void
            ): IEventer;

            answer<answerType>(
                event: IEventData|string,
                listener:
                    (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: IEmit) => void
            ): IEventer;

            respond<requestType, responseType>(
                event: IEventData|string,
                listener:
                    (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: IEmit) => void
            ): IEventer;


            onlyOnce(): IEventer;


            setMaxListeners(max: number): IEventer;
            annotate(anno: any): IEventer;
            on(event: IEventData|string, method: Function): IEventer;
            addListener(event: IEventData|string, method: Function): IEventer;
            once(event: IEventData|string, method: Function): IEventer;
            removeListener(event: IEventData|string, method: Function): IEventer;
            removeAnnotatedListeners(event: IEventData|string, anno?: any): IEventer;
            removeAllListeners(event?: IEventData|string): IEventer;
            removeAllAnnotatedListeners(anno?: any, event?: IEventData|string): IEventer;

            intercept(event: IEventData|string, interceptors: IronBeam.IInterceptors): IEventer;


            dispose(callback?: () => void);
        }
    }
    export module whoIAm {
        export interface IAm {
            id: string;
            name: string;
        }
        export interface IAmVersioned extends IAm {
            version: string;
        }
        export interface IWho {
            me: IAm;
        }
        export interface IWhoQuery {
            names?: string[];
            ids?: string[];
            op?: string;
        }
    }
    export module collection {
        export interface ICollection<whoType extends whoIAm.IWho> extends whoIAm.IWho {
            add(item: whoType): ICollection<whoType>;
            addMany(items: whoType[]): ICollection<whoType>;
            remove(query: whoIAm.IWhoQuery, callback?: (e: Error, result: ICollection<whoType>) => void);
            get(query: whoIAm.IWhoQuery, callback: (e: Error, result: ICollection<whoType>) => void);
            clear(): ICollection<whoType>;
            list(): whoType[];
            each(iterator: (item: whoType, itemDone: (e: Error) => void) => void, allDone?: (e: Error) => void);
            filter(
                iterator: (item: whoType, check: (e: Error, include: boolean) => void) => void,
                done: (e: Error, results: ICollection<whoType>) => void
            );
            length(): number;
            dispose(callback?: () => void);
        }

        export class Collection<whoType extends whoIAm.IWho> implements ICollection<whoType> {
            public me: whoIAm.IAm;

            constructor(id: string, opts?: options.ICollectionOpts);

            public add(item: whoType): ICollection<whoType>;

            public addMany(items: whoType[]);

            public remove(query: whoIAm.IWhoQuery, callback?: (e: Error, removed: ICollection<whoType>) => void);

            public get(query: whoIAm.IWhoQuery, callback: (e: Error, result: ICollection<whoType>) => void);

            public list(): whoType[];

            public clear(): ICollection<whoType>;

            public each(iterator: (item: whoType, itemDone: (e: Error) => void) => void, allDone?: (e: Error) => void);

            public filter(
                iterator: (item: whoType, check: (e: Error, include: boolean) => void) => void,
                done: (e: Error, results: ICollection<whoType>) => void
            );

            public length(): number;

            public dispose(callback?: () => void);
        }
    }
}