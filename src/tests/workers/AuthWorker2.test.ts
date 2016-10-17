
import chai = require('chai');
var expect = chai.expect;

import _ = require('lodash');
import async = require('async');
import jwt = require('jsonwebtoken');
import request = require('request');

import idHelper = require('../../helpers/idHelper');

import Service = require('../../service/Service');
import IService = require('../../interfaces/service/IService');
import IServiceReady = require('../../interfaces/service/IServiceReady');
import IWorker = require('../../interfaces/workers/IWorker');
import Worker = require('../../workers/Worker');

import LogWorker = require('../../workers/LogWorker');
import EnvironmentWorker = require('../../workers/EnvironmentWorker');
import HttpServerWorker = require('../../workers/HttpServerWorker');
import IHttpServerWorker = require('../../interfaces/workers/IHttpServerWorker');
import SocketWorker = require('../../workers/SocketWorker');
import ISocketWorker = require('../../interfaces/workers/ISocketWorker');
import IServiceListener = require('../../interfaces/service/IServiceListener');

describe('AuthWorker', () => {
    it("should ...", (done) => {
        async.waterfall([
            (cb) => {
                new Service('iws-auth-refactor-server')
                    .use(new EnvironmentWorker('', {
                        environmentObject: {
                            IW_JWT_AUTH_SECRET: 'secret'
                        }
                    }))
                    // .use(new LogWorker({ level: 500 }))
                    .use(new HttpServerWorker({
                        host: process.env.IP,
                        port: 8080, //process.env.PORT,
                        apiRoute: 'api'
                    }))
                    .use(new SecureHttpServerWorker())
                    .use(new SocketWorker())
                    .use(new SecureSocketWorker())
                    .use(new AuthWorker())
                    .use(new JwtAuthPackager())
                    .use(new UserCredsValidator())
                    .use(new ServiceCredsValidator())
                    .use(new RefreshTokenRepo())
                    .use(new MockRoleProvider())
                    .info<IServiceReady>('ready', (iw) => {
                        iw.service.annotate({ auth: { required: { authorization: { roles: [{ type: 'service', name: 'admin' }, { type: 'user', name: 'mock-role' }] } } } })
                            .ack('must-be-service-admin-and-user-mock', (cb) => {
                                cb(null);
                            });
                        iw.service.annotate({ auth: { required: { authorization: 'admin' } } })
                            .ack('all-must-be-admin', (cb) => {
                                cb(null);
                            });
                        setTimeout(() => {
                            cb(null, iw.service);
                        }, 50);
                    })
                    .start();
            },
            // (serverService, cb) => {
            //     async.waterfall([
            //         (cb) => {
            //             request({
            //                 url: 'http://localhost:8080/api/comm/iws-auth-refactor-server/confirm/iw-service/all-must-be-admin',
            //                 method: 'POST',
            //                 json: true,
            //                 body: {}
            //             }, (e, res: any) => {
            //                 expect(e).to.be.null;
            //                 expect(res.body).to.be.equal('unable to authenticate');
            //                 expect(res.statusCode).to.be.equal(401);
            //                 cb(e);
            //             });
            //         },
            //         (cb) => {
            //             var jar = request.jar();
            //             request({
            //                 url: 'http://localhost:8080/api/comm/iws-auth-refactor-server/request/iw-auth/authenticate',
            //                 method: 'POST',
            //                 jar: jar,
            //                 json: true,
            //                 body: {
            //                     id: 'test-user',
            //                     password: 'password'
            //                 }
            //             }, (e, res: any) => {
            //                 if (e === null) {
            //                     expect(res.statusCode).to.be.equal(200);
            //                     expect(res.body).to.not.have.property('authorization');
            //                     expect(res.body).to.not.have.property('access_token');
            //                     expect(res.body).to.not.have.property('refresh_token');
            //                     expect((<any>jar)._jar.store.idx.localhost['/'].access_token.value).to.be.a('string');
            //                     expect((<any>jar)._jar.store.idx.localhost['/'].refresh_token.value).to.be.a('string');
            //                     expect(res.headers['iw-authorization']).to.be.an('string');
            //                 }
            //                 cb(e, jar);
            //             });
            //         },
            //         (jar, cb) => {
            //             request({
            //                 url: 'http://localhost:8080/api/comm/iws-auth-refactor-server/confirm/iw-auth/test-authorization',
            //                 method: 'POST',
            //                 jar: jar,
            //                 json: true,
            //                 body: {}
            //             }, (e, res: any) => {
            //                 expect(e).to.be.null;
            //                 expect(res.statusCode).to.be.equal(200);
            //                 cb(e, jar);
            //             });
            //         },
            //         (jar, cb) => {
            //             request({
            //                 url: 'http://localhost:8080/api/comm/iws-auth-refactor-server/confirm/iw-service/all-must-be-admin',
            //                 method: 'POST',
            //                 jar: jar,
            //                 json: true,
            //                 body: {}
            //             }, (e, res: any) => {
            //                 expect(e).to.be.null;
            //                 expect(res.body).to.be.equal('unable to authorize');
            //                 expect(res.statusCode).to.be.equal(403);
            //                 cb(e);
            //             });
            //         }
            //     ], (e) => {
            //         cb(e, serverService);
            //     });
            // },
            (serverService, cb) => {
                new Service('iws-auth-refactor-client')
                    .use(new EnvironmentWorker('', {
                        serviceConnections: [{
                            name: 'iws-auth-refactor-server',
                            protocol: 'http',
                            host: process.env.IP,
                            port: '8080',
                            id: 'my-client-service',
                            password: 'password'
                        }]
                    }))
                    .use(new ConnectorWorker())
                    //.use(new LogWorker({ level: 500 }))
                    .info<IServiceReady>('ready', (iw) => {
                        cb(null, serverService, iw.service);
                    })
                    .start();
            },
            // (serverService, clientService, cb) => {
            //     clientService.confirm('iws-auth-refactor-server.confirm.iw-auth.test-authorization', (e) => {
            //         cb(e, serverService, clientService);
            //     });
            // },
            (serverService, clientService, cb) => {
                clientService
                    .annotate({
                        auth: {
                            authorization: {
                                type: 'user',
                                id: 'test-user',
                                roles: [ 'mock-role' ]
                            }
                        }
                    })
                    .confirm('iws-auth-refactor-server.confirm.iw-service.must-be-service-admin-and-user-mock', (e) => {
                        cb(e, serverService, clientService);
                    });
            },
            (serverService, clientService, cb) => {
                setTimeout(() => {
                    console.log('artificial delay');
                    cb(null, serverService, clientService);
                }, 3000);
            },
            (serverService, clientService, cb) => {
                clientService
                    .annotate({
                        auth: {
                            authorization: {
                                type: 'user',
                                id: 'test-user',
                                roles: [ 'mock-role' ]
                            }
                        }
                    })
                    .confirm('iws-auth-refactor-server.confirm.iw-service.must-be-service-admin-and-user-mock', (e) => {
                        cb(e, serverService, clientService);
                    });
            },
            // (serverService, clientService, cb) => {
            //     clientService
            //         .annotate({
            //             auth: {
            //                 authorization: {
            //                     type: 'user',
            //                     id: 'test-user',
            //                     roles: [ 'admin' ]
            //                 }
            //             }
            //         })
            //         .confirm('iws-auth-refactor-server.confirm.iw-service.all-must-be-admin', (e) => {
            //             cb(e, serverService);
            //         });
            // }
        ], (e) => { 
            if (e !== null) {
                console.log(e);
            }
            expect(e).to.be.null;
            done();
        });
    });
});

