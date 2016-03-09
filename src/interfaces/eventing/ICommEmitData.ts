
import IEmitData = require('./IEmitData');
import ICommEventData = require('./ICommEventData');
import IAm = require('../whoIAm/IAm');

interface ICommEmitData extends IEmitData, ICommEventData {
    scoc?: IAm[];
}

export = ICommEmitData;
