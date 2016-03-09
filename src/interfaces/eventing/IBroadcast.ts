
import IEmitData = require('./IEmitData');

interface IBroadcast extends IEmitData {
    internal?: boolean;
    onlyToWorker?: string;
    name: string;
    info: any;
}

export = IBroadcast;
