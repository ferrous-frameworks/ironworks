
import IWorker = require('./IWorker');

import IWho = require('../whoIAm/IWho');

interface IDependency<T extends IWorker> extends IWho {
    value?: T;
}

export = IDependency;
