/// <reference path="../../typings/master.d.ts" />

import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

import fs = require('fs');
import path = require('path');

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
import LogWorker = require('../../workers/LogWorker');

import SocketWorker = require('../../workers/SocketWorker');
import IServiceReady = require("../../interfaces/service/IServiceReady");
import IHttpServerWorker = require("../../interfaces/workers/IHttpServerWorker");

describe('HttpServerWorker', function () {
    it('should serve static files if the server.hapi.connections.routes.files.relativeTo option is set', function (done) {
        new Service('test-service')
            .use(new HttpServerWorker({
                port: ports.HttpServerWorker[0],
                rootSitePagePath: "index.html",
                hapi: {
                    connections: {
                        routes: {
                            files: {
                                relativeTo: path.resolve('./src/tests/workers/public')
                            }
                        }
                    }
                }
            }))
            .info<IServiceReady>('ready', function (iw) {
                var url = 'http://localhost:' + ports.HttpServerWorker[0];
                request({
                    url: url,
                    method: 'GET'
                }, function (e, res, body) {
                    expect(res.statusCode).to.be.equal(200);
                    var indexHtml = fs.readFileSync(path.resolve('./src/tests/workers/public/index.html'), {
                        encoding: 'utf8'
                    });
                    expect(body).to.be.equal(indexHtml);
                    iw.service.dispose(function () {
                        done();
                    });
                });
            })
            .start();
    });
    
    it('should provide an apiRoute prop equal to the sanitized option, if available', function (done) {
        var test = 'some-crazy-api-prefix';
        new Service('test-service')
            .use(new HttpServerWorker({
                port: ports.HttpServerWorker[1],
                apiRoute: test
            }))
            .info<IServiceReady>('ready', function (iw) {
                iw.service.get({
                    names: ['iw-http-server']
                }, function (e, results) {
                    var dep:IHttpServerWorker = <IHttpServerWorker>results.list()[0];
                    expect(dep.apiRoute).to.be.equal('/' + test);
                    iw.service.dispose(function () {
                        done();
                    });
                })
            })
            .start();
    });

    it('should serve registered rest methods if the apiRoute option is set', function (done) {
        var w = new Worker([], {
            id: 'worker-id',
            name: 'worker-name'
        }, void 0);
        w.init = function (cb) {
            w.respond('worker-event', function (req, cb) {
                cb(null, req);
            });
            w.tell('ready');
            cb(null);
            return this;
        };
        new Service('test-service')
            .use(new HttpServerWorker({
                port: ports.HttpServerWorker[2],
                apiRoute: 'api'
            }))
            .use(w)
            .info<IServiceReady>('ready', function (iw) {
                var test = {
                    some: "data"
                };
                var url = 'http://localhost:' + ports.HttpServerWorker[2] +
                    '/api/comm/test-service/request/worker-name/worker-event' +
                    '?myId=comm-id&myName=comm-name';
                request({
                    url: url,
                    method: 'POST',
                    json: true,
                    body: test
                }, function (e, res, body) {
                    expect(e).to.be.equal(null);
                    expect(res.statusCode).to.be.equal(200);
                    expect(body.some).to.be.equal(test.some);
                    iw.service.dispose(function () {
                        done();
                    });
                });
            })
            .start();
    });

    it('should 404 requests if there are no listeners for the route', function (done) {
        var s = new Service('test-service');
        s.use(new HttpServerWorker({
            port: ports.HttpServerWorker[3],
            apiRoute: 'api'
        }));
        s.use(new LogWorker({
            stdout: function (s) {
                var entry = JSON.parse(s);
                expect(entry).to.not.be.equal(void 0);
            }
        }));
        s.info<IServiceReady>('ready', function (iw) {
            var test = {
                some: "data"
            };
            var url = 'http://localhost:' + ports.HttpServerWorker[3] +
                '/api/comm/test-service/request/worker-name/should-404';
            request({
                url: url,
                method: 'POST',
                json: true,
                body: test
            }, function (e, res, body) {
                expect(res.statusCode).to.be.equal(404);
                iw.service.dispose(function () {
                    done();
                });
            });
        });
        s.start();
    });

    it('should accept a large post body (1mb+)', function (done) {
        this.timeout(30000);
        var w = new Worker([], {
            id: 'id',
            name: 'worker'
        }, void 0);
        w.init = function (cb) {
            w.respond('echo', function (req, cb) {
                cb(null, req);
            });
            cb(null);
            return this;
        };
        var s = new Service('test-service');
        s.use(w);
        s.use(new HttpServerWorker({
            port: ports.HttpServerWorker[4],
            apiRoute: 'api'
        }));
        s.info<IServiceReady>('ready', function (iw) {
            var test = { contents: fs.readFileSync(path.resolve('./src/tests/workers/HttpServerLargeTestUploadFile.dat')) };
            var url = 'http://localhost:' + ports.HttpServerWorker[4] +
                '/api/comm/test-service/request/worker/echo';
            request({
                url: url,
                method: 'POST',
                json: true,
                body: test
            }, function (e, res, body) {
                expect(res.statusCode).to.be.equal(200);
                iw.service.dispose(function () {
                    done();
                });
            });
        });
        s.start();
    });
});
