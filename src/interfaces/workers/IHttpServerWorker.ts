///<reference path="../../typings/tsd/hapi/hapi.d.ts"/>
import hapi = require('hapi');

import ICommEmit = require('../eventing/ICommEmit');
import IAm = require('../whoIAm/IAm');

import IWorker = require('./IWorker');

interface IHttpServerWorker extends IWorker {
    getCommEmitFromRequest(eventArray: string[], who?: IAm): ICommEmit;
    handleApiReq:(emit: ICommEmit, req: hapi.Request, reply: hapi.IReply, input: any, cb: (e: Error, ...args) => void) => void;
    apiRoute: string;
    httpServer: hapi.Server;
}

export = IHttpServerWorker;