
import IAm = require('../interfaces/whoIAm/IAm');

import IEmit = require('../interfaces/eventing/IEmit');
import IEmitData = require('../interfaces/eventing/IEmitData');

import Event = require('./Event');

class Emit extends Event implements IEmit {
    timestamp: number;
    id: string;
    emitter: IAm;

    constructor(data: IEmitData) {
        super(data);
        this.id = data.id;
        this.emitter = data.emitter;
        this.timestamp = new Date().getTime();
    }
}

export = Emit;
