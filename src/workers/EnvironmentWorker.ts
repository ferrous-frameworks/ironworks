
var _ = require('lodash');
var async = require('async');

import idHelper = require('../helpers/idHelper');

import Worker = require('../workers/Worker');
import IWorker = require('../interfaces/workers/IWorker');
import IEnvironmentWorkerOpts = require('../interfaces/opts/IEnvironmentWorkerOpts');
import IServiceConnection = require('../interfaces/workers/IServiceConnection');
import IGenericConnection = require('../interfaces/workers/IGenericConnection');

class EnvironmentWorker extends Worker implements IWorker {
    protected serviceConnections: IServiceConnection[];
    protected genericConnections: IGenericConnection[];
    protected environmentObject: any;

    constructor(name?: string, opts?: IEnvironmentWorkerOpts) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-env' + (_.isUndefined(name) || name.length === 0 ? '' : '-' + name)
        }, opts);
        var defOpts = {};
        this.opts = this.opts.beAdoptedBy<IEnvironmentWorkerOpts>(defOpts, 'worker');
        this.opts.merge(opts);
        this.genericConnections = this.opts.get<IGenericConnection[]>('genericConnections');
        this.genericConnections = _.isUndefined(this.genericConnections) ? [] : _.toArray(this.genericConnections);
        this.environmentObject = this.opts.get('environmentObject');
        this.environmentObject = _.isUndefined(this.environmentObject) ? process.env : this.environmentObject;
        var serviceConnections = this.opts.get<IServiceConnection[]>('serviceConnections');
        if (!_.isUndefined(serviceConnections)) {
            this.serviceConnections = _.map(serviceConnections, (srvConn: IServiceConnection) => {
                var conn: IServiceConnection = {
                    name: srvConn.name,
                    protocol: srvConn.protocol,
                    host: srvConn.host,
                    port: srvConn.port,
                    endPoints: srvConn.endPoints,
                    token: srvConn.token,
                    url: EnvironmentWorker.getServiceConnectionUrl(srvConn)
                };
                return conn;
            });
        }
    }

    public init(cb: (e: Error) => void): IWorker {
        this.annotate({
            internal: true,
            log:{
                level:1000
            }
        }).answer<IServiceConnection[]>('list-service-connections', (cb) => {
            cb(null, this.serviceConnections);
        });
        this.annotate({
            internal: true,
            log:{
                level:1000
            }
        }).answer<IGenericConnection[]>('list-generic-connections', (cb) => {
            cb(null, this.genericConnections);
        });
        this.annotate({
            internal: true,
            log:{
                level:1000
            }
        }).respond<string, string>('env-var', (req, cb) => {
            cb(null, _.get(this.environmentObject, req));
        });
        super.init(cb);
        return this;
    }

    public static getServiceConnectionUrl(srvConn: IServiceConnection): string {
        return srvConn.protocol + '://' + srvConn.host + ':' + srvConn.port + '/';
    }
}

export = EnvironmentWorker;
