
import _ = require('lodash');
import async = require('async');

import idHelper = require('../helpers/idHelper');

import IWorker = require('../interfaces/workers/IWorker');
import IHiveWorkerOpts = require('../interfaces/opts/IHiveWorkerOpts');
import Worker = require('./Worker');
import CommEvent = require('../eventing/CommEvent');
import CommEmit = require('../eventing/CommEmit');
import ICommEventData = require('../interfaces/eventing/ICommEventData');
import IHiveHeartbeat = require('../interfaces/workers/IHiveHeartbeat');
import IServiceReady = require('../interfaces/service/IServiceReady');
import IServiceListener = require('../interfaces/service/IServiceListener');
import Eventer = require('../eventing/Eventer');
import IAm = require('../interfaces/whoIAm/IAm');

class HiveWorker extends Worker implements IWorker {
    private heartbeat: any;
    private heartbeatFreq: number;
    private ignoreExternalWorkerNames: string[];

    constructor(opts?: IHiveWorkerOpts) {
        super([ 'iw-connector' ], {
            id: idHelper.newId(),
            name: 'iw-hive'
        }, opts);
        var defOpts: IHiveWorkerOpts = {
            heartbeatFrequency: 60000
        };
        this.opts = this.opts.beAdoptedBy<IHiveWorkerOpts>(defOpts, 'worker');
        this.opts.merge(opts);

        this.heartbeat = void 0;
        this.heartbeatFreq = this.opts.get<number>('heartbeatFrequency');
    }

    public init(cb): IWorker {
        this.comm.intercept(this.getCommEvent('ask.iw-service.list-listeners'), {
            preEmit: (stop, next, anno, ...args) => {
                var emit = new CommEmit(args[0]);
                var cb = args.pop();
                async.waterfall([
                    (cb) => {
                        args.push((e, localListeners) => {
                            cb(e, localListeners);
                        });
                    },
                    (localListeners, cb) => {
                        this.annotate({
                            log:{
                                level:1000
                            }
                        }).ask<string[]>('iw-connector.list-external-service-names', (e, serviceNames) => {
                            cb(e, serviceNames, localListeners);
                        });
                    },
                    (serviceNames, localListeners, cb) => {
                        async.reduce(serviceNames, [], (allExtListeners, serviceName: string, cb) => {
                            var circular = _.reduce(_.pluck(emit.scoc, 'name'), (count, name) => {
                                return this.whoService.name === name ? ++count : count;
                            }, 0) > 2;
                            if (circular) {
                                cb(null, allExtListeners);
                            }
                            else {
                                var extListEmit = this.getCommEmit(emit);
                                extListEmit.service = serviceName;
                                this.ask<IServiceListener[]>(extListEmit, (e, srvExtListeners) => {
                                    cb(e, allExtListeners.concat(srvExtListeners));
                                });
                            }
                        }, (e, allExtListeners) => {
                            cb(e, localListeners, allExtListeners);
                        });
                    },
                    (localListeners, allExtListeners, cb) => {
                        if (!_.isEmpty(allExtListeners)) {
                            this.comm.removeAllAnnotatedListeners({
                                externallyRouted: true
                            });
                        }
                        cb(null, localListeners, allExtListeners);
                    },
                    (localListeners, allExtListeners, cb) => {
                        var preferredListeners = localListeners;
                        async.whilst(() => {
                            return !_.isEmpty(allExtListeners);
                        }, (cb) => {
                            var extListener = allExtListeners.shift();
                            if (!_.isUndefined(extListener)) {
                                var newWorkerListener = !_.any<IServiceListener>(preferredListeners, (l) => {
                                    return extListener.commEvent.method === l.commEvent.method
                                        && extListener.commEvent.worker === l.commEvent.worker
                                        && extListener.commEvent.name === l.commEvent.name;
                                });
                                var shorterRoute = _.any<IServiceListener>(allExtListeners, (l) => {
                                    return extListener.commEvent.method === l.commEvent.method
                                        && extListener.commEvent.worker === l.commEvent.worker
                                        && extListener.commEvent.name === l.commEvent.name
                                        && _.contains(_.initial(extListener.annotation.smap), l.commEvent.service)
                                });
                                if (newWorkerListener && !shorterRoute) {
                                    preferredListeners.push(extListener);
                                }
                            }
                            cb(null);
                        }, (e) => {
                            cb(e, preferredListeners);
                        });
                    },
                    (preferredListeners: IServiceListener[]) => {
                        var availableListeners = _.reduce(preferredListeners, (availableListeners, l) => {
                            var method = l.commEvent.method;
                            var localCommEvt = this.getCommEvent(l.commEvent);
                            localCommEvt.service = this.whoService.name;
                            var isLocal = localCommEvt.service === l.commEvent.service;
                            var isNotServiceEvent = localCommEvt.worker !== 'iw-service';
                            var alreadyListening = this.comm.hasListener(localCommEvt.getText());
                            if (isNotServiceEvent && !isLocal && !alreadyListening) {
                                this.annotate({
                                    externallyRouted: true,
                                    internal: true
                                })[Eventer.getListenMethodName(method)](localCommEvt, (...args) => {
                                    this[method].apply(this, ([ l.commEvent ]).concat(args));
                                });
                            }
                            var alreadyListed = _.any(availableListeners, (l) => {
                                return CommEvent.equal(l.commEvent, localCommEvt);
                            });
                            if (!alreadyListed && (isLocal || isNotServiceEvent)) {
                                var smap = l.annotation.smap;
                                if (_.isUndefined(smap)) {
                                    smap = [];
                                }
                                if (smap.length === 0 || smap[smap.length - 1] !== this.whoService.name) {
                                    smap.push(this.whoService.name);
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
                ], (e) => {
                    if (e !== null) {
                        cb(e);
                    }
                });
                next(args);
            }
        });
        this.annotate({
            internal: true
        }).ack('init-external-service-connections', (cb) => {
            this.annotate({
                log:{
                    level:1000
                }
            }).confirm('iw-connector.connect-to-external-services', (e) => {
                cb(e);
            });
        });
        super.init(cb);
        return this;
    }

    public postStart(deps, cb): IWorker {
        this.beatHeart();
        super.postStart(deps, cb);
        return this;
    }

    private beatHeart() {
        this.heartbeat = setTimeout(() => {
            this.ask<IServiceListener[]>('iw-service.list-listeners', (e, listeners) => {
                this.annotate({
                    log:{
                        level:1000
                    }
                }).inform<IHiveHeartbeat>('heartbeat', {
                    availableListeners: listeners
                });
                this.beatHeart();
            });
        }, this.heartbeatFreq);
    }

    public dispose(cb?) {
        clearTimeout(this.heartbeat);
        super.dispose(cb);
    }
}

export = HiveWorker;
