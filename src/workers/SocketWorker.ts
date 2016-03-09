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
    private unauthenticatedSockets: any[];
    private secure: boolean;

    public socketServer: any;

    constructor(opts?: ISocketWorkerOpts) {
        super([
            'iw-http-server'
        ], {
            id: idHelper.newId(),
            name: 'iw-socket'
        }, opts);

        var defOpts: ISocketWorkerOpts = {
            secure: false
        };
        this.opts = this.opts.beAdoptedBy<ISocketWorkerOpts>(defOpts, 'worker');
        this.opts.merge(opts);

        this.secure = this.opts.get<boolean>('secure');
        this.unauthenticatedSockets = [];
    }

    public init(cb): IWorker {
        this.annotate({
            internal: true
        }).ack('secure', (cb) => {
            this.secure = true;
            cb(null);
        });
        return super.init(cb);
    }

    public postInit(dependencies: ICollection<IWorker>, callback?: (e: Error) => void): IWorker {
        this.socketServer = io((<IHttpServerWorker> dependencies.list()[0]).httpServer.listener);
        this.socketServer.use(ioWildcard);
        this.socketServer.on('connection', (socket) => {
            socket.on('disconnect', () => {
                this.removeUnauthenticatedSocket(socket.id);
            });
            if (this.secure) {
                this.unauthenticatedSockets.push(socket);
                this.watchForAuthentication(socket);
            }
            else {
                this.monitorSocket(socket);
            }
        });
        super.postInit(dependencies, callback);
        return this;
    }

    private watchForAuthentication(socket) {
        async.whilst(() => {
            if (!_.contains(_.pluck(this.unauthenticatedSockets, 'id'), socket.id)) {
                return false;
            }
            if (_.isUndefined(socket.authentication)) {
                return true;
            }
            return !socket.authentication.authenticated && !socket.authentication.timeout;
        }, (cb) => {
            setImmediate(() => {
                cb(null);
            });
        }, (e) => {
            if (e === null) {
                if (_.contains(_.pluck(this.unauthenticatedSockets, 'id'), socket.id)) {
                    this.monitorSocket(socket);
                }
            }
            else {
                this.inform<Error>('error', e);
            }
            this.removeUnauthenticatedSocket(socket.id);
        });
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
            event.data.push(anno);
            var cb = void 0;
            var callCb = _.any([
                'tell',
                'inform'
            ], (m) => {
                return emit.method === m;
            });
            if (callCb) {
                cb = event.data.pop();
            }
            if (this.secure) {
                _.merge(anno, {
                    auth: {
                        authentication: {
                            interservice: socket.authentication.interservice
                        }
                    }
                });
            }
            this[emit.method].apply(this, [ emit ].concat(event.data));
            if (callCb) {
                cb();
            }
        });
    }

    private removeUnauthenticatedSocket(id) {
        var removed = void 0;
        this.unauthenticatedSockets = _.filter(this.unauthenticatedSockets, (socket) => {
            var toRemove = id === socket.id;
            if (toRemove) {
                removed = socket;
            }
            return !toRemove;
        });
        return removed;
    }

    public dispose(callback?: () => void) {
        if (!_.isUndefined(this.socketServer)) {
            this.socketServer.close();
        }
        _.each(this.unauthenticatedSockets, (socket) => {
            socket.disconnect(true);
        });
        if (!_.isUndefined(callback)) {
            process.nextTick(() => {
                callback();
            });
        }
    }
}

export = SocketWorker;
