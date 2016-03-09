/// <reference path="../../typings/master.d.ts" />

import chai = require('chai');
var expect = chai.expect;

import _ = require('lodash');
import async = require('async');
import ioClient = require('socket.io-client');
import request = require('request');
import jwt = require('jsonwebtoken');

chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));
var ports = require('../test-ports.json');
import Service = require('../../service/Service');
import Comm = require('../../eventing/Comm');
import Worker = require('../../workers/Worker');
import HttpServerWorker = require('../../workers/HttpServerWorker');
import SocketWorker = require('../../workers/SocketWorker');
import AuthWorker = require('../../workers/AuthWorker');
import EnvironmentWorker = require('../../workers/EnvironmentWorker');
import ConnectorWorker = require('../../workers/ConnectorWorker');
import IFailedAuthentication = require("../../interfaces/auth/IFailedAuthentication");
import IServiceReady = require("../../interfaces/service/IServiceReady");
import IService = require('../../interfaces/service/IService');
import IWorker = require('../../interfaces/workers/IWorker');
import idHelper = require('../../helpers/idHelper');
import IUser = require('../../interfaces/auth/IUser');
import ICredentials = require('../../interfaces/auth/ICredentials');
import IUserAuth = require('../../interfaces/auth/IUserAuth');
import IAmVersioned = require('../../interfaces/whoIAm/IAmVersioned');
import IRoleTreeElement = require('../../interfaces/auth/IRoleTreeElement');

var testString = 'test-string';
var propName = 'some';
var propValue = 'data';

