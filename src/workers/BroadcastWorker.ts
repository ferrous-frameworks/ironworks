
import _ = require('lodash');

import idHelper = require('../helpers/idHelper');

import Worker = require('../workers/Worker');
import IBroadcastWorkerOpts = require('../interfaces/opts/IBroadcastWorkerOpts');
import ICollection = require('../interfaces/collection/ICollection');
import IWorker = require('../interfaces/workers/IWorker');
import IComm = require('../interfaces/eventing/IComm');
import IAm = require('../interfaces/whoIAm/IAm');
import ICommEmit = require('../interfaces/eventing/ICommEmit');
import CommEmit = require('../eventing/CommEmit');
import IBroadcast = require('../interfaces/eventing/IBroadcast');

class BroadcastWorker extends Worker implements IWorker {
    constructor(opts?: IBroadcastWorkerOpts) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-broadcast'
        }, opts);
        var defOpts: IBroadcastWorkerOpts = {};
        this.opts = this.opts.beAdoptedBy<IBroadcastWorkerOpts>(defOpts, 'worker');
        this.opts.merge(opts);
    }

    public init(callback?: (e: Error) => void): IWorker {
        this.info<IBroadcast>('broadcast', (broadcast) => {
            this.broadcast(broadcast);
        });
        super.init(callback);
        return this;
    }

    private broadcast(broadcast: IBroadcast) {
        var instance = this;
        //this.ask<IRunningWorkerInfo[]>('iw-service.list-running-workers', (e: Error, workers) => {
        //    var internal = !_.isUndefined(broadcast.internal) && broadcast.internal;
        //    var specificWorker = !_.isUndefined(broadcast.onlyToWorker);
        //    var cfClientRunning = _.contains(_.pluck(workers, 'name'), 'iw-cf-client');
        //    var emit: ICommEmit = new CommEmit({
        //        id: broadcast.id,
        //        emitter : broadcast.emitter,
        //        emitterService: this.whoService,
        //        timestamp: broadcast.timestamp,
        //        prefix: instance.comm.prefix(),
        //        service: void 0,
        //        method: 'inform',
        //        worker: void 0,
        //        name: broadcast.name
        //    });
        //    if (internal) {
        //        emit.service = instance.whoService.name;
        //        _.each<IAm>(workers, (w) => {
        //            emit.worker = w.name;
        //            if (w.name !== instance.me.name && (!specificWorker || broadcast.onlyToWorker === w.name)) {
        //                instance.inform(emit, broadcast.info);
        //            }
        //        });
        //    }
        //    else if (cfClientRunning) {
        //        instance.ask<ICfClient[]>('iw-cf-client.list-user-provided-services', (e: Error, services) => {
        //            emit.worker = 'iw-service';
        //            _.each<ICfClient>(services, (s: ICfClient) => {
        //                emit.service = s.serviceName;
        //                emit.name = 'broadcast';
        //                instance.inform<IBroadcast>(emit, broadcast);
        //            });
        //        });
        //    }
        //    else {
        //        instance.inform<string>('warning', 'Unable to broadcast externally because there is no CfClientWorker running');
        //    }
        //});
    }
}

export = BroadcastWorker;