import ioClient = require('socket.io-client');
class ConnectorWorker extends Worker implements IWorker {
    private envWorker: string;
    private socketIoClientOpts: any;
    private serviceConnections: {
        service: any;
        authpack?: any;
    }[]
    
    constructor(opts?: any) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-connector'
        }, opts);
        
        this.opts = this.opts.beAdoptedBy(<any>{
            environmentWorker: 'iw-env',
            socketIoClient: {
                multiplex: false,
                timeout: 5000,
                reconnection: false
            }
        }, 'worker');
        this.opts.merge(opts);
        
        this.envWorker = this.opts.get<string>('environmentWorker');
        this.socketIoClientOpts = this.opts.get('socketIoClient');
        
        this.serviceConnections = [];
    }
    
    public postInit(deps, cb): IWorker {
        async.waterfall([
            (cb) => {
                this.getServiceWorkers((e, workers) => {
                    cb(e, workers);
                });
            },
            (workers, cb) => {
                if ((<any>_).any(workers, (worker: any) => {
                    return worker === this.envWorker;
                })) {
                    this.loadServiceConnections((e) => {
                        this.setupIntercepts();
                        cb(e);
                    });
                }
                else {
                    cb(new Error(this.me.name + ' depends on ' + this.envWorker))
                }
            }
        ], (e) => {
            if (e == null) {
                super.postInit(deps, cb);
            }
            else {
                cb(e);
            }
        });
        return this;
    }
    
    private getServiceWorkers(cb: (e: Error, workers: string[]) => void) {
        this.annotate({
            log: {
                level: 1000
            }
        }).ask<string[]>('iw-service.list-workers', (e, workers) => {
            cb(e, (<any>_).pluck(workers, 'name'));
        }); 
    }
    
    private loadServiceConnections(cb: (e: Error) => void) {
        this.ask<any>(this.envWorker + '.list-service-connections', (e, serviceConnections) => {
            this.serviceConnections = <any>_.map(serviceConnections, (service) => {
                return {
                    service: service,
                    authpack: {}
                };
            });
            cb(e);
        });
    }
    
    private setupIntercepts() {
        if (!_.isEmpty(this.serviceConnections)) {
            this.intercept('inform.iw-service.available-listeners', {
                preEmit: (stop, next, anno, ...args) => {
                    var listeners:IServiceListener[] = args.pop();
                    _.each(this.serviceConnections, (srvConn) => {
                        var name = [this.comm.prefix(), srvConn.service.name, '*', '*', '*'].join('.');
                        listeners.push({
                            annotation: {},
                            commEvent: this.getCommEvent(name)
                        });
                    });
                    args.push(listeners);
                    next(args);
                }
            });
        }
        _.each(this.serviceConnections, (serviceConn) => {
            this.intercept(serviceConn.service.name + '.*.*.*', {
                preEmit: (stop, next, anno, ...args) => {
                    var emit = this.getCommEmit(args.shift());
                    var emitterCb = void 0;
                    if (_.isFunction(_.last(args))) {
                        emitterCb = args.pop();
                    }
                    this.emitToService(serviceConn, emit, anno, args, emitterCb, (stop) => {
                        if (!stop) {
                            next();
                        }
                        else {
                            stop();
                        }
                    });
                }
            });
        });
    }
    
    private emitToService(srvConn: any, emit: any, anno: any, args: any[], emitterCb, cb) {
        var clientOpts = _.cloneDeep(this.socketIoClientOpts);
        clientOpts.extraHeaders = _.merge(_.isEmpty(srvConn.authpack) ? void 0 : { 
            authpack: JSON.stringify(srvConn.authpack)
        }, clientOpts.extraHeaders);
        var socket: any = ioClient(srvConn.service.url, clientOpts);
        socket.once('error', (errorJson) => {
            var errorObj = JSON.parse(errorJson);
            var e = new Error(errorObj.message);
            (<any>e).code = errorObj.code;
            this.handleSocketError(e, srvConn, socket, (e) => {
                if (e == null) {
                    this.emitToService(srvConn, emit, anno, args, emitterCb, cb);
                }
                else {
                    if (_.isFunction(emitterCb)) {
                        emitterCb(e);
                    }
                    cb(true);
                }
            });
        });
        socket.once('connect', () => {
            socket.emit.apply(socket, [emit.getText(), emit, anno].concat(args).concat([ (...resArgs) => {
                if (resArgs[0] == null) {
                    socket.close();
                    if (_.isFunction(emitterCb)) {
                        emitterCb.apply(this, resArgs);
                    }
                    cb(false);
                }
                else {
                    this.handleSocketError(resArgs[0], srvConn, socket, (e) => {
                        if (e == null) {
                            this.emitToService(srvConn, emit, anno, args, emitterCb, cb);
                        }
                        else {
                            if (_.isFunction(emitterCb)) {
                                emitterCb(e);
                            }
                            cb(true);
                        }
                        
                    });
                }
            } ]));
        });
        socket.once('connect_error', (connError) => {
            var e = new Error(connError.message);
            (<any>e).code = connError.description;
            this.handleSocketError(e, srvConn, socket, (e) => {
                if (e == null) {
                    this.emitToService(srvConn, emit, anno, args, emitterCb, cb);
                }
                else {
                    if (_.isFunction(emitterCb)) {
                        emitterCb(e);
                    }
                    cb(true);
                }
            });
        });
        socket.once('authpack-update', (authpack, cb) => {
            srvConn.authpack = authpack;
            cb();
        });
    }
    
    private handleSocketError(errorObj, srvConn, socket, cb) {
        socket.close();
        var e: any = new Error(errorObj.message);
        if (!_.isUndefined(errorObj.code)) {
            (<any>e).code = errorObj.code;
        }
        switch (e.code) {
            case 401:
                this.authenticateWithSecureService(srvConn, (e) => {
                    cb(e);
                });
                break;
            case 403:
                console.log('connector: socket cb error 403', e);
                break;
            default:
                cb(e);
                break;
        }
    }
    
    private authenticateWithSecureService(srvConn: any, cb: (e: Error) => void) {
        srvConn.authpack = {};
        this.annotate({ log: { properties: [
            { name: 'password', secure: true },
            { name: 'accessToken', secure: true },
            { name: 'refreshToken', secure: true },
        ] } })
            .request(this.getCommEvent(srvConn.service.name + '.request.iw-auth.authenticate').getText(), {
                type: 'service',
                id: srvConn.service.id,
                password: srvConn.service.password
            }, (e, authpack) => {
                if (e === null) {
                    srvConn.authpack = authpack;
                }
                cb(e);
            });
    }
}

