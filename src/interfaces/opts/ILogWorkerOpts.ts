
import IWorkerChildOpts = require('./IWorkerChildOpts');

interface ILogWorkerOpts extends IWorkerChildOpts {
    stdout?: Function;
    stderr?: Function;
    level?: number;
    defaultLevel?: number;
}

export = ILogWorkerOpts;
