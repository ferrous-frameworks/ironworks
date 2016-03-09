
import ICommEventData = require('./ICommEventData');
import IEvent = require('./IEvent');

interface ICommEvent extends ICommEventData, IEvent {}

export = ICommEvent;
