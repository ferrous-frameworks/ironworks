
import IWorkerChildOpts = require('./IWorkerChildOpts');

interface ISocketWorkerOpts extends IWorkerChildOpts {
    secure?: boolean;
}

export = ISocketWorkerOpts;
