
import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

import util = require('util');

import _ = require('lodash');

chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));

var ports = require('../test-ports.json');

import LogWorker = require('../../workers/LogWorker');
import Service = require('../../service/Service');
import Worker = require('../../workers/Worker');
import HttpServerWorker = require('../../workers/HttpServerWorker');
import SocketWorker = require('../../workers/SocketWorker');
import EnvironmentWorker = require('../../workers/EnvironmentWorker');
import ConnectorWorker = require('../../workers/ConnectorWorker');
import HiveWorker = require('../../workers/HiveWorker');
import IServiceReady = require("../../interfaces/service/IServiceReady");

describe('LogWorker', function () {
    it("should log JSON versions of all emit's and listener's callbacks to stdout/stderr", function (done) {
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
        w.start = function (deps, cb) {
            if (!_.isUndefined(cb)) {
                cb(null);
            }
            return this;
        };
        new Service('service-name', {
            dependencyCheckTimeout: 250,
            dependencyCheckFrequency: 10
        })
            .use(w)
            .use(new LogWorker({
                stdout: function (s) {
                    expect(s.length).to.be.above(0);
                }
            }))
            .info('error', function (e) {
                done(e);
            })
            .info<IServiceReady>('ready', function (iw) {
                var test = {
                    some: 'data'
                };
                iw.service.comm.request('comm.service-name.request.worker-test.test', test, function (e, res) {
                    expect(res).to.be.equal(test);
                    iw.service.dispose(function () {
                        done();
                    });
                });
            })
            .start();
    });
    it("should log emits without listeners", function (done) {
        var test = {
            some: 'data'
        };
        new Service('service-name', {
            dependencyCheckTimeout: 250,
            dependencyCheckFrequency: 10
        })
            .use(new LogWorker({
                stdout: function (s) {
                    var obj = JSON.parse(s);
                    expect(obj).to.not.be.an('undefined');
                    expect(obj.meta).to.not.be.an('undefined');
                    if (obj.meta.name === 'test') {
                        expect(obj.emitted).to.not.be.an('undefined');
                        expect(obj.emitted.some).to.be.equal(test.some);
                        done();
                    }
                }
            }))
            .info('error', function (e) {
                done(e);
            })
            .info<IServiceReady>('ready', function (iw) {
                iw.service.comm.request('comm.service-name.request.worker.test', test, function (e, res) {
                    done(new Error('there is no listener so this callback should never be called in this test'));
                });
            })
            .start();
    });
    it("should provide a 'log' event for custom logging", function (done) {
        var test = {
            some: 'data'
        };
        new Service('service-name')
            .use(new LogWorker({
                stdout: function (str) {
                    var obj = JSON.parse(str);
                    if (obj.meta.name === 'log') {
                        expect(obj.emitted.data.some).to.be.equal(test.some);
                        done();
                    }
                },
                stderr: function (str) {
                    done(new Error(str));
                }
            }))
            .info<IServiceReady>('ready', function (iw) {
                iw.service.request('iw-log.log', {
                    message: 'test',
                    data: test
                },(err,res)=>{

                });
            })
            .start();
    });
    it("should not log events annotated with a 'log.level' higher than it's 'level' option", function (done) {
        new Service('service-name')
            .use(new LogWorker({
                stdout: function (str) {
                    var obj = JSON.parse(str);
                    if (obj.meta.worker === 'iw-service' && obj.meta.name === 'test') {
                        done(new Error("LogWorker should not have logged the service.test event"));
                    }
                },
                level: 0
            }))
            .info<IServiceReady>('ready', function (iw) {
                iw.service.annotate({
                    log: {
                        level: 1
                    }
                }).tell('test');
                setTimeout(done, 50);
            })
            .start();
    });
    it("should not throw an error if no options are passed", function (done) {
        new Service('service-name')
            .use(new LogWorker())
            .info('ready', function () {
                done();
            })
            .start();
    });
    it("should use local event listeners even if they're annotated 'internal'", function (done) {
        function ChildWorker() {
            Worker.call(this, [], {
                name: 'iw-child'
            });
        }
        util.inherits(ChildWorker, Worker);
        ChildWorker.prototype.init = function (cb) {
            this.annotate({
                internal: true
            }).verify('test', function (req, cb) {
                expect(!_.isUndefined(req)).to.be.true;
                expect(req.some).to.be.equal('data');
                cb(null);
            });
            Worker.prototype.init.call(this, cb);
        };
        function ParentWorker() {
            Worker.call(this, ['iw-child'], {
                name: 'iw-parent'
            });
        }
        util.inherits(ParentWorker, Worker);
        ParentWorker.prototype.init = function (cb) {
            var instance = this;
            this.ack('test', function (cb) {
                instance.check('iw-child.test', {
                    some: 'data'
                }, function (e) {
                    expect(e).to.be.null;
                    cb(e);
                });
            });
            Worker.prototype.init.call(this, cb);
        };
        new Service('service-name')
            .use(new LogWorker())
            .use(new ChildWorker())
            .use(new ParentWorker())
            .info<IServiceReady>('ready', function (iw) {
                iw.service.confirm('iw-parent.test', function (e) {
                    expect(e).to.be.null;
                    done();
                });
            })
            .start();
    });
    it("should not log emitted properties on events annotated with the 'log.properties[].level' if it's higher than the 'level' option", (done) => {
        new Service('service-name')
            .use(new LogWorker({
                stdout: (str) => {
                    var obj = JSON.parse(str);
                    if (obj.meta.worker === 'iw-service' && obj.meta.name === 'test') {
                        expect(_.isUndefined(obj.emitted.iDoNotWantThisLogged)).to.be.true;
                        done();
                    }
                },
                level: 0,
                defaultLevel: 0
            }))
            .info<IServiceReady>('ready', (iw) => {
                iw.service.annotate({
                    log: {
                        properties: [{
                            name: 'iDoNotWantThisLogged',
                            level: 1
                        }]
                    }
                }).inform('test', {
                    iWantThisLogged: {
                        some: "data"
                    },
                    iDoNotWantThisLogged: new Buffer(_.range(100000))
                });
            })
            .start();
    });
    it("should not log emitted nested properties on events annotated with the 'log.properties[].level' if it's higher than the 'level' option", (done) => {
        new Service('service-name')
            .use(new LogWorker({
                stdout: (str) => {
                    var obj = JSON.parse(str);
                    if (obj.meta.worker === 'iw-service' && obj.meta.name === 'test') {
                        expect(_.isUndefined(obj.emitted.a.b.iDoNotWantThisLogged)).to.be.true;
                        done();
                    }
                },
                level: 0,
                defaultLevel: 0
            }))
            .info<IServiceReady>('ready', (iw) => {
                iw.service.annotate({
                    log: {
                        properties: [{
                            name: 'a.b.iDoNotWantThisLogged',
                            level: 1
                        }]
                    }
                }).inform('test', {
                    a: {
                        iWantThisLogged: {
                            some: "data"
                        },
                        b: {
                            iDoNotWantThisLogged: new Buffer(_.range(100000))
                        }
                    }
                });
            })
            .start();
    });
    it("should replace the logged property value with '*****' on events annotated with the 'log.properties[].secure'", (done) => {
        new Service('service-name')
            .use(new LogWorker({
                stdout: (str) => {
                    var obj = JSON.parse(str);
                    if (obj.meta.worker === 'iw-service' && obj.meta.name === 'test') {
                        expect(obj.emitted.iWantThisSecured).to.be.equal('*****');
                        done();
                    }
                }
            }))
            .info<IServiceReady>('ready', (iw) => {
                iw.service.annotate({
                    log: {
                        properties: [{
                            name: 'iWantThisSecured',
                            secure: true
                        }]
                    }
                }).inform('test', {
                    iWantThisSecured: 'aPassword'
                });
            })
            .start();
    });
    it("should collapse the logged array value on events annotated with the 'log.properties[].arrayLengthOnly'", (done) => {
        new Service('service-name')
            .use(new LogWorker({
                stdout: (str) => {
                    var obj = JSON.parse(str);
                    if (obj.meta.worker === 'iw-service' && obj.meta.name === 'test') {
                        expect(obj.emitted.iOnlyWantTheLength).to.be.equal('array[100]');
                        done();
                    }
                }
            }))
            .info<IServiceReady>('ready', (iw) => {
                iw.service.annotate({
                    log: {
                        properties: [{
                            name: 'iOnlyWantTheLength',
                            arrayLengthOnly: true
                        }]
                    }
                }).inform('test', {
                    iOnlyWantTheLength: _.range(100)
                });
            })
            .start();
    });
    it("should collapse the logged array value on events annotated with the 'log.emittedObject.arrayLengthOnly'", (done) => {
        new Service('service-name')
            .use(new LogWorker({
                stdout: (str) => {
                    var obj = JSON.parse(str);
                    if (obj.meta.worker === 'iw-service' && obj.meta.name === 'test') {
                        expect(obj.emitted).to.be.equal('array[100]');
                        done();
                    }
                }
            }))
            .info<IServiceReady>('ready', (iw) => {
                iw.service.annotate({
                    log: {
                        emittedObject: {
							arrayLengthOnly: true
						}
                    }
                }).inform('test', _.range(100));
            })
            .start();
    });
});
