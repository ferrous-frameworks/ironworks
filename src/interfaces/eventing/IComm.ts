
import IronBeam = require('iron-beam');
import IInterceptors = IronBeam.IInterceptors;

import ICommEventData = require('./ICommEventData');
import ICommListener = require('./ICommListener');
import IEventer = require('./IEventer');
import IEventData = require('./IEventData');
import IEmitData = require('./IEmitData');
import IEmit = require('./IEmit');

interface IComm extends IEventer {
    prefix(): string;
    hasListener(event: ICommEventData|string, method?: string): boolean;
    allCommListeners(): ICommListener[];

    listen(
        event: IEventData|string,
        listener:
            (anno?: any, emit?: IEmit) => void
    ): IComm;

    info<infoType>(
        event: IEventData|string,
        listener:
            (info: infoType, anno?: any, emit?: IEmit) => void
    ): IComm;

    ack(
        event: IEventData|string,
        listener:
            (callback: (e: Error) => void, anno?: any, emit?: IEmit) => void
    ): IComm;

    verify<checkType>(
        event: IEventData|string,
        listener:
            (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: IEmit) => void
    ): IComm;

    answer<answerType>(
        event: IEventData|string,
        listener:
            (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: IEmit) => void
    ): IComm;

    respond<requestType, responseType>(
        event: IEventData|string,
        listener:
            (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: IEmit) => void
    ): IComm;

    setMaxListeners(max: number): IComm;
    annotate(anno: any): IComm;
    on(event: ICommEventData|string, method: Function): IComm;
    addListener(event: ICommEventData|string, method: Function): IComm;
    once(event: ICommEventData|string, method: Function): IComm;
    removeListener(event: ICommEventData|string, method: Function): IComm;
    removeAnnotatedListeners(event: ICommEventData|string, anno?: any): IComm;
    removeAllListeners(event?: ICommEventData|string): IComm;
    removeAllAnnotatedListeners(anno?: any, event?: ICommEventData|string): IComm;
    onlyOnce(): IComm;

    intercept(event: ICommEventData|string, interceptors: IInterceptors): IComm;


    dispose(callback?: () => void);
}

export = IComm;
