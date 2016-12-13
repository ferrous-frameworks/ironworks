
import path = require('path');

import _ = require('lodash');
import async = require('async');

import IronBeam = require('iron-beam');

import IListener = IronBeam.IListener;

import idHelper = require('../helpers/idHelper');

import Comm = require('../eventing/Comm');
import IComm = require('../interfaces/eventing/IComm');
import ICommOpts = require('../interfaces/opts/ICommOpts');
import Collection = require('../collection/Collection');
import ICollection = require('../interfaces/collection/ICollection');
import IWorker = require('../interfaces/workers/IWorker');
import IWorkerOpts = require('../interfaces/opts/IWorkerOpts');
import IWhoQuery = require('../interfaces/whoIAm/IWhoQuery');
import IAm = require('../interfaces/whoIAm/IAm');
import IServiceReady = require('../interfaces/service/IServiceReady');
import IBroadcast = require('../interfaces/eventing/IBroadcast');
import CommEvent = require('../eventing/CommEvent');
import ICommEvent = require('../interfaces/eventing/ICommEvent');
import ICommEventData = require('../interfaces/eventing/ICommEventData');
import ICommEmitData = require('../interfaces/eventing/ICommEmitData');
import IDependency = require('../interfaces/workers/IDependency');
import IHiveHeartbeat = require('../interfaces/workers/IHiveHeartbeat');
import IServiceListener = require('../interfaces/service/IServiceListener');
import ICommListener = require('../interfaces/eventing/ICommListener');
import Eventer = require('../eventing/Eventer');
import IAmVersioned = require('../interfaces/whoIAm/IAmVersioned');

import Worker = require('../workers/Worker');

import IService = require('../interfaces/service/IService');
import IServiceOpts = require('../interfaces/opts/IServiceOpts');

class Service extends Worker implements IService {
    private workers: ICollection<IWorker>;
    private readyEventLogLevel: number;
    private availableListenersEventLogLevel: number;
    private ignoreWorkerNames: string[];
    private autoAnnotateInternalEmitNames: string[];

    constructor(name: string, opts?: IServiceOpts) {
        var id = idHelper.newId();

        super([], {
            id: id,
            name: 'iw-service'
        }, opts);

        var defOpts: IServiceOpts = {
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
        this.opts = this.opts.beAdoptedBy<IServiceOpts>(defOpts, 'worker');
        this.opts.merge(opts);

        this.workers = new Collection<IWorker>(idHelper.newId());

        var version = this.opts.get<string>('version');
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
        }, 'iw-service', this.opts.get<ICommOpts>('comm'));

        this.readyEventLogLevel = this.opts.get<number>('readyEventLogLevel');
        this.availableListenersEventLogLevel = this.opts.get<number>('availableListenersEventLogLevel');

