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
        var defOpts = {
            clientConnectionEventsLogLevel: 800,
            socketIoClient: {
                multiplex: false,
                timeout: 5000
            }
        };
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        this.socketIoClientOpts = this.opts.get('socketIoClient');
        this.clientConnectionEventsLogLevel = this.opts.get('clientConnectionEventsLogLevel');
        this.autoConnect = false;
    }
    ConnectorWorker.prototype.init = function (cb) {
        var _this = this;
        this.annotate({
            internal: true
        }).ack('connect-to-external-services', function (cb) {
            _this.loadServiceConnections(function (e) {
                if (e !== null) {
                    cb(e);
                }
                else {
                    _.each(_this.serviceConnections, function (srvConn) {
                        _this.intercept(srvConn.name + '.*.*.*', {
                            preEmit: function (stop, next, anno) {
                                var args = [];
                                for (var _i = 3; _i < arguments.length; _i++) {
                                    args[_i - 3] = arguments[_i];
                                }
                                var emit = _this.getCommEmit(args.shift());
                                var srvClient = _.find(_this.serviceClients, function (c) {
                                    return c.service === emit.service && c.authenticated;
                                });
                                if (!_.isUndefined(srvClient) && !_.isUndefined(srvClient.socket)) {
                                    _this.emitToConnectedService(srvClient, emit, anno, args, function () {
                                        next(args);
                                    });
                                }
                            }
                        });
                        _this.handshakeWithConnectedService(srvConn);
                    });
                    cb(null);
                }
            });
        });
        this.annotate({
            internal: true
        }).answer('list-external-service-names', function (cb) {
            cb(null, _.pluck(_this.serviceConnections, 'name'));
        });
        this.annotate({
            log: {
                level: 1000
            }
        }).ask('iw-service.list-workers', function (e, workerNames) {
            if (e === null) {
                _this.autoConnect = !_.contains(_.pluck(workerNames, 'name'), 'iw-hive');
                _super.prototype.init.call(_this, cb);
            }
            else if (!_.isUndefined(cb)) {
                cb(e);
            }
            else {
                _this.inform('error', e);
            }
        });
        return this;
    };
    ConnectorWorker.prototype.postInit = function (deps, cb) {
        var _this = this;
        if (this.autoConnect) {
            this.annotate({
                log: {
                    level: 1000
                }
            }).confirm('connect-to-external-services', function (e) {
                if (e === null) {
                    if (!_.isEmpty(_this.serviceConnections)) {
                        _this.intercept('ask.iw-service.list-listeners', {
                            preEmit: function (stop, next, anno) {
                                var args = [];
                                for (var _i = 3; _i < arguments.length; _i++) {
                                    args[_i - 3] = arguments[_i];
                                }
                                var listeners = args.pop();
                                _.each(_this.serviceConnections, function (conn) {
                                    var name = [_this.comm.prefix(), conn.name, '*', '*', '*'].join('.');
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
                    _super.prototype.postInit.call(_this, deps, cb);
                }
                else if (!_.isUndefined(cb)) {
                    cb(e);
                }
                else {
                    _this.inform('error', e);
                }
            });
        }
        else {
            _super.prototype.postInit.call(this, deps, cb);
        }
        return this;
    };
    ConnectorWorker.prototype.preStart = function (deps, cb) {
        var _this = this;
        async.whilst(function () {
            return !_.every(_this.serviceClients, function (srvClient) {
                return srvClient.authenticated && !_.isUndefined(srvClient.socket);
            });
        }, function (cb) {
            setImmediate(function () {
                cb(null);
            });
        }, function (e) {
            if (e === null) {
                _super.prototype.preStart.call(_this, deps, cb);
            }
            else if (_.isUndefined(cb)) {
                cb(e);
            }
            else {
                _this.inform('error', e);
            }
        });
        return this;
    };
    ConnectorWorker.prototype.loadServiceConnections = function (cb) {
        var _this = this;
        var envEvts = _.reduce(this.allCommListeners(), function (envWorkers, l) {
            if (l.commEvent.worker.indexOf('iw-env') === 0 && l.commEvent.name === 'list-service-connections') {
                envWorkers.push(l.commEvent);
            }
            return envWorkers;
        }, []);
        var extSrvConns = [];
        async.whilst(function () {
            return envEvts.length > 0;
        }, function (cb) {
            var envEvt = envEvts.pop();
            _this.annotate({
                log: {
                    level: 1000
                }
            }).ask(envEvt, function (e, srvConn) {
                extSrvConns = extSrvConns.concat(srvConn);
                cb(null);
            });
        }, function (e) {
            _this.serviceConnections = _.uniq(extSrvConns);
            _this.serviceClients = _.map(_this.serviceConnections, function (srvConn) {
                return {
                    service: srvConn.name,
                    authenticated: _.isEmpty(srvConn.token)
                };
            });
            cb(e);
        });
    };
    ConnectorWorker.prototype.handshakeWithConnectedService = function (service) {
        var _this = this;
        var options = this.socketIoClientOpts;
        var secureProtocol = _.any(['wss', 'https'], function (p) {
            return p === service.protocol;
        });
        if (secureProtocol || service.port.toString().indexOf("443") !== -1) {
            options.secure = true;
        }
        var srvClient = _.find(this.serviceClients, function (c) {
            return c.service === service.name;
        });
        if (!_.isUndefined(srvClient)) {
            var c = ioClient(service.url, options);
            c.on('connect', function () {
                _this.informSocketClientEvent('connection-connect', service);
                if (!_.isEmpty(service.token)) {
                    c.emit(_this.getCommEvent(service.name + '.check.iw-auth.authenticate-interservice').getText(), {
                        accessToken: service.token
                    }, function (errorMsg) {
                        if (errorMsg === null) {
                            srvClient.socket = c;
                            srvClient.authenticated = true;
                        }
                        else {
                            _this.resetServiceClient(srvClient, service);
                            _this.inform('error', new Error(errorMsg));
                        }
                    });
                }
                else {
                    srvClient.socket = c;
                    srvClient.authenticated = true;
                }
            });
            c.on('reconnect', function (attempts) {
                _this.informSocketClientEvent('connection-reconnect', service);
            });
            c.on('connect_error', function (e) {
                _this.informSocketClientEvent('connection-error', service);
            });
            c.on('reconnecting', function (attempts) {
                _this.informSocketClientEvent('connection-reconnecting', service);
            });
            c.on('reconnect_failed', function () {
                _this.informSocketClientEvent('connection-reconnect-failed', service);
            });
            c.on('connect_timeout', function () {
                _this.informSocketClientEvent('connection-timeout', service);
            });
            c.on('disconnect', function () {
                _this.informSocketClientEvent('connection-disconnect', service);
                _this.resetServiceClient(srvClient, service);
            });
        }
    };
    ConnectorWorker.prototype.resetServiceClient = function (c, s) {
        if (!_.isUndefined(c.socket)) {
            c.socket.disconnect(true);
        }
        c.socket = void 0;
        c.authenticated = _.isEmpty(s.token);
    };
    ConnectorWorker.prototype.emitToConnectedService = function (c, emit, anno, args, cb) {
        var _this = this;
        var emitterCb = args.pop();
        var hasCb = _.isFunction(emitterCb);
        if (!hasCb) {
            args.push(emitterCb);
        }
        args.push(function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i - 0] = arguments[_i];
            }
            if (!hasCb) {
                cb();
            }
            else {
                emitterCb.apply(_this, args.concat(anno));
            }
        });
        c.socket.emit.apply(c.socket, [emit.getText(), emit, anno].concat(args));
    };
    ConnectorWorker.prototype.informSocketClientEvent = function (eventName, service) {
        this.annotate({
            log: {
                level: this.clientConnectionEventsLogLevel
            }
        }).inform(eventName, {
            serviceName: service.name
        });
    };
    return ConnectorWorker;
}(Worker));
module.exports = ConnectorWorker;
//# sourceMappingURL=ConnectorWorker.js.map