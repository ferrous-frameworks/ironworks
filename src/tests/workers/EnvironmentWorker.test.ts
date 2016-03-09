/// <reference path="../../typings/tsd/tsd.d.ts" />

import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

import _ = require('lodash');
import async = require('async');

chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));

import idHelper = require('../../helpers/idHelper');

import Service = require('../../service/Service');

import EnvironmentWorker = require('../../workers/EnvironmentWorker');
import IServiceReady = require("../../interfaces/service/IServiceReady");
import IServiceConnection = require("../../interfaces/workers/IServiceConnection");
import IEnvironmentWorkerOpts = require("../../interfaces/opts/IEnvironmentWorkerOpts");
import IGenericConnection = require("../../interfaces/workers/IGenericConnection");

describe('EnvironmentWorker', function () {
    it("should have a 'list-service-connections' listener that provides service connections for configured external services", function (done) {
        var extSrvConns = [{
            name: 'ext-service-0',
            protocol: 'http',
            host: 'localhost',
            port: '0'
        }, {
            name: 'ext-service-1',
            protocol: 'http',
            host: 'localhost',
            port: '1'
        }];
        new Service('iw-env-test-service')
            .use(new EnvironmentWorker('test', {
                serviceConnections: extSrvConns
            }))
            .info<IServiceReady>('ready', function (iw) {
                iw.service.ask<IServiceConnection[]>('iw-env-test.list-service-connections', function (e, srvConns) {
                    expect(_.isArray(srvConns)).to.be.true;
                    expect(srvConns.length).to.be.equal(2);
                    expect(srvConns[0].name).to.equal(extSrvConns[0].name);
                    expect(srvConns[0].protocol).to.equal(extSrvConns[0].protocol);
                    expect(srvConns[0].host).to.equal(extSrvConns[0].host);
                    expect(srvConns[0].port).to.equal(extSrvConns[0].port);
                    expect(srvConns[0].url).to.equal('http://localhost:0/');
                    expect(srvConns[1].name).to.equal(extSrvConns[1].name);
                    expect(srvConns[1].protocol).to.equal(extSrvConns[1].protocol);
                    expect(srvConns[1].host).to.equal(extSrvConns[1].host);
                    expect(srvConns[1].port).to.equal(extSrvConns[1].port);
                    expect(srvConns[1].url).to.equal('http://localhost:1/');
                    done();
                });
            })
            .start();
    });

    it("should have a 'list-generic-connections' listener that provides generic connections for configured generic services", function (done) {
        var genConnections:IServiceConnection[] = [{
            name: 'service-x',
            host: 'localhost',
            port: '0',
            type: 'x',
            data: {
                some: 'x-data'
            }
        }, {
            name: 'service-y',
            host: 'localhost',
            port: '1',
            type: 'y',
            data: {
                some: 'y-data'
            }
        }];
        new Service('iw-env-test-service')
            .use(new EnvironmentWorker('test', <IEnvironmentWorkerOpts>{
                genericConnections: genConnections
            }))
            .info<IServiceReady>('ready', function (iw) {
                iw.service.ask<IGenericConnection[]>('iw-env-test.list-generic-connections', function (e, genConns) {
                    expect(_.isArray(genConns)).to.be.true;
                    expect(genConns.length).to.be.equal(2);
                    expect(genConns[0].name).to.equal(genConnections[0].name);
                    expect(genConns[0].host).to.equal(genConnections[0].host);
                    expect(genConns[0].port).to.equal(genConnections[0].port);
                    expect(genConns[1].name).to.equal(genConnections[1].name);
                    expect(genConns[1].host).to.equal(genConnections[1].host);
                    expect(genConns[1].port).to.equal(genConnections[1].port);
                    done();
                });
            })
            .start();
    });

    it("should have a 'env-var' listener that provides value of an environment variable given the key", function (done) {
        process.env.ENV_WRK_TEST = 'test';
        new Service('iw-env-test-service')
            .use(new EnvironmentWorker('test'))
            .info<IServiceReady>('ready', function (iw) {
                iw.service.request('iw-env-test.env-var', "ENV_WRK_TEST", function (e, v) {
                    expect(v).to.be.equal('test');
                    done();
                });
            })
            .start();
    });

    it("should accept a 'environmentObject' option that sets the environment variables for 'env-var'", function (done) {
        new Service('iw-env-test-service')
            .use(new EnvironmentWorker('test', {
                environmentObject: {
                    ENV_WRK_TEST: 'test'
                }
            }))
            .info<IServiceReady>('ready', function (iw) {
                iw.service.request('iw-env-test.env-var', "ENV_WRK_TEST", function (e, v) {
                    expect(v).to.be.equal('test');
                    done();
                });
            })
            .start();
    });
});
