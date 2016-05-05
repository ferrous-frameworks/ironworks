
import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

import util = require('util');

import _ = require('lodash');

chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));

import Worker = require('../../workers/Worker');
import Comm = require('../../eventing/Comm');
import Service = require('../../service/Service');
import HttpServerWorker = require('../../workers/HttpServerWorker');
import SocketWorker = require('../../workers/SocketWorker');

describe('Worker', function () {
    var serviceAm = {
        id: 'service-id',
        name: 'service-name'
    };
    var worker;
    beforeEach(function () {
        var comm = new Comm({
            id: 'comm-id',
            name: 'comm-name'
        },{
            id: 'comm-id2',
            name: 'comm-name2'
        },
        'service-worker-name');
        worker = new Worker([], {
            id: 'worker-id',
            name: 'worker-name'
        }, void 0);
        worker.whoService = serviceAm;
        worker.comm = comm;
    });

    it("should implement a 'tell' / 'listen' emit/listener combination", function (done) {
        worker.listen('test', function () {
            done();
        });
        worker.tell('test');
    });

    it("should implement a 'inform' / 'info' emit/listener combination", function (done) {
        var test = {
            some: "data"
        };
        worker.info('test', function (info) {
            expect(info).to.be.equal(test);
            done();
        });
        worker.inform('test', test);
    });

    it("should implement a 'confirm' / 'ack' emit/listener combination", function (done) {
        worker.ack('test', function (cb) {
            cb(void 0);
        });
        worker.confirm('test', function (e) {
            done();
        });
    });

    it("should implement a 'ask' / 'answer' emit/listener combination", function (done) {
        var test = {
            some: "data"
        };
        worker.answer('test', function (cb) {
            cb(void 0, test);
        });
        worker.ask('test', function (e, answer) {
            expect(answer).to.be.equal(test);
            done();
        });
    });

    it("should implement a 'request' / 'respond' emit/listener combination", function (done) {
        var test = {
            some: "data2"
        };
        worker.respond('test', function (request, cb) {
            cb(void 0, request);
        });
        worker.request('test', test, function (e, response) {
            expect(response).to.be.equal(test);
            done();
        });
    });

    it("should implement an 'onlyOnce' method that makes the next listener created only catch the event once", function (done) {
        worker.onlyOnce().listen('test', function () {
            done();
        });
        worker.tell('test');
        worker.tell('test');
    });

    it("should have a 'dispose' method", function () {
        assert.isFunction(worker.dispose);
    });

    it("should add the names in the 'dependencies' option to it's dependency list", function (done) {
        var ChildWorker = function (opts) {
            Worker.call(this, [ 'iw-socket' ], {
                id: 'child-worker-id',
                name: 'child-worker'
            }, opts);
            var defOpts = {};
            this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
            this.opts.merge(opts);
        };
        util.inherits(ChildWorker, Worker);

        var s = new Service('dep-opt-service');
        s.use(new ChildWorker({
            worker: {
                dependencies: [ 'iw-http-server' ]
            }
        }));
        s.use(new HttpServerWorker());
        s.use(new SocketWorker);
        s.info('ready', function () {
            done();
        });
        s.start();
    });

    it("should not start if a worker was added to the 'dependencies' option unless that worker is present", function (done) {
        var ChildWorker = function (opts) {
            Worker.call(this, [], {
                id: 'child-worker-id',
                name: 'child-worker'
            }, opts);
            var defOpts = {};
            this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
            this.opts.merge(opts);
        };
        util.inherits(ChildWorker, Worker);

        var s = new Service('dep-opt-service');
        s.use(new ChildWorker({
            worker: {
                dependencies: [ 'iw-http-server' ]
            }
        }));
        s.info('ready', function () {
            throw new Error("service should not have started because there is no 'iw-http-server' present");
        });
        s.start();
        setTimeout(done, 50);
    });
});
