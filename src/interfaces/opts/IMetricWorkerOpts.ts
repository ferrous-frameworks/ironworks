
import IWorkerChildOpts = require('./IWorkerChildOpts');

interface IMetricWorkerOpts extends IWorkerChildOpts {
    ignored?: string[]
}

export = IMetricWorkerOpts;
