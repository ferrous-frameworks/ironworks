import path = require('path');

import _ = require('lodash');
import async = require('async');
import io = require('socket.io');

var ioWildcard = require('socketio-wildcard')();

import ICommEmit = require('../interfaces/eventing/ICommEmit');
import CommEmit = require('../eventing/CommEmit');
import CommEvent = require('../eventing/CommEvent');
import IComm = require('../interfaces/eventing/IComm');
import Comm = require('../eventing/Comm');
import idHelper = require('../helpers/idHelper');
import IAm = require('../interfaces/whoIAm/IAm');
import Options = require('../opts/Options');
import ICommEvent = require('../interfaces/eventing/ICommEvent');
import ICommEmitData = require('../interfaces/eventing/ICommEmitData');
import ICollection = require('../interfaces/collection/ICollection');
import IWorker = require('../interfaces/workers/IWorker');
import IHttpServerWorker = require('../interfaces/workers/IHttpServerWorker');
import IBroadcast = require('../interfaces/eventing/IBroadcast');
import ITokenAuthentication = require('../interfaces/auth/ITokenAuthentication');

import Worker = require('../workers/Worker');

import ISocketWorker = require('../interfaces/workers/ISocketWorker');
import ISocketWorkerOpts = require('../interfaces/opts/ISocketWorkerOpts');

class SocketWorker extends Worker implements ISocketWorker {
    public socketServer: any;

    constructor(opts?: ISocketWorkerOpts) {
        super([
            'iw-http-server'
        ], {
            id: idHelper.newId(),
            name: 'iw-socket'
        }, opts);

        var defOpts: ISocketWorkerOpts = {};
        this.opts = this.opts.beAdoptedBy<ISocketWorkerOpts>(defOpts, 'worker');
        this.opts.merge(opts);
    }

    public postInit(dependencies: ICollection<IWorker>, callback?: (e: Error) => void): IWorker {
        this.socketServer = io((<IHttpServerWorker> dependencies.list()[0]).httpServer.listener);
        this.socketServer.use(ioWildcard);
        this.socketServer.on('connection', (socket) => {
            this.monitorSocket(socket);
        });
        super.postInit(dependencies, callback);
        return this;
    }

    private monitorSocket(socket) {
        socket.on('error', (e) => {
            this.inform('error', e);
        });
        socket.on('*', (event: any) => {
            event.data.shift();
            var emit = this.getCommEmit(event.data.shift());
            emit.scoc.push(this.whoService);
            var anno = event.data.shift();
            if (_.isUndefined(anno) || anno === null) {
                anno = {};
            }
            if (!_.isUndefined(socket.iwAuth)) {
                _.set(anno, 'auth.authentication.authenticated', socket.iwAuth.authentication.authenticated);
                if (!_.isUndefined(socket.iwAuth.authorization)) {
                    var authorizationAnno = <any[]>_.get(anno, 'auth.authorization');
                    if (_.isUndefined(authorizationAnno)) {
                        authorizationAnno = [];
                    }
                    else if (_.isObject(authorizationAnno)) {
                        authorizationAnno = [ authorizationAnno ];
                    }
                    var match = _.remove(authorizationAnno, (authorization) => {
                        return authorization.type === socket.iwAuth.authorization.type;
                    });
                    if (_.isUndefined(match)) {
                        authorizationAnno.push(socket.iwAuth.authorization);
                    }
                    authorizationAnno.push(socket.iwAuth.authorization);
                    _.set(anno, 'auth.authorization', authorizationAnno);
                }
            }
            var cb = void 0;
            if (emit.method != 'tell' && emit.method != 'inform') {
                cb = event.data.pop();
            }
            event.data.push((...args) => {
                if (args[0] != null) {
                    var errorObj = <any>{
                        message: args[0].message
                    };
                    if (!_.isUndefined(args[0].code)) {
                        errorObj.code = args[0].code;
                    }
                    args[0] = errorObj;
                }
                if (_.isFunction(cb)) {
                    cb.apply(this, args);
                }
            });
            event.data.push(anno);
            this[emit.method].apply(this, [ emit ].concat(event.data));
        });
    }

    public dispose(callback?: () => void) {
        if (!_.isUndefined(this.socketServer)) {
            this.socketServer.close();
        }
        if (!_.isUndefined(callback)) {
            process.nextTick(() => {
                callback();
            });
        }
    }
}

export = SocketWorker;
