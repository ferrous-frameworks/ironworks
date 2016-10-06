
import IronBeam = require('iron-beam');
import IInterceptors = IronBeam.IInterceptors;

import IWho = require('../whoIAm/IWho');
import IAmVersioned = require('../whoIAm/IAmVersioned');
import IComm = require('../eventing/IComm');
import ICollection = require('../collection/ICollection');
import ICommListener = require('../eventing/ICommListener');
import ICommEventData = require('../eventing/ICommEventData');
import ICommEmitData = require('../eventing/ICommEmitData');
import ICommEvent = require('../eventing/ICommEvent');
import ICommEmit = require('../eventing/ICommEmit');
import IDependencyDefinition = require('../workers/IDependencyDefinition');

import IEventer = require('../eventing/IEventer');

interface IWorker extends IWho, IEventer {
    whoService: IAmVersioned;
    inited: boolean;
    postInited: boolean;
    preStarted: boolean;
    started: boolean;
    postStarted: boolean;

    preInit(comm: IComm, whoService: IAmVersioned, callback?: (e: Error) => void): IWorker;
    init(callback?: (e: Error) => void): IWorker;
    postInit(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IWorker;
    preStart(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IWorker;
    start(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IWorker;
    postStart(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IWorker;

    getDependencyDefs(): IDependencyDefinition[];

    hasListener(event: ICommEventData|string, method?: string): boolean;
    allCommListeners(): ICommListener[];
    getCommEvent(event: ICommEventData|string, method?: string): ICommEvent;
    getCommEmit(event: ICommEventData|ICommEmitData|string, method?: string): ICommEmit;

    addDependency(name: string, optional: boolean);

    tell(
        event: ICommEmitData|string,
        anno?: any
    ): boolean;

    inform<infoType>(
        event: ICommEmitData|string,
        info: infoType,
        anno?: any
    ): boolean;

    confirm(
        event: ICommEmitData|string,
        callback: (e: Error, anno?: any) => void,
        anno?: any
    ): boolean;

    check<checkType>(
        event: ICommEmitData|string,
        toCheck: checkType,
        callback: (e: Error, anno?: any) => void,
        anno?: any
    ): boolean;

    ask<answerType>(
        event: ICommEmitData|string,
        callback: (e: Error, answer?: answerType, anno?: any) => void,
        anno?: any
    ): boolean;

    request<requestType, responseType>(
        event: ICommEmitData|string,
        request: requestType,
        callback: (e: Error, response?: responseType, anno?: any) => void,
        anno?: any
    ): boolean;

    listen(
        event: ICommEventData|string,
        listener:
            (anno?: any, emit?: ICommEmit) => void
    ): IWorker;

    info<infoType>(
        event: ICommEventData|string,
        listener:
            (info: infoType, anno?: any, emit?: ICommEmit) => void
    ): IWorker;

    ack(
        event: ICommEventData|string,
        listener:
            (callback: (e: Error) => void, anno?: any, emit?: ICommEmit) => void
    ): IWorker;

    verify<checkType>(
        event: ICommEventData|string,
        listener:
            (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: ICommEmit) => void
    ): IWorker;

    answer<answerType>(
        event: ICommEventData|string,
        listener:
            (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: ICommEmit) => void
    ): IWorker;

    respond<requestType, responseType>(
        event: ICommEventData|string,
        listener:
            (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: ICommEmit) => void
    ): IWorker;

    onlyOnce(): IWorker;

    setMaxListeners(max: number): IWorker;
    annotate(anno: any): IWorker;
    on(event: ICommEventData|string, method: Function): IWorker;
    addListener(event: ICommEventData|string, method: Function): IWorker;
    once(event: ICommEventData|string, method: Function): IWorker;
    removeListener(event: ICommEventData|string, method: Function): IWorker;
    removeAnnotatedListeners(event: ICommEventData|string, anno?: any): IWorker;
    removeAllListeners(event?: ICommEventData|string): IWorker;
    removeAllAnnotatedListeners(anno?: any, event?: ICommEventData|string): IWorker;

    intercept(event: ICommEventData|string, interceptors: IInterceptors): IWorker;
}

export = IWorker;
