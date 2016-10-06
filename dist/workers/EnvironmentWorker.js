"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var async = require('async');
var idHelper = require('../helpers/idHelper');
var Worker = require('../workers/Worker');
var EnvironmentWorker = (function (_super) {
    __extends(EnvironmentWorker, _super);
    function EnvironmentWorker(name, opts) {
        _super.call(this, [], {
            id: idHelper.newId(),
            name: 'iw-env' + (_.isUndefined(name) || name.length === 0 ? '' : '-' + name)
        }, opts);
        var defOpts = {};
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        this.genericConnections = this.opts.get('genericConnections');
        this.genericConnections = _.isUndefined(this.genericConnections) ? [] : _.toArray(this.genericConnections);
        this.environmentObject = this.opts.get('environmentObject');
        this.environmentObject = _.isUndefined(this.environmentObject) ? process.env : _.merge(this.environmentObject, process.env);
        var serviceConnections = this.opts.get('serviceConnections');
        if (!_.isUndefined(serviceConnections)) {
            this.serviceConnections = _.map(serviceConnections, function (srvConn) {
                var conn = _.merge(srvConn, {
                    url: EnvironmentWorker.getServiceConnectionUrl(srvConn)
                });
                return conn;
            });
        }
    }
    EnvironmentWorker.prototype.init = function (cb) {
        var _this = this;
        this.annotate({
            internal: true,
            log: {
                level: 1000
            }
        }).answer('list-service-connections', function (cb) {
            cb(null, _this.serviceConnections);
        });
        this.annotate({
            internal: true,
            log: {
                level: 1000
            }
        }).answer('list-generic-connections', function (cb) {
            cb(null, _this.genericConnections);
        });
        this.annotate({
            internal: true,
            log: {
                level: 1000
            }
        }).respond('env-var', function (req, cb) {
            cb(null, _.get(_this.environmentObject, req));
        });
        _super.prototype.init.call(this, cb);
        return this;
    };
    EnvironmentWorker.getServiceConnectionUrl = function (srvConn) {
        return srvConn.protocol + '://' + srvConn.host + ':' + srvConn.port + '/';
    };
    return EnvironmentWorker;
}(Worker));
module.exports = EnvironmentWorker;
//# sourceMappingURL=EnvironmentWorker.js.map