class SecureSocketWorker extends Worker implements IWorker {
    constructor(opts?: any) {
        super([
            'iw-socket',
            'iw-auth'
        ], {
            id: idHelper.newId(),
            name: 'iw-secure-socket'
        }, opts);
        
        this.opts = this.opts.beAdoptedBy(<any>{}, 'worker');
        this.opts.merge(opts);
    }
    
    public preStart(deps, cb): IWorker {
        var socketWorker = <ISocketWorker>_.find(deps.list(), (dep: IWorker) => {
            return dep.me.name === 'iw-socket';
        });
        var authWorker = <IWorker>_.find(deps.list(), (dep: IWorker) => {
            return dep.me.name === 'iw-auth';
        });
        socketWorker.socketServer.use((socket, next) => {
            var iwAuth: any = {
                authentication: {
                    authenticated: false
                }
            };
            (<any>socket).iwAuth = iwAuth;
            var authpack = <any>_.get(socket, 'request.headers.authpack');
            authpack = _.isString(authpack) ? JSON.parse(authpack) : void 0;
            if (!_.isUndefined(authpack)) {
                authWorker.request<any, any>('unpackage', authpack, (e, opened) => {
                    if (e == null) {
                        iwAuth.authentication.authenticated = true;
                        iwAuth.authorization = opened.authorization;
                        if (!_.isUndefined(opened.accessToken)) {
                            iwAuth.newAuthpack = {
                                accessToken: opened.accessToken,
                                refreshToken: opened.refreshToken
                            };
                        }
                        next();
                    }
                    else {
                        var errorObj: any = {
                            code: (<any>e).code
                        };
                        if (!_.isUndefined((<any>e).code)) {
                            errorObj.message = 'unable to authenticate';
                        }
                        else {
                            this.inform('error', e);
                            errorObj.message = 'internal server error';
                        }
                        next(new Error(JSON.stringify(errorObj)));
                    }
                });
            }
            else {
                next();
            }
        });
        return super.preStart(deps, cb);
    }
}

