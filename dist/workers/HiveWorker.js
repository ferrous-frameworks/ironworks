"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var async = require('async');
var idHelper = require('../helpers/idHelper');
var Worker = require('./Worker');
var CommEvent = require('../eventing/CommEvent');
var CommEmit = require('../eventing/CommEmit');
var Eventer = require('../eventing/Eventer');
var HiveWorker = (function (_super) {
    __extends(HiveWorker, _super);
    function HiveWorker(opts) {
        _super.call(this, ['iw-connector'], {
            id: idHelper.newId(),
            name: 'iw-hive'
        }, opts);
        var defOpts = {
            heartbeatFrequency: 60000
        };
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        this.heartbeat = void 0;
        this.heartbeatFreq = this.opts.get('heartbeatFrequency');
    }
    HiveWorker.prototype.init = function (cb) {
        var _this = this;
        this.comm.intercept(this.getCommEvent('ask.iw-service.list-listeners'), {
            preEmit: function (stop, next, anno) {
                var args = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    args[_i - 3] = arguments[_i];
                }
                var emit = new CommEmit(args[0]);
                var cb = args.pop();
                async.waterfall([
                    function (cb) {
                        args.push(function (e, localListeners) {
                            cb(e, localListeners);
                        });
                    },
                    function (localListeners, cb) {
                        _this.annotate({
                            log: {
                                level: 1000
                            }
                        }).ask('iw-connector.list-external-service-names', function (e, serviceNames) {
                            cb(e, serviceNames, localListeners);
                        });
                    },
                    function (serviceNames, localListeners, cb) {
                        async.reduce(serviceNames, [], function (allExtListeners, serviceName, cb) {
                            var circular = _.reduce(_.pluck(emit.scoc, 'name'), function (count, name) {
                                return _this.whoService.name === name ? ++count : count;
                            }, 0) > 2;
                            if (circular) {
                                cb(null, allExtListeners);
                            }
                            else {
                                var extListEmit = _this.getCommEmit(emit);
                                extListEmit.service = serviceName;
                                _this.ask(extListEmit, function (e, srvExtListeners) {
                                    cb(e, allExtListeners.concat(srvExtListeners));
                                });
                            }
                        }, function (e, allExtListeners) {
                            cb(e, localListeners, allExtListeners);
                        });
                    },
                    function (localListeners, allExtListeners, cb) {
                        if (!_.isEmpty(allExtListeners)) {
                            _this.comm.removeAllAnnotatedListeners({
                                externallyRouted: true
                            });
                        }
                        cb(null, localListeners, allExtListeners);
                    },
                    function (localListeners, allExtListeners, cb) {
                        var preferredListeners = localListeners;
                        async.whilst(function () {
                            return !_.isEmpty(allExtListeners);
                        }, function (cb) {
                            var extListener = allExtListeners.shift();
                            if (!_.isUndefined(extListener)) {
                                var newWorkerListener = !_.any(preferredListeners, function (l) {
                                    return extListener.commEvent.method === l.commEvent.method
                                        && extListener.commEvent.worker === l.commEvent.worker
                                        && extListener.commEvent.name === l.commEvent.name;
                                });
                                var shorterRoute = _.any(allExtListeners, function (l) {
                                    return extListener.commEvent.method === l.commEvent.method
                                        && extListener.commEvent.worker === l.commEvent.worker
                                        && extListener.commEvent.name === l.commEvent.name
                                        && _.contains(_.initial(extListener.annotation.smap), l.commEvent.service);
                                });
                                if (newWorkerListener && !shorterRoute) {
                                    preferredListeners.push(extListener);
                                }
                            }
                            cb(null);
                        }, function (e) {
                            cb(e, preferredListeners);
                        });
                    },
                    function (preferredListeners) {
                        var availableListeners = _.reduce(preferredListeners, function (availableListeners, l) {
                            var method = l.commEvent.method;
                            var localCommEvt = _this.getCommEvent(l.commEvent);
                            localCommEvt.service = _this.whoService.name;
                            var isLocal = localCommEvt.service === l.commEvent.service;
                            var isNotServiceEvent = localCommEvt.worker !== 'iw-service';
                            var alreadyListening = _this.comm.hasListener(localCommEvt.getText());
                            if (isNotServiceEvent && !isLocal && !alreadyListening) {
                                _this.annotate({
                                    externallyRouted: true,
                                    internal: true
                                })[Eventer.getListenMethodName(method)](localCommEvt, function () {
                                    var args = [];
                                    for (var _i = 0; _i < arguments.length; _i++) {
                                        args[_i - 0] = arguments[_i];
                                    }
                                    _this[method].apply(_this, ([l.commEvent]).concat(args));
                                });
                            }
                            var alreadyListed = _.any(availableListeners, function (l) {
                                return CommEvent.equal(l.commEvent, localCommEvt);
                            });
                            if (!alreadyListed && (isLocal || isNotServiceEvent)) {
                                var smap = l.annotation.smap;
                                if (_.isUndefined(smap)) {
                                    smap = [];
                                }
                                if (smap.length === 0 || smap[smap.length - 1] !== _this.whoService.name) {
                                    smap.push(_this.whoService.name);
                                }
                                availableListeners.push({
                                    commEvent: localCommEvt,
                                    annotation: _.extend(l.annotation, {
                                        smap: smap
                                    })
                                });
                            }
                            return availableListeners;
                        }, []);
                        cb(null, availableListeners);
                    }
                ], function (e) {
                    if (e !== null) {
                        cb(e);
                    }
                });
                next(args);
            }
        });
        this.annotate({
            internal: true
        }).ack('init-external-service-connections', function (cb) {
            _this.annotate({
                log: {
                    level: 1000
                }
            }).confirm('iw-connector.connect-to-external-services', function (e) {
                cb(e);
            });
        });
        _super.prototype.init.call(this, cb);
        return this;
    };
    HiveWorker.prototype.postStart = function (deps, cb) {
        this.beatHeart();
        _super.prototype.postStart.call(this, deps, cb);
        return this;
    };
    HiveWorker.prototype.beatHeart = function () {
        var _this = this;
        this.heartbeat = setTimeout(function () {
            _this.ask('iw-service.list-listeners', function (e, listeners) {
                _this.annotate({
                    log: {
                        level: 1000
                    }
                }).inform('heartbeat', {
                    availableListeners: listeners
                });
                _this.beatHeart();
            });
        }, this.heartbeatFreq);
    };
    HiveWorker.prototype.dispose = function (cb) {
        clearTimeout(this.heartbeat);
        _super.prototype.dispose.call(this, cb);
    };
    return HiveWorker;
}(Worker));
module.exports = HiveWorker;
//# sourceMappingURL=HiveWorker.js.map