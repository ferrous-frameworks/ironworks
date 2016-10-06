"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var JsonStringifySafe = require('json-stringify-safe');
var idHelper = require('../helpers/idHelper');
var CommEvent = require('../eventing/CommEvent');
var Worker = require('./Worker');
var LogWorker = (function (_super) {
    __extends(LogWorker, _super);
    function LogWorker(opts) {
        _super.call(this, [], {
            id: idHelper.newId(),
            name: 'iw-log'
        }, opts);
        if (_.isUndefined(opts) || (_.isUndefined(opts.stdout) && _.isUndefined(this.writeStdout))) {
            this.writeStdout = console.log;
        }
        else {
            this.writeStdout = opts.stdout;
        }
        if (_.isUndefined(opts) || (_.isUndefined(opts.stderr) && _.isUndefined(this.writeStderr))) {
            this.writeStderr = console.error;
        }
        else {
            this.writeStderr = opts.stderr;
        }
        var defOpts = {
            level: 500,
            defaultLevel: 500
        };
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        this.level = this.opts.get('level');
        this.defLevel = this.opts.get('defaultLevel');
        this.serviceListeners = [];
    }
    LogWorker.prototype.preInit = function (comm, whoService, cb) {
        var _this = this;
        this.comm = comm;
        this.whoService = whoService;
        this.info('iw-service.available-listeners', function (listeners) {
            _this.serviceListeners = listeners;
        });
        this.info('log', function (entry) { });
        this.intercept('*.*.*.*', {
            preEmit: function (stop, next, anno) {
                var args = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    args[_i - 3] = arguments[_i];
                }
                var logLevel = _this.defLevel;
                if (!_.isUndefined(anno.log) && !_.isUndefined(anno.log.level)) {
                    logLevel = anno.log.level;
                }
                if (logLevel > _this.level) {
                    next(args);
                }
                else {
                    var meta = args[0];
                    var emitterObj = void 0;
                    var cb = void 0;
                    if (args.length === 2) {
                        if (_.isFunction(args[1])) {
                            cb = args[1];
                        }
                        else {
                            emitterObj = args[1];
                        }
                    }
                    if (args.length === 3) {
                        emitterObj = args[1];
                        cb = args[2];
                    }
                    var nextArgs = [meta];
                    var emitterObjLog = void 0;
                    if (!_.isUndefined(emitterObj)) {
                        emitterObjLog = _.clone(emitterObj);
                        if (!_.isUndefined(anno.log)) {
                            if (!_.isEmpty(anno.log.properties)) {
                                _.each(anno.log.properties, function (prop) {
                                    var emittedProp = _.get(emitterObjLog, prop.name);
                                    if (!_.isUndefined(emittedProp)) {
                                        if (!_.isUndefined(prop.level) && prop.level > _this.level) {
                                            emittedProp = void 0;
                                        }
                                        else if (!_.isUndefined(prop.secure) && prop.secure) {
                                            emittedProp = '*****';
                                        }
                                        else if (!_.isUndefined(prop.arrayLengthOnly) && prop.arrayLengthOnly && _.isArray(emittedProp)) {
                                            emittedProp = 'array[' + emittedProp.length + ']';
                                        }
                                        _.set(emitterObjLog, prop.name, emittedProp);
                                    }
                                });
                            }
                            else if (!_.isEmpty(anno.log.emittedObject)) {
                                if (!_.isUndefined(anno.log.emittedObject.arrayLengthOnly) && anno.log.emittedObject.arrayLengthOnly && _.isArray(emitterObjLog)) {
                                    emitterObjLog = 'array[' + emitterObjLog.length + ']';
                                }
                            }
                        }
                        nextArgs.push(emitterObj);
                        if (!_this.interceptListener(_this.getCommEvent(meta)) || _.isUndefined(cb)) {
                            if (emitterObj instanceof Error) {
                                _this.error(meta, anno, emitterObj);
                            }
                            else {
                                _this.log(meta, anno, emitterObjLog);
                            }
                        }
                    }
                    if (!_.isUndefined(cb)) {
                        nextArgs.push(function () {
                            var listenerArgs = [];
                            for (var _i = 0; _i < arguments.length; _i++) {
                                listenerArgs[_i - 0] = arguments[_i];
                            }
                            var e = listenerArgs[0];
                            var listenerRes;
                            if (listenerArgs.length > 1) {
                                listenerRes = listenerArgs[1];
                            }
                            if (e !== null) {
                                _this.error(meta, anno, e, emitterObj);
                            }
                            else {
                                _this.log(meta, anno, emitterObjLog, listenerRes);
                            }
                            cb(e, listenerRes);
                        });
                    }
                    else if (_.isUndefined(emitterObj)) {
                        _this.log(meta, anno);
                    }
                    next(nextArgs);
                }
            }
        });
        _super.prototype.preInit.call(this, comm, whoService, cb);
        return this;
    };
    LogWorker.prototype.postInit = function (deps, cb) {
        var _this = this;
        this.comm.on('newListener', function (event) {
            if (_this.getCommEvent(event).name !== 'newListener') {
                _this.ask('iw-service.list-listeners', function (e, listeners) {
                    if (e === null) {
                        _this.serviceListeners = listeners;
                    }
                });
            }
        });
        return _super.prototype.postInit.call(this, deps, cb);
    };
    LogWorker.prototype.interceptListener = function (evt) {
        return this.hasListener(evt)
            || _.any(this.serviceListeners, function (srvListener) {
                return CommEvent.equal(evt, srvListener.commEvent);
            })
            || evt.name === 'error'
            || evt.name === 'warn';
    };
    LogWorker.prototype.log = function (meta, anno, emitterObj, listenerRes) {
        var _this = this;
        process.nextTick(function () {
            var entry = {
                meta: meta,
                anno: anno
            };
            if (!_.isUndefined(emitterObj)) {
                entry.emitted = emitterObj;
            }
            if (!_.isUndefined(listenerRes)) {
                entry.emitted = listenerRes;
            }
            var json = JsonStringifySafe(entry);
            _this.writeStdout(json);
        });
    };
    LogWorker.prototype.error = function (meta, anno, error, emitterObj) {
        var _this = this;
        process.nextTick(function () {
            var entry = {
                meta: meta,
                anno: anno
            };
            if (error !== null) {
                if (error instanceof Error) {
                    entry.error = error.message;
                    entry.stack = error.stack.substring(error.stack.indexOf('at', 7 + error.message.length));
                    entry = _.merge(entry, _.omit(error, ['message', 'stack']));
                }
                if (_.isString(error)) {
                    entry.error = error;
                }
                if (_.isObject(error)) {
                    entry = _.merge(entry, error);
                }
            }
            if (!_.isUndefined(emitterObj)) {
                entry.emitted = emitterObj;
            }
            var json = JsonStringifySafe(entry);
            _this.writeStderr(json);
        });
    };
    return LogWorker;
}(Worker));
module.exports = LogWorker;
//# sourceMappingURL=LogWorker.js.map