class SecureHttpServerWorker extends Worker implements IWorker {
    constructor(opts?: any) {
        super([
            'iw-http-server',
            'iw-auth'
        ], {
            id: idHelper.newId(),
            name: 'iw-secure-http-server'
        }, opts);
        
        this.opts = this.opts.beAdoptedBy(<any>{}, 'worker');
        this.opts.merge(opts);
    }
    
    public preStart(deps, cb): IWorker {
        var httpServerWorker = <IHttpServerWorker>_.find(deps.list(), (dep: IWorker) => {
            return dep.me.name === 'iw-http-server';
        });
        var authWorker = <IWorker>_.find(deps.list(), (dep: IWorker) => {
            return dep.me.name === 'iw-auth';
        });
        httpServerWorker.httpServer.state('access_token', {
            path: '/'
        });
        httpServerWorker.httpServer.state('refresh_token', {
            path: '/'
        });
        httpServerWorker.httpServer.auth.scheme('iw-auth-scheme', (server, opts) => {
            return {
                authenticate: (req, reply) => {
                    var iwAuth: any = {
                        authentication: {
                            authenticated: false
                        }
                    };
                    var authpack = void 0;
                    if (!_.isUndefined(req.state.access_token) && !_.isUndefined(req.state.refresh_token)) {
                        authpack = {
                            accessToken: req.state.access_token,
                            refreshToken: req.state.refresh_token
                        };
                    }
                    if (!_.isUndefined(authpack)) {
                        authWorker.request<any, any>('unpackage', authpack, (e, opened) => {
                            if (e == null) {
                                iwAuth.authentication.authenticated = true;
                                iwAuth.authorization = opened.authorization;
                                reply.continue({
                                    isAuthenticated: true,
                                    credentials: iwAuth
                                });
                            }
                            else {
                                if (!_.isUndefined((<any>e).code)) {
                                    reply('unable to authenticate').statusCode = (<any>e).code;
                                }
                                else {
                                    this.inform('error', e);
                                    reply(e);
                                }
                            }
                        });
                    }
                    else {
                        reply.continue({
                            isAuthenticated: false,
                            credentials: iwAuth
                        });
                    }
                }
            }
        });
        httpServerWorker.httpServer.auth.strategy('iw-auth-packager', 'iw-auth-scheme', 'required');
        httpServerWorker.httpServer.ext('onPreResponse', (req, reply) => {
            if (req.response instanceof Error) {
                if (!_.isUndefined(req.response.code)) {
                    (<any>reply).unstate('access_token');
                    (<any>reply).unstate('refresh_token');
                    if (!_.isUndefined(req.response.headers)) {
                        delete req.response.headers['iw-authorization'];
                    }
                    (<any>reply((<any>req.response).message)).statusCode = req.response.code;
                }
                else {
                    reply.continue();
                }
            }
            else {
                if (!_.isUndefined(_.get(req.response.source, 'authorization'))) {
                    req.response.headers['iw-authorization'] = JSON.stringify(req.response.source.authorization);
                    delete req.response.source.authorization;
                }
                if (!_.isUndefined(_.get(req.response.source, 'accessToken'))) {
                    (<any>reply).state('access_token', req.response.source.accessToken);
                    delete req.response.source.accessToken;
                }
                if (!_.isUndefined(_.get(req.response.source, 'refreshToken'))) {
                    (<any>reply).state('refresh_token', req.response.source.refreshToken);
                    delete req.response.source.refreshToken;
                }
                reply.continue();
            }
        });
        return super.preStart(deps, cb);
    }
}

