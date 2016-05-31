"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var async = require('async');
var io = require('socket.io');
var ioWildcard = require('socketio-wildcard')();
var idHelper = require('../helpers/idHelper');
var Worker = require('../workers/Worker');
var SocketWorker = (function (_super) {
    __extends(SocketWorker, _super);
    function SocketWorker(opts) {
        _super.call(this, [
            'iw-http-server'
        ], {
            id: idHelper.newId(),
            name: 'iw-socket'
        }, opts);
        var defOpts = {
            secure: false
        };
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        this.secure = this.opts.get('secure');
        this.unauthenticatedSockets = [];
    }
    SocketWorker.prototype.init = function (cb) {
        var _this = this;
        this.annotate({
            internal: true
        }).ack('secure', function (cb) {
            _this.secure = true;
            cb(null);
        });
        return _super.prototype.init.call(this, cb);
    };
    SocketWorker.prototype.postInit = function (dependencies, callback) {
        var _this = this;
        this.socketServer = io(dependencies.list()[0].httpServer.listener);
        this.socketServer.use(ioWildcard);
        this.socketServer.on('connection', function (socket) {
            socket.on('disconnect', function () {
                _this.removeUnauthenticatedSocket(socket.id);
            });
            if (_this.secure) {
                _this.unauthenticatedSockets.push(socket);
                _this.watchForAuthentication(socket);
            }
            else {
                _this.monitorSocket(socket);
            }
        });
        _super.prototype.postInit.call(this, dependencies, callback);
        return this;
    };
    SocketWorker.prototype.watchForAuthentication = function (socket) {
        var _this = this;
        async.whilst(function () {
            if (!_.contains(_.pluck(_this.unauthenticatedSockets, 'id'), socket.id)) {
                return false;
            }
            if (_.isUndefined(socket.authentication)) {
                return true;
            }
            return !socket.authentication.authenticated && !socket.authentication.timeout;
        }, function (cb) {
            setImmediate(function () {
                cb(null);
            });
        }, function (e) {
            if (e === null) {
                if (_.contains(_.pluck(_this.unauthenticatedSockets, 'id'), socket.id)) {
                    _this.monitorSocket(socket);
                }
            }
            else {
                _this.inform('error', e);
            }
            _this.removeUnauthenticatedSocket(socket.id);
        });
    };
    SocketWorker.prototype.monitorSocket = function (socket) {
        var _this = this;
        socket.on('error', function (e) {
            _this.inform('error', e);
        });
        socket.on('*', function (event) {
            event.data.shift();
            var emit = _this.getCommEmit(event.data.shift());
            emit.scoc.push(_this.whoService);
            var anno = event.data.shift();
            if (_.isUndefined(anno) || anno === null) {
                anno = {};
            }
            event.data.push(anno);
            var cb = void 0;
            var callCb = _.any([
                'tell',
                'inform'
            ], function (m) {
                return emit.method === m;
            });
            if (callCb) {
                cb = event.data.pop();
            }
            if (_this.secure) {
                _.merge(anno, {
                    auth: {
                        authentication: {
                            interservice: socket.authentication.interservice
                        }
                    }
                });
            }
            _this[emit.method].apply(_this, [emit].concat(event.data));
            if (callCb) {
                cb();
            }
        });
    };
    SocketWorker.prototype.removeUnauthenticatedSocket = function (id) {
        var removed = void 0;
        this.unauthenticatedSockets = _.filter(this.unauthenticatedSockets, function (socket) {
            var toRemove = id === socket.id;
            if (toRemove) {
                removed = socket;
            }
            return !toRemove;
        });
        return removed;
    };
    SocketWorker.prototype.dispose = function (callback) {
        if (!_.isUndefined(this.socketServer)) {
            this.socketServer.close();
        }
        _.each(this.unauthenticatedSockets, function (socket) {
            socket.disconnect(true);
        });
        if (!_.isUndefined(callback)) {
            process.nextTick(function () {
                callback();
            });
        }
    };
    return SocketWorker;
}(Worker));
module.exports = SocketWorker;
//# sourceMappingURL=SocketWorker.js.map