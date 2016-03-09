/// <reference path="../../typings/master.d.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var chai = require('chai');
var expect = chai.expect;
var _ = require('lodash');
var async = require('async');
var ioClient = require('socket.io-client');
var request = require('request');
var jwt = require('jsonwebtoken');
chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));
var ports = require('../test-ports.json');
var Service = require('../../service/Service');
var Worker = require('../../workers/Worker');
var HttpServerWorker = require('../../workers/HttpServerWorker');
var SocketWorker = require('../../workers/SocketWorker');
var AuthWorker = require('../../workers/AuthWorker');
var EnvironmentWorker = require('../../workers/EnvironmentWorker');
var ConnectorWorker = require('../../workers/ConnectorWorker');
var idHelper = require('../../helpers/idHelper');
var testString = 'test-string';
var propName = 'some';
var propValue = 'data';
describe('AuthWorker', function () {
    var primary, other;
    it("should listen to comm events intended for another service, then connect to and emit the event to that service with socket auth", function (done) {
        var port = ports.AuthWorker.pop();
        other = createOtherService({
            environmentObject: {
                IW_INTERSERVICE_AUTH_TOKEN: 'thisisasecret',
                IW_JWT_AUTH_TOKEN: 'thisissecret'
            }
        }, {
            port: port
        }, {
            socket: {
                authentication: {
                    secure: true
                }
            }
        }, done, function () {
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http',
                        token: "thisisasecret"
                    }]
            }, function () {
                primary.ask('my-other-service.ask.iw-foo.foo', function (e, results) {
                    expect(e).to.be.null;
                    expect(results).to.be.equal('bar');
                    done();
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should not prevent comm events intended for another service, if socket isn't secure", function (done) {
        var port = ports.AuthWorker.pop();
        other = createOtherService({
            environmentObject: {
                IW_INTERSERVICE_AUTH_TOKEN: 'thisisasecret',
                IW_JWT_AUTH_TOKEN: 'thisissecret'
            }
        }, {
            port: port
        }, void 0, done, function () {
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                primary.ask('my-other-service.ask.iw-foo.foo', function (e, results) {
                    expect(e).to.be.null;
                    expect(results).to.be.equal('bar');
                    done();
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should fail if unable to find the interservice auth token in the local environment", function (done) {
        var port = ports.AuthWorker.pop();
        other = createOtherService({
            environmentObject: {
                IW_INTERSERVICE_AUTH_TOKEN2: 'thisisasecret',
                IW_JWT_AUTH_TOKEN: 'thisissecret'
            }
        }, {
            port: port
        }, {
            socket: {
                authentication: {
                    secure: true
                }
            }
        }, function (e) {
            expect(e.message.indexOf('unable to find environment variable')).to.be.equal(0);
            done();
        }, function () {
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http',
                        token: "thisisasecret"
                    }]
            }, function () {
                done(new Error('service should not have started'));
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should inform 'authentication-failed' with a timeout message when socket authentication times out", function (done) {
        var port = ports.AuthWorker.pop(), emitted = false;
        other = createOtherService({
            environmentObject: {
                IW_INTERSERVICE_AUTH_TOKEN: 'thisisasecret',
                IW_JWT_AUTH_TOKEN: 'thisissecret'
            }
        }, {
            port: port
        }, {
            socket: {
                authentication: {
                    secure: true,
                    timeout: 100
                }
            }
        }, function (e) {
            expect(emitted).to.be.true;
            expect(e.message.indexOf('timeout')).to.be.above(-1);
            done();
        }, function () {
            other.info('iw-auth.authentication-failed', function (e) {
                expect(e.message).to.be.equal('unable to authenticate socket connection - authentication timeout');
                done();
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                emitted = true;
                primary.ask('my-other-service.ask.foo-worker.foo', function (e, results) {
                    done(new Error('event listener should not have been called'));
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should inform 'authentication-failed' with a bad token message when the socket auth tokens do not match", function (done) {
        var port = ports.AuthWorker.pop();
        other = createOtherService({
            environmentObject: {
                IW_INTERSERVICE_AUTH_TOKEN: 'thisisasecret2',
                IW_JWT_AUTH_TOKEN: 'thisissecret'
            }
        }, {
            port: port
        }, {
            socket: {
                authentication: {
                    secure: true
                }
            }
        }, function (e) {
            expect(e.message.indexOf('bad token')).to.be.above(-1);
            done();
        }, function () {
            other.info('iw-auth.authentication-failed', function (e) {
                expect(e.message).to.be.equal('unable to authenticate socket connection - bad token');
                done();
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http',
                        token: "thisisasecret"
                    }]
            }, function () {
                done(new Error('service should not have started'));
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should provide an authentication token over socket", function (done) {
        var port = ports.AuthWorker.pop();
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        var privateKey = 'this is a secret key for jwt token signing :)';
        other = createOtherService({
            environmentObject: {
                IW_INTERSERVICE_AUTH_TOKEN: 'thisisasecret',
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, {
            socket: {
                authentication: {
                    secure: true
                }
            }
        }, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: [{
                                    name: 'iw-auth-tester'
                                }]
                        }
                    }
                };
                cb(null, userAuth);
            });
            var c = ioClient('http://localhost:' + port);
            c.on('connect', function () {
                async.waterfall([
                    function (cb) {
                        c.emit(other.getCommEvent('request.iw-auth.authenticate-creds').getText(), login, function (e, token) {
                            cb(e, token);
                        });
                    },
                    function (token, cb) {
                        var emit = other.getCommEmit('ask.iw-authorized-foo.foo-authorized');
                        c.emit(emit.getText(), emit, {
                            auth: {
                                authorization: {
                                    user: {
                                        token: token
                                    }
                                }
                            }
                        }, function (e, results) {
                            expect(e).to.be.null;
                            expect(results).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    },
                    function (cb) {
                        var emit = other.getCommEmit('ask.iw-authorized-foo.foo-authorized');
                        c.emit(emit.getText(), emit, void 0, function (e, results) {
                            expect(e).to.be.equal('unable to authorize');
                            c.on('disconnect', function () {
                                cb(null);
                            });
                            c.disconnect();
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should authenticate specified http routes using a jwt", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, {
            http: {
                authentication: {
                    listenersToAuthenticate: [
                        'ask.iw-foo.foo'
                    ]
                }
            }
        }, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-foo/foo';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(jar._jar.store.idx.localhost["/"].access_token.value).to.not.be.empty;
                            expect(jar._jar.store.idx.localhost["/"].refresh_token.value).to.not.be.empty;
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should not authenticate specified http routes using a jwt if a password is not supplied", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, {
            http: {
                authentication: {
                    listenersToAuthenticate: [
                        'ask.iw-foo.foo'
                    ]
                }
            }
        }, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        primary.ask('iw-env-primary-env.list-service-connections', function (e, srvConns) {
                            cb(e, srvConns[0].url);
                        });
                    },
                    function (baseUrl) {
                        var url = baseUrl + 'api/comm/my-other-service/request/iw-auth/authenticate';
                        var jar = request.jar();
                        request({
                            url: url,
                            method: 'POST',
                            jar: jar,
                            json: true,
                            body: {
                                username: login.username
                            }
                        }, function (e, res) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(401);
                            done();
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should authorize events based on annotated roles over http", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: [{
                                    name: 'iw-auth-tester'
                                }]
                        }
                    }
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should inform the 'authorization-failed' event if a user is not in the correct role", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: []
                        }
                    }
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                other.info('iw-auth.authorization-failed', function (failure) {
                    expect(failure.message.indexOf('authorization failed')).to.be.above(-1);
                    expect(failure.message.indexOf('foo-authorized')).to.be.above(-1);
                    done();
                });
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(403);
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should authenticate all listeners with an authorization annotation", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: []
                        }
                    }
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(403);
                            expect(body).to.be.equal('unable to authorize');
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should handle multiple user roles", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: [{
                                    name: 'iw-auth-tester'
                                }, {
                                    name: 'iw-auth-tester2'
                                }]
                        }
                    }
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should check for a role provider worker and use any branch elements to authorize an event", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        var adminRole = 'iw-auth-test-admin';
        var testerRole = 'iw-auth-tester';
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: [{
                                    name: adminRole
                                }]
                        }
                    }
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, function () {
            other.respond(other.getCommEvent('request.iw-role-provider-test.role-tree'), function (requestingWhoService, cb) {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: adminRole,
                    children: [{
                            name: testerRole
                        }]
                });
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should check for emitted object required value before authorizing an event", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: [{
                                    name: 'iw-auth-tester',
                                    emittedObject: {
                                        required: {
                                            value: testString
                                        }
                                    }
                                }]
                        }
                    }
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/check/iw-authorized-foo/check-foo';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar,
                            body: testString
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, function () {
            other.respond(other.getCommEvent('request.iw-role-provider-test.role-tree'), function (requestingWhoService, cb) {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: 'iw-auth-tester'
                });
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should not authorize an event if the emitted object required value do not match", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: [{
                                    name: 'iw-auth-tester',
                                    emittedObject: {
                                        required: {
                                            value: testString
                                        }
                                    }
                                }]
                        }
                    }
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/check/iw-authorized-foo/check-foo';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar,
                            body: testString + 'bad'
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(403);
                            expect(body).to.be.equal('unable to authorize');
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, function () {
            other.respond(other.getCommEvent('request.iw-role-provider-test.role-tree'), function (requestingWhoService, cb) {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: 'iw-auth-tester'
                });
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should check for emitted object required properties before authorizing an event", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: [{
                                    name: 'iw-auth-tester',
                                    emittedObject: {
                                        required: {
                                            properties: [{
                                                    name: propName,
                                                    value: propValue
                                                }]
                                        }
                                    }
                                }]
                        }
                    }
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/check/iw-authorized-foo/check-foo';
                        var obj = {};
                        obj[propName] = propValue;
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar,
                            body: obj
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, function () {
            other.respond(other.getCommEvent('request.iw-role-provider-test.role-tree'), function (requestingWhoService, cb) {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: 'iw-auth-tester'
                });
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should not authorize an event if the emitted object required properties do not match", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth = {
                    username: userCreds.username,
                    issuer: other.whoService,
                    authorization: {
                        user: {
                            roles: [{
                                    name: 'iw-auth-tester',
                                    emittedObject: {
                                        required: {
                                            properties: [{
                                                    name: propName,
                                                    value: propValue
                                                }]
                                        }
                                    }
                                }]
                        }
                    }
                };
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/check/iw-authorized-foo/check-foo';
                        var obj = {};
                        obj[propName] = propValue + 'bad';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar,
                            body: obj
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(403);
                            expect(body).to.be.equal('unable to authorize');
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, function () {
            other.respond(other.getCommEvent('request.iw-role-provider-test.role-tree'), function (requestingWhoService, cb) {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: 'iw-auth-tester'
                });
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should provide the access and refresh tokens via cookies and the user auth object via iw_app_user_data header", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should utilize the refresh token when the access token is expired", function (done) {
        var delay = 1;
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, {
            http: {
                accessTokenExpiration: delay
            }
        }, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        setTimeout(function () {
                            cb(null, baseUrl, jar);
                        }, delay * 1000);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            expect(JSON.parse(res.headers.iw_app_user_data).username).to.be.equal(login.username);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 when both access and refresh tokens are expired", function (done) {
        var delay = 1;
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, {
            http: {
                accessTokenExpiration: delay,
                refreshTokenExpiration: delay
            }
        }, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        setTimeout(function () {
                            cb(null, baseUrl, jar);
                        }, delay * 1000);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 if the access token is corrupt", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        jar._jar.store.idx.localhost['/'].access_token.value = 'bad';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 if the refresh token is corrupt", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        jar._jar.store.idx.localhost['/'].refresh_token.value = 'bad';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 if the access token has been resigned", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        var token = jar._jar.store.idx.localhost['/'].access_token.value;
                        var obj = jwt.decode(token);
                        jar._jar.store.idx.localhost['/'].access_token.value = jwt.sign(obj, 'bad secret');
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 if the refresh token has been resigned", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        var token = jar._jar.store.idx.localhost['/'].refresh_token.value;
                        var obj = jwt.decode(token);
                        jar._jar.store.idx.localhost['/'].refresh_token.value = jwt.sign(obj, 'bad secret');
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should not respond with a 403 when there was an actual server error that does not pertain to authentication", function (done) {
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, void 0, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-error-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(res.statusCode).to.be.equal(500);
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should save active refresh tokens in redis, if a redis worker is available", function (done) {
        var delay = 1;
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, {
            http: {
                accessTokenExpiration: delay
            }
        }, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            var mockRedis = {};
            other.respond('request.iw-redis.keys', function (pattern, cb) {
                expect(_.isString(pattern)).to.be.true;
                cb(null, [pattern]);
            });
            other.respond('check.iw-redis.set', function (set, cb) {
                expect(_.isString(set.key)).to.be.true;
                expect(_.isString(set.value)).to.be.true;
                mockRedis[set.key] = set.value;
                cb(null);
            });
            other.respond('request.iw-redis.del', function (key, cb) {
                expect(_.isString(key)).to.be.true;
                delete mockRedis[key];
                cb(null);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        setTimeout(function () {
                            cb(null, baseUrl, jar);
                        }, delay * 1000);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            expect(JSON.parse(res.headers.iw_app_user_data).username).to.be.equal(login.username);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should not allow a refresh token to be used if not found in redis, if redis worker is present", function (done) {
        var delay = 1;
        var port = ports.AuthWorker.pop();
        var privateKey = 'this is a secret key for jwt token signing :)';
        var login = {
            username: 'test-user',
            password: 'pw'
        };
        other = createOtherService({
            environmentObject: {
                IW_JWT_AUTH_TOKEN: privateKey
            }
        }, {
            port: port,
            apiRoute: 'api'
        }, {
            http: {
                accessTokenExpiration: delay
            }
        }, done, function () {
            var userAuth = {
                username: login.username,
                issuer: other.whoService,
                authorization: {
                    user: {
                        roles: [{
                                name: 'iw-auth-tester'
                            }]
                    }
                }
            };
            other.respond(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), function (userCreds, cb) {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            var mockRedis = {};
            other.respond('request.iw-redis.keys', function (pattern, cb) {
                expect(_.isString(pattern)).to.be.true;
                cb(null, []);
            });
            other.respond('check.iw-redis.set', function (set, cb) {
                expect(_.isString(set.key)).to.be.true;
                expect(_.isString(set.value)).to.be.true;
                mockRedis[set.key] = set.value;
                cb(null);
            });
            other.respond('request.iw-redis.del', function (key, cb) {
                expect(_.isString(key)).to.be.true;
                delete mockRedis[key];
                cb(null);
            });
            primary = createPrimaryService({
                serviceConnections: [{
                        name: 'my-other-service',
                        host: 'localhost',
                        port: port,
                        protocol: 'http'
                    }]
            }, function () {
                async.waterfall([
                    function (cb) {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    function (baseUrl, jar, cb) {
                        setTimeout(function () {
                            cb(null, baseUrl, jar);
                        }, delay * 1000);
                    },
                    function (baseUrl, jar, cb) {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, function (e, res, body) {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], function (e) {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    afterEach(function (done) {
        async.waterfall([
            function (cb) {
                if (!_.isUndefined(other)) {
                    other.dispose(function () {
                        cb(null);
                    });
                }
                else {
                    cb(null);
                }
            },
            function (cb) {
                if (!_.isUndefined(primary)) {
                    primary.dispose(function () {
                        cb(null);
                    });
                }
                else {
                    cb(null);
                }
            }
        ], function (e) {
            done(e);
        });
    });
});
var FooWorker = (function (_super) {
    __extends(FooWorker, _super);
    function FooWorker(name) {
        _super.call(this, [], {
            id: idHelper.newId(),
            name: 'iw-foo' + (_.isUndefined(name) || name.length === 0 ? '' : '-' + name)
        }, void 0);
    }
    FooWorker.prototype.init = function (cb) {
        this.answer('foo', function (cb) {
            cb(null, 'bar');
        });
        return _super.prototype.init.call(this, cb);
    };
    return FooWorker;
})(Worker);
var AuthorizedFooWorker = (function (_super) {
    __extends(AuthorizedFooWorker, _super);
    function AuthorizedFooWorker(name) {
        _super.call(this, [], {
            id: idHelper.newId(),
            name: 'iw-authorized-foo' + (_.isUndefined(name) || name.length === 0 ? '' : '-' + name)
        }, void 0);
    }
    AuthorizedFooWorker.prototype.init = function (cb) {
        this.annotate({
            auth: {
                authorization: {
                    roles: {
                        required: ['iw-auth-tester']
                    }
                }
            }
        }).answer('foo-authorized', function (cb) {
            cb(null, 'bar-authorized');
        });
        this.annotate({
            auth: {
                authorization: {
                    roles: {
                        required: [
                            'iw-auth-tester',
                            'iw-auth-tester2'
                        ]
                    }
                }
            }
        }).answer('foo-more-authorized', function (cb) {
            cb(null, 'bar-authorized');
        });
        this.annotate({
            auth: {
                authorization: {
                    roles: {
                        required: ['iw-auth-tester']
                    }
                }
            }
        }).verify('check-foo', function (req, cb) {
            cb(null);
        });
        this.annotate({
            auth: {
                authorization: {
                    roles: {
                        required: ['iw-auth-tester']
                    }
                }
            }
        }).answer('foo-error-authorized', function (cb) {
            cb(new Error('this is a fake error to mock an internal server error'));
        });
        return _super.prototype.init.call(this, cb);
    };
    return AuthorizedFooWorker;
})(Worker);
function createOtherService(envOpts, httpServerOpts, authOpts, done, ready, postInited) {
    return new Service('my-other-service')
        .use(new EnvironmentWorker('other-env', envOpts))
        .use(new HttpServerWorker(httpServerOpts))
        .use(new SocketWorker())
        .use(new AuthWorker(authOpts))
        .info('error', function (e) {
        done(e);
    })
        .annotate({
        internal: true
    })
        .listen('post-inited', function () {
        if (_.isFunction(postInited)) {
            postInited();
        }
    })
        .info('ready', function () {
        ready();
    });
}
function createPrimaryService(envOpts, ready, done) {
    return new Service('my-primary-service')
        .use(new EnvironmentWorker('primary-env', envOpts))
        .use(new ConnectorWorker())
        .info('error', function (e) {
        done(e);
    })
        .info('ready', function () {
        ready();
    })
        .start();
}
function authenticateOverHttp(primary, login, done, cb) {
    async.waterfall([
        function (cb) {
            primary.ask('iw-env-primary-env.list-service-connections', function (e, srvConns) {
                cb(e, srvConns[0].url);
            });
        },
        function (baseUrl) {
            var url = baseUrl + 'api/comm/my-other-service/request/iw-auth/authenticate';
            var jar = request.jar();
            request({
                url: url,
                method: 'POST',
                jar: jar,
                json: true,
                body: login
            }, function (e, res) {
                expect(e).to.be.null;
                expect(res.statusCode).to.be.equal(200);
                expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                expect(JSON.parse(res.headers.iw_app_user_data).username).to.be.equal(login.username);
                cb(null, baseUrl, jar);
            });
        }
    ], function (e) {
        expect(e).to.be.null;
        done();
    });
}
//# sourceMappingURL=AuthWorker.test.js.map