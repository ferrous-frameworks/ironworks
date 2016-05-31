
import path = require('path');

import async = require('async');
import _ = require('lodash');
import hapi = require('hapi');
var inert = require('inert');

import IComm = require('../interfaces/eventing/IComm');
import idHelper = require('../helpers/idHelper');
import IAm = require('../interfaces/whoIAm/IAm');
import Options = require('../opts/Options');
import ICommEmit = require('../interfaces/eventing/ICommEmit');
import CommEmit = require('..//eventing/CommEmit');
import ICollection = require('../interfaces/collection/ICollection');
import IWorker = require('../interfaces/workers/IWorker');
import CommEvent = require('../eventing/CommEvent');
import ICommEvent = require('../interfaces/eventing/ICommEvent');
import ICommEventData = require('../interfaces/eventing/ICommEventData');
import IServiceListener = require('../interfaces/service/IServiceListener');

import Worker = require('../workers/Worker');

import IHttpServerWorker = require('../interfaces/workers/IHttpServerWorker');
import IHttpServerWorkerOpts = require('../interfaces/opts/IHttpServerWorkerOpts');
import ICommEmitData = require("../interfaces/eventing/ICommEmitData");

class HttpServerWorker extends Worker implements IHttpServerWorker {
    private serviceListeners: IServiceListener[];

    private routeConfig: any;

    public apiRoute: string;
    public httpServer: hapi.Server;

