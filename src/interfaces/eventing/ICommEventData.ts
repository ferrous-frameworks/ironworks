
import IEventData = require('./IEventData');

interface ICommEventData extends IEventData {
    prefix: string;
    service: string;
    method: string;
    worker: string;
}

export = ICommEventData;
