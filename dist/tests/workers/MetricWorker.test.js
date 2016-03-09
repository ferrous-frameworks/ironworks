/// <reference path="../../typings/tsd/tsd.d.ts" />
var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;
chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));
var ports = require('../test-ports.json');
var Service = require('../../service/Service');
var MetricWorker = require('../../workers/MetricWorker');
var LogWorker = require('../../workers/LogWorker');
var Worker = require('../../workers/Worker');
var CommEmit = require('../../eventing/CommEmit');
describe('MetricWorker', function () {
    it("should emit a 'duration' event when any emit is intercepted", function (done) {
        var srvName = 'service-name';
        var w = new Worker([], {
            id: 'worker-test-id',
            name: 'worker-test'
        }, void 0);
        w.init = function (cb) {
            w.respond('test', function (req, cb) {
                cb(null, req);
            });
            cb(null);
            return this;
        };
        new Service(srvName)
            .use(new MetricWorker())
            .use(new LogWorker({
            stdout: function (s) {
                expect(JSON.parse(s).meta.service).to.be.equal(srvName);
            }
        }))
            .use(new MetricWorker('2'))
            .use(w)
            .info('error', function (e) {
            throw e;
        })
            .info('ready', function (iw) {
            var test = {
                some: 'data'
            };
            var increment = false;
            var duration1 = false;
            var duration2 = false;
            iw.service.info('iw-metric.increment', function (inc) {
                if (inc.emit.name === 'test') {
                    increment = true;
                    expect(inc.metricWorkerName).to.be.equal('iw-metric');
                }
            });
            iw.service.info('iw-metric.duration', function (dur) {
                if (dur.emit.name === 'test') {
                    duration1 = true;
                    assert.isNumber(dur.duration, "dur duration not a number");
                    //expect(dur.duration).to.be.a.number;
                    expect(dur.duration).to.be.below(2000);
                    expect(dur.metricWorkerName).to.be.equal('iw-metric');
                }
            });
            iw.service.info('iw-metric-2.duration', function (dur) {
                if (dur.emit.name === 'test') {
                    duration2 = true;
                    assert.isNumber(dur.duration, "dur duration not a number");
                    expect(dur.duration).to.be.below(2000);
                    expect(dur.metricWorkerName).to.be.equal('iw-metric-2');
                }
            });
            iw.service.request('comm.service-name.request.worker-test.test', test, function (e, res) {
                setTimeout(function () {
                    expect(increment).to.be.true;
                    expect(duration1).to.be.true;
                    expect(duration2).to.be.true;
                    expect(res).to.be.equal(test);
                    iw.service.dispose(function () {
                        done();
                    });
                }, 500);
            });
        })
            .start();
    });
    it("should not intercept events contained in the 'ignore' option", function (done) {
        var s = new Service('metric-ignore-service');
        s.use(new MetricWorker(void 0, {
            ignored: [
                'tell.iw-service.test'
            ]
        }));
        s.info('iw-metric.increment', function (metricInc) {
            var emit = new CommEmit(metricInc.emit);
            if (emit.worker === 'iw-service' && emit.name === 'test') {
                throw new Error('MetricWorker should not emit the increment event when the test event is emitted because test is ignored');
            }
        });
        s.info('iw-metric.duration', function (metricDur) {
            var emit = new CommEmit(metricDur.emit);
            if (emit.worker === 'iw-service' && emit.name === 'test') {
                throw new Error('MetricWorker should not emit the duration event when the test event is emitted because test is ignored');
            }
        });
        s.info('ready', function () {
            s.tell('test');
            setTimeout(done, 50);
        });
        s.start();
    });
    it("should intercept an event emitted to another for another service", function (done) {
        var s = new Service('metric-another-service');
        s.use(new MetricWorker());
        s.info('iw-metric.increment', function (inc) {
            if (inc.emit.service === 'another-service') {
                done();
            }
        });
        s.info('ready', function () {
            s.tell('another-service.tell.worker.test');
        });
        s.start();
    });
});
//# sourceMappingURL=MetricWorker.test.js.map