    constructor(opts?: IHttpServerWorkerOpts) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-http-server'
        }, opts);

        var defOpts: IHttpServerWorkerOpts = {
            port: process.env.VCAP_APP_PORT
        };
        this.opts = this.opts.beAdoptedBy<IHttpServerWorkerOpts>(defOpts, 'worker');
        this.opts.merge(opts);

        var serveApi = this.opts.has('apiRoute');
        if (serveApi) {
            var api = this.opts.get<string>('apiRoute');
            if (api[0] !== '/') {
                api = '/' + api;
            }
            if (api[api.length - 1] === '/') {
                api = api.substring(0, api.length - 1);
            }
            this.apiRoute = api;
        }

        this.serviceListeners = [];

        this.routeConfig = {
            post: {
                method: 'POST',
                path: this.apiRoute + '/{prefix}/{service}/{method}/{worker}/{event}',
                config: {
                    payload: {
                        allow: 'application/json',
                        parse: true,
                        maxBytes: 105000000
                    }
                }
            },
            get: {
                method: 'GET',
                path: this.apiRoute + '/{prefix}/{service}/{method}/{worker}/{event}'
            }
        }
    }

    public init(callback?: (e: Error) => void): IWorker {
        this.httpServer = new hapi.Server(this.opts.get<hapi.IServerOptions>('hapi'));
        this.httpServer.connection({
            host: this.opts.get<string>('host'),
            port: this.opts.get<number>('port')
        });
        var servePublicRoot = this.opts.has('hapi.connections.routes.files.relativeTo')
            && this.opts.has('rootSitePagePath');
        if (servePublicRoot) {
            this.httpServer.register(inert, () => {});
            this.httpServer.route({
                method: 'GET',
                path: '/{p*}',
                handler: (req: hapi.Request, reply: hapi.IReply) => {
                    if (req.path === '/') {
                        req.path = this.opts.get<string>('rootSitePagePath');
                    }
                    var root = this.opts.get<string>('hapi.connections.routes.files.relativeTo');
                    var filePath = path.join(root, req.path);
                    reply.file(filePath);
                }
            });
        }
        else {
            this.httpServer.route({
                method: 'GET',
                path: '/',
                handler: (req: hapi.Request, reply: hapi.IReply) => {
                    reply('');
                }
            });
        }
        this.info<IServiceListener[]>('iw-service.available-listeners', (listeners) => {
            this.serviceListeners = listeners;
        });
        this.annotate({
            internal: true
        }).answer('route-config', (cb) => {
            cb(null, this.routeConfig);
        });
        this.intercept('ask.iw-service.list-listeners', {
            preEmit: (stop, next, anno, emit, cb) => {
                next([emit, (e, listeners) => {
                    if (e === null) {
                        _.each(listeners, (l: any) => {
                            l.httpPath = this.apiRoute + '/' + l.commEvent.getText().replace(/\./g, '/');
                        });
                    }
                    cb(e, listeners);
                }]);
            }
        });
        super.init(callback);
        return this;
    }

    public getCommEmitFromRequest(eventArray: string[], who?: IAm): ICommEmit {
        return new CommEmit({
            id: idHelper.newId(),
            emitter: _.isUndefined(who) ? this.me : who,
            timestamp: new Date().getTime(),
            prefix: eventArray[0],
            service: eventArray[1],
            method: eventArray[2],
            worker: eventArray[3],
            name: eventArray[4],
            scoc: [ this.whoService ]
        });
    }

    public handleApiReq(emit: ICommEmitData, req: hapi.Request, reply: hapi.IReply, input: any, cb?) {
        var method = emit.method;
        var hasEvent = (<any>_).any(this.serviceListeners, (srvListener: IServiceListener) => {
            return CommEvent.equal(emit, srvListener.commEvent);
        });
        if (!hasEvent) {
            method = void 0;
        }
        else if (!_.isNull(req.auth.credentials)) {
            this.annotate({
                auth: req.auth.credentials
            });
        }
        switch (method) {
            case 'tell':
                this.tell(emit);
                reply(null);
                break;
            case 'inform':
                this.inform(emit, input);
                reply(null);
                break;
            case 'confirm':
                this.confirm(emit, (e) => {
                    this.handleApiReqCallback(cb, reply, e);
                });
                break;
            case 'check':
                this.check(emit, input, (e) => {
                    this.handleApiReqCallback(cb, reply, e);
                });
                break;
            case 'ask':
                this.ask(emit, (e, answer) => {
                    this.handleApiReqCallback(cb, reply, e, answer);
                });
                break;
            case 'request':
                this.request(emit, input, (e, response) => {
                    this.handleApiReqCallback(cb, reply, e, response);
                });
                break;
            default:
                reply('').statusCode = 404;
                break;
        }
    }

    private handleApiReqCallback(cb, reply, ...args) {

        if (_.isFunction(cb)) {
            cb.apply(void 0, args);
        }
        else {
            reply.apply(reply, args);
        }
    }

    public postInit(dependencies: ICollection<IWorker>, callback?: (e: Error) => void): IWorker {
        if (!_.isUndefined(this.apiRoute)) {
            var postRoute = _.cloneDeep(this.routeConfig.post);
            var getRoute = _.cloneDeep(this.routeConfig.get);
            postRoute.handler = (req: hapi.Request, reply: hapi.IReply) => {
                var emit = this.getCommEmitFromRequest(req.paramsArray);
                this.handleApiReq(emit, req, reply, _.extend(req.payload, req.query));
            };
            getRoute.handler = (req: hapi.Request, reply: hapi.IReply) => {
                var emit = this.getCommEmitFromRequest(req.paramsArray);
                this.handleApiReq(emit, req, reply, req.query);
            };
            this.httpServer.route(postRoute);
            this.httpServer.route(getRoute);
        }
        this.httpServer.start((e) => {
            if (_.isUndefined(e)) {
                e = null;
            }
            if (e === null) {
                super.postInit(dependencies, callback);
            }
            else if (!_.isUndefined(callback)) {
                callback(e);
            }
            else {
                this.inform<Error>('error', e);
            }

        });
        return this;
    }

    public dispose(callback?: () => void) {
        if (!_.isUndefined(this.httpServer)) {
            this.httpServer.stop({
                timeout: 5000
            }, () => {
                if (!_.isUndefined(callback)) {
                    callback();
                }
            });
        }
        else {
            if (!_.isUndefined(callback)) {
                process.nextTick(() => {
                    callback();
                });
            }
        }
    }
}

export = HttpServerWorker;