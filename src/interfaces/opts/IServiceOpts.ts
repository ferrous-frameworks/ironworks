
import IWorkerOpts = require('./IWorkerOpts');
import ICommOpts = require('./ICommOpts');

interface IServiceOpts {
    version?: string;
    dependencyCheckTimeout?: number;
    dependencyCheckFrequency?: number;
    readyEventLogLevel?: number;
    availableListenersEventLogLevel?: number;
    listListeners?: {
        ignoreWorkerNames?: string[];
        autoAnnotateInternalEmitNames?: string[];
    }
}

export = IServiceOpts;
