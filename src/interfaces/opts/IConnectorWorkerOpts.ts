
import IWorkerChildOpts = require('./IWorkerChildOpts');

interface IConnectorWorkerOpts extends IWorkerChildOpts {
    clientConnectionEventsLogLevel?: number;
    socketIoClient?: any
}

export = IConnectorWorkerOpts;
