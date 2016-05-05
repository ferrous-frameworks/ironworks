
import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;


import _ = require('lodash');
import ioClient = require('socket.io-client');

chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));

var ports = require('../test-ports.json');

import Service = require('../../service/Service');
import Comm = require('../../eventing/Comm');
import Worker = require('../../workers/Worker');
import HttpServerWorker = require('../../workers/HttpServerWorker');
import ConnectorWorker = require('../../workers/ConnectorWorker');
import HiveWorker = require('../../workers/HiveWorker');
import SocketWorker = require('../../workers/SocketWorker');
import BroadcastWorker = require('../../workers/BroadcastWorker');
import LogWorker = require('../../workers/LogWorker');

describe('BroadcastWorker', function () {
    //var service;
    //
    //beforeEach(function (done) {
    //    process.env['VCAP_SERVICES_BROADCAST'] = JSON.stringify(
    //        {
    //            "user-provided": [
    //                {
    //                    "credentials": {
    //                        "iw": "true",
    //                        "serviceName": "other-service",
    //                        "protocol":"http",
    //                        "host": "localhost",
    //                        "port": ports.BroadcastWorker[0],
    //                        "endPoints": [],
    //                        "token": "qwer32r123rewr213r"
    //                    },
    //                    "label": "user-provided",
    //                    "name": "service-name",
    //                    "syslog_drain_url": "",
    //                    "tags": []
    //                }
    //            ]
    //        });
    //
    //    done();
    //});
    //
    //it("should broadcast internally to all running workers", function (done) {
    //    var test = {
    //        some: "data"
    //    };
    //    var w1 = false;
    //    var w2 = false;
    //    var worker1 = new Worker([], {
    //        id: 'w1-id',
    //        name: 'w1'
    //    });
    //    worker1.init = function (cb) {
    //        worker1.info('test', function (info) {
    //            expect(info).to.be.equal(test);
    //            w1 = true;
    //            check(service);
    //        });
    //        worker1.info('test1', function (info) {});
    //        worker1.info('test2', function (info) {});
    //        cb(null);
    //    };
    //    var worker2 = new Worker([], {
    //        id: 'w2-id',
    //        name: 'w2'
    //    });
    //    worker2.init = function (cb) {
    //        worker2.info('test', function (info) {
    //            expect(info).to.be.equal(test);
    //            w2 = true;
    //            check(service);
    //        });
    //        cb(null);
    //    };
    //    new Service('my-service')
    //        .use(new BroadcastWorker())
    //        .use(worker1)
    //        .use(worker2)
    //        .info('error', function (e) {
    //            throw e;
    //        })
    //        .info('ready', function (iw) {
    //            expect(iw.service.comm).to.have.a.listener('comm.my-service.inform.iw-broadcast.broadcast');
    //            iw.service.comm.inform('iw-broadcast.broadcast', {
    //                id: 'my-broadcast-id',
    //                emitter: {
    //                    id: 'my-emitter-id',
    //                    name: 'test-emitter'
    //                },
    //                timestamp: new Date().getTime(),
    //                internal: true,
    //                name: 'test',
    //                info: test
    //            });
    //        })
    //        .start();
    //    function check(service) {
    //        if (w1 && w2) {
    //            service.dispose(function () {
    //                done();
    //            });
    //        }
    //    }
    //});
    //
    //it("should broadcast to other external iw services", function (done) {
    //    var test = {
    //        some: "data"
    //    };
    //    var w1 = false;
    //    var w2 = false;
    //    var worker1 = new Worker([], {
    //        id: 'w1-id',
    //        name: 'w1'
    //    });
    //    worker1.init = function (cb) {
    //        worker1.info('test', function (info) {
    //            expect(info.some).to.be.equal(test.some);
    //            w1 = true;
    //            check();
    //        });
    //        cb(null);
    //    };
    //    var worker2 = new Worker([], {
    //        id: 'w2-id',
    //        name: 'w2'
    //    });
    //    worker2.init = function (cb) {
    //        worker2.info('test', function (info) {
    //            expect(info.some).to.be.equal(test.some);
    //            w2 = true;
    //            check();
    //        });
    //        cb(null);
    //    };
    //    var s2;
    //    var s1 = new Service('other-service')
    //        .use(new HttpServerWorker({
    //            port: ports.BroadcastWorker[0]
    //        }))
    //        .use(new SocketWorker())
    //        .use(new CfClientWorker({
    //            vcapServices: 'VCAP_SERVICES_BROADCAST'
    //        }))
    //        .use(new BroadcastWorker())
    //        .use(worker1)
    //        .use(worker2)
    //        .info('error', function (e) {
    //            throw e;
    //        })
    //        .info('ready', function (iw1) {
    //            s2 = new Service('my-service')
    //                .use(new HttpServerWorker({
    //                    port: ports.BroadcastWorker[1]
    //                }))
    //                .use(new SocketWorker())
    //                .use(new CfClientWorker({
    //                    vcapServices: 'VCAP_SERVICES_BROADCAST'
    //                }))
    //                .use(new BroadcastWorker())
    //                .info('ready', function (iw2) {
    //                    iw2.service.comm.inform('iw-broadcast.broadcast', {
    //                        id: 'my-broadcast-id',
    //                        emitter: {
    //                            id: 'my-emitter-id',
    //                            name: 'test-emitter'
    //                        },
    //                        timestamp: new Date().getTime(),
    //                        internal: false,
    //                        name: 'test',
    //                        info: test
    //                    });
    //                });
    //                s2.start();
    //        });
    //        s1.start();
    //    function check() {
    //        if (w1 && w2) {
    //            s2.dispose(function () {
    //                s1.dispose(function () {
    //                    done();
    //                });
    //            });
    //        }
    //    }
    //});
    //
    //it("should broadcast to all connected niwc's (Non-IronWorks Connection)", function (done) {
    //    var test = {
    //        some: "data"
    //    };
    //    new Service('other-service')
    //        .use(new HttpServerWorker({
    //            port: ports.BroadcastWorker[0]
    //        }))
    //        .use(new SocketWorker())
    //        .use(new CfClientWorker({
    //            vcapServices: 'VCAP_SERVICES_BROADCAST'
    //        }))
    //        .use(new BroadcastWorker())
    //        .info('error', function (e) {
    //            throw e;
    //        })
    //        .info('ready', function (iw) {
    //            var client = ioClient('http://localhost:' + ports.BroadcastWorker[0]);
    //            client.emit('comm.other-service.check.iw-cf-client.register-niwc', {}, {
    //                id: 'niwc-id',
    //                name: 'iw-service',
    //                service: 'my-niwc-service'
    //            }, function () {
    //                client.on('comm.my-niwc-service.info.iw-service.test', function (info) {
    //                    expect(info.some).to.be.equal(test.some);
    //                    done();
    //                });
    //                iw.service.comm.inform('iw-broadcast.broadcast', {
    //                    id: 'my-broadcast-id',
    //                    emitter: {
    //                        id: 'my-emitter-id',
    //                        name: 'test-emitter'
    //                    },
    //                    timestamp: new Date().getTime(),
    //                    internal: false,
    //                    name: 'test',
    //                    info: test
    //                });
    //            });
    //        })
    //        .start();
    //});
});
