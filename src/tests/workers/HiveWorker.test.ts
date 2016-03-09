/// <reference path="../../typings/tsd/tsd.d.ts" />

import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

import util = require('util');

import _ = require('lodash');
import async = require('async');

chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));

var ports = require('../test-ports.json');

import idHelper = require('../../helpers/idHelper');

import Service = require('../../service/Service');
import HiveWorker = require('../../workers/HiveWorker');
import Worker = require('../../workers/Worker');
import SocketWorker = require('../../workers/SocketWorker');
import HttpServerWorker = require('../../workers/HttpServerWorker');
import LogWorker = require('../../workers/LogWorker');
import ConnectorWorker = require('../../workers/ConnectorWorker');
import EnvironmentWorker = require('../../workers/EnvironmentWorker');

import CommEvent = require('../../eventing/CommEvent');

function EchoWorker(name) {
    Worker.call(this, [], {
        id: idHelper.newId(),
        name: 'iw-echo' + (_.isUndefined(name) || name.length === 0 ? '' : '-' + name)
    });
}
util.inherits(EchoWorker, Worker);
EchoWorker.prototype.init = function (cb) {
    this.respond('echo', function (req, cb) {
        cb(null, req);
    });
    Worker.prototype.init.call(this, cb);
};
EchoWorker.prototype.postStart = function (deps, cb) {
    this.respond('new-echo', function (req, cb) {
        cb(null, req);
    });
    Worker.prototype.postStart.call(this, deps, cb);
};

var heartBeatFreq = 750;
var whilstDelay = 25;

