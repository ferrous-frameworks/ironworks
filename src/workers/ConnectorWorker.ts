
import _ = require('lodash');
import async = require('async');
import ioClient = require('socket.io-client');

import idHelper = require('../helpers/idHelper');

import Worker = require('../workers/Worker');
import IWorker = require('../interfaces/workers/IWorker');
// import IConnectorWorkerOpts = require('../interfaces/opts/IConnectorWorkerOpts');
// import IServiceConnection = require('../interfaces/workers/IServiceConnection');
// import ICommEmit = require('../interfaces/eventing/ICommEmit');
// import CommEmit = require('../eventing/CommEmit');
import IServiceListener = require('../interfaces/service/IServiceListener');

class ConnectorWorker extends Worker implements IWorker {
    private envWorker: string;
    private credsValidator: string;
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
            credsValidator: 'service',
            socketIoClient: {
                multiplex: false,
                timeout: 5000,
                reconnection: false
            }
        }, 'worker');
        this.opts.merge(opts);
        
        this.envWorker = this.opts.get<string>('environmentWorker');
        this.credsValidator = this.opts.get<string>('credsValidator');
        this.socketIoClientOpts = this.opts.get('socketIoClient');
        
        this.serviceConnections = [];
    }
    
    public init(cb): IWorker {
        this.annotate({ internal: true }).answer('list-external-service-names', (cb) => {
            cb(null, _.map(_.map(this.serviceConnections, 'service'), 'name'));
        });
        return super.init(cb);
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
                    this.emitToService(serviceConn, emit, anno, args, emitterCb, (shouldStop) => {
                        if (!shouldStop) {
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
        if (!_.isUndefined(errorObj.unauthorizedClients)) {
            (<any>e).unauthorizedClients = errorObj.unauthorizedClients;
        }
        switch (e.code) {
            case 401:
                this.authenticateWithSecureService(srvConn, (e) => {
                    cb(e);
                });
                break;
            case 403:
                if (_.isUndefined(_.get(srvConn, 'authpack.accessToken'))) {
                    this.authenticateWithSecureService(srvConn, (e) => {
                        cb(e);
                    }); 
                }
                else {
                    if ((<any>_).any((<any>e).unauthorizedClients, (uc) => {
                        return uc.id == srvConn.service.id && uc.type == this.credsValidator;
                    })) {
                        cb(new Error('internal server error'));
                    }
                    else {
                        cb(e);
                    }
                }
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
                type: this.credsValidator,
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

export = ConnectorWorker;
