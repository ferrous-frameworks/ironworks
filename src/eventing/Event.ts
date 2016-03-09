
import IEvent = require('../interfaces/eventing/IEvent');
import IEventData = require('../interfaces/eventing/IEventData');

class Event implements IEvent {
    name: string;

    constructor(data: IEventData) {
        this.name = data.name;
    }

    public getText(): string {
        return this.name;
    }
    public equal(event: IEvent): boolean {
        return this.name === event.name;
    }
}

export = Event;