describe('HiveWorker', function () {
    var services = [];
    var readyCalls = [];
    var availableListenerCalls = [];
    var serviceNames = [
        'hive-0',
        'hive-1',
        'hive-2',
        'hive-a',
        'hive-b',
        'hive-c'
    ];
    var serviceConns = [
        {
            from: 'hive-0',
            to: [ 'hive-1' ]
        },
        {
            from: 'hive-1',
            to: [ 'hive-2' ]
        },
        {
            from: 'hive-2',
            to: [ 'hive-0', 'hive-a' ]
        },


        {
            from: 'hive-a',
            to: [ 'hive-b' ]
        },
        {
            from: 'hive-b',
            to: [ 'hive-c' ]
        },
        {
            from: 'hive-c',
            to: [ 'hive-a' ]//, 'hive-1' ]
        }
    ];
    var newEchoCalls = [
        {
            from: 'hive-0',
            to: 'hive-0',
            called: false
        },
        {
            from: 'hive-0',
            to: 'hive-1',
            called: false
        },
        {
            from: 'hive-0',
            to: 'hive-2',
            called: false
        },

        {
            from: 'hive-1',
            to: 'hive-0',
            called: false
        },
        {
            from: 'hive-1',
            to: 'hive-1',
            called: false
        },
        {
            from: 'hive-1',
            to: 'hive-2',
            called: false
        },

        {
            from: 'hive-2',
            to: 'hive-0',
            called: false
        },
        {
            from: 'hive-2',
            to: 'hive-1',
            called: false
        },
        {
            from: 'hive-2',
            to: 'hive-2',
            called: false
        },


        {
            from: 'hive-a',
            to: 'hive-a',
            called: false
        },
        {
            from: 'hive-a',
            to: 'hive-b',
            called: false
        },
        {
            from: 'hive-a',
            to: 'hive-c',
            called: false
        },

        {
            from: 'hive-b',
            to: 'hive-a',
            called: false
        },
        {
            from: 'hive-b',
            to: 'hive-b',
            called: false
        },
        {
            from: 'hive-b',
            to: 'hive-c',
            called: false
        },

        {
            from: 'hive-c',
            to: 'hive-a',
            called: false
        },
        {
            from: 'hive-c',
            to: 'hive-b',
            called: false
        },
        {
            from: 'hive-c',
            to: 'hive-c',
            called: false
        },


        {
            from: 'hive-0',
            to: 'hive-b',
            called: false
        }
    ];

    beforeEach(function (done) {
        services = _.map(serviceNames, function (name) {
            return createService(name, getPort());
        });
        async.each(services, function (s, cb) {
            readyCalls.push({
                name: s.name,
                called: false
            });
            availableListenerCalls.push({
                name: s.name,
                called: false
            });
            var srvConns = _.filter(serviceConns, function (sc) {
                return sc.from === s.name;
            });
            async.each(srvConns, function (sc, cb) {
                async.each(sc.to, function (esn, cb) {
                    var extSrv = _.find(services, function (extSrv) {
                        return extSrv.name === esn;
                    });
                    if (!_.isUndefined(extSrv)) {
                        s.service.getWorker('iw-env', function (e, env) {
                            if (e === null) {
                                env.serviceConnections.push(createServiceConnection(esn, extSrv.port));
                            }
                            cb(e);
                        });
                    }
                    else {
                        cb(new Error('unable to find service: ' + esn));
                    }
                }, function (e) {
                    cb(e);
                });
            }, function (e) {
                cb(e);
            });
        }, function (e) {
            if (e !== null) {
                throw e;
            }
            else {
                done();
            }
        });
    });

    function createService(name, port) {
        var conns = [];
        return {
            name: name,
            port: port,
            conns: conns,
            service: new Service(name)
                .use(new EnvironmentWorker('', {
                    serviceConnections: conns
                }))
                .use(new ConnectorWorker())
                .use(new HiveWorker({
                    heartbeatFrequency: heartBeatFreq
                }))
                .use(new HttpServerWorker({
                    apiRoute: 'api',
                    port: port
                }))
                .use(new SocketWorker())
                .use(new EchoWorker(name))
        };
    }
    function createServiceConnection(name, port) {
        var conn = {
            name: name,
            protocol: 'http',
            host: 'localhost',
            port: port,
            url: ''
        };
        conn.url = EnvironmentWorker.getServiceConnectionUrl(conn);
        return conn;
    }
    var nextPortIndex = 0;
    function getPort() {
        if (nextPortIndex > ports.HiveWorker.length - 1) {
            throw new Error('add more ports to test-ports.json');
        }
        return ports.HiveWorker[nextPortIndex++];
    }
    function waitOnCalls(calls, cb) {
        async.whilst(function () {
            return _.any<any>(calls, function (c) {
                return !c.called;
            });
        }, function (cb) {
            setTimeout(function () {
                cb(null);
            }, whilstDelay);
        }, function (e) {
            cb(e);
        });
    }

    afterEach(function (done) {
        async.parallel(_.map(services, function (s) {
            return function (cb) {
                s.service.tell('dispose');
                cb(null);
            }
        }), function () {
            done();
        });
    });

    it("should flatten external service connections so that external workers' listeners are accessible through local emits", function (done) {
        async.series([
            function (cb) {
                async.parallel(_.map(services, function (s) {
                    return function (cb) {
                        s.service.info('ready', function () {
                            var readyCall = _.find(readyCalls, function (c) {
                                return c.name === s.name;
                            });
                            readyCall.called = true;
                        });
                        cb(null);
                    }
                }), function (e,results) {
                    cb(e,null);
                });
            },
            function (cb) {
                async.parallel(_.map(services, function (s) {
                    return function (cb) {
                        s.service.start();
                        cb(null);
                    }
                }));
                cb(null, null);
            },
            function (cb) {
                waitOnCalls(readyCalls, cb);
            },
            function (cb) {
                async.parallel(_.map(services, function (s) {
                    return function (cb) {
                        s.service.onlyOnce().info('available-listeners', function (evts) {
                            var availableListenerCall = _.find(availableListenerCalls, function (c) {
                                return c.name === s.name;
                            });
                            availableListenerCall.called = true;
                        });
                        cb(null);
                    }
                }));
                cb(null,null);
            },
            function (cb) {
                waitOnCalls(availableListenerCalls, cb);
            },
            function (cb) {
                callNewEchos(cb);
            }
        ], function (e) {
            expect(e).to.be.null;
            done();
        });
        function callNewEchos(cb) {
            async.waterfall([
                function (cb) {
                    async.parallel(_.map(newEchoCalls, function (nec) {
                        return function (cb) {
                            var from = _.find(services, function (s) {
                                return s.name === nec.from;
                            });
                            from.service.request('iw-echo-' + nec.to + '.new-echo', {
                                some: 'data'
                            }, function (e, res) {
                                expect(e).to.be.null;
                                expect(res.some).to.be.equal('data');
                                nec.called = true;
                            });
                            cb(null);
                        }
                    }));
                    cb(null);
                },
                function (cb) {
                    waitOnCalls(newEchoCalls, cb);
                }
            ], function (e) {
                cb(e);
            });
        }
    });
});
