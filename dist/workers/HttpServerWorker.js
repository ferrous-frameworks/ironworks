var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var path = require('path');
var _ = require('lodash');
var hapi = require('hapi');
var inert = require('inert');
var idHelper = require('../helpers/idHelper');
var CommEmit = require('..//eventing/CommEmit');
var CommEvent = require('../eventing/CommEvent');
var Worker = require('../workers/Worker');
var HttpServerWorker = (function (_super) {
    __extends(HttpServerWorker, _super);
    function HttpServerWorker(opts) {
        _super.call(this, [], {
            id: idHelper.newId(),
            name: 'iw-http-server'
        }, opts);
        var defOpts = {
            port: process.env.VCAP_APP_PORT
        };
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        var serveApi = this.opts.has('apiRoute');
        if (serveApi) {
            var api = this.opts.get('apiRoute');
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
        };
    }
    HttpServerWorker.prototype.init = function (callback) {
        var _this = this;
        this.httpServer = new hapi.Server(this.opts.get('hapi'));
        this.httpServer.connection({
            host: this.opts.get('host'),
            port: this.opts.get('port')
        });
        var servePublicRoot = this.opts.has('hapi.connections.routes.files.relativeTo')
            && this.opts.has('rootSitePagePath');
        if (servePublicRoot) {
            this.httpServer.register(inert, function () { });
            this.httpServer.route({
                method: 'GET',
                path: '/{p*}',
                handler: function (req, reply) {
                    if (req.path === '/') {
                        req.path = _this.opts.get('rootSitePagePath');
                    }
                    var root = _this.opts.get('hapi.connections.routes.files.relativeTo');
                    var filePath = path.join(root, req.path);
                    reply.file(filePath);
                }
            });
        }
        else {
            this.httpServer.route({
                method: 'GET',
                path: '/',
                handler: function (req, reply) {
                    reply('');
                }
            });
        }
        this.info('iw-service.available-listeners', function (listeners) {
            _this.serviceListeners = listeners;
        });
        this.annotate({
            internal: true
        }).answer('route-config', function (cb) {
            cb(null, _this.routeConfig);
        });
        this.intercept('ask.iw-service.list-listeners', {
            preEmit: function (stop, next, anno, emit, cb) {
                next([emit, function (e, listeners) {
                        if (e === null) {
                            _.each(listeners, function (l) {
                                l.httpPath = _this.apiRoute + '/' + l.commEvent.getText().replace(/\./g, '/');
                            });
                        }
                        cb(e, listeners);
                    }]);
            }
        });
        _super.prototype.init.call(this, callback);
        return this;
    };
    HttpServerWorker.prototype.getCommEmitFromRequest = function (eventArray, who) {
        return new CommEmit({
            id: idHelper.newId(),
            emitter: _.isUndefined(who) ? this.me : who,
            timestamp: new Date().getTime(),
            prefix: eventArray[0],
            service: eventArray[1],
            method: eventArray[2],
            worker: eventArray[3],
            name: eventArray[4],
            scoc: [this.whoService]
        });
    };
    HttpServerWorker.prototype.handleApiReq = function (emit, req, reply, input, cb) {
        var _this = this;
        var method = emit.method;
        var hasEvent = _.any(this.serviceListeners, function (srvListener) {
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
                this.confirm(emit, function (e) {
                    _this.handleApiReqCallback(cb, reply, e);
                });
                break;
            case 'check':
                this.check(emit, input, function (e) {
                    _this.handleApiReqCallback(cb, reply, e);
                });
                break;
            case 'ask':
                this.ask(emit, function (e, answer) {
                    _this.handleApiReqCallback(cb, reply, e, answer);
                });
                break;
            case 'request':
                this.request(emit, input, function (e, response) {
                    _this.handleApiReqCallback(cb, reply, e, response);
                });
                break;
            default:
                reply('').statusCode = 404;
                break;
        }
    };
    HttpServerWorker.prototype.handleApiReqCallback = function (cb, reply) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        if (_.isFunction(cb)) {
            cb.apply(void 0, args);
        }
        else {
            reply.apply(reply, args);
        }
    };
    HttpServerWorker.prototype.postInit = function (dependencies, callback) {
        var _this = this;
        if (!_.isUndefined(this.apiRoute)) {
            var postRoute = _.cloneDeep(this.routeConfig.post);
            var getRoute = _.cloneDeep(this.routeConfig.get);
            postRoute.handler = function (req, reply) {
                var emit = _this.getCommEmitFromRequest(req.paramsArray);
                _this.handleApiReq(emit, req, reply, _.extend(req.payload, req.query));
            };
            getRoute.handler = function (req, reply) {
                var emit = _this.getCommEmitFromRequest(req.paramsArray);
                _this.handleApiReq(emit, req, reply, req.query);
            };
            this.httpServer.route(postRoute);
            this.httpServer.route(getRoute);
        }
        this.httpServer.start(function (e) {
            if (_.isUndefined(e)) {
                e = null;
            }
            if (e === null) {
                _super.prototype.postInit.call(_this, dependencies, callback);
            }
            else if (!_.isUndefined(callback)) {
                callback(e);
            }
            else {
                _this.inform('error', e);
            }
        });
        return this;
    };
    HttpServerWorker.prototype.dispose = function (callback) {
        if (!_.isUndefined(this.httpServer)) {
            this.httpServer.stop({
                timeout: 5000
            }, function () {
                if (!_.isUndefined(callback)) {
                    callback();
                }
            });
        }
        else {
            if (!_.isUndefined(callback)) {
                process.nextTick(function () {
                    callback();
                });
            }
        }
    };
    return HttpServerWorker;
})(Worker);
module.exports = HttpServerWorker;
//# sourceMappingURL=HttpServerWorker.js.map