class AuthWorker extends Worker implements IWorker {
    private requireAuthenticationOnAuthorizedListeners: boolean;
    
    constructor(opts?: any) {
        super([
            'iw-auth-packager'
        ], {
            id: idHelper.newId(),
            name: 'iw-auth'
        }, opts);

        this.opts = this.opts.beAdoptedBy(<any>{
            defaultCredsValidator: 'user',
            requireAuthenticationOnAuthorizedListeners: true
        }, 'worker');
        this.opts.merge(opts);
        
        this.requireAuthenticationOnAuthorizedListeners = this.opts.get<boolean>('requireAuthenticationOnAuthorizedListeners');
    }
    
    public init(cb): IWorker {
        this.respond<any, any>('authenticate', (authentication, cb) => {
            this.authenticate(authentication, (e, authpack) => {
                cb(e, authpack);
            });
        });
        this.annotate({ internal: true }).respond<any, any>('unpackage', (authpack, cb, ...args) => {
            this.unpackage(authpack, (e, opened) => {
                cb(e, opened);
            });
        });
        this.annotate({ auth: { required: { authentication: { authenticated: true } } } }).ack('test-authentication', (cb) => {
            cb(null);
        });
        this.annotate({ auth: { required: { authorization: { test: true } } } }).ack('test-authorization', (cb) => {
            cb(null);
        });
        this.answer('logout', (cb) => {
            //TODO logout
        });
        this.intercept(this.getCommEvent('*.*.*'), {
            preEmit: (stop, next, anno, ...args) => {
                if (!_.isUndefined(anno.auth)) {
                    this.checkAuth(anno.auth, _.last(args), (callStop) => {
                        if (!callStop) {
                            next();
                        }
                        else {
                            stop();
                        }
                    });   
                }
                else {
                    next();
                }
            }
        });
        return super.init(cb);
    }
    
    private authenticate(authentication: any, cb: (e: Error, authpack?: any) => void) {
        this.buildAuthpack(authentication, 'validate-creds', (e, authpack) => {
            cb(e, authpack);
        });
    }
    
    private unpackage(authpack: any, cb: (e: Error, opened?: any) => void) {
        async.waterfall([
            (cb) => {
                this.request<any, any>('iw-auth-packager.unpackage', authpack, (e, tokens) => {
                    cb(e, tokens);
                });
            },
            (tokens) => {
                if (!_.isUndefined(tokens.refresh)) {
                    if (!_.isUndefined(tokens.access)) {
                        cb(null, {
                            authorization: tokens.access
                        });
                    }
                    else {
                        this.getAuthpack(tokens.refresh, (e, authpack) => {
                            cb(e, authpack);
                        });
                    }
                }
                else {
                    cb(new Error('unexpected error occured processing tokens'));
                }
            }
        ], (e) => {
            cb(e);
        });
    }
    
    private getAuthpack(refresh: any, cb: (e: Error, authpack?: any) => void) {
        this.buildAuthpack(refresh, 'get-roles', (e, authpack) => {
            cb(e, authpack);
        });
    }
    
    private buildAuthpack(authentication: any, event: string, cb: (e: Error, authpack?: any) => void) {
        if (_.isUndefined(authentication.type)) {
            authentication.type = this.opts.get<string>('defaultCredsValidator');
        }
        async.waterfall([
            (cb) => {
                this.getCredsValidator(authentication.type, (e, credsWorker) => {
                    cb(e, credsWorker);
                });
            },
            (credsWorker, cb) => {
                this.request<any, any>(credsWorker + '.' + event, authentication, (e, authorization) => {
                    if (e == null && _.isUndefined(authorization.type)) {
                        cb(null, {
                            type: authentication.type,
                            id: authentication.id,
                            roles: authorization
                        });
                    }
                    else {
                        cb(e, authorization); 
                    }
                });
            },
            (authorization) => {
                this.request<any, any>('iw-auth-packager.package', authorization, (e, authpack) => {
                    cb(e, authpack);
                });
            }
        ], (e) => {
            cb(e);
        });
    }
    
