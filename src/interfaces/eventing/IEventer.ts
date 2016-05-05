
import IronBeam = require('iron-beam');
import IEventEmitter = IronBeam.IEventEmitter;
import IInterceptors = IronBeam.IInterceptors;

import IEventData = require('./IEventData');
import IEmitData = require('./IEmitData');
import IEmit = require('./IEmit');

interface IEventer extends IEventEmitter {
    tell(
        event: IEmitData|string,
        anno?: any
    ): boolean;

    inform<infoType>(
        event: IEmitData|string,
        info: infoType,
        anno?: any
    ): boolean;

    confirm(
        event: IEmitData|string,
        callback: (e: Error, anno?: any) => void,
        anno?: any
    ): boolean;

    check<checkType>(
        event: IEmitData|string,
        toCheck: checkType,
        callback: (e: Error, anno?: any) => void,
        anno?: any
    ): boolean;

    ask<answerType>(
        event: IEmitData|string,
        callback: (e: Error, answer?: answerType, anno?: any) => void,
        anno?: any
    ): boolean;

    request<requestType, responseType>(
        event: IEmitData|string,
        request: requestType,
        callback: (e: Error, response?: responseType, anno?: any) => void,
        anno?: any
    ): boolean;


    listen(
        event: IEventData|string,
        listener:
            (anno?: any, emit?: IEmit) => void
    ): IEventer;

    info<infoType>(
        event: IEventData|string,
        listener:
            (info: infoType, anno?: any, emit?: IEmit) => void
    ): IEventer;

    ack(
        event: IEventData|string,
        listener:
            (callback: (e: Error) => void, anno?: any, emit?: IEmit) => void
    ): IEventer;

    verify<checkType>(
        event: IEventData|string,
        listener:
            (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: IEmit) => void
    ): IEventer;

    answer<answerType>(
        event: IEventData|string,
        listener:
            (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: IEmit) => void
    ): IEventer;

    respond<requestType, responseType>(
        event: IEventData|string,
        listener:
            (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: IEmit) => void
    ): IEventer;


    onlyOnce(): IEventer;


    setMaxListeners(max: number): IEventer;
    annotate(anno: any): IEventer;
    on(event: IEventData|string, method: Function): IEventer;
    addListener(event: IEventData|string, method: Function): IEventer;
    once(event: IEventData|string, method: Function): IEventer;
    removeListener(event: IEventData|string, method: Function): IEventer;
    removeAnnotatedListeners(event: IEventData|string, anno?: any): IEventer;
    removeAllListeners(event?: IEventData|string): IEventer;
    removeAllAnnotatedListeners(anno?: any, event?: IEventData|string): IEventer;

    intercept(event: IEventData|string, interceptors: IInterceptors): IEventer;


    dispose(callback?: () => void);
}

export = IEventer;
