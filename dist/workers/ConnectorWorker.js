"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var async = require('async');
var ioClient = require('socket.io-client');
var idHelper = require('../helpers/idHelper');
var Worker = require('../workers/Worker');
var ConnectorWorker = (function (_super) {
    __extends(ConnectorWorker, _super);
    function ConnectorWorker(opts) {
        _super.call(this, [], {
            id: idHelper.newId(),
            name: 'iw-connector'
        }, opts);
        this.opts = this.opts.beAdoptedBy({
            environmentWorker: 'iw-env',
            credsValidator: 'service',
            socketIoClient: {
                multiplex: false,
                timeout: 5000,
                reconnection: false
            }
        }, 'worker');
        this.opts.merge(opts);
        this.envWorker = this.opts.get('environmentWorker');
        this.credsValidator = this.opts.get('credsValidator');
        this.socketIoClientOpts = this.opts.get('socketIoClient');
        this.serviceConnections = [];
    }
    ConnectorWorker.prototype.init = function (cb) {
        var _this = this;
        this.annotate({ internal: true }).answer('list-external-service-names', function (cb) {
            cb(null, _.map(_.map(_this.serviceConnections, 'service'), 'name'));
        });
        return _super.prototype.init.call(this, cb);
    };
    ConnectorWorker.prototype.postInit = function (deps, cb) {
        var _this = this;
        async.waterfall([
            function (cb) {
                _this.getServiceWorkers(function (e, workers) {
                    cb(e, workers);
                });
            },
            function (workers, cb) {
                if (_.any(workers, function (worker) {
                    return worker === _this.envWorker;
                })) {
                    _this.loadServiceConnections(function (e) {
                        _this.setupIntercepts();
                        cb(e);
                    });
                }
                else {
                    cb(new Error(_this.me.name + ' depends on ' + _this.envWorker));
                }
            }
        ], function (e) {
            if (e == null) {
                _super.prototype.postInit.call(_this, deps, cb);
            }
            else {
                cb(e);
            }
        });
        return this;
    };
    ConnectorWorker.prototype.getServiceWorkers = function (cb) {
        this.annotate({
            log: {
                level: 1000
            }
        }).ask('iw-service.list-workers', function (e, workers) {
            cb(e, _.pluck(workers, 'name'));
        });
    };
    ConnectorWorker.prototype.loadServiceConnections = function (cb) {
        var _this = this;
        this.ask(this.envWorker + '.list-service-connections', function (e, serviceConnections) {
            _this.serviceConnections = _.map(serviceConnections, function (service) {
                return {
                    service: service,
                    authpack: {}
                };
            });
            cb(e);
        });
    };
    ConnectorWorker.prototype.setupIntercepts = function () {
        var _this = this;
        if (!_.isEmpty(this.serviceConnections)) {
            this.intercept('inform.iw-service.available-listeners', {
                preEmit: function (stop, next, anno) {
                    var args = [];
                    for (var _i = 3; _i < arguments.length; _i++) {
                        args[_i - 3] = arguments[_i];
                    }
                    var listeners = args.pop();
                    _.each(_this.serviceConnections, function (srvConn) {
                        var name = [_this.comm.prefix(), srvConn.service.name, '*', '*', '*'].join('.');
                        listeners.push({
                            annotation: {},
                            commEvent: _this.getCommEvent(name)
                        });
                    });
                    args.push(listeners);
                    next(args);
                }
            });
        }
        _.each(this.serviceConnections, function (serviceConn) {
            _this.intercept(serviceConn.service.name + '.*.*.*', {
                preEmit: function (stop, next, anno) {
                    var args = [];
                    for (var _i = 3; _i < arguments.length; _i++) {
                        args[_i - 3] = arguments[_i];
                    }
                    var emit = _this.getCommEmit(args.shift());
                    var emitterCb = void 0;
                    if (_.isFunction(_.last(args))) {
                        emitterCb = args.pop();
                    }
                    _this.emitToService(serviceConn, emit, anno, args, emitterCb, function (shouldStop) {
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
    };
    ConnectorWorker.prototype.emitToService = function (srvConn, emit, anno, args, emitterCb, cb) {
        var _this = this;
        var clientOpts = _.cloneDeep(this.socketIoClientOpts);
        clientOpts.extraHeaders = _.merge(_.isEmpty(srvConn.authpack) ? void 0 : {
            authpack: JSON.stringify(srvConn.authpack)
        }, clientOpts.extraHeaders);
        var socket = ioClient(srvConn.service.url, clientOpts);
        socket.once('error', function (errorJson) {
            var errorObj = JSON.parse(errorJson);
            var e = new Error(errorObj.message);
            e.code = errorObj.code;
            _this.handleSocketError(e, srvConn, socket, function (e) {
                if (e == null) {
                    _this.emitToService(srvConn, emit, anno, args, emitterCb, cb);
                }
                else {
                    if (_.isFunction(emitterCb)) {
                        emitterCb(e);
                    }
                    cb(true);
                }
            });
        });
        socket.once('connect', function () {
            socket.emit.apply(socket, [emit.getText(), emit, anno].concat(args).concat([function () {
                    var resArgs = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        resArgs[_i - 0] = arguments[_i];
                    }
                    if (resArgs[0] == null) {
                        socket.close();
                        if (_.isFunction(emitterCb)) {
                            emitterCb.apply(_this, resArgs);
                        }
                        cb(false);
                    }
                    else {
                        _this.handleSocketError(resArgs[0], srvConn, socket, function (e) {
                            if (e == null) {
                                _this.emitToService(srvConn, emit, anno, args, emitterCb, cb);
                            }
                            else {
                                if (_.isFunction(emitterCb)) {
                                    emitterCb(e);
                                }
                                cb(true);
                            }
                        });
                    }
                }]));
        });
        socket.once('connect_error', function (connError) {
            var e = new Error(connError.message);
            e.code = connError.description;
            _this.handleSocketError(e, srvConn, socket, function (e) {
                if (e == null) {
                    _this.emitToService(srvConn, emit, anno, args, emitterCb, cb);
                }
                else {
                    if (_.isFunction(emitterCb)) {
                        emitterCb(e);
                    }
                    cb(true);
                }
            });
        });
        socket.once('authpack-update', function (authpack, cb) {
            srvConn.authpack = authpack;
            cb();
        });
    };
    ConnectorWorker.prototype.handleSocketError = function (errorObj, srvConn, socket, cb) {
        var _this = this;
        socket.close();
        var e = new Error(errorObj.message);
        if (!_.isUndefined(errorObj.code)) {
            e.code = errorObj.code;
        }
        if (!_.isUndefined(errorObj.unauthorizedClients)) {
            e.unauthorizedClients = errorObj.unauthorizedClients;
        }
        switch (e.code) {
            case 401:
                this.authenticateWithSecureService(srvConn, function (e) {
                    cb(e);
                });
                break;
            case 403:
                if (_.isUndefined(_.get(srvConn, 'authpack.accessToken'))) {
                    this.authenticateWithSecureService(srvConn, function (e) {
                        cb(e);
                    });
                }
                else {
                    if (_.any(e.unauthorizedClients, function (uc) {
                        return uc.id == srvConn.service.id && uc.type == _this.credsValidator;
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
    };
    ConnectorWorker.prototype.authenticateWithSecureService = function (srvConn, cb) {
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
        }, function (e, authpack) {
            if (e === null) {
                srvConn.authpack = authpack;
            }
            cb(e);
        });
    };
    return ConnectorWorker;
}(Worker));
module.exports = ConnectorWorker;
//# sourceMappingURL=ConnectorWorker.js.map