    private getCredsValidator(type: string, cb: (e: Error, workerName?: string) => void) {
        this.getServiceWorkers((e, workers) => {
            if (e === null) {
                var worker = _.find(workers, (worker) => {
                    return worker.indexOf('iw-creds-validator' + '-' + type) === 0;
                });
                if (!_.isUndefined(worker)) {
                    cb(null, worker);
                }
                else {
                    cb(new Error('unable to find a ' + type + ' credential validator'));
                }
            }
            else {
                cb(e);
            }
        });
    }
    
    private getServiceWorkers(cb: (e: Error, workers: string[]) => void) {
        this.annotate({
            log: {
                level: 1000
            }
        }).ask<string[]>('iw-service.list-workers', (e, workers) => {
            cb(e, (<any>_).pluck(workers, 'name'));
        }); 
    }
    
    private checkAuth(auth, emitterCb: Function, cb: (stop: boolean) => void) {
        auth = _.merge({
            required: {
                authentication: {
                    authenticated: this.requireAuthenticationOnAuthorizedListeners && !_.isEmpty(_.get(auth, 'required.authorization.roles'))
                },
                authorization: {
                    test: false,
                    roles: []
                }
            },
            authentication: {
                authenticated: false
            },
            authorization: []
        }, auth);
        if (!auth.authentication.authenticated && auth.required.authentication.authenticated) {
            this.handleAuthFailure('unauthenticated client attempted to access an authenticated endpoint', 401, emitterCb);
            cb(true);
        }
        else {
            var matchAllRoles = false;
            if (_.isString(auth.required.authorization)) {
                matchAllRoles = true;
                auth.required.authorization = {
                    test: false,
                    roles: [{
                        type: '*',
                        name: auth.required.authorization
                    }]
                }
            }
            else if (_.isArray(auth.required.authorization)) {
                auth.required.authorization = {
                    test: false,
                    roles: auth.required.authorization
                }
            }
            if (auth.required.authorization.test) {
                auth.required.authorization.roles.push({
                    type: '*',
                    name: '*'
                });
            }
            if (!_.isEmpty(auth.required.authorization.roles)) {
                async.each(auth.required.authorization.roles, (reqRole: any, cb) => {
                    cb(!(matchAllRoles ? _.every : (<any>_).any)(auth.authorization, (authorization) => {
                        var typeMatch = reqRole.type === '*' || authorization.type === reqRole.type;
                        var roleMatch = reqRole.name === '*' || (<any>_).any(authorization.roles, (role) => {
                            return reqRole.name === role;
                        });
                        return typeMatch && roleMatch;
                    }) ? 1 : null);
                }, (e) => {
                    if (e == null) {
                        cb(false);
                    }
                    else {
                        this.handleAuthFailure('unauthorized client attempted to access an authorized endpoint', 403, emitterCb);
                        cb(true);
                    }
                });
            }
            else {
                cb(false);
            }
        }
    }
    
    private handleAuthFailure(reason, code, cb) {
        var error = 'unable to ';
        var failureEvt = void 0;
        switch (code) {
            case 401: 
                error += 'authenticate';
                failureEvt = 'authentication';
                break;
            case 403: 
                error += 'authorize';
                failureEvt = 'authorization';
                break;
        }
        this.inform(failureEvt + '-failure', {
            reason: reason
        });
        if (_.isFunction(cb)) {
            var e = new Error(error);
            (<any>e).code = code;
            cb(e);
        }
    }
}

class MockRoleProvider extends Worker implements IWorker {
    constructor(opts?: any) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-role-provider'
        }, opts);

        this.opts = this.opts.beAdoptedBy({}, 'worker');
        this.opts.merge(opts);
    }
    
    public init(cb): IWorker {
        this.respond('role-tree', (whoService, cb) => {
            cb(null, {
                name: 'admin',
                children: [{
                    name: 'mock-role'
                }]
            });
        });
        return super.init(cb);
    }
}

class JwtAuthPackager extends Worker implements IWorker {
    private secret: string;
    private envWorker: string;
    private refreshTokenRepoWorker: string;
    private accessTokenExpiration: number;
    private refreshTokenExpiration: number;
    private issuer: string;
    
