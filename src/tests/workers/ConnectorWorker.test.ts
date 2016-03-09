/// <reference path="../../typings/tsd/tsd.d.ts" />

import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var util = require('util');

import _ = require('lodash');
import async = require('async');
import request = require('request');
import io = require('socket.io');


chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));

import idHelper = require('../../helpers/idHelper');

import Service = require('../../service/Service');
import Worker = require('../../workers/Worker');
import HttpServerWorker = require('../../workers/HttpServerWorker');
import SocketWorker = require('../../workers/SocketWorker');
import EnvironmentWorker = require('../../workers/EnvironmentWorker');

import ConnectorWorker = require('../../workers/ConnectorWorker');
import IServiceReady = require("../../interfaces/service/IServiceReady");

var ports = require('../test-ports.json');

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

describe('ConnectorWorker', function () {
    it("should have a 'list-external-service-names' listener that provides service names provided by the environment", function (done) {
        var extSrvConns = [{
            name: 'iw-env-ext-service',
            protocol: 'http',
            host: 'localhost',
            port: ports.ConnectorWorker[0]
        }];
        var socketServer = io(ports.ConnectorWorker[0]);
        socketServer.on('connection', function (socket) {});
        new Service('iw-env-test-service')
            .use(new EnvironmentWorker('test', {
                serviceConnections: extSrvConns
            }))
            .use(new ConnectorWorker())
            .info<IServiceReady>('ready', function (iw) {
                iw.service.ask<string[]>('iw-connector.list-external-service-names', function (e, extSrvNames) {
                    expect(e).to.be.null;
                    expect(_.isArray(extSrvNames)).to.be.true;
                    expect(extSrvNames.length).to.be.equal(1);
                    expect(extSrvNames[0]).to.be.equal(extSrvConns[0].name);
                    done();
                });
            })
            .start();
    });
    it("should intercept all external service events provided by the environment", function (done) {
        new Service('iw-env-ext-service')
            .use(new HttpServerWorker({
                port: ports.ConnectorWorker[1]
            }))
            .use(new SocketWorker())
            .use(new EchoWorker('test'))
            .start();
        new Service('iw-env-test-service')
            .use(new EnvironmentWorker('test', {
                serviceConnections: [{
                    name: 'iw-env-ext-service',
                    protocol: 'http',
                    host: 'localhost',
                    port: ports.ConnectorWorker[1]
                }]
            }))
            .use(new ConnectorWorker())
            .info<IServiceReady>('ready', function (iw) {
                iw.service.request<any,any>('iw-env-ext-service.request.iw-echo-test.echo', {
                    some: 'data'
                }, function (e, res) {
                    expect(e).to.be.null;
                    expect(res.some).to.be.equal('data');
                    done();
                });
            })
            .start();
    });
    it("should provide external events to HttpServerWorker so they are routed properly", function (done) {
        new Service('iw-env-ext-service')
            .use(new HttpServerWorker({
                port: ports.ConnectorWorker[2]
            }))
            .use(new SocketWorker())
            .use(new EchoWorker('test'))
            .start();
        new Service('iw-env-test-service')
            .use(new EnvironmentWorker('test', {
                serviceConnections: [{
                    name: 'iw-env-ext-service',
                    protocol: 'http',
                    host: 'localhost',
                    port: ports.ConnectorWorker[2]
                }]
            }))
            .use(new ConnectorWorker())
            .use(new HttpServerWorker({
                apiRoute: 'api',
                port: ports.ConnectorWorker[3]
            }))
            .info('ready', function (iw) {
                var url = 'http://localhost:' + ports.ConnectorWorker[3] + '/api/comm/iw-env-ext-service/ask/iw-service/list-workers';
                request({
                    url: url,
                    method: 'GET'
                }, function (e, res, body) {
                    expect(e).to.be.null;
                    expect(res.statusCode).to.be.equal(200);
                    done();
                });
            })
            .start();
    });
});
