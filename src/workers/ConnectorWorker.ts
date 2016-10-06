
import _ = require('lodash');
import async = require('async');
import ioClient = require('socket.io-client');

import idHelper = require('../helpers/idHelper');

import Worker = require('../workers/Worker');
import IWorker = require('../interfaces/workers/IWorker');
import IConnectorWorkerOpts = require('../interfaces/opts/IConnectorWorkerOpts');
import IServiceConnection = require('../interfaces/workers/IServiceConnection');
import ICommEmit = require('../interfaces/eventing/ICommEmit');
import CommEmit = require('../eventing/CommEmit');
import IServiceListener = require('../interfaces/service/IServiceListener');

interface IServiceClient {
    service: string;
    socket?: any;
    authenticated: boolean;
}

class ConnectorWorker extends Worker implements IWorker {
    private socketIoClientOpts: any;
    private serviceConnections: IServiceConnection[];
    private serviceClients: IServiceClient[];
    private clientConnectionEventsLogLevel: number;
    private autoConnect: boolean;

    constructor(opts?: IConnectorWorkerOpts) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-connector'
        }, opts);
        var defOpts = {
            clientConnectionEventsLogLevel: 800,
            socketIoClient: {
                multiplex: false,
                timeout: 5000
            }
        };
        this.opts = this.opts.beAdoptedBy<IConnectorWorkerOpts>(defOpts, 'worker');
        this.opts.merge(opts);

        this.socketIoClientOpts = this.opts.get('socketIoClient');
        
        this.clientConnectionEventsLogLevel = this.opts.get<number>('clientConnectionEventsLogLevel');

        this.autoConnect = false;
    }
    
    public init(cb): IWorker {
        this.annotate({
            internal: true
        }).ack('connect-to-external-services', (cb) => {
            this.loadServiceConnections((e) => {
                if (e !== null) {
                    cb(e);
                }
                else {
                    _.each(this.serviceConnections, (srvConn) => {
                        this.intercept(srvConn.name + '.*.*.*', {
                            preEmit: (stop, next, anno, ...args) => {
                                var emit = this.getCommEmit(args.shift());
                                var srvClient = _.find(this.serviceClients, (c) => {
                                    return c.service === emit.service && c.authenticated;
                                });
                                if (!_.isUndefined(srvClient) && !_.isUndefined(srvClient.socket)) {
                                    this.emitToConnectedService(srvClient, emit, anno, args, () => {
                                        next(args);
                                    });
                                }
                            }
                        });
                        this.handshakeWithConnectedService(srvConn);
                    });
                    cb(null);
                }
            });
        });
        this.annotate({
            internal: true
        }).answer('list-external-service-names', (cb) => {
            cb(null, (<any>_).pluck(this.serviceConnections, 'name'));
        });
        this.annotate({
            log:{
                level:1000
            }
        }).ask<string[]>('iw-service.list-workers', (e, workerNames) => {
            if (e === null) {
                this.autoConnect = !(<any>_).contains((<any>_).pluck(workerNames, 'name'), 'iw-hive');
                super.init(cb);
            }
            else if (!_.isUndefined(cb)) {
                cb(e);
            }
            else {
                this.inform('error', e);
            }
        });
        return this;
    }

    public postInit(deps, cb): IWorker {
        if (this.autoConnect) {
            this.annotate({
                log:{
                    level:1000
                }
            }).confirm('connect-to-external-services', (e) => {
                if (e === null) {
                    if (!_.isEmpty(this.serviceConnections)) {
                        this.intercept('ask.iw-service.list-listeners', {
                            preEmit: (stop, next, anno, ...args) => {
                                var listeners:IServiceListener[] = args.pop();
                                _.each(this.serviceConnections, (conn) => {
                                    var name = [this.comm.prefix(), conn.name, '*', '*', '*'].join('.');
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
                    super.postInit(deps, cb);
                }
                else if (!_.isUndefined(cb)) {
                    cb(e);
                }
                else {
                    this.inform<Error>('error', e);
                }
            });
        }
        else {
            super.postInit(deps, cb);
        }
        return this;
    }

    public preStart(deps, cb): IWorker {
        async.whilst(() => {
            return !_.every(this.serviceClients, (srvClient: IServiceClient) => {
                return srvClient.authenticated && !_.isUndefined(srvClient.socket);
            });
        }, (cb) => {
            setImmediate(() => {
                cb(null);
            });
        }, (e) => {
            if (e === null) {
                super.preStart(deps, cb);
            }
            else if (_.isUndefined(cb)) {
                cb(e);
            }
            else {
                this.inform<Error>('error', e);
            }
        });
        return this;
    }
    
    private loadServiceConnections(cb: (e: Error) => void) {
        var envEvts = _.reduce(this.allCommListeners(), (envWorkers, l) => {
            if (l.commEvent.worker.indexOf('iw-env') === 0 && l.commEvent.name === 'list-service-connections') {
                envWorkers.push(l.commEvent);
            }
            return envWorkers;
        }, []);
        var extSrvConns = [];
        async.whilst(
            () => {
                return envEvts.length > 0;
            },
            (cb) => {
                var envEvt = envEvts.pop();
                this.annotate({
                    log:{
                        level:1000
                    }
                }).ask(envEvt, (e, srvConn) => {
                    extSrvConns = extSrvConns.concat(srvConn);
                    cb(null);
                });
            },
            (e) => {
                this.serviceConnections = _.uniq(extSrvConns);
                this.serviceClients = _.map<IServiceConnection, IServiceClient>(this.serviceConnections, (srvConn): IServiceClient => {
                    return {
                        service: srvConn.name,
                        authenticated: _.isEmpty(srvConn.token)
                    };
                });
                cb(e);
            }
        );
    }

    private handshakeWithConnectedService(service: IServiceConnection) {
        var options = this.socketIoClientOpts;
        var secureProtocol = (<any>_).any(['wss','https'], (p) => {
            return p === service.protocol;
        });
        if (secureProtocol || service.port.toString().indexOf("443") !== -1) {
            options.secure = true;
        }
        var srvClient = _.find(this.serviceClients, (c) => {
            return c.service === service.name;
        });
        if (!_.isUndefined(srvClient)) {
            var c: any = ioClient(service.url, options);
            c.on('connect', () => {
                this.informSocketClientEvent('connection-connect', service);
                if (!_.isEmpty(service.token)) {
                    c.emit(this.getCommEvent(service.name + '.check.iw-auth.authenticate-interservice').getText(), {
                        accessToken: service.token
                    }, (errorMsg) => {
                        if (errorMsg === null) {
                            srvClient.socket = c;
                            srvClient.authenticated = true;
                        }
                        else {
                            this.resetServiceClient(srvClient, service);
                            this.inform<Error>('error', new Error(errorMsg));
                        }
                    });
                }
                else {
                    srvClient.socket = c;
                    srvClient.authenticated = true;
                }
            });
            c.on('reconnect', (attempts) => {
                this.informSocketClientEvent('connection-reconnect', service);
            });
            c.on('connect_error', (e) => {
                this.informSocketClientEvent('connection-error', service);
            });
            c.on('reconnecting', (attempts) => {
                this.informSocketClientEvent('connection-reconnecting', service);
            });
            c.on('reconnect_failed', () => {
                this.informSocketClientEvent('connection-reconnect-failed', service);
            });
            c.on('connect_timeout', () => {
                this.informSocketClientEvent('connection-timeout', service);
            });
            c.on('disconnect', () => {
                this.informSocketClientEvent('connection-disconnect', service);
                this.resetServiceClient(srvClient, service);
            });
        }
    }

    private resetServiceClient(c: IServiceClient, s: IServiceConnection) {
        if (!_.isUndefined(c.socket)) {
            c.socket.disconnect(true);
        }
        c.socket = void 0;
        c.authenticated = _.isEmpty(s.token);
    }

    private emitToConnectedService(c: IServiceClient, emit, anno, args, cb) {
        var emitterCb = args.pop();
        var hasCb = _.isFunction(emitterCb);
        if (!hasCb) {
            args.push(emitterCb);
        }
        args.push((...args) => {
            if (!hasCb) {
                cb();
            }
            else {
                emitterCb.apply(this, args.concat(anno));
            }
        });
        c.socket.emit.apply(c.socket, [emit.getText(), emit, anno].concat(args));
    }
    
    private informSocketClientEvent(eventName: string, service: IServiceConnection) {
        this.annotate({
            log: {
                level: this.clientConnectionEventsLogLevel
            }
        }).inform(eventName, {
            serviceName: service.name
        });
    }
}

export = ConnectorWorker;
