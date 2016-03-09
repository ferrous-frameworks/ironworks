
import IAm = require('../whoIAm/IAm');

import IEventData = require('./IEventData');

interface IEmitData extends IEventData {
    id: string;
    emitter: IAm;
    timestamp: number;
}

export = IEmitData;