    constructor(opts?: any) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-auth-packager'
        }, opts);

        this.opts = this.opts.beAdoptedBy(<any>{
            environmentWorker: 'iw-env',
            refreshTokenRepoWorker: 'iw-refresh-token-repo',
            accessTokenExpiration: 60,
            
            
            refreshTokenExpiration: 30 * 24 * 60 * 60
            
            
        }, 'worker');
        this.opts.merge(opts);
        
        this.envWorker = this.opts.get<string>('environmentWorker');
        this.refreshTokenRepoWorker = this.opts.get<string>('refreshTokenRepoWorker');
        this.accessTokenExpiration = this.opts.get<number>('accessTokenExpiration');
        this.refreshTokenExpiration = this.opts.get<number>('refreshTokenExpiration');
    }
    
    public init(cb): IWorker {
        this.respond('package', (authorization: any, cb) => {
            this.getRefreshToken({
                id: authorization.id,
                type: authorization.type
            }, (e, refreshToken) => {
                if (e === null) {
                    cb(null, {
                        authorization: authorization,
                        accessToken: jwt.sign({ 
                            authorization: authorization
                        }, this.secret, {
                            issuer: this.issuer,
                            expiresIn: this.accessTokenExpiration.toString()
                        }),
                        refreshToken: refreshToken
                    });
                }
                else {
                    cb(e);
                }
            });
        });
        this.respond<any, any>('unpackage', (authpack, cb) => {
            async.waterfall([
                (cb) => {
                    jwt.verify(authpack.accessToken, this.secret, (e, verified: any) => {
                        if (e === null) {
                            cb(null, verified.authorization);
                        }
                        else if (e instanceof (<any>jwt).TokenExpiredError) {
                            cb(null, void 0);
                        }
                        else if (e instanceof (<any>jwt).JsonWebTokenError) {
                            var err = new Error('unable to verify access token');
                            (<any>err).code = 401;
                            cb(err);
                        }
                        else {
                            cb(e);
                        }
                    });
                },
                (access) => {
                    jwt.verify(authpack.refreshToken, this.secret, (e, verified: any) => {
                        if (e === null) {
                            if (_.isUndefined(this.refreshTokenRepoWorker)) {
                                cb(null, {
                                    access: access, 
                                    refresh: verified
                                });
                            }
                            else if (!_.isUndefined(access)) {
                                this.check(this.refreshTokenRepoWorker + '.validate', verified, (e) => {
                                    cb(e, e === null ? {
                                        access: access, 
                                        refresh: verified
                                    } : void 0);
                                });
                            }
                            else {
                                this.check(this.refreshTokenRepoWorker + '.consume', verified, (e) => {
                                    cb(e, e === null ? {
                                        access: access, 
                                        refresh: verified
                                    } : void 0);
                                });
                            }
                        }
                        else if (e instanceof (<any>jwt).TokenExpiredError) {
                            var err = new Error('refresh token expired');
                            (<any>err).code = 401;
                            cb(err);
                        }
                        else if (e instanceof (<any>jwt).JsonWebTokenError) {
                            var err = new Error('unable to verify refresh token');
                            (<any>err).code = 401;
                            cb(err);
                        }
                        else {
                            cb(e);
                        }
                    });
                }
            ], (e) => {
                cb(e);
            });
        });
        return super.init(cb);
    }
    
    public postInit(deps, cb): IWorker {
        this.issuer = this.whoService.name + '@' + this.whoService.version + '[' + this.whoService.id + ']';
        async.waterfall([
            (cb) => {
                this.getServiceWorkers((e, workers) => {
                    if (!_.isUndefined(this.refreshTokenRepoWorker) && workers.indexOf(this.refreshTokenRepoWorker) == -1) {
                        cb(new Error(this.me.name + ' depends on an refresh token repo worker named ' + this.refreshTokenRepoWorker));
                    }
                    else {
                        var w = _.find(workers, (worker: any) => {
                            return worker === this.envWorker;
                        });
                        if (!_.isUndefined(w)) {
                            cb(null, w);
                        }
                        else {
                            cb(new Error(this.me.name + ' depends on an environment worker named ' + this.envWorker));
                        }
                    }
                });
            },
            (envWorker, cb) => {
                this.request<string, string>(envWorker + '.env-var', 'IW_JWT_AUTH_SECRET', (e, secret) => {
                    if (e === null) {
                        this.secret = secret;
                    }
                    cb(e);
                });
            }
        ], (e) => {
            if (e === null) {
                super.postInit(deps, cb);
            }
            else {
                cb(e);
            }
        });
        return this;
    }
    
    private getServiceWorkers(cb: (e: Error, workers: string[]) => void) {
        this.annotate({
            log: {
                level: 1000
            }
        }).ask<string[]>('iw-service.list-workers', (e, workers) => {
            cb(e, (<any>_).pluck(workers, 'name'));
        }); 
    }
    
    private getRefreshToken(refresh: any, cb: (e: Error, token?: string) => void) {
        if (_.isUndefined(this.refreshTokenRepoWorker)) {
            this.signRefreshToken(refresh, (e, token) => {
                cb(e, token);
            });
        }
        else {
            async.waterfall([
                (cb) => {
                    this.request(this.refreshTokenRepoWorker + '.create', {
                        refresh: refresh,
                        expiresIn: this.refreshTokenExpiration
                    }, (e, refresh) => {
                        cb(e, refresh);
                    });
                },
                (refresh) => {
                    this.signRefreshToken(refresh, (e, token) => {
                        cb(e, token);
                    });
                }
            ], (e) => {
                cb(e);
            });
        }
    }
    
    private signRefreshToken(refresh: any, cb: (e: Error, token?: string) => void) {
        if (_.isUndefined(refresh.refreshId)) {
            refresh.refreshId = idHelper.newId();
        }
        process.nextTick(() => {
            cb(null, jwt.sign(refresh, this.secret, {
                issuer: this.issuer,
                expiresIn: this.refreshTokenExpiration.toString()
            }));
        });
    }
}

