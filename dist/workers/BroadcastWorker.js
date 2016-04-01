"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var idHelper = require('../helpers/idHelper');
var Worker = require('../workers/Worker');
var BroadcastWorker = (function (_super) {
    __extends(BroadcastWorker, _super);
    function BroadcastWorker(opts) {
        _super.call(this, [], {
            id: idHelper.newId(),
            name: 'iw-broadcast'
        }, opts);
        var defOpts = {};
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
    }
    BroadcastWorker.prototype.init = function (callback) {
        var _this = this;
        this.info('broadcast', function (broadcast) {
            _this.broadcast(broadcast);
        });
        _super.prototype.init.call(this, callback);
        return this;
    };
    BroadcastWorker.prototype.broadcast = function (broadcast) {
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
    };
    return BroadcastWorker;
}(Worker));
module.exports = BroadcastWorker;
//# sourceMappingURL=BroadcastWorker.js.map