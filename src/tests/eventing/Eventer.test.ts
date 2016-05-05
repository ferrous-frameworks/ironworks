
import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));

import Eventer = require('../../eventing/Eventer');

describe('Eventer', function () {
    var eventer;

    beforeEach(function () {
        eventer = new Eventer();
    });

    it("should call a listener only one time when a wildcard listener is also in place", function (done) {
        var wildcard = 0;
        var literal = 0;
        var prefix = 'comm.service.';
        var event = prefix + 'method.worker.event';

        eventer.on(prefix + '*.*.*', function () {
            wildcard++;
        });
        eventer.on(event, function () {
            literal++;
        });
        eventer.emit(event);
        setTimeout(function () {
            expect(wildcard).to.be.equal(1);
            expect(literal).to.be.equal(1);
            done();
        }, 250);
    });

    it("should implement a 'tell' / 'listen' emit/listener combination", function (done) {
        eventer.listen('test', function () {
            done();
        });
        eventer.tell('test');
    });

    it("should implement a 'inform' / 'info' emit/listener combination", function (done) {
        var test = {
            some: "data"
        };
        eventer.info('test', function (info) {
            expect(info).to.be.equal(test);
            done();
        });
        eventer.inform('test', test);
    });

    it("should implement a 'confirm' / 'ack' emit/listener combination", function (done) {
        eventer.ack('test', function (cb) {
            cb(null);
        });
        eventer.confirm('test', function (e) {
            done();
        });
    });

    it("should implement a 'check' / 'verify' emit/listener combination", function (done) {
        var test = {
            some: "data"
        };
        eventer.verify('test', function (toCheck, cb) {
            expect(toCheck).to.be.equal(test);
            cb(null);
        });
        eventer.check('test', test, function (e) {
            expect(e).to.be.null;
            done();
        });
    });

    it("should implement a 'ask' / 'answer' emit/listener combination", function (done) {
        var test = {
            some: "data"
        };
        eventer.answer('test', function (cb) {
            cb(null, test);
        });
        eventer.ask('test', function (e, answer) {
            expect(answer).to.be.equal(test);
            done();
        });
    });

    it("should implement a 'request' / 'respond' emit/listener combination", function (done) {
        var test = {
            some: "data"
        };
        eventer.respond('test', function (request, cb) {
            cb(null, request);
        });
        eventer.request('test', test, function (e, response) {
            expect(response).to.be.equal(test);
            done();
        });
    });

    it("should implement an 'onlyOnce' method that makes the next listener created only catch the event once", function (done) {
        eventer.onlyOnce().listen('test', function () {
            done();
        });
        eventer.tell('test');
        eventer.tell('test');
    });

    it("should have a 'dispose' method", function () {
        //expect(eventer).to.have.a.method('dispose');
        assert.isFunction(eventer.dispose);
    });
});
