
import IEventData = require('./IEventData');

interface IEvent extends IEventData {
    getText(): string;
    equal(event: IEvent): boolean;
}

export = IEvent;
