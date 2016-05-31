
import ICommEmit = require('../eventing/ICommEmit');

import IWorker = require('./IWorker');

interface ISocketWorker extends IWorker {
    socketServer: SocketIO.Server;
}

export = ISocketWorker;