class RefreshTokenRepo extends Worker implements IWorker {
    private redisKey: string;
    private fakeRedis: any;
    
    constructor(opts?: any) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-refresh-token-repo'
        }, opts);

        this.opts = this.opts.beAdoptedBy({}, 'worker');
        this.opts.merge(opts);
        
        this.fakeRedis = {};
    }
    
    public init(cb): IWorker {
        this.redisKey = this.whoService.name + '.auth.refresh-tokens.';
        this.annotate({ internal: true }).respond<any, any>('create', (create, cb) => {
            var id = idHelper.newId();
            var key = this.redisKey + id;
            this.fakeRedis[key] = {
                refreshId: id,
                id: create.refresh.id,
                type: create.refresh.type
            };
            cb(null, _.clone(this.fakeRedis[key]));
        });
        this.annotate({ internal: true }).verify<any>('validate', (refresh, cb) => {
            this.validate(refresh.refreshId, (e) => {
                cb(e);
            });
        });
        this.annotate({ internal: true }).verify<any>('consume', (refresh, cb) => {
            this.validate(refresh.refreshId, (e) => {
                if (e === null) {
                    delete this.fakeRedis[this.redisKey + refresh.refreshId];
                }
                cb(e);
            });
        });
        return super.init(cb);
    }
        
    private validate(refreshId: string, cb: (e: Error) => void) {
        process.nextTick(() => {
            var e: Error = null;
            if (_.isUndefined(this.fakeRedis[this.redisKey + refreshId])) {
                e = new Error('refresh token cannot be used');
                (<any>e).code = 401;
            }
            
            console.log('refresh repo: validate', e, this.fakeRedis);
            
            cb(e);
        });
    }
}

class ServiceCredsValidator extends Worker implements IWorker {
    constructor(opts?: any) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-creds-validator-service'
        }, opts);

        this.opts = this.opts.beAdoptedBy({}, 'worker');
        this.opts.merge(opts);
    }
    
    public init(cb): IWorker {
        this.respond<any, any>('validate-creds', (creds, cb) => {
            if (creds.password === 'password') {
                this.request('get-roles', creds.id, (e, roles) => {
                    if (e === null) {
                        cb(null, {
                            type: 'service',
                            id: creds.id,
                            roles: roles
                        });
                    }
                    else {
                        cb(e);
                    }
                });
            }
            else {
                var err = new Error('invalid password');
                (<any>err).code = 401;
                cb(err);
            }
        });
        this.annotate({ internal: true }).respond<any, any>('get-roles', (id, cb) => {
            switch (id) {
                default:
                    cb(null, [
                        'admin'
                    ])
                    break;
            }
        });
        return super.init(cb);
    }
}

class UserCredsValidator extends Worker implements IWorker {
    constructor(opts?: any) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-creds-validator-user'
        }, opts);

        this.opts = this.opts.beAdoptedBy({}, 'worker');
        this.opts.merge(opts);
    }
    
    public init(cb): IWorker {
        this.respond<any, any>('validate-creds', (creds, cb) => {
            if (creds.password === 'password') {
                this.request('get-roles', creds.id, (e, roles) => {
                    if (e === null) {
                        cb(null, {
                            type: 'user',
                            id: creds.id,
                            roles: roles
                        });
                    }
                    else {
                        cb(e);
                    }
                });
            }
            else {
                var err = new Error('invalid password');
                (<any>err).code = 401;
                cb(err);
            }
        });
        this.annotate({ internal: true }).respond<any, any>('get-roles', (id, cb) => {
            switch (id) {
                default:
                    cb(null, [
                        'mock-role'
                    ])
                    break;
            }
        });
        return super.init(cb);
    }
}
