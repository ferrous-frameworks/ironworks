"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var idHelper = require('../helpers/idHelper');
var Worker = require('./Worker');
var MetricWorker = (function (_super) {
    __extends(MetricWorker, _super);
    function MetricWorker(name, opts) {
        _super.call(this, [], {
            id: idHelper.newId(),
            name: 'iw-metric' + (_.isUndefined(name) || name.length === 0 ? '' : '-' + name)
        }, opts);
        this.ignoredStrings = _.isUndefined(opts) ? void 0 : opts.ignored;
        var defOpts = {};
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        this.interceptions = [];
        this.ignored = [];
    }
    MetricWorker.prototype.init = function (cb) {
        var _this = this;
        if (_.isUndefined(this.ignoredStrings)) {
            this.ignoredStrings = [];
        }
        this.ignored = _.map(this.ignoredStrings, function (ignore) {
            return _this.getCommEvent(ignore);
        });
        this.comm.intercept(this.comm.prefix() + '.*.*.*.*', {
            preEmit: function (stop, next, anno) {
                var args = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    args[_i - 3] = arguments[_i];
                }
                var emit = _this.getCommEmit(args[0]);
                if (_this.shouldIntercept(emit)) {
                    _this.interceptions.push({
                        eventId: emit.id,
                        timestamp: emit.timestamp
                    });
                    _this.annotate({
                        log: {
                            level: 1000
                        }
                    }).inform('increment', {
                        emit: emit,
                        metricWorkerName: _this.me.name
                    });
                }
                next(args);
            },
            postEmit: function (stop, next, anno) {
                var args = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    args[_i - 3] = arguments[_i];
                }
                var emit = _this.getCommEmit(args[0]);
                if (_this.shouldIntercept(emit)) {
                    _this.interceptions = _.filter(_this.interceptions, function (interception) {
                        var match = interception.eventId === emit.id;
                        if (match) {
                            _this.annotate({
                                log: {
                                    level: 1000
                                }
                            }).inform('duration', {
                                emit: emit,
                                metricWorkerName: _this.me.name,
                                duration: emit.timestamp - interception.timestamp
                            });
                        }
                        return !match;
                    });
                }
                next();
            }
        });
        _super.prototype.init.call(this, cb);
        return this;
    };
    MetricWorker.prototype.shouldIntercept = function (emit) {
        return emit.worker.indexOf('iw-metric') !== 0 && !_.contains(_.invoke(this.ignored, 'getText'), emit.getText());
    };
    return MetricWorker;
}(Worker));
module.exports = MetricWorker;
//# sourceMappingURL=MetricWorker.js.map