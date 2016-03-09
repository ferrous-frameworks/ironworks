
import IAm = require('../interfaces/whoIAm/IAm');

import CommEvent = require('./CommEvent');

import ICommEmit = require('../interfaces/eventing/ICommEmit');
import ICommEmitData = require('../interfaces/eventing/ICommEmitData');

class CommEmit extends CommEvent implements ICommEmit {
    public timestamp: number;
    public id: string;
    public emitter: IAm;
    public scoc: IAm[];

    constructor(data: ICommEmitData) {
        super(data);
        this.id = data.id;
        this.emitter = data.emitter;
        this.timestamp = new Date().getTime();
        this.scoc = data.scoc;
    }
}

export = CommEmit;