        this.ignoreWorkerNames = _.toArray(this.opts.get<string[]>('listListeners.ignoreWorkerNames'));
        this.autoAnnotateInternalEmitNames = _.toArray(this.opts.get<string[]>('listListeners.autoAnnotateInternalEmitNames'));
    }

    public preInit(comm: IComm, whoService: IAmVersioned, callback?: (e: Error) => void): IService {
        super.preInit(comm, whoService, callback);
        return this;
    }

    public init(callback?: (e: Error) => void): IService {
        this.answer<IServiceListener[]>('list-listeners', (cb) => {
            this.ask<IServiceListener[]>('list-local-listeners', (e, listeners) => {
                // if (_.map(_.map(this.workers.list(), 'me'), 'name').indexOf('iw-connector') > -1) {
                    
                // }
                cb(null, listeners);
            });
        });
        this.answer<IAmVersioned>('who', (cb) => {
            cb(null, this.whoService);
        });
        this.annotate({ log: { level: 900 } }).answer<IServiceListener[]>('list-local-listeners', (cb) => {
            cb(null, _.reduce<IServiceListener, IServiceListener[]>(this.allCommListeners(), (availableListeners, l) => {
                if ((<any>_).contains(this.autoAnnotateInternalEmitNames, l.commEvent.name)) {
                    l.annotation = _.extend({
                        internal: true
                    }, l.annotation);
                }
                var internal = !_.isUndefined(l.annotation.internal) && l.annotation.internal;
                var ignored = (<any>_).any(this.ignoreWorkerNames, (ignoredWorkerName) => {
                    return l.commEvent.worker.indexOf(ignoredWorkerName) === 0;
                });
                if (!internal && !ignored) {
                    availableListeners.push(l);
                }
                return availableListeners;
            }, []));
        });
        this.answer<IAm[]>('list-workers', (cb) => {
            cb(null, (<any>_).pluck(this.workers.list(), 'me').concat(this.me));
        });
        this.annotate({
            internal: true
        }).info<IBroadcast>('broadcast', (broadcast) => {
            broadcast.internal = true;
            this.inform<IBroadcast>('iw-broadcast.broadcast', broadcast);
        });
        this.annotate({
            internal: true
        }).listen('dispose', () => {
            this.dispose();
        });
        super.init(callback);
        return this;
    }

    public postInit(dependencies?: ICollection<IDependency<IService>>, callback?: (e: Error) => void): IService {
        super.postInit(new Collection<IWorker>(idHelper.newId()), callback);
        return this;
    }

    public preStart(dependencies?: ICollection<IDependency<IService>>, callback?: (e: Error) => void): IService {
        super.preStart(new Collection<IWorker>(idHelper.newId()), callback);
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
    }

    public start(dependencies?: ICollection<IDependency<IService>>, callback?: (e: Error) => void): IService {
        async.waterfall([
            (cb) => {
                this.preInit(this.comm, this.whoService, (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.init((e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.independentWorkflowStep('preInit', this.comm, this.whoService, (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.independentWorkflowStep('init', (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.postInit(void 0, (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.dependentWorkflowStep('postInit', 'postInited', (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.preStart(void 0, (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.dependentWorkflowStep('preStart', 'preStarted', (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.annotate({
                    log: {
                        level: 1000
                    }
                }).ask<IServiceListener[]>('list-listeners', (e, evts) => {
                    if (e === null) {
                        this.annotate({
                            log: {
                                level: this.availableListenersEventLogLevel
                            }
                        }).inform<IServiceListener[]>('available-listeners', evts);
                    }
                    cb(e);
                });
            },
            (cb) => {
                this.dependentWorkflowStep('start', 'started', (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.postStart(void 0, (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.dependentWorkflowStep('postStart', 'postStarted', (e) => {
                    cb(e);
                });
            }
        ], (e: Error) => {
            this.started = true;
            if (!_.isUndefined(callback)) {
                callback(e);
            }
            if (e === null) {
                this.annotate({
                    log: {
                        level: this.readyEventLogLevel
                    }
                }).inform<IServiceReady>('ready', {
                    service: this
                });
            }
            else {
                this.inform('error', e);
            }
        });
        return this;
    }

    private independentWorkflowStep(step: string, ...args: any[]) {
        var cb = args.pop();
        async.each(this.workers.list(), (worker, cb) => {
            if (!_.isUndefined(worker[step]) && _.isFunction(worker[step])) {
                worker[step].apply(worker, args.concat((e) => {
                    cb(e);
                }));
            }
        }, (e) => {
            cb(e);
        });
    }

    private dependentWorkflowStep(step: string, waitForProp: string, cb: (e: Error) => void) {
        async.each(this.workers.list(), (worker, cb) => {
            async.waterfall([
                (cb) => {
                    this.waitForDeps(worker, waitForProp, (e, deps) => {
                        cb(e, deps);
                    });
                },
                (deps) => {
                    if (!_.isUndefined(worker[step]) && _.isFunction(worker[step])) {
                        worker[step](deps, (e) => {
                            cb(e);
                        });
                    }
                }
            ]);
        }, (e) => {
            cb(e);
        });
    }

    private waitForDeps(worker: IWorker, waitForProp: string, cb: (e: Error, workers?: ICollection<IWorker>) => void) {
        var errorPrefix = 'Failed to load dependencies for ' + worker.me.name + ': ';
        async.waterfall([
            (cb) => {
                this.getWorkerDeps(errorPrefix, worker, (e, deps) => {
                    cb(e, deps);
                });
            },
            (workerDeps) => {
                var started = new Date().getTime();
                var timeout = this.opts.get<number>('dependencyCheckTimeout');
                async.whilst(() => {
                    return !_.every(workerDeps.list(), (w: IWorker) => {
                        return _.isUndefined(w[waitForProp]) ? false : w[waitForProp];
                    });
                }, (tryAgain) => {
                    var now = new Date().getTime();
                    if ((now - started) >= timeout) {
                        tryAgain(new Error(errorPrefix + 'timeout'));
                    }
                    else {
                        setTimeout(tryAgain, this.opts.get<number>('dependencyCheckFrequency'));
                    }
                }, (e: Error) => {
                    cb(e, workerDeps);
                });
            }
        ]);
    }

    private getWorkerDeps(errorPrefix: string, worker: IWorker, cb: (e: Error, workers?: ICollection<IWorker>) => void) {
        var depDefs = worker.getDependencyDefs();
        if (depDefs.length > 0) {
            this.workers.get({
                names: (<any>_).pluck(depDefs, 'name')
            }, (e: Error, deps: ICollection<IWorker>) => {
                var missingRequiredDeps = _.filter(depDefs, (depDef) => {
                    return !depDef.optional && !(<any>_).any(deps.list(), (dep) => {
                        return dep.me.name === depDef.name;
                    });
                });
                if (!_.isEmpty(missingRequiredDeps)) {
                    cb(new Error(errorPrefix + 'missing - ' + (<any>_).pluck(missingRequiredDeps, 'name')));
                }
                else {
                    cb(null, deps);
                }
            });
        }
        else {
            cb(null, new Collection<IWorker>(idHelper.newId()));
        }
    }

    public postStart(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IService {
        super.postStart(dependencies, callback);
        return this;
    }

    public use(worker: IWorker): IService {
        this.workers.add(worker);
        return this;
    }

    public get(workerQuery: IWhoQuery, callback: (e: Error, results: ICollection<IWorker>) => void): IService {
        this.workers.get(workerQuery, callback);
        return this;
    }

    public getWorker(name: string, callback: (e: Error, worker?: IWorker) => void): IService {
        this.workers.get({ names: [ name ]}, (e, workers) => {
            if (e === null) {
                callback(null, workers.list()[0]);
            }
            else {
                callback(e);
            }
        });
        return this;
    }

    private disposeWorkers(cb: () => void) {
        async.each(this.workers.list(), (w: IWorker, cb: () => void) => {
            w.dispose(() => {
                cb();
            });
        }, () => {
            cb();
        });
    }

    public dispose(cb?: () => void) {
        async.waterfall([
            (cb) => {
                this.disposeWorkers(() => {
                    cb(null);
                });
            },
            (cb) => {
                super.dispose(() => {
                    cb(null);
                });
            },
            (cb) => {
                this.workers.dispose(() => {
                    cb(null);
                });
            },
            (cb) => {
                this.comm.dispose(() => {
                    cb(null);
                });
            }
        ], () => {
            if (!_.isUndefined(cb)) {
                cb();
            }
        });
    }
}

export = Service;