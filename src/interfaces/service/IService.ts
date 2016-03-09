
import IWhoQuery = require('../whoIAm/IWhoQuery');
import IAm = require('../whoIAm/IAm');
import ICollection = require('../collection/ICollection');
import IComm = require('../eventing/IComm');
import ICommEventData = require('../eventing/ICommEventData');
import ICommEmitData = require('../eventing/ICommEmitData');
import ICommEmit = require('../eventing/ICommEmit');

import IWorker = require('../workers/IWorker');

interface IService extends IWorker {
    comm: IComm;

    use(worker: IWorker): IService;
    get(workerQuery: IWhoQuery, callback: (e: Error, results: ICollection<IWorker>) => void): IService;
    getWorker(name: string, callback: (e: Error, worker?: IWorker) => void);

    preInit(comm: IComm, whoService: IAm, callback?: (e: Error) => void): IService;
    init(callback?: (e: Error) => void): IService;
    preStart(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IService;
    start(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IService;
    postStart(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IService;

    tell(
        event: ICommEmitData|string
    ): boolean;

    inform<infoType>(
        event: ICommEmitData|string,
        info: infoType
    ): boolean;

    confirm(
        event: ICommEmitData|string,
        callback: (e: Error, anno?: any) => void
    ): boolean;

    check<checkType>(
        event: ICommEmitData|string,
        toCheck: checkType,
        callback: (e: Error, anno?: any) => void
    ): boolean;

    ask<answerType>(
        event: ICommEmitData|string,
        callback: (e: Error, answer?: answerType, anno?: any) => void
    ): boolean;

    request<requestType, responseType>(
        event: ICommEmitData|string,
        request: requestType,
        callback: (e: Error, response?: responseType, anno?: any) => void
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
}

export = IService;
