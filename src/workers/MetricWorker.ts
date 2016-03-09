import _ = require('lodash');

import idHelper = require('../helpers/idHelper');

import ICollection = require('../interfaces/collection/ICollection');
import Collection = require('../collection/Collection');
import IComm = require('../interfaces/eventing/IComm');
import IAm = require('../interfaces/whoIAm/IAm');
import IWorker = require('../interfaces/workers/IWorker');
import ICommEmit = require('../interfaces/eventing/ICommEmit');
import CommEvent = require('../eventing/CommEvent');
import ICommEvent = require('../interfaces/eventing/ICommEvent');
import IMetricDuration = require('../interfaces/workers/IMetricDuration');
import IMetricIncrement = require('../interfaces/workers/IMetricIncrement');

import IMetricWorkerOpts = require('../interfaces/opts/IMetricWorkerOpts');
import Worker = require('./Worker');

class MetricWorker extends Worker implements IWorker {
    private interceptions: {
        eventId: string;
        timestamp: number;
    }[];
    private ignoredStrings: string[];
    private ignored: ICommEvent[];

    constructor(name?: string, opts?: IMetricWorkerOpts) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-metric' + (_.isUndefined(name) || name.length === 0 ? '' : '-' + name)
        }, opts);

        this.ignoredStrings = _.isUndefined(opts) ? void 0 : opts.ignored;

        var defOpts: IMetricWorkerOpts = {};
        this.opts = this.opts.beAdoptedBy<IMetricWorkerOpts>(defOpts, 'worker');
        this.opts.merge(opts);

        this.interceptions = [];
        this.ignored = [];
    }

    public init(cb): IWorker {
        if (_.isUndefined(this.ignoredStrings)) {
            this.ignoredStrings = [];
        }
        this.ignored = _.map<string, ICommEvent>(this.ignoredStrings, (ignore) => {
            return this.getCommEvent(ignore);
        });

        this.comm.intercept(this.comm.prefix() + '.*.*.*.*', {
            preEmit: (stop, next, anno, ...args) => {
                var emit = this.getCommEmit(args[0]);
                if (this.shouldIntercept(emit)) {
                    this.interceptions.push({
                        eventId: emit.id,
                        timestamp: emit.timestamp
                    });
                    this.annotate({
                        log:{
                            level:1000
                        }
                    }).inform<IMetricIncrement>('increment', {
                        emit: emit,
                        metricWorkerName: this.me.name
                    });
                }
                next(args);
            },
            postEmit: (stop, next, anno, ...args) => {
                var emit = this.getCommEmit(args[0]);
                if (this.shouldIntercept(emit)) {
                    this.interceptions = _.filter(this.interceptions, (interception) => {
                        var match = interception.eventId === emit.id;
                        if (match) {
                            this.annotate({
                                log:{
                                    level:1000
                                }
                            }).inform<IMetricDuration>('duration', {
                                emit: emit,
                                metricWorkerName: this.me.name,
                                duration: emit.timestamp - interception.timestamp
                            });
                        }
                        return !match;
                    });
                }
                next();
            }
        });
        super.init(cb);
        return this;
    }

    private shouldIntercept(emit: ICommEmit): boolean {
        return emit.worker.indexOf('iw-metric') !== 0 && !_.contains(_.invoke(this.ignored, 'getText'), emit.getText());
    }
}

export = MetricWorker;
