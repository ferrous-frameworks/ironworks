///<reference path="../../typings/tsd/socket.io/socket.io.d.ts"/>

import ICommEmit = require('../eventing/ICommEmit');

import IWorker = require('./IWorker');

interface ISocketWorker extends IWorker {
    socketServer: SocketIO.Server;
}

export = ISocketWorker;