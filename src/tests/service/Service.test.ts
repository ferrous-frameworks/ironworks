
import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

import util = require('util');

import _ = require('lodash');
import request = require('request');


chai.use(require('../_chai/toHaveAMethod'));
chai.use(require('../_chai/toHaveAListener'));

var ports = require('../test-ports.json');

import Worker = require('../../workers/Worker');

import Service = require('../../service/Service');
import HttpServerWorker = require('../../workers/HttpServerWorker');
import SocketWorker = require('../../workers/SocketWorker');
import EnvironmentWorker = require('../../workers/EnvironmentWorker');
import ConnectorWorker = require('../../workers/ConnectorWorker');
import HiveWorker = require('../../workers/HiveWorker');
import LogWorker = require('../../workers/LogWorker');
import IServiceReady = require('../../interfaces/service/IServiceReady');
import IAmVersioned = require('../../interfaces/whoIAm/IAmVersioned')
import IAm = require('../../interfaces/whoIAm/IAm');


describe('Service', function () {
    var service;
    var conns;

    beforeEach(function () {
        conns = [{
            name: "my-other-service",
            protocol: 'http',
            host: 'localhost',
            port: ports.Service[2]
        }];
    });

    it("should have a 'use' method that accepts an IWorker and manages it's dependencies when started",
        function (done) {
            service = new Service('service-name', {
                dependencyCheckTimeout: 250,
                dependencyCheckFrequency: 10
            });
            var worker2Name = 'worker-two';
            var worker1 = new Worker([
                worker2Name
            ], {
                id: 'worker-1',
                name: 'worker-one'
            }, void 0);
            var worker2 = new Worker([], {
                id: 'worker-2',
                name: worker2Name
            }, void 0);
            service
                .use(worker1)
                .use(worker2)
                .info('ready', function () {
                    done();
                })
                .info('error', function (e) {
                    throw e;
                });
            service.start();
        });

    it("should have a 'start' method that emits a 'ready' event", function (done) {
        service = new Service('service-name');
            service.info('ready', function () {
                done();
            })
            .info('error', function (e) {
                throw e;
            })
            .start();
    });

    it("should initialize all workers before any are started", function (done) {
        var test = {
            some: "data"
        };
        var TestWorker = function () {
            Worker.call(this, [], {
                id: 'worker',
                name: 'worker'
            });
        };
        util.inherits(TestWorker, Worker);
        TestWorker.prototype.init = function (cb) {
            this.answer('test', function (cb) {
                cb(null, test);
            });
            cb(null);
        };
        var otherService = new Service('my-other-service')
            .use(new HttpServerWorker({
                apiRoute: 'api',
                port: ports.Service[2]
            }))
            .use(new SocketWorker())
            .use(new TestWorker());
        otherService.info('ready', function (iw) {
            var s = new Service('service-name')
                .use(new HttpServerWorker({
                    apiRoute: 'api',
                    port: ports.Service[1]
                }))
                .use(new SocketWorker())
                .use(new EnvironmentWorker('', {
                    serviceConnections: conns
                }))
                .use(new ConnectorWorker())
                // .use(new HiveWorker());
            s.info('ready', function (iw) {
                request({
                    url: 'http://localhost:' + ports.Service[1] + '/api/comm/my-other-service/ask/worker/test',
                    method: 'POST',
                    json: true,
                    body: test
                }, function (e, res, body) {
                    expect(e).to.be.null;
                    expect(res.statusCode).to.be.equal(200);
                    expect(body.some).to.be.equal(test.some);
                    done();
                });
            });
            s.start();
        });
        otherService.start();
    });
    it("should not, by default, log the ready event if a LogWorker is used", function (done) {
        new Service('service-name')
            .use(new LogWorker({
                stdout: function (str) {
                    var obj = JSON.parse(str);
                    if (obj.meta.worker === 'iw-service' && obj.meta.name === 'ready') {
                        throw new Error("LogWorker should not have logged the service.ready event");
                    }
                }
            }))
            .start();
        setTimeout(done, 50);
    });
    it("should not, by default, log the available-listeners event if a LogWorker is used", function (done) {
        new Service('service-name')
            .use(new LogWorker({
                stdout: function (str) {
                    var obj = JSON.parse(str);
                    if (obj.meta.worker === 'iw-service' && obj.meta.name === 'available-listeners') {
                        throw new Error("LogWorker should not have logged the service.available-listeners event");
                    }
                }
            }))
            .start();
        setTimeout(done, 50);
    });
    it("should have a 'list-workers' listener that provides a list of worker names that are running", function (done) {
        new Service('service-name')
            .info<IServiceReady>('ready', (iw) => {
                iw.service.ask<IAm[]>('list-workers', function (e, workers) {
                    expect(e).to.be.null;
                    expect(_.isArray(workers)).to.be.true;
                    expect(workers.length).to.be.equal(1);
                    expect(workers[0].name).to.be.equal('iw-service');
                    done();
                });
            })
            .start();
    });
    it("should provide a 'who' listener that provides it's whoService object", function (done) {
        new Service('service-name')
            .info<IServiceReady>('ready', (iw) => {
                iw.service.ask<IAmVersioned>('who', function (e, whoService) {
                    expect(e).to.be.null;
                    expect(whoService.version[0]).to.be.equal('v');
                    done();
                });
            })
            .start();
    });
});
