///<reference path='../typings/master.d.ts' />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var async = require('async');
var jwt = require('jsonwebtoken');
var ironTree = require('iron-tree');
var IronTree = ironTree.Tree;
var idHelper = require('../helpers/idHelper');
var Worker = require('./Worker');
var HttpAutoAuthenticationType = require('../enums/auth/HttpAutoAuthenticationType');
var CommEvent = require('../eventing/CommEvent');
var AuthWorker = (function (_super) {
    __extends(AuthWorker, _super);
    function AuthWorker(opts) {
        _super.call(this, ['iw-socket', 'iw-http-server'], {
            id: idHelper.newId(true),
            name: 'iw-auth'
        }, opts);
        var defOpts = {
            socket: {
                authentication: {
                    timeout: 1000,
                    secure: false,
                    interserviceTokenEnvVarName: 'IW_INTERSERVICE_AUTH_TOKEN'
                }
            },
            http: {
                authentication: {
                    auto: HttpAutoAuthenticationType.none,
                    listenersToAuthenticate: [],
                    listenersToNotAuthenticate: [],
                    workersToAuthenticate: [],
                    workersToNotAuthenticate: []
                },
                clientSecretEnvVarName: 'IW_JWT_AUTH_TOKEN',
                accessTokenExpiration: 60,
                refreshTokenExpiration: 30 * 24 * 60 * 60
            }
        };
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        this.socketAuth = {
            timeout: this.opts.get('socket.authentication.timeout'),
            secure: this.opts.get('socket.authentication.secure'),
            interserviceTokenEnvVarName: this.opts.get('socket.authentication.interserviceTokenEnvVarName'),
            interserviceToken: void 0
        };
        this.httpAuth = {
            auto: this.opts.get('http.authentication.auto'),
            clientSecret: void 0,
            securedListeners: [],
            listenersToAuthenticate: this.opts.get('http.authentication.listenersToAuthenticate'),
            listenersToNotAuthenticate: this.opts.get('http.authentication.listenersToNotAuthenticate'),
            workersToAuthenticate: this.opts.get('http.authentication.workersToAuthenticate'),
            workersToNotAuthenticate: this.opts.get('http.authentication.workersToNotAuthenticate'),
            clientSecretEnvVarName: this.opts.get('http.clientSecretEnvVarName'),
            accessTokenExpiration: this.opts.get('http.accessTokenExpiration'),
            refreshTokenExpiration: this.opts.get('http.refreshTokenExpiration')
        };
        this.roleTree = new IronTree();
    }
    AuthWorker.prototype.init = function (cb) {
        var _this = this;
        var envVarListener = _.find(this.allCommListeners(), function (l) {
            return l.commEvent.worker.indexOf('iw-env') === 0 && l.commEvent.name === 'env-var';
        });
        if (_.isUndefined(envVarListener)) {
            cb(new Error('unable to find environment worker'));
            return this;
        }
        this.envVarEvent = envVarListener.commEvent;
        this.info('iw-service.available-listeners', function (listeners) {
            _this.serviceListeners = listeners;
        });
        this.intercept(this.getCommEvent('*.*.*'), {
            preEmit: function (stop, next, anno) {
                var args = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    args[_i - 3] = arguments[_i];
                }
                if (!_.isUndefined(anno.auth)) {
                    var username = anno.auth.username;
                    if (!_.isUndefined(anno.auth.authorization)) {
                        var authorization = anno.auth.authorization;
                        var requiredRoles = [];
                        if (!_.isUndefined(authorization.roles) && _.isArray(authorization.roles.required)) {
                            requiredRoles = _.map(authorization.roles.required, function (roleOrString) {
                                if (typeof roleOrString === 'string') {
                                    return {
                                        name: roleOrString
                                    };
                                }
                                else {
                                    return roleOrString;
                                }
                            });
                        }
                        var emittedObject;
                        if (args.length === 2) {
                            if (!_.isFunction(args[1])) {
                                emittedObject = args[1];
                            }
                        }
                        if (args.length === 3) {
                            emittedObject = args[1];
                        }
                        var cb = _.last(args);
                        if (!_.isUndefined(authorization.user)) {
                            var user = authorization.user;
                            var emit = _this.getCommEmit(args[0]);
                            if (!_.isUndefined(user.token)) {
                                jwt.verify(user.token, _this.httpAuth.clientSecret, function (e, verified) {
                                    if (e === null) {
                                        user.roles = _.get(verified, 'authorization.user.roles');
                                        if (_.isArray(user.roles)) {
                                            var authorized = _this.checkUserRoles(requiredRoles, user.roles, emittedObject);
                                            if (authorized) {
                                                next();
                                            }
                                            else {
                                                cb(AuthWorker.getRoleError(emit, requiredRoles, username, user.roles));
                                            }
                                        }
                                        else {
                                            _this.inform('error', new Error('unable to find roles on verified token'));
                                            cb('unable to authorize');
                                        }
                                    }
                                    else {
                                        _this.inform('error', e);
                                        cb('unable to authorize');
                                    }
                                });
                            }
                            else if (_.isArray(user.roles)) {
                                var authorized = _this.checkUserRoles(requiredRoles, user.roles, emittedObject);
                                if (authorized) {
                                    next();
                                }
                                else {
                                    cb(AuthWorker.getRoleError(emit, requiredRoles, username, user.roles));
                                }
                            }
                            else {
                                _this.inform('error', new Error('user token missing from authorization object'));
                                cb('unable to authorize');
                            }
                        }
                        else if (!_.isEmpty(requiredRoles)) {
                            _this.inform('error', new Error('user missing from authorization object'));
                            cb('unable to authorize');
                        }
                    }
                    else {
                        next();
                    }
                }
                else {
                    next();
                }
            }
        });
        async.waterfall([
            function (cb) {
                _this.initSocketAuthentication(function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.initTokenAuthentication(function (e) {
                    cb(e);
                });
            }
        ], function (e) {
            if (e === null) {
                _super.prototype.init.call(_this, cb);
            }
            else if (!_.isUndefined(cb)) {
                cb(e);
            }
            else {
                _this.inform('error', e);
            }
        });
        return this;
    };
    AuthWorker.prototype.checkUserRoles = function (requiredRoles, userRoles, emittedObject) {
        var _this = this;
        if (_.isEmpty(requiredRoles)) {
            return true;
        }
        var allUserRoles = [];
        if (!this.roleTree.isEmpty()) {
            _.each(userRoles, function (userRoleOrString) {
                var userRole = AuthWorker.getRoleFromRoleOrString(userRoleOrString);
                var userRoleClone = _.cloneDeep(userRole);
                var childRoles = _this.roleTree.getBranches(userRoleClone.name);
                childRoles = _.map(childRoles, function (childRole) {
                    if (childRole.name === userRole.name) {
                        return _.merge(userRoleClone, childRole);
                    }
                    else {
                        return childRole;
                    }
                });
                allUserRoles = allUserRoles.concat(childRoles);
            });
        }
        else {
            allUserRoles = _.clone(userRoles);
        }
        return _.every(requiredRoles, function (requiredRoleOrString) {
            var requiredRole = AuthWorker.getRoleFromRoleOrString(requiredRoleOrString);
            return _.any(allUserRoles, function (userRoleOrString) {
                var userRole = AuthWorker.getRoleFromRoleOrString(userRoleOrString);
                if (userRole.name !== requiredRole.name) {
                    return false;
                }
                if (_.isUndefined(userRole.emittedObject)) {
                    return true;
                }
                if (_.isUndefined(userRole.emittedObject.required)) {
                    return true;
                }
                if (!_.isUndefined(userRole.emittedObject.required.value)) {
                    return _.isEqual(emittedObject, userRole.emittedObject.required.value);
                }
                else if (!_.isUndefined(userRole.emittedObject.required.properties)) {
                    return _.every(userRole.emittedObject.required.properties, function (roleProp) {
                        return emittedObject[roleProp.name] === roleProp.value;
                    });
                }
                return true;
            });
        });
    };
    AuthWorker.getRoleFromRoleOrString = function (roleOrString) {
        var role;
        if (_.isString(roleOrString)) {
            role = {
                name: roleOrString
            };
        }
        else {
            role = roleOrString;
        }
        return role;
    };
    AuthWorker.getRoleError = function (emit, requiredRoles, username, userRoles) {
        var userRolesText = _.map(userRoles, function (userRole) {
            var emittedRoleStr = '';
            if (!_.isUndefined(userRole.emittedObject) && !_.isUndefined(userRole.emittedObject.required)) {
                if (_.isArray(userRole.emittedObject.required.properties)) {
                    _.each(userRole.emittedObject.required.properties, function (prop) {
                        emittedRoleStr = prop.name + ':' + prop.value + '|';
                    });
                    emittedRoleStr = emittedRoleStr.substring(0, emittedRoleStr.length - 1);
                }
                else if (!_.isUndefined(userRole.emittedObject.required.value)) {
                    emittedRoleStr = 'emittedObject:' + userRole.emittedObject.required.value;
                }
            }
            return userRole.name + (!_.isUndefined(emittedRoleStr) ? '[' + emittedRoleStr + ']' : '');
        }).join(', ');
        return new Error('authorization failed - ' + emit.getText() + ' requires ' +
            _.pluck(requiredRoles, 'name').join(',') + ' role(s); ' + username + ' is a member of ' +
            userRolesText + ' role(s)');
    };
    AuthWorker.prototype.preStart = function (deps, cb) {
        var _this = this;
        async.waterfall([
            function (cb) {
                _this.setupRoleProvider(function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.startSocketAuthentication(deps, function (e) {
                    cb(e);
                });
            },
            function (cb) {
                _this.startHttpAuthentication(deps, function (e) {
                    cb(e);
                });
            }
        ], function (e) {
            if (e === null) {
                _super.prototype.preStart.call(_this, deps, cb);
            }
            else if (!_.isUndefined(cb)) {
                cb(e);
            }
            else {
                _this.inform('error', e);
            }
        });
        return this;
    };
    AuthWorker.prototype.setupRoleProvider = function (cb) {
        var _this = this;
        var getRoleListener = _.find(this.allCommListeners(), function (l) {
            return l.commEvent.worker.indexOf('iw-role-provider') === 0 && l.commEvent.name === 'role-tree';
        });
        if (!_.isUndefined(getRoleListener)) {
            var emit = this.getCommEmit(getRoleListener.commEvent);
            this.request(emit, this.whoService, function (e, roleTreeElementOrString) {
                var roleTreeElement;
                if (e === null) {
                    if (typeof roleTreeElementOrString === 'string') {
                        roleTreeElement = {
                            name: roleTreeElementOrString
                        };
                    }
                    else {
                        roleTreeElement = roleTreeElementOrString;
                    }
                    _this.putRoleElementInTree(roleTreeElement);
                    cb(null);
                }
                else {
                    cb(e);
                }
            });
        }
        else {
            cb(null);
        }
    };
    AuthWorker.prototype.putRoleElementInTree = function (roleTreeElement, atKey) {
        var _this = this;
        if (!_.isUndefined(atKey)) {
            atKey += '.';
        }
        else {
            atKey = '';
        }
        atKey += roleTreeElement.name;
        var role = AuthWorker.getRoleFromTreeElement(roleTreeElement);
        this.roleTree.add(atKey, role);
        if (!_.isEmpty(roleTreeElement.children)) {
            _.each(roleTreeElement.children, function (child) {
                _this.putRoleElementInTree(child, atKey);
            });
        }
    };
    AuthWorker.getRoleFromTreeElement = function (roleTreeElement) {
        var role = _.cloneDeep(roleTreeElement);
        delete role.children;
        return role;
    };
    AuthWorker.prototype.initSocketAuthentication = function (cb) {
        var _this = this;
        if (this.socketAuth.secure) {
            async.waterfall([
                function (cb) {
                    _this.confirm('iw-socket.secure', function (e) {
                        cb(e);
                    });
                },
                function (cb) {
                    _this.getEnvVar(_this.socketAuth.interserviceTokenEnvVarName, function (e, token) {
                        if (e === null) {
                            if (!_.isEmpty(token)) {
                                _this.socketAuth.interserviceToken = token;
                            }
                            else {
                                e = new Error('unable to find environment variable ' + _this.socketAuth.interserviceTokenEnvVarName);
                            }
                        }
                        cb(e);
                    });
                }
            ], function (e) {
                cb(e);
            });
        }
        else {
            cb(null);
        }
    };
    AuthWorker.prototype.startSocketAuthentication = function (deps, cb) {
        var _this = this;
        if (this.socketAuth.secure) {
            var socketWorker = _.find(deps.list(), function (worker) {
                return worker.me.name === 'iw-socket';
            });
            socketWorker.socketServer.use(function (socket, next) {
                socket.authentication = {
                    authenticated: false,
                    timeout: false,
                    interservice: false
                };
                var timer = setTimeout(function () {
                    socket.authentication.timeout = true;
                    var reason = "authentication timeout";
                    _this.cannotAuthenticate(socket, reason);
                    _this.inform('timeout', {
                        type: 'socket-authentication',
                        timeout: _this.socketAuth.timeout,
                        reason: reason
                    });
                }, _this.socketAuth.timeout);
                socket.on(_this.getCommEvent('authenticate-interservice', 'check').getText(), function (tokenAuth, cb) {
                    if (_.isObject(tokenAuth) && !_.isEmpty(tokenAuth.accessToken)) {
                        if (!socket.authentication.timeout) {
                            clearTimeout(timer);
                            if (!_.isEmpty(_this.socketAuth.interserviceToken) && _.isEqual(_this.socketAuth.interserviceToken, tokenAuth.accessToken)) {
                                socket.authentication.authenticated = true;
                                socket.authentication.interservice = true;
                                cb(null);
                            }
                            else {
                                _this.cannotAuthenticate(socket, "bad token", timer, cb);
                            }
                        }
                    }
                    else {
                        _this.cannotAuthenticate(socket, "token not found on emitted object", timer, cb);
                    }
                });
                socket.on(_this.getCommEvent('authenticate-creds', 'request').getText(), function (creds, cb) {
                    if (!socket.authentication.timeout) {
                        clearTimeout(timer);
                        _this.request('authenticate', creds, function (e, token) {
                            if (e === null) {
                                socket.authentication.authenticated = true;
                                cb(null, token.accessToken);
                            }
                            else {
                                _this.cannotAuthenticate(socket, e, timer, cb);
                            }
                        });
                    }
                });
                next();
            });
        }
        cb(null);
    };
    AuthWorker.prototype.cannotAuthenticate = function (socket, reason, timer, cb) {
        clearTimeout(timer);
        if (!_.isUndefined(cb)) {
            cb('unable to authenticate');
        }
        socket.disconnect(true);
        this.inform('authentication-failed', {
            message: "unable to authenticate socket connection - " + reason
        });
    };
    AuthWorker.prototype.initTokenAuthentication = function (cb) {
        var _this = this;
        this.annotate({
            log: {
                properties: [{
                        name: 'password',
                        secure: true
                    }]
            }
        }).respond('authenticate', function (creds, cb) {
            if (!_.isUndefined(creds.password)) {
                _this.getTokenAuth(creds, function (e, tokenAuth) {
                    cb(e, tokenAuth);
                });
            }
            else {
                cb(new Error('password cannot be blank'));
            }
        });
        this.getEnvVar(this.httpAuth.clientSecretEnvVarName, function (e, clientSecret) {
            if (e === null) {
                if (!_.isEmpty(clientSecret)) {
                    _this.httpAuth.clientSecret = clientSecret;
                }
                else {
                    _this.inform('warn', new Error('unable to find environment variable ' + _this.httpAuth.clientSecretEnvVarName));
                }
                cb(null);
            }
            else {
                cb(e);
            }
        });
    };
    AuthWorker.prototype.getTokenAuth = function (data, cb) {
        var _this = this;
        async.waterfall([
            function (cb) {
                var event = void 0;
                if (!_.isUndefined(data.password)) {
                    event = 'validate-user-credentials';
                }
                else {
                    event = 'get-user-auth';
                    data = { username: data.username };
                }
                var userAuthListener = _.find(_this.allCommListeners(), function (l) {
                    return l.commEvent.worker.indexOf('iw-user-validator') === 0 && l.commEvent.name === event;
                });
                if (!_.isUndefined(userAuthListener)) {
                    cb(null, userAuthListener.commEvent);
                }
                else {
                    cb(new Error("unable to find an 'iw-user-validator' worker with a '" + event + "' listener"));
                }
            },
            function (userAuthEmit, cb) {
                _this.request(userAuthEmit, data, function (e, userAuth) {
                    cb(e, userAuth);
                });
            },
            function (userAuth, cb) {
                var id = idHelper.newId();
                var refreshToken = jwt.sign({
                    id: id,
                    issuer: userAuth.issuer,
                    username: userAuth.username
                }, _this.httpAuth.clientSecret, {
                    issuer: _this.whoService.name + '[' + _this.whoService.id + ']',
                    expiresIn: _this.httpAuth.refreshTokenExpiration
                });
                var redisSetListener = _.find(_this.allCommListeners(), function (l) {
                    return l.commEvent.worker.indexOf('iw-redis') === 0 && l.commEvent.method === 'check' && l.commEvent.name === 'set';
                });
                if (!_.isUndefined(redisSetListener)) {
                    _this.check(redisSetListener.event, {
                        key: _this.getRedisActiveRefreshTokenKey(userAuth.username, id),
                        value: refreshToken,
                        ex: _this.httpAuth.refreshTokenExpiration
                    }, function (e) {
                        cb(e, userAuth, refreshToken);
                    });
                }
                else {
                    cb(null, userAuth, refreshToken);
                }
            },
            function (userAuth, refreshToken) {
                cb(null, {
                    userAuth: userAuth,
                    accessToken: jwt.sign(userAuth, _this.httpAuth.clientSecret, {
                        issuer: _this.whoService.name + '[' + _this.whoService.id + ']',
                        expiresIn: _this.httpAuth.accessTokenExpiration
                    }),
                    refreshToken: refreshToken
                });
            }
        ], function (e) {
            cb(e);
        });
    };
    AuthWorker.prototype.startHttpAuthentication = function (deps, cb) {
        var _this = this;
        async.waterfall([
            function (cb) {
                if (_.isEmpty(_this.serviceListeners)) {
                    _this.ask('iw-service.list-listeners', function (e, listeners) {
                        _this.serviceListeners = _.filter(listeners, function (l) {
                            return !(l.commEvent.worker === _this.me.name && l.commEvent.name === 'authenticate');
                        });
                        cb(e);
                    });
                }
                else {
                    cb(null);
                }
            },
            function (cb) {
                _this.ask('iw-http-server.route-config', function (e, routeConfig) {
                    cb(e, routeConfig);
                });
            },
            function (routeConfig, cb) {
                _this.secureServiceListeners();
                if (!_.isEmpty(_this.httpAuth.securedListeners)) {
                    var httpServerWorker = _.find(deps.list(), function (worker) {
                        return worker.me.name === 'iw-http-server';
                    });
                    httpServerWorker.httpServer.state('access_token', {
                        path: '/'
                    });
                    httpServerWorker.httpServer.state('refresh_token', {
                        path: '/'
                    });
                    httpServerWorker.httpServer.auth.scheme('iw-auth-scheme', function (server, opts) {
                        return {
                            authenticate: function (req, reply) {
                                req.app.tokenAuth = void 0;
                                async.waterfall([
                                    function (cb) {
                                        jwt.verify(req.state.access_token, _this.httpAuth.clientSecret, function (e, token) {
                                            if (e === null) {
                                                cb(null, token, false);
                                            }
                                            else if (e instanceof jwt.TokenExpiredError) {
                                                cb(null, void 0, true);
                                            }
                                            else {
                                                cb(e);
                                            }
                                        });
                                    },
                                    function (access, accessExpired, cb) {
                                        jwt.verify(req.state.refresh_token, _this.httpAuth.clientSecret, function (e, token) {
                                            if (e === null) {
                                                cb(null, access, accessExpired, token, false);
                                            }
                                            else if (e instanceof jwt.TokenExpiredError) {
                                                cb(null, access, accessExpired, void 0, true);
                                            }
                                            else {
                                                cb(e);
                                            }
                                        });
                                    },
                                    function (access, accessExpired, refresh, refreshExpired, cb) {
                                        if (!accessExpired) {
                                            req.app.tokenAuth = {
                                                accessToken: req.state.access_token,
                                                refreshToken: req.state.refresh_token,
                                                userAuth: {
                                                    authorization: access.authorization,
                                                    username: access.username
                                                }
                                            };
                                            reply.continue({
                                                isAuthenticated: true,
                                                credentials: _.merge(req.app.tokenAuth.userAuth, {
                                                    authentication: {
                                                        interservice: false
                                                    }
                                                })
                                            });
                                            cb(null);
                                        }
                                        else if (!refreshExpired) {
                                            async.waterfall([
                                                function (cb) {
                                                    var redisKeysListener = _.find(_this.allCommListeners(), function (l) {
                                                        return l.commEvent.worker.indexOf('iw-redis') === 0 && l.commEvent.name === 'keys';
                                                    });
                                                    var redisDelListener = _.find(_this.allCommListeners(), function (l) {
                                                        return l.commEvent.worker.indexOf('iw-redis') === 0 && l.commEvent.name === 'del';
                                                    });
                                                    if (!_.isUndefined(redisKeysListener) && !_.isUndefined(redisDelListener)) {
                                                        var key = _this.getRedisActiveRefreshTokenKey(refresh.username, refresh.id);
                                                        async.waterfall([
                                                            function (cb) {
                                                                _this.request(redisKeysListener.event, key, function (e, keys) {
                                                                    cb(e, _.isArray(keys) ? keys[0] : void 0);
                                                                });
                                                            },
                                                            function (refreshTokenKey, cb) {
                                                                if (!_.isUndefined(refreshTokenKey)) {
                                                                    _this.request(redisDelListener.event, key, function (e) {
                                                                        cb(e);
                                                                    });
                                                                }
                                                                else {
                                                                    cb(new Error('refresh token has already been used or has been revoked'));
                                                                }
                                                            }
                                                        ], function (e) {
                                                            cb(e);
                                                        });
                                                    }
                                                    else {
                                                        cb(null);
                                                    }
                                                },
                                                function () {
                                                    _this.getTokenAuth(refresh, function (e, tokenAuth) {
                                                        req.app.tokenAuth = tokenAuth;
                                                        reply.continue({
                                                            isAuthenticated: true,
                                                            credentials: _.merge(tokenAuth.userAuth, {
                                                                authentication: {
                                                                    interservice: false
                                                                }
                                                            })
                                                        });
                                                        cb(null);
                                                    });
                                                }
                                            ], function (e) {
                                                cb(e);
                                            });
                                        }
                                        else {
                                            cb(new Error('refresh token is expired'));
                                        }
                                    }
                                ], function (e) {
                                    if (e !== null) {
                                        _this.inform('authentication-failed', {
                                            endpoint: req.path,
                                            message: e.message
                                        });
                                        var res = reply('invalid token');
                                        res.unstate('access_token');
                                        res.unstate('refresh_token');
                                        res.statusCode = 400;
                                    }
                                });
                            }
                        };
                    });
                    httpServerWorker.httpServer.auth.strategy('iw-jwt-token', 'iw-auth-scheme');
                    _this.setupSecureHttpRoutes(httpServerWorker, function (e) {
                        cb(e);
                    });
                }
                else {
                    cb(null);
                }
            }
        ], function (e) {
            cb(e);
        });
    };
    AuthWorker.prototype.getRedisActiveRefreshTokenKey = function (username, id) {
        return this.whoService.name + ':' + this.me.name + ':' + username + ':active-refresh-token:' + id;
    };
    AuthWorker.prototype.setupSecureHttpRoutes = function (httpServerWorker, cb) {
        var _this = this;
        this.ask('iw-http-server.route-config', function (e, routeConfig) {
            _this.setupAuthenticateRoutes(httpServerWorker, routeConfig);
            _.each(_this.httpAuth.securedListeners, function (l) {
                var postRoute = _this.createRouteConfig(httpServerWorker, routeConfig.post, l.commEvent, function (reply, tokenAuth, e) {
                    var args = [];
                    for (var _i = 3; _i < arguments.length; _i++) {
                        args[_i - 3] = arguments[_i];
                    }
                    _this.handleHttpReply(reply, e, 'authorization-failed', 'unable to authorize', 403, tokenAuth, args);
                });
                var getRoute = _this.createRouteConfig(httpServerWorker, routeConfig.get, l.commEvent, function (reply, tokenAuth, e) {
                    var args = [];
                    for (var _i = 3; _i < arguments.length; _i++) {
                        args[_i - 3] = arguments[_i];
                    }
                    _this.handleHttpReply(reply, e, 'authorization-failed', 'unable to authorize', 403, tokenAuth, args);
                });
                var auth = {
                    mode: 'required',
                    strategy: 'iw-jwt-token'
                };
                postRoute.config.auth = auth;
                getRoute.config = {
                    auth: auth
                };
                httpServerWorker.httpServer.route(postRoute);
                httpServerWorker.httpServer.route(getRoute);
            });
            cb(null);
        });
    };
    AuthWorker.prototype.setupAuthenticateRoutes = function (httpServerWorker, routeConfig) {
        var _this = this;
        var evt = this.getCommEvent('authenticate', 'request');
        var postRoute = this.createRouteConfig(httpServerWorker, routeConfig.post, evt, function (reply, tokenAuth, e) {
            var args = [];
            for (var _i = 3; _i < arguments.length; _i++) {
                args[_i - 3] = arguments[_i];
            }
            _this.handleHttpReply(reply, e, 'authentication-failed', 'unable to authenticate', 401, tokenAuth, args);
        });
        var getRoute = this.createRouteConfig(httpServerWorker, routeConfig.get, evt, function (reply, tokenAuth, e) {
            var args = [];
            for (var _i = 3; _i < arguments.length; _i++) {
                args[_i - 3] = arguments[_i];
            }
            _this.handleHttpReply(reply, e, 'authentication-failed', 'unable to authenticate', 401, tokenAuth, args);
        });
        httpServerWorker.httpServer.route(postRoute);
        httpServerWorker.httpServer.route(getRoute);
    };
    AuthWorker.prototype.handleHttpReply = function (reply, e, errorEvt, replyMsg, replyCode, tokenAuth, args) {
        if (e === null) {
            var res = reply.apply(reply, args);
            if (!_.isUndefined(tokenAuth)) {
                res.state('access_token', tokenAuth.accessToken);
                res.state('refresh_token', tokenAuth.refreshToken);
                res.header('iw_app_user_data', JSON.stringify(tokenAuth.userAuth));
            }
        }
        else if (_.startsWith(e.message, 'password cannot be blank')) {
            this.inform(errorEvt, {
                message: e.message
            });
            reply(replyMsg).statusCode = 401;
        }
        else if (_.startsWith(e.message, 'authorization failed') || replyCode === 401) {
            this.inform(errorEvt, {
                message: e.message
            });
            var res = reply(replyMsg);
            if (!_.isUndefined(tokenAuth)) {
                res.header('iw_app_user_data', JSON.stringify(tokenAuth.userAuth));
            }
            res.statusCode = replyCode;
        }
        else {
            this.inform('error', e);
            reply({
                error: 'Internal Server Error',
                message: 'An internal server error occurred',
                statusCode: 500
            }).statusCode = 500;
        }
    };
    AuthWorker.prototype.createRouteConfig = function (httpServerWorker, routeConfig, commEvent, cb) {
        var _this = this;
        var route = _.cloneDeep(routeConfig);
        route.handler = function (req, reply) {
            var emit = httpServerWorker.getCommEmitFromRequest(req.path.split('/').slice(2));
            var input = _.isUndefined(req.payload) || _.isNull(req.payload) ? req.query : _.extend(req.payload, req.query);
            var handleApiReqArgs = [emit, req, reply, input];
            if (_.isFunction(cb)) {
                handleApiReqArgs.push(function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i - 0] = arguments[_i];
                    }
                    if (args.length === 2 && emit.worker === _this.me.name && emit.name === 'authenticate') {
                        cb.call(_this, reply, args[1], args[0]);
                    }
                    else {
                        cb.apply(_this, [reply, req.app.tokenAuth].concat(args));
                    }
                });
            }
            httpServerWorker.handleApiReq.apply(httpServerWorker, handleApiReqArgs);
        };
        return AuthWorker.replaceRoutePath(route, commEvent);
    };
    AuthWorker.replaceRoutePath = function (route, commEvent) {
        route.path = route.path
            .replace(/\{prefix}/g, commEvent.prefix)
            .replace(/\{service}/g, commEvent.service)
            .replace(/\{method}/g, commEvent.method)
            .replace(/\{worker}/g, commEvent.worker)
            .replace(/\{event}/g, commEvent.name);
        return route;
    };
    AuthWorker.prototype.secureServiceListeners = function () {
        var _this = this;
        var listeners = this.serviceListeners;
        var securedListeners = [];
        switch (this.httpAuth.auto) {
            case HttpAutoAuthenticationType.iw_service_only:
                securedListeners = this.addCommListenersToArray(listeners, securedListeners, '*.iw-service.*');
                break;
            case HttpAutoAuthenticationType.all:
                securedListeners = _.map(listeners, function (l) {
                    return {
                        commEvent: l.commEvent,
                        annotation: l.annotation
                    };
                });
                break;
        }
        securedListeners = _.reduce(this.httpAuth.workersToAuthenticate, function (securedListeners, workerName) {
            return _this.addCommListenersToArray(listeners, securedListeners, '*.' + workerName + '.*');
        }, securedListeners);
        securedListeners = _.reduce(this.httpAuth.workersToNotAuthenticate, function (securedListeners, workerName) {
            return _this.removeCommListenersToArray(listeners, securedListeners, '*.' + workerName + '.*');
        }, securedListeners);
        securedListeners = _.reduce(this.httpAuth.listenersToAuthenticate, function (securedListeners, event) {
            return _this.addCommListenersToArray(listeners, securedListeners, event);
        }, securedListeners);
        securedListeners = _.reduce(this.httpAuth.listenersToNotAuthenticate, function (securedListeners, event) {
            return _this.removeCommListenersToArray(listeners, securedListeners, event);
        }, securedListeners);
        securedListeners = _.reduce(this.allAnnotatedListeners({
            auth: {
                authenticate: true
            }
        }), function (securedListeners, l) {
            return _this.addCommListenersToArray(listeners, securedListeners, l.event);
        }, securedListeners);
        securedListeners = _.reduce(this.allAnnotatedListeners({
            auth: {
                authenticate: false
            }
        }), function (securedListeners, l) {
            return _this.removeCommListenersToArray(listeners, securedListeners, l.event);
        }, securedListeners);
        securedListeners = _.reduce(_.filter(listeners, function (l) {
            return !_.isUndefined(l.annotation.auth) && !_.isUndefined(l.annotation.auth.authorization);
        }), function (securedListeners, l) {
            return _this.addCommListenersToArray(listeners, securedListeners, l.commEvent);
        }, securedListeners);
        this.httpAuth.securedListeners = securedListeners;
    };
    AuthWorker.prototype.addCommListenersToArray = function (srvListeners, existingListeners, event) {
        var _this = this;
        var evt = this.getCommEvent(event);
        var listeners = _.filter(srvListeners, function (l) {
            return CommEvent.equal(evt, l.commEvent);
        });
        _.each(listeners, function (l) {
            var cl = {
                commEvent: l.commEvent,
                annotation: l.annotation
            };
            if (!_.contains(existingListeners, cl)) {
                _this.annotate({
                    internal: true,
                    log: {
                        level: 1000
                    }
                }).inform('listener-secured', cl);
                existingListeners.push(cl);
            }
        });
        return existingListeners;
    };
    AuthWorker.prototype.removeCommListenersToArray = function (srvListeners, existingListeners, event) {
        var _this = this;
        var evt = this.getCommEvent(event);
        var listeners = _.filter(srvListeners, function (l) {
            return CommEvent.equal(evt, l.commEvent);
        });
        _.each(listeners, function (l) {
            existingListeners = _.filter(existingListeners, function (el) {
                var shouldRemove = CommEvent.equal(el.commEvent, l.commEvent);
                if (shouldRemove) {
                    _this.annotate({
                        internal: true,
                        log: {
                            level: 1000
                        }
                    }).inform('listener-unsecured', l);
                }
                return !shouldRemove;
            });
        });
        return existingListeners;
    };
    AuthWorker.prototype.getEnvVar = function (envVarName, cb) {
        var emit = this.getCommEmit(this.envVarEvent);
        this.request(emit, envVarName, function (e, token) {
            cb(e, token);
        });
    };
    return AuthWorker;
}(Worker));
module.exports = AuthWorker;
//# sourceMappingURL=AuthWorker.js.map