
///<reference path='../typings/master.d.ts' />

import _ = require('lodash');

import Event = require('./Event');

import ICommEvent = require('../interfaces/eventing/ICommEvent');
import ICommEventData = require('../interfaces/eventing/ICommEventData');

class CommEvent extends Event implements ICommEvent {
    prefix: string;
    service: string;
    method: string;
    worker: string;

    constructor(event: ICommEventData|string) {
        var evt: ICommEventData;
        if (typeof event === 'string') {
            evt = {
                prefix: void 0,
                service: void 0,
                method: void 0,
                worker: void 0,
                name: event
            };
        }
        else {
            evt = <ICommEventData>event;
        }
        var split = evt.name.split('.').reverse();
        evt.prefix = _.isUndefined(split[4]) ? evt.prefix : split[4];
        evt.service = _.isUndefined(split[3]) ? evt.service : split[3];
        evt.method = _.isUndefined(split[2]) ? evt.method : split[2];
        evt.worker = _.isUndefined(split[1]) ? evt.worker : split[1];
        evt.name = _.isUndefined(split[0]) ? evt.name : split[0];
        super(evt);
        this.prefix = evt.prefix;
        this.service = evt.service;
        this.method = evt.method;
        this.worker = evt.worker;
    }

    public getText(): string {
        return _.compact([
            this.prefix,
            this.service,
            this.method,
            this.worker,
            this.name
        ]).join('.');
    }

    public equal(event: ICommEvent): boolean {
        return CommEvent.equal(this, event);
    }
    
    public static equal(evt1: ICommEventData, evt2: ICommEventData): boolean {
        var prefixMatch = evt1.prefix === '*' || evt2.prefix === '*' || evt1.prefix === evt2.prefix;
        var serviceMatch = evt1.service === '*' || evt2.service === '*' || evt1.service === evt2.service;
        var methodMatch = evt1.method === '*' || evt2.method === '*' || evt1.method === evt2.method;
        var workerMatch = evt1.worker === '*' || evt2.worker === '*' || evt1.worker === evt2.worker;
        var nameMatch = evt1.name === '*' || evt2.name === '*' || evt1.name === evt2.name;
        return prefixMatch && serviceMatch && methodMatch && workerMatch && nameMatch;
    }
}

export = CommEvent;
