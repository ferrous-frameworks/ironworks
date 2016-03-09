
import ICommEmit = require('../eventing/ICommEmit');

interface IMetricIncrement {
    emit: ICommEmit;
    metricWorkerName: string;
}

export = IMetricIncrement;
