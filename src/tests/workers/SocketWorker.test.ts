
import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

import ioClient = require('socket.io-client');
import request = require('request');

chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));

var ports = require('../test-ports.json');

import Service = require('../../service/Service');
import Comm = require('../../eventing/Comm');
import Worker = require('../../workers/Worker');
import HttpServerWorker = require('../../workers/HttpServerWorker');
import EnvironmentWorker = require('../../workers/EnvironmentWorker');
import ConnectorWorker = require('../../workers/ConnectorWorker');
import HiveWorker = require('../../workers/HiveWorker');

import SocketWorker = require('../../workers/SocketWorker');

describe('SocketWorker', function () {
    var service;

    it("should emit events received over the socket on comm", function (done) {
        var w = new Worker([
        ], {
            id: 'worker-test-id',
            name: 'worker-test'
        }, void 0);
        w.init = function (cb) {
            w.listen('test', function () {
                service.dispose(function () {
                    done();
                });
            });
            cb(null);
            return this;
        };
        service = new Service('service-name')
            .use(w)
            .use(new SocketWorker())
            .use(new HttpServerWorker({
                port: ports.SocketWorker[0]
            }))
            .info('error', function (e) {
                throw e;
            })
            .info('ready', function (iw) {
                var socket = ioClient("http://localhost:" + ports.SocketWorker[0]);
                socket.on('connect', function () {
                    socket.emit('tell.worker-test.test', 'tell.worker-test.test', {});
                });
            });
        service.start();
    });
});
