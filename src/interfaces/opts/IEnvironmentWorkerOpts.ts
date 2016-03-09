
import IWorkerChildOpts = require('./IWorkerChildOpts');
import IServiceConnection = require('../workers/IServiceConnection');

interface IEnvironmentWorkerOpts extends IWorkerChildOpts {
    serviceConnections?: IServiceConnection[];
    genericConnections?: IServiceConnection[];
    environmentObject?: any;
}

export = IEnvironmentWorkerOpts;