describe('AuthWorker', () => {
    var primary:IService, other:IService;
    it("should listen to comm events intended for another service, then connect to and emit the event to that service with socket auth", (done) => {
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
        }, done, () => {
            primary = createPrimaryService({
                serviceConnections: [{
                    name: 'my-other-service',
                    host: 'localhost',
                    port: port,
                    protocol: 'http',
                    token: "thisisasecret"
                }]
            }, () => {
                primary.ask('my-other-service.ask.iw-foo.foo', (e, results) => {
                    expect(e).to.be.null;
                    expect(results).to.be.equal('bar');
                    done();
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should not prevent comm events intended for another service, if socket isn't secure", (done) => {
        var port = ports.AuthWorker.pop();
        other = createOtherService({
            environmentObject: {
                IW_INTERSERVICE_AUTH_TOKEN: 'thisisasecret',
                IW_JWT_AUTH_TOKEN: 'thisissecret'
            }
        }, {
            port: port
        }, void 0, done, () => {
            primary = createPrimaryService({
                serviceConnections: [{
                    name: 'my-other-service',
                    host: 'localhost',
                    port: port,
                    protocol: 'http'
                }]
            }, () => {
                primary.ask('my-other-service.ask.iw-foo.foo', (e, results) => {
                    expect(e).to.be.null;
                    expect(results).to.be.equal('bar');
                    done();
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should fail if unable to find the interservice auth token in the local environment", (done) => {
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
        }, (e) => {
            expect(e.message.indexOf('unable to find environment variable')).to.be.equal(0);
            done();
        }, () => {
            primary = createPrimaryService({
                serviceConnections: [{
                    name: 'my-other-service',
                    host: 'localhost',
                    port: port,
                    protocol: 'http',
                    token: "thisisasecret"
                }]
            }, () => {
                done(new Error('service should not have started'));
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should inform 'authentication-failed' with a timeout message when socket authentication times out", (done) => {
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
        }, (e) => {
            expect(emitted).to.be.true;
            expect(e.message.indexOf('timeout')).to.be.above(-1);
            done();
        }, () => {
            other.info<Error>('iw-auth.authentication-failed', (e) => {
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
            }, () => {
                emitted = true;
                primary.ask('my-other-service.ask.foo-worker.foo', (e, results) => {
                    done(new Error('event listener should not have been called'));
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should inform 'authentication-failed' with a bad token message when the socket auth tokens do not match", (done) => {
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
        }, (e) => {
            expect(e.message.indexOf('bad token')).to.be.above(-1);
            done();
        }, () => {
            other.info<Error>('iw-auth.authentication-failed', (e) => {
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
            }, () => {
                done(new Error('service should not have started'));
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should provide an authentication token over socket", (done) => {
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
        }, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            c.on('connect', () => {
                async.waterfall([
                    (cb) => {
                        c.emit(other.getCommEvent('request.iw-auth.authenticate-creds').getText(), login, (e, token) => {
                            cb(e, token);
                        });
                    },
                    (token, cb) => {
                        var emit = other.getCommEmit('ask.iw-authorized-foo.foo-authorized');
                        c.emit(emit.getText(), emit, {
                            auth: {
                                authorization: {
                                    user: {
                                        token: token
                                    }
                                }
                            }
                        }, (e, results) => {
                            expect(e).to.be.null;
                            expect(results).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    },
                    (cb) => {
                        var emit = other.getCommEmit('ask.iw-authorized-foo.foo-authorized');
                        c.emit(emit.getText(), emit, void 0, (e, results) => {
                            expect(e).to.be.equal('unable to authorize');
                            c.on('disconnect', () => {
                                cb(null);
                            });
                            (<any>c).disconnect();
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });

    it("should authenticate specified http routes using a jwt", (done) => {
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
        }, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-foo/foo';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(jar._jar.store.idx.localhost["/"].access_token.value).to.not.be.empty;
                            expect(jar._jar.store.idx.localhost["/"].refresh_token.value).to.not.be.empty;
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should not authenticate specified http routes using a jwt if a password is not supplied", (done) => {
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
        }, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        primary.ask('iw-env-primary-env.list-service-connections', (e, srvConns) => {
                            cb(e, srvConns[0].url);
                        });
                    },
                    (baseUrl) => {
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
                        }, (e, res) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(401);
                            done();
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new FooWorker())
            .start();
    });
    it("should authorize events based on annotated roles over http", (done) => {
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
        }, void 0, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should inform the 'authorization-failed' event if a user is not in the correct role", (done) => {
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
        }, void 0, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                other.info<IFailedAuthentication>('iw-auth.authorization-failed', (failure) => {
                    expect(failure.message.indexOf('authorization failed')).to.be.above(-1);
                    expect(failure.message.indexOf('foo-authorized')).to.be.above(-1);
                    done();
                });
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(403);
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should authenticate all listeners with an authorization annotation", (done) => {
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
        }, void 0, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(403);
                            expect(body).to.be.equal('unable to authorize');
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should handle multiple user roles", (done) => {
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
        }, void 0, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should check for a role provider worker and use any branch elements to authorize an event", (done) => {
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
        }, void 0, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, () => {
            other.respond<IAmVersioned, IRoleTreeElement>(other.getCommEvent('request.iw-role-provider-test.role-tree'), (requestingWhoService, cb) => {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: adminRole,
                    children: [{
                        name: testerRole
                    }]
                })
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should check for emitted object required value before authorizing an event", (done) => {
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
        }, void 0, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/check/iw-authorized-foo/check-foo';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar,
                            body: testString
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, () => {
            other.respond<IAmVersioned, IRoleTreeElement>(other.getCommEvent('request.iw-role-provider-test.role-tree'), (requestingWhoService, cb) => {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: 'iw-auth-tester'
                })
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should not authorize an event if the emitted object required value do not match", (done) => {
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
        }, void 0, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/check/iw-authorized-foo/check-foo';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar,
                            body: testString + 'bad'
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(403);
                            expect(body).to.be.equal('unable to authorize');
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, () => {
            other.respond<IAmVersioned, IRoleTreeElement>(other.getCommEvent('request.iw-role-provider-test.role-tree'), (requestingWhoService, cb) => {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: 'iw-auth-tester'
                })
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should check for emitted object required properties before authorizing an event", (done) => {
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
        }, void 0, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/check/iw-authorized-foo/check-foo';
                        var obj = {};
                        obj[propName] = propValue;
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar,
                            body: obj
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, () => {
            other.respond<IAmVersioned, IRoleTreeElement>(other.getCommEvent('request.iw-role-provider-test.role-tree'), (requestingWhoService, cb) => {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: 'iw-auth-tester'
                })
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should not authorize an event if the emitted object required properties do not match", (done) => {
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
        }, void 0, done, () => {
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                var userAuth:IUserAuth = {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/check/iw-authorized-foo/check-foo';
                        var obj = {};
                        obj[propName] = propValue + 'bad';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar,
                            body: obj
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(403);
                            expect(body).to.be.equal('unable to authorize');
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        }, () => {
            other.respond<IAmVersioned, IRoleTreeElement>(other.getCommEvent('request.iw-role-provider-test.role-tree'), (requestingWhoService, cb) => {
                expect(requestingWhoService.name).to.be.equal(other.whoService.name);
                cb(null, {
                    name: 'iw-auth-tester'
                })
            });
        })
            .use(new AuthorizedFooWorker())
            .start();
    });

    it("should provide the access and refresh tokens via cookies and the user auth object via iw_app_user_data header", (done) => {
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
        }, void 0, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should utilize the refresh token when the access token is expired", (done) => {
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
        }, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond<IUser, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), (userCreds, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        setTimeout(() => {
                            cb(null, baseUrl, jar);
                        }, delay * 1000);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            expect(JSON.parse(res.headers.iw_app_user_data).username).to.be.equal(login.username);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 when both access and refresh tokens are expired", (done) => {
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
        }, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond<IUser, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), (userCreds, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        setTimeout(() => {
                            cb(null, baseUrl, jar);
                        }, delay * 1000);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 if the access token is corrupt", (done) => {
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
        }, void 0, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond<IUser, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), (userCreds, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        (<any>jar)._jar.store.idx.localhost['/'].access_token.value = 'bad';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 if the refresh token is corrupt", (done) => {
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
        }, void 0, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond<IUser, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), (userCreds, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        (<any>jar)._jar.store.idx.localhost['/'].refresh_token.value = 'bad';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 if the access token has been resigned", (done) => {
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
        }, void 0, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond<IUser, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), (userCreds, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        var token = (<any>jar)._jar.store.idx.localhost['/'].access_token.value;
                        var obj = jwt.decode(token);
                        (<any>jar)._jar.store.idx.localhost['/'].access_token.value = jwt.sign(obj, 'bad secret');
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should respond with a 400 if the refresh token has been resigned", (done) => {
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
        }, void 0, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond<IUser, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), (userCreds, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        var token = (<any>jar)._jar.store.idx.localhost['/'].refresh_token.value;
                        var obj = jwt.decode(token);
                        (<any>jar)._jar.store.idx.localhost['/'].refresh_token.value = jwt.sign(obj, 'bad secret');
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should not respond with a 403 when there was an actual server error that does not pertain to authentication", (done) => {
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
        }, void 0, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond<IUser, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), (userCreds, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-error-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(res.statusCode).to.be.equal(500);
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });

    it("should save active refresh tokens in redis, if a redis worker is available", (done) => {
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
        }, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond<IUser, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            var mockRedis = {};
            other.respond<string, string[]>('request.iw-redis.keys', (pattern, cb) => {
                expect(_.isString(pattern)).to.be.true;
                cb(null, [ pattern ]);
            });
            other.respond<string, string[]>('check.iw-redis.set', (set: any, cb) => {
                expect(_.isString(set.key)).to.be.true;
                expect(_.isString(set.value)).to.be.true;
                mockRedis[set.key] = set.value;
                cb(null);
            });
            other.respond<string, string[]>('request.iw-redis.del', (key, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        setTimeout(() => {
                            cb(null, baseUrl, jar);
                        }, delay * 1000);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(200);
                            expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                            expect(JSON.parse(res.headers.iw_app_user_data).username).to.be.equal(login.username);
                            expect(body).to.be.equal('bar-authorized');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    it("should not allow a refresh token to be used if not found in redis, if redis worker is present", (done) => {
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
        }, done, () => {
            var userAuth:IUserAuth = {
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
            other.respond<ICredentials, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.validate-user-credentials'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                expect(userCreds.password).to.be.equal(login.password);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            other.respond<IUser, IUserAuth>(other.getCommEvent('request.iw-user-validator-test.get-user-auth'), (userCreds, cb) => {
                expect(userCreds.username).to.be.equal(login.username);
                userAuth.username = userCreds.username;
                cb(null, userAuth);
            });
            var mockRedis = {};
            other.respond<string, string[]>('request.iw-redis.keys', (pattern, cb) => {
                expect(_.isString(pattern)).to.be.true;
                cb(null, []);
            });
            other.respond<string, string[]>('check.iw-redis.set', (set: any, cb) => {
                expect(_.isString(set.key)).to.be.true;
                expect(_.isString(set.value)).to.be.true;
                mockRedis[set.key] = set.value;
                cb(null);
            });
            other.respond<string, string[]>('request.iw-redis.del', (key, cb) => {
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
            }, () => {
                async.waterfall([
                    (cb) => {
                        authenticateOverHttp(primary, login, done, cb);
                    },
                    (baseUrl, jar, cb) => {
                        setTimeout(() => {
                            cb(null, baseUrl, jar);
                        }, delay * 1000);
                    },
                    (baseUrl, jar, cb) => {
                        var url = baseUrl + 'api/comm/my-other-service/ask/iw-authorized-foo/foo-authorized';
                        request({
                            url: url,
                            method: 'POST',
                            json: true,
                            jar: jar
                        }, (e, res, body) => {
                            expect(e).to.be.null;
                            expect(res.statusCode).to.be.equal(400);
                            expect(body).to.be.equal('invalid token');
                            cb(null);
                        });
                    }
                ], (e) => {
                    expect(e).to.be.null;
                    done();
                });
            }, done);
        })
            .use(new AuthorizedFooWorker())
            .start();
    });
    afterEach((done) => {
        async.waterfall([
            (cb) => {
                if (!_.isUndefined(other)) {
                    other.dispose(() => {
                        cb(null);
                    });
                }
                else {
                    cb(null);
                }
            },
            (cb) => {
                if (!_.isUndefined(primary)) {
                    primary.dispose(() => {
                        cb(null);
                    });
                }
                else {
                    cb(null);
                }
            }
        ], (e) => {
            done(e);
        });
    });
});

class FooWorker extends Worker implements IWorker {
    constructor(name?) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-foo' + (_.isUndefined(name) || name.length === 0 ? '' : '-' + name)
        }, void 0);
    }
    public init(cb): IWorker {
        this.answer('foo', (cb) => {
            cb(null, 'bar');
        });
        return super.init(cb);
    }
}

class AuthorizedFooWorker extends Worker implements IWorker {
    constructor(name?) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-authorized-foo' + (_.isUndefined(name) || name.length === 0 ? '' : '-' + name)
        }, void 0);
    }
    public init(cb): IWorker {
        this.annotate({
            auth: {
                authorization: {
                    roles: {
                        required: [ 'iw-auth-tester' ]
                    }
                }
            }
        }).answer('foo-authorized', (cb) => {
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
        }).answer('foo-more-authorized', (cb) => {
            cb(null, 'bar-authorized');
        });
        this.annotate({
            auth: {
                authorization: {
                    roles: {
                        required: [ 'iw-auth-tester' ]
                    }
                }
            }
        }).verify('check-foo', (req, cb) => {
            cb(null);
        });
        this.annotate({
            auth: {
                authorization: {
                    roles: {
                        required: [ 'iw-auth-tester' ]
                    }
                }
            }
        }).answer('foo-error-authorized', (cb) => {
            cb(new Error('this is a fake error to mock an internal server error'));
        });
        return super.init(cb);
    }
}

function createOtherService(envOpts, httpServerOpts, authOpts, done, ready, postInited?): IService {
    return <IService>new Service('my-other-service')
        .use(new EnvironmentWorker('other-env', envOpts))
        .use(new HttpServerWorker(httpServerOpts))
        .use(new SocketWorker())
        .use(new AuthWorker(authOpts))
        .info('error', (e) => {
            done(e);
        })
        .annotate({
            internal: true
        })
        .listen('post-inited', () => {
            if (_.isFunction(postInited)) {
                postInited();
            }
        })
        .info('ready', () => {
            ready();
        });
}

function createPrimaryService(envOpts, ready, done): IService {
    return <IService>new Service('my-primary-service')
        .use(new EnvironmentWorker('primary-env', envOpts))
        .use(new ConnectorWorker())
        .info('error', (e) => {
            done(e);
        })
        .info('ready', () => {
            ready();
        })
        .start();
}

function authenticateOverHttp(primary, login, done, cb) {
    async.waterfall([
        (cb) => {
            primary.ask('iw-env-primary-env.list-service-connections', (e, srvConns) => {
                cb(e, srvConns[0].url);
            });
        },
        (baseUrl) => {
            var url = baseUrl + 'api/comm/my-other-service/request/iw-auth/authenticate';
            var jar = request.jar();
            request({
                url: url,
                method: 'POST',
                jar: jar,
                json: true,
                body: login
            }, (e, res) => {
                expect(e).to.be.null;
                expect(res.statusCode).to.be.equal(200);
                expect(!_.isUndefined(res.headers.iw_app_user_data)).to.be.true;
                expect(JSON.parse(res.headers.iw_app_user_data).username).to.be.equal(login.username);
                cb(null, baseUrl, jar);
            });
        }
    ], (e) => {
        expect(e).to.be.null;
        done();
    });
}
