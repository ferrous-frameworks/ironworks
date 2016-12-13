"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var path = require('path');
var _ = require('lodash');
var async = require('async');
var idHelper = require('../helpers/idHelper');
var Comm = require('../eventing/Comm');
var Collection = require('../collection/Collection');
var Worker = require('../workers/Worker');
var Service = (function (_super) {
    __extends(Service, _super);
    function Service(name, opts) {
        var id = idHelper.newId();
        _super.call(this, [], {
            id: id,
            name: 'iw-service'
        }, opts);
        var defOpts = {
            dependencyCheckTimeout: 120000,
            dependencyCheckFrequency: 100,
            readyEventLogLevel: 900,
            availableListenersEventLogLevel: 900,
            listListeners: {
                ignoreWorkerNames: [
                    'iw-connector',
                    'iw-env'
                ],
                autoAnnotateInternalEmitNames: [
                    'pre-inited',
                    'inited',
                    'pre-started',
                    'ready',
                    'post-started',
                    'available-listeners',
                    'list-local-listeners',
                    'error'
                ]
            }
        };
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        this.workers = new Collection(idHelper.newId());
        var version = this.opts.get('version');
        if (_.isUndefined(version)) {
            version = 'v' + require(path.resolve('./package.json')).version;
        }
        this.whoService = {
            id: id,
            name: name,
            version: version
        };
        this.comm = new Comm(this.whoService, {
            id: idHelper.newId(),
            name: name + '-comm'
        }, 'iw-service', this.opts.get('comm'));
        this.readyEventLogLevel = this.opts.get('readyEventLogLevel');
        this.availableListenersEventLogLevel = this.opts.get('availableListenersEventLogLevel');
        this.ignoreWorkerNames = _.toArray(this.opts.get('listListeners.ignoreWorkerNames'));
        this.autoAnnotateInternalEmitNames = _.toArray(this.opts.get('listListeners.autoAnnotateInternalEmitNames'));
    }
    Service.prototype.preInit = function (comm, whoService, callback) {
        _super.prototype.preInit.call(this, comm, whoService, callback);
        return this;
    };
    Service.prototype.init = function (callback) {
        var _this = this;
        this.answer('list-listeners', function (cb) {
            _this.ask('list-local-listeners', function (e, listeners) {
                // if (_.map(_.map(this.workers.list(), 'me'), 'name').indexOf('iw-connector') > -1) {
                // }
                cb(null, listeners);
            });
        });
        this.answer('who', function (cb) {
            cb(null, _this.whoService);
        });
        this.annotate({ log: { level: 900 } }).answer('list-local-listeners', function (cb) {
            cb(null, _.reduce(_this.allCommListeners(), function (availableListeners, l) {
                if (_.contains(_this.autoAnnotateInternalEmitNames, l.commEvent.name)) {
                    l.annotation = _.extend({
                        internal: true
                    }, l.annotation);
                }
                var internal = !_.isUndefined(l.annotation.internal) && l.annotation.internal;
                var ignored = _.any(_this.ignoreWorkerNames, function (ignoredWorkerName) {
                    return l.commEvent.worker.indexOf(ignoredWorkerName) === 0;
                });
                if (!internal && !ignored) {
                    availableListeners.push(l);
                }
                return availableListeners;
            }, []));
        });
        this.answer('list-workers', function (cb) {
            cb(null, _.pluck(_this.workers.list(), 'me').concat(_this.me));
        });
        this.annotate({
            internal: true
        }).info('broadcast', function (broadcast) {
            broadcast.internal = true;
            _this.inform('iw-broadcast.broadcast', broadcast);
        });
        this.annotate({
            internal: true
        }).listen('dispose', function () {
            _this.dispose();
        });
        _super.prototype.init.call(this, callback);
        return this;
    };
    Service.prototype.postInit = function (dependencies, callback) {
        _super.prototype.postInit.call(this, new Collection(idHelper.newId()), callback);
        return this;
    };
    Service.prototype.preStart = function (dependencies, callback) {
        _super.prototype.preStart.call(this, new Collection(idHelper.newId()), callback);
        return this;
        // var extSrvConnEvt = _.find(this.allCommListeners(), (l) => {
        //     return l.commEvent.name === 'init-external-service-connections';
        // });
        // if (!_.isUndefined(extSrvConnEvt)) {
        //     this.annotate({
        //         internal: true
        //     }).info<IHiveHeartbeat>(extSrvConnEvt.commEvent.worker + '.heartbeat', (heartbeat) => {
        //         this.annotate({
        //             log: {
        //                 level: this.availableListenersEventLogLevel
        //             }
        //         }).inform<IServiceListener[]>('available-listeners', heartbeat.availableListeners);
        //     });
        //     this.confirm(extSrvConnEvt.event, (e) => {
        //         if (e === null) {
        //             super.preStart(new Collection<IWorker>(idHelper.newId()), callback);
        //         }
        //         else if (!_.isUndefined(callback)) {
        //             callback(e);
        //         }
        //         else {
        //             this.inform<Error>('error', e);
        //         }
        //     });
        // }
        // else {
        //     super.preStart(new Collection<IWorker>(idHelper.newId()), callback);
        // }
        // return this;
    };
    Service.prototype.start = function (dependencies, callback) {
        var _this = this;
        async.waterfall([
            function (cb) {
                _this.preInit(_this.comm, _this.whoService, function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.init(function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.independentWorkflowStep('preInit', _this.comm, _this.whoService, function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.independentWorkflowStep('init', function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.postInit(void 0, function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.dependentWorkflowStep('postInit', 'postInited', function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.preStart(void 0, function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.dependentWorkflowStep('preStart', 'preStarted', function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.annotate({
                    log: {
                        level: 1000
                    }
                }).ask('list-listeners', function (e, evts) {
                    if (e === null) {
                        _this.annotate({
                            log: {
                                level: _this.availableListenersEventLogLevel
                            }
                        }).inform('available-listeners', evts);
                    }
                    cb(e);
                });
            },
            function (cb) {
                _this.dependentWorkflowStep('start', 'started', function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.postStart(void 0, function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.dependentWorkflowStep('postStart', 'postStarted', function (e) {
                    cb(e);
                });
            }
        ], function (e) {
            _this.started = true;
            if (!_.isUndefined(callback)) {
                callback(e);
            }
            if (e === null) {
                _this.annotate({
                    log: {
                        level: _this.readyEventLogLevel
                    }
                }).inform('ready', {
                    service: _this
                });
            }
            else {
                _this.inform('error', e);
            }
        });
        return this;
    };
    Service.prototype.independentWorkflowStep = function (step) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var cb = args.pop();
        async.each(this.workers.list(), function (worker, cb) {
            if (!_.isUndefined(worker[step]) && _.isFunction(worker[step])) {
                worker[step].apply(worker, args.concat(function (e) {
                    cb(e);
                }));
            }
        }, function (e) {
            cb(e);
        });
    };
    Service.prototype.dependentWorkflowStep = function (step, waitForProp, cb) {
        var _this = this;
        async.each(this.workers.list(), function (worker, cb) {
            async.waterfall([
                function (cb) {
                    _this.waitForDeps(worker, waitForProp, function (e, deps) {
                        cb(e, deps);
                    });
                },
                function (deps) {
                    if (!_.isUndefined(worker[step]) && _.isFunction(worker[step])) {
                        worker[step](deps, function (e) {
                            cb(e);
                        });
                    }
                }
            ]);
        }, function (e) {
            cb(e);
        });
    };
    Service.prototype.waitForDeps = function (worker, waitForProp, cb) {
        var _this = this;
        var errorPrefix = 'Failed to load dependencies for ' + worker.me.name + ': ';
        async.waterfall([
            function (cb) {
                _this.getWorkerDeps(errorPrefix, worker, function (e, deps) {
                    cb(e, deps);
                });
            },
            function (workerDeps) {
                var started = new Date().getTime();
                var timeout = _this.opts.get('dependencyCheckTimeout');
                async.whilst(function () {
                    return !_.every(workerDeps.list(), function (w) {
                        return _.isUndefined(w[waitForProp]) ? false : w[waitForProp];
                    });
                }, function (tryAgain) {
                    var now = new Date().getTime();
                    if ((now - started) >= timeout) {
                        tryAgain(new Error(errorPrefix + 'timeout'));
                    }
                    else {
                        setTimeout(tryAgain, _this.opts.get('dependencyCheckFrequency'));
                    }
                }, function (e) {
                    cb(e, workerDeps);
                });
            }
        ]);
    };
    Service.prototype.getWorkerDeps = function (errorPrefix, worker, cb) {
        var depDefs = worker.getDependencyDefs();
        if (depDefs.length > 0) {
            this.workers.get({
                names: _.pluck(depDefs, 'name')
            }, function (e, deps) {
                var missingRequiredDeps = _.filter(depDefs, function (depDef) {
                    return !depDef.optional && !_.any(deps.list(), function (dep) {
                        return dep.me.name === depDef.name;
                    });
                });
                if (!_.isEmpty(missingRequiredDeps)) {
                    cb(new Error(errorPrefix + 'missing - ' + _.pluck(missingRequiredDeps, 'name')));
                }
                else {
                    cb(null, deps);
                }
            });
        }
        else {
            cb(null, new Collection(idHelper.newId()));
        }
    };
    Service.prototype.postStart = function (dependencies, callback) {
        _super.prototype.postStart.call(this, dependencies, callback);
        return this;
    };
    Service.prototype.use = function (worker) {
        this.workers.add(worker);
        return this;
    };
    Service.prototype.get = function (workerQuery, callback) {
        this.workers.get(workerQuery, callback);
        return this;
    };
    Service.prototype.getWorker = function (name, callback) {
        this.workers.get({ names: [name] }, function (e, workers) {
            if (e === null) {
                callback(null, workers.list()[0]);
            }
            else {
                callback(e);
            }
        });
        return this;
    };
    Service.prototype.disposeWorkers = function (cb) {
        async.each(this.workers.list(), function (w, cb) {
            w.dispose(function () {
                cb();
            });
        }, function () {
            cb();
        });
    };
    Service.prototype.dispose = function (cb) {
        var _this = this;
        async.waterfall([
            function (cb) {
                _this.disposeWorkers(function () {
                    cb(null);
                });
            },
            function (cb) {
                _super.prototype.dispose.call(_this, function () {
                    cb(null);
                });
            },
            function (cb) {
                _this.workers.dispose(function () {
                    cb(null);
                });
            },
            function (cb) {
                _this.comm.dispose(function () {
                    cb(null);
                });
            }
        ], function () {
            if (!_.isUndefined(cb)) {
                cb();
            }
        });
    };
    return Service;
}(Worker));
module.exports = Service;
//# sourceMappingURL=Service.js.map