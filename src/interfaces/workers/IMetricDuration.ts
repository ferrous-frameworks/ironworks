
import IEmitDuration = require('../eventing/IEmitDuration');

interface IMetricDuration extends IEmitDuration {
    metricWorkerName: string;
}

export = IMetricDuration;
