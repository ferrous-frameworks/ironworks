///<reference path='../typings/master.d.ts' />

import _ = require('lodash');
import async = require('async');
import hapi = require('hapi');
import SocketioAuth = require('socketio-auth');
import jwt = require('jsonwebtoken');
import Joi = require('joi');

import ironTree = require('iron-tree');
import IronTree = ironTree.Tree;

import idHelper = require('../helpers/idHelper');
import IComm = require('../interfaces/eventing/IComm');
import IAm = require('../interfaces/whoIAm/IAm');
import ICollection = require('../interfaces/collection/ICollection');
import IWorker = require('../interfaces/workers/IWorker');
import ISocketWorker = require('../interfaces/workers/ISocketWorker');
import IHttpServerWorker = require('../interfaces/workers/IHttpServerWorker');
import ITokenAuthentication = require('../interfaces/auth/ITokenAuthentication');
import IAuthWorkerOpts = require('../interfaces/opts/IAuthWorkerOpts');
import Worker = require('./Worker');
import ICommListener  = require('../interfaces/eventing/ICommListener');
import IFailedAuthentication = require('../interfaces/auth/IFailedAuthentication');
import HttpAutoAuthenticationType = require('../enums/auth/HttpAutoAuthenticationType');
import ICommEventData = require('../interfaces/eventing/ICommEventData');
import CommEvent = require('../eventing/CommEvent');
import ICommEvent = require('../interfaces/eventing/ICommEvent');
import IServiceListener = require('../interfaces/service/IServiceListener');
import ICredentials = require('../interfaces/auth/ICredentials');
import IUserAuth = require('../interfaces/auth/IUserAuth');
import IRoleTreeElement = require('../interfaces/auth/IRoleTreeElement');
import IRole = require('../interfaces/auth/IRole');
import IAmVersioned = require('../interfaces/whoIAm/IAmVersioned');
import ICommEmit = require('../interfaces/eventing/ICommEmit');

interface ISocketAuthentication {
    timeout: number;
    secure: boolean;
    interserviceTokenEnvVarName: string;
    interserviceToken: string;
}
interface IHttpAuthentication {
    auto: HttpAutoAuthenticationType;
    clientSecretEnvVarName: string;
    clientSecret: string;
    listenersToAuthenticate: (ICommEventData|string)[];
    listenersToNotAuthenticate: (ICommEventData|string)[];
    workersToAuthenticate: string[];
    workersToNotAuthenticate: string[];
    securedListeners: ICommListener[];
    accessTokenExpiration: string;
    refreshTokenExpiration: string;
}

class AuthWorker extends Worker implements IWorker {
    private serviceListeners: IServiceListener[];
    private socketAuth: ISocketAuthentication;
    private httpAuth: IHttpAuthentication;
    private envVarEvent: ICommEventData;
    private roleTree: IronTree<IRole>;

    constructor(opts?: IAuthWorkerOpts) {
        super(['iw-socket', 'iw-http-server'], {
            id: idHelper.newId(true),
            name: 'iw-auth'
        }, opts);

        var defOpts: IAuthWorkerOpts = {
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

        this.opts = this.opts.beAdoptedBy<IAuthWorkerOpts>(defOpts, 'worker');
        this.opts.merge(opts);

        this.socketAuth = {
            timeout: this.opts.get<number>('socket.authentication.timeout'),
            secure: this.opts.get<boolean>('socket.authentication.secure'),
            interserviceTokenEnvVarName: this.opts.get<string>('socket.authentication.interserviceTokenEnvVarName'),
            interserviceToken: void 0
        };
        this.httpAuth = {
            auto: this.opts.get<HttpAutoAuthenticationType>('http.authentication.auto'),
            clientSecret: void 0,
            securedListeners: [],
            listenersToAuthenticate: this.opts.get<string[]>('http.authentication.listenersToAuthenticate'),
            listenersToNotAuthenticate: this.opts.get<string[]>('http.authentication.listenersToNotAuthenticate'),
            workersToAuthenticate: this.opts.get<string[]>('http.authentication.workersToAuthenticate'),
            workersToNotAuthenticate: this.opts.get<string[]>('http.authentication.workersToNotAuthenticate'),
            clientSecretEnvVarName: this.opts.get<string>('http.clientSecretEnvVarName'),
            accessTokenExpiration: this.opts.get<string>('http.accessTokenExpiration'),
            refreshTokenExpiration: this.opts.get<string>('http.refreshTokenExpiration')
        };
        this.roleTree = new IronTree<IRole>();
    }

    public init(cb): IWorker {
        var envVarListener = _.find<ICommListener>(this.allCommListeners(), (l) => {
            return l.commEvent.worker.indexOf('iw-env') === 0 && l.commEvent.name === 'env-var';
        });
        if (_.isUndefined(envVarListener)) {
            cb(new Error('unable to find environment worker'));
            return this;
        }
        this.envVarEvent = envVarListener.commEvent;
        this.info<IServiceListener[]>('iw-service.available-listeners', (listeners) => {
            this.serviceListeners = listeners;
        });
        this.intercept(this.getCommEvent('*.*.*'), {
            preEmit: (stop, next, anno, ...args) => {
                if (!_.isUndefined(anno.auth)) {
                    var username = anno.auth.username;
                    if (!_.isUndefined(anno.auth.authorization)) {
                        var authorization = anno.auth.authorization;
                        var requiredRoles = [];
                        if (!_.isUndefined(authorization.roles) && _.isArray(authorization.roles.required)) {
                            requiredRoles = _.map(authorization.roles.required, (roleOrString: string|IRole) => {
                                if (typeof roleOrString === 'string') {
                                    return {
                                        name: <string>roleOrString
                                    }
                                }
                                else {
                                    return <IRole>roleOrString;
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
                        var cb = <(e: any) => void>_.last(args);
                        if (!_.isUndefined(authorization.user)) {
                            var user = authorization.user;
                            var emit = this.getCommEmit(args[0]);
                            if (!_.isUndefined(user.token)) {
                                jwt.verify(user.token, this.httpAuth.clientSecret, (e, verified) => {
                                    if (e === null) {
                                        user.roles = (<any>_).get(verified, 'authorization.user.roles');
                                        if (_.isArray(user.roles)) {
                                            var authorized = this.checkUserRoles(requiredRoles, user.roles, emittedObject);
                                            if (authorized) {
                                                next();
                                            }
                                            else {
                                                cb(AuthWorker.getRoleError(emit, requiredRoles, username, user.roles));
                                            }
                                        }
                                        else {
                                            this.inform('error', new Error('unable to find roles on verified token'));
                                            cb('unable to authorize');
                                        }
                                    }
                                    else {
                                        this.inform('error', e);
                                        cb('unable to authorize');
                                    }
                                });
                            }
                            else if (_.isArray(user.roles)) {
                                var authorized = this.checkUserRoles(requiredRoles, user.roles, emittedObject);
                                if (authorized) {
                                    next();
                                }
                                else {
                                    cb(AuthWorker.getRoleError(emit, requiredRoles, username, user.roles));
                                }
                            }
                            else {
                                this.inform('error', new Error('user token missing from authorization object'));
                                cb('unable to authorize');
                            }
                        }
                        else if (!_.isEmpty(requiredRoles)) {
                            this.inform('error', new Error('user missing from authorization object'));
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
            (cb) => {
                this.initSocketAuthentication((e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.initTokenAuthentication((e) => {
                    cb(e);
                });
            }
        ], (e) => {
            if (e === null) {
                super.init(cb);
            }
            else if (!_.isUndefined(cb)) {
                cb(e);
            }
            else {
                this.inform('error', e);
            }
        });
        return this;
    }

    private checkUserRoles(requiredRoles: (string|IRole)[], userRoles: (string|IRole)[], emittedObject: any): boolean {
        if (_.isEmpty(requiredRoles)) {
            return true;
        }
        var allUserRoles = [];
        if (!this.roleTree.isEmpty()) {
            _.each(userRoles, (userRoleOrString) => {
                var userRole = AuthWorker.getRoleFromRoleOrString(userRoleOrString);
                var userRoleClone = _.cloneDeep(userRole);
                var childRoles = this.roleTree.getBranches(userRoleClone.name);
                childRoles = <IRole[]>_.map(childRoles, (childRole) => {
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
        return _.every(requiredRoles, (requiredRoleOrString) => {
            var requiredRole = AuthWorker.getRoleFromRoleOrString(requiredRoleOrString);
            return _.any(allUserRoles, (userRoleOrString) => {
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
                    return _.every(userRole.emittedObject.required.properties, (roleProp) => {
                        return emittedObject[roleProp.name] === roleProp.value;
                    });
                }
                return true;
            });
        });
    }

    private static getRoleFromRoleOrString(roleOrString: string|IRole): IRole {
        var role: IRole;
        if (_.isString(roleOrString)) {
            role = {
                name: <string>roleOrString
            }
        }
        else {
            role = <IRole>roleOrString;
        }
        return role;
    }

    private static getRoleError(emit: ICommEmit, requiredRoles: IRole[], username: string, userRoles: IRole[]): Error {
        var userRolesText = _.map(userRoles, (userRole) => {
            var emittedRoleStr = '';
            if (!_.isUndefined(userRole.emittedObject) && !_.isUndefined(userRole.emittedObject.required)) {
                if (_.isArray(userRole.emittedObject.required.properties)) {
                    _.each(userRole.emittedObject.required.properties, (prop) => {
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
    }

    public preStart(deps, cb): IWorker {
        async.waterfall([
            (cb) => {
                this.setupRoleProvider((e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.startSocketAuthentication(deps, (e) => {
                    cb(e);
                });
            },
            (cb) => {
                this.startHttpAuthentication(deps, (e) => {
                    cb(e);
                });
            }
        ], (e) => {
            if (e === null) {
                super.preStart(deps, cb);
            }
            else if (!_.isUndefined(cb)) {
                cb(e);
            }
            else {
                this.inform('error', e);
            }
        });
        return this;
    }

    private setupRoleProvider(cb) {
        var getRoleListener = _.find<ICommListener>(this.allCommListeners(), (l) => {
            return l.commEvent.worker.indexOf('iw-role-provider') === 0 && l.commEvent.name === 'role-tree';
        });
        if (!_.isUndefined(getRoleListener)) {
            var emit = this.getCommEmit(getRoleListener.commEvent);
            this.request<IAmVersioned, IRoleTreeElement|string>(emit, this.whoService, (e, roleTreeElementOrString) => {
                var roleTreeElement: IRoleTreeElement;
                if (e === null) {
                    if (typeof roleTreeElementOrString === 'string') {
                        roleTreeElement = {
                            name: <string>roleTreeElementOrString
                        }
                    }
                    else {
                        roleTreeElement = <IRoleTreeElement>roleTreeElementOrString;
                    }
                    this.putRoleElementInTree(roleTreeElement);
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
    }

    private putRoleElementInTree(roleTreeElement: IRoleTreeElement, atKey?: string) {
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
            _.each(roleTreeElement.children, (child) => {
                this.putRoleElementInTree(child, atKey);
            });
        }
    }

    private static getRoleFromTreeElement(roleTreeElement: IRoleTreeElement): IRole {
        var role = _.cloneDeep(roleTreeElement);
        delete role.children;
        return role;
    }

    private initSocketAuthentication(cb) {
        if (this.socketAuth.secure) {
            async.waterfall([
                (cb) => {
                    this.confirm('iw-socket.secure', (e) => {
                        cb(e);
                    });
                },
                (cb) => {
                    this.getEnvVar(this.socketAuth.interserviceTokenEnvVarName, (e, token) => {
                        if (e === null) {
                            if (!_.isEmpty(token)) {
                                this.socketAuth.interserviceToken = token;
                            }
                            else {
                                e = new Error('unable to find environment variable ' + this.socketAuth.interserviceTokenEnvVarName);
                            }
                        }
                        cb(e);
                    });
                }
            ], (e) => {
                cb(e);
            });
        }
        else {
            cb(null);
        }
    }

    private startSocketAuthentication(deps, cb) {
        if (this.socketAuth.secure) {
            var socketWorker:ISocketWorker = <ISocketWorker>_.find(deps.list(), (worker:IWorker) => {
                return worker.me.name === 'iw-socket';
            });
            socketWorker.socketServer.use((socket, next) => {
                socket.authentication = {
                    authenticated: false,
                    timeout: false,
                    interservice: false
                };
                var timer = setTimeout(() => {
                    socket.authentication.timeout = true;
                    var reason = "authentication timeout";
                    this.cannotAuthenticate(socket, reason);
                    this.inform('timeout', {
                        type: 'socket-authentication',
                        timeout: this.socketAuth.timeout,
                        reason: reason
                    });
                }, this.socketAuth.timeout);
                socket.on(this.getCommEvent('authenticate-interservice', 'check').getText(), (tokenAuth:ITokenAuthentication, cb) => {
                    if (_.isObject(tokenAuth) && !_.isEmpty(tokenAuth.accessToken)) {
                        if (!socket.authentication.timeout) {
                            clearTimeout(timer);
                            if (!_.isEmpty(this.socketAuth.interserviceToken) && _.isEqual(this.socketAuth.interserviceToken, tokenAuth.accessToken)) {
                                socket.authentication.authenticated = true;
                                socket.authentication.interservice = true;
                                cb(null);
                            }
                            else {
                                this.cannotAuthenticate(socket, "bad token", timer, cb);
                            }
                        }
                    }
                    else {
                        this.cannotAuthenticate(socket, "token not found on emitted object", timer, cb);
                    }
                });
                socket.on(this.getCommEvent('authenticate-creds', 'request').getText(), (creds:ICredentials, cb) => {
                    if (!socket.authentication.timeout) {
                        clearTimeout(timer);
                        this.request<ICredentials, ITokenAuthentication>('authenticate', creds, (e, token) => {
                            if (e === null) {
                                socket.authentication.authenticated = true;
                                cb(null, token.accessToken);
                            }
                            else {
                                this.cannotAuthenticate(socket, e, timer, cb);
                            }
                        });
                    }
                });
                next()
            });
        }
        cb(null);
    }

    private cannotAuthenticate(socket, reason, timer?, cb?) {
        clearTimeout(timer);
        if (!_.isUndefined(cb)) {
            cb('unable to authenticate');
        }
        socket.disconnect(true);
        this.inform<IFailedAuthentication>('authentication-failed', {
            message: "unable to authenticate socket connection - " + reason
        });
    }

    private initTokenAuthentication(cb) {
        this.annotate({
            log: {
                properties: [{
                    name: 'password',
                    secure: true
                }]
            }
        }).respond<ICredentials, ITokenAuthentication>('authenticate', (creds, cb) => {
            if (!_.isUndefined(creds.password)) {
                this.getTokenAuth(creds, (e, tokenAuth) => {
                    cb(e, tokenAuth);
                });
            }
            else {
                cb(new Error('password cannot be blank'));
            }
        });
        this.getEnvVar(this.httpAuth.clientSecretEnvVarName, (e, clientSecret) => {
            if (e === null) {
                if (!_.isEmpty(clientSecret)) {
                    this.httpAuth.clientSecret = clientSecret;
                }
                else {
                    this.inform('warn', new Error('unable to find environment variable ' + this.httpAuth.clientSecretEnvVarName));
                }
                cb(null);
            }
            else {
                cb(e);
            }
        });
    }

    private getTokenAuth(data, cb) {
        async.waterfall([
            (cb) => {
                var event = void 0;
                if (!_.isUndefined(data.password)) {
                    event = 'validate-user-credentials';
                }
                else {
                    event = 'get-user-auth';
                    data = { username: data.username };
                }
                var userAuthListener = _.find<ICommListener>(this.allCommListeners(), (l) => {
                    return l.commEvent.worker.indexOf('iw-user-validator') === 0 && l.commEvent.name === event;
                });
                if (!_.isUndefined(userAuthListener)) {
                    cb(null, userAuthListener.commEvent);
                }
                else {
                    cb(new Error("unable to find an 'iw-user-validator' worker with a '" + event + "' listener"));
                }
            },
            (userAuthEmit, cb) => {
                this.request<any, IUserAuth>(userAuthEmit, data, (e, userAuth) => {
                    cb(e, userAuth);
                });
            },
            (userAuth, cb) => {
                var id = idHelper.newId();
                var refreshToken = jwt.sign({
                    id: id,
                    issuer: userAuth.issuer,
                    username: userAuth.username
                }, this.httpAuth.clientSecret, {
                    issuer: this.whoService.name + '[' + this.whoService.id + ']',
                    expiresIn: this.httpAuth.refreshTokenExpiration
                });
                var redisSetListener = _.find<ICommListener>(this.allCommListeners(), (l) => {
                    return l.commEvent.worker.indexOf('iw-redis') === 0 && l.commEvent.method === 'check' && l.commEvent.name === 'set';
                });
                if (!_.isUndefined(redisSetListener)) {
                    this.check(redisSetListener.event, {
                        key: this.getRedisActiveRefreshTokenKey(userAuth.username, id),
                        value: refreshToken,
                        ex: this.httpAuth.refreshTokenExpiration
                    }, (e) => {
                        cb(e, userAuth, refreshToken);
                    });
                }
                else {
                    cb(null, userAuth, refreshToken);
                }
            },
            (userAuth, refreshToken) => {
                cb(null, {
                    userAuth: userAuth,
                    accessToken: jwt.sign(userAuth, this.httpAuth.clientSecret, {
                        issuer: this.whoService.name + '[' + this.whoService.id + ']',
                        expiresIn: this.httpAuth.accessTokenExpiration
                    }),
                    refreshToken: refreshToken
                });
            }
        ], (e) => {
            cb(e);
        });
    }

    private startHttpAuthentication(deps, cb) {
        async.waterfall([
            (cb) => {
                if (_.isEmpty(this.serviceListeners)) {
                    this.ask<IServiceListener[]>('iw-service.list-listeners', (e, listeners) => {
                        this.serviceListeners = _.filter(listeners, (l) => {
                            return !(l.commEvent.worker === this.me.name && l.commEvent.name === 'authenticate');
                        });
                        cb(e);
                    });
                }
                else {
                    cb(null);
                }
            },
            (cb) => {
                this.ask('iw-http-server.route-config', (e, routeConfig) => {
                    cb(e, routeConfig);
                });
            },
            (routeConfig, cb) => {
                this.secureServiceListeners();
                if (!_.isEmpty(this.httpAuth.securedListeners)) {
                    var httpServerWorker:IHttpServerWorker = <IHttpServerWorker>_.find(deps.list(), (worker:IWorker) => {
                        return worker.me.name === 'iw-http-server';
                    });
                    httpServerWorker.httpServer.state('access_token', {
                        path: '/'
                    });
                    httpServerWorker.httpServer.state('refresh_token', {
                        path: '/'
                    });
                    httpServerWorker.httpServer.auth.scheme('iw-auth-scheme', (server, opts) => {
                        return {
                            authenticate: (req, reply) => {
                                req.app.tokenAuth = void 0;
                                async.waterfall([
                                    (cb) => {
                                        jwt.verify(req.state.access_token, this.httpAuth.clientSecret, (e, token) => {
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
                                    (access, accessExpired, cb) => {
                                        jwt.verify(req.state.refresh_token, this.httpAuth.clientSecret, (e, token) => {
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
                                    (access, accessExpired, refresh, refreshExpired, cb) => {
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
                                                (cb) => {
                                                    var redisKeysListener = _.find<ICommListener>(this.allCommListeners(), (l) => {
                                                        return l.commEvent.worker.indexOf('iw-redis') === 0 && l.commEvent.name === 'keys';
                                                    });
                                                    var redisDelListener = _.find<ICommListener>(this.allCommListeners(), (l) => {
                                                        return l.commEvent.worker.indexOf('iw-redis') === 0 && l.commEvent.name === 'del';
                                                    });
                                                    if (!_.isUndefined(redisKeysListener) && !_.isUndefined(redisDelListener)) {
                                                        var key = this.getRedisActiveRefreshTokenKey(refresh.username, refresh.id);
                                                        async.waterfall([
                                                            (cb) => {
                                                                this.request<string, string[]>(redisKeysListener.event, key, (e, keys) => {
                                                                    cb(e, _.isArray(keys) ? keys[0] : void 0);
                                                                });
                                                            },
                                                            (refreshTokenKey, cb) => {
                                                                if (!_.isUndefined(refreshTokenKey)) {
                                                                    this.request<string, number>(redisDelListener.event, key, (e) => {
                                                                        cb(e);
                                                                    });
                                                                }
                                                                else {
                                                                    cb(new Error('refresh token has already been used or has been revoked'));
                                                                }
                                                            }
                                                        ], (e) => {
                                                            cb(e);
                                                        });
                                                    }
                                                    else {
                                                        cb(null);
                                                    }
                                                },
                                                () => {
                                                    this.getTokenAuth(refresh, (e, tokenAuth) => {
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
                                            ], (e) => {
                                                cb(e);
                                            });
                                        }
                                        else {
                                            cb(new Error('refresh token is expired'));
                                        }
                                    }
                                ], (e) => {
                                    if (e !== null) {
                                        this.inform('authentication-failed', {
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
                        }
                    });
                    httpServerWorker.httpServer.auth.strategy('iw-jwt-token', 'iw-auth-scheme');
                    this.setupSecureHttpRoutes(httpServerWorker, (e) => {
                        cb(e);
                    });
                }
                else {
                    cb(null);
                }
            }
        ], (e) => {
            cb(e);
        });
    }

    private getRedisActiveRefreshTokenKey(username, id): string {
        return this.whoService.name + ':' + this.me.name + ':' + username + ':active-refresh-token:' + id;
    }

    private setupSecureHttpRoutes(httpServerWorker, cb) {
        this.ask('iw-http-server.route-config', (e, routeConfig: any) => {
            this.setupAuthenticateRoutes(httpServerWorker, routeConfig);
            _.each(this.httpAuth.securedListeners, (l) => {
                var postRoute = this.createRouteConfig(httpServerWorker, routeConfig.post, l.commEvent, (reply, tokenAuth, e, ...args) => {
                    this.handleHttpReply(reply, e, 'authorization-failed', 'unable to authorize', 403, tokenAuth, args);
                });
                var getRoute = this.createRouteConfig(httpServerWorker, routeConfig.get, l.commEvent, (reply, tokenAuth, e, ...args) => {
                    this.handleHttpReply(reply, e, 'authorization-failed', 'unable to authorize', 403, tokenAuth, args);
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
    }

    private setupAuthenticateRoutes(httpServerWorker, routeConfig) {
        var evt = this.getCommEvent('authenticate', 'request');
        var postRoute = this.createRouteConfig(httpServerWorker, routeConfig.post, evt, (reply, tokenAuth, e, ...args) => {
            this.handleHttpReply(reply, e, 'authentication-failed', 'unable to authenticate', 401, tokenAuth, args);
        });
        var getRoute = this.createRouteConfig(httpServerWorker, routeConfig.get, evt, (reply, tokenAuth, e, ...args) => {
            this.handleHttpReply(reply, e, 'authentication-failed', 'unable to authenticate', 401, tokenAuth, args);
        });
        httpServerWorker.httpServer.route(postRoute);
        httpServerWorker.httpServer.route(getRoute);
    }

    private handleHttpReply(reply, e, errorEvt, replyMsg, replyCode, tokenAuth, args) {
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
    }

    private createRouteConfig(httpServerWorker, routeConfig, commEvent, cb?) {
        var route = _.cloneDeep(routeConfig);
        route.handler = (req: hapi.Request, reply: hapi.IReply) => {
            var emit = httpServerWorker.getCommEmitFromRequest(req.path.split('/').slice(2));
            var input = _.isUndefined(req.payload) || _.isNull(req.payload) ? req.query : _.extend(req.payload, req.query);
            var handleApiReqArgs = [ emit, req, reply, input ];
            if (_.isFunction(cb)) {
                handleApiReqArgs.push((...args) => {
                    if (args.length === 2 && emit.worker === this.me.name && emit.name === 'authenticate') {
                        cb.call(this, reply, args[1], args[0]);
                    }
                    else {
                        cb.apply(this, [ reply, req.app.tokenAuth ].concat(args));
                    }
                });
            }
            httpServerWorker.handleApiReq.apply(httpServerWorker, handleApiReqArgs);
        };
        return AuthWorker.replaceRoutePath(route, commEvent);
    }

    private static replaceRoutePath(route, commEvent) {
        route.path = route.path
            .replace(/\{prefix}/g, commEvent.prefix)
            .replace(/\{service}/g, commEvent.service)
            .replace(/\{method}/g, commEvent.method)
            .replace(/\{worker}/g, commEvent.worker)
            .replace(/\{event}/g, commEvent.name);
        return route;
    }

    private secureServiceListeners() {
        var listeners = this.serviceListeners;
        var securedListeners: ICommListener[] = [];
        switch (this.httpAuth.auto) {
            case HttpAutoAuthenticationType.iw_service_only:
                securedListeners = this.addCommListenersToArray(listeners, securedListeners, '*.iw-service.*');
                break;
            case HttpAutoAuthenticationType.all:
                securedListeners = _.map(listeners, (l) => {
                    return <ICommListener>{
                        commEvent: l.commEvent,
                        annotation: l.annotation
                    };
                });
                break;
        }
        securedListeners = _.reduce(this.httpAuth.workersToAuthenticate, (securedListeners, workerName) => {
            return this.addCommListenersToArray(listeners, securedListeners, '*.' + workerName + '.*');
        }, securedListeners);
        securedListeners = _.reduce(this.httpAuth.workersToNotAuthenticate, (securedListeners, workerName) => {
            return this.removeCommListenersToArray(listeners, securedListeners, '*.' + workerName + '.*');
        }, securedListeners);
        securedListeners = _.reduce(this.httpAuth.listenersToAuthenticate, (securedListeners, event) => {
            return this.addCommListenersToArray(listeners, securedListeners, event);
        }, securedListeners);
        securedListeners = _.reduce(this.httpAuth.listenersToNotAuthenticate, (securedListeners, event) => {
            return this.removeCommListenersToArray(listeners, securedListeners, event);
        }, securedListeners);
        securedListeners = _.reduce(this.allAnnotatedListeners({
            auth: {
                authenticate: true
            }
        }), (securedListeners, l) => {
            return this.addCommListenersToArray(listeners, securedListeners, l.event);
        }, securedListeners);
        securedListeners = _.reduce(this.allAnnotatedListeners({
            auth: {
                authenticate: false
            }
        }), (securedListeners, l) => {
            return this.removeCommListenersToArray(listeners, securedListeners, l.event);
        }, securedListeners);
        securedListeners = _.reduce(_.filter(listeners, (l) => {
            return !_.isUndefined(l.annotation.auth) && !_.isUndefined(l.annotation.auth.authorization);
        }), (securedListeners, l) => {
            return this.addCommListenersToArray(listeners, securedListeners, l.commEvent);
        }, securedListeners);
        this.httpAuth.securedListeners = securedListeners;
    }

    private addCommListenersToArray(srvListeners: IServiceListener[], existingListeners: ICommListener[], event: ICommEventData|string): ICommListener[] {
        var evt = this.getCommEvent(event);
        var listeners = _.filter(srvListeners, (l) => {
            return CommEvent.equal(evt, l.commEvent);
        });
        _.each(listeners, (l) => {
            var cl = <ICommListener>{
                commEvent: l.commEvent,
                annotation: l.annotation
            };
            if (!_.contains(existingListeners, cl)) {
                this.annotate({
                    internal: true,
                    log: {
                        level: 1000
                    }
                }).inform('listener-secured', cl);
                existingListeners.push(cl);
            }
        });
        return existingListeners
    }

    private removeCommListenersToArray(srvListeners: IServiceListener[], existingListeners: ICommListener[], event: ICommEventData|string): ICommListener[] {
        var evt = this.getCommEvent(event);
        var listeners = _.filter(srvListeners, (l) => {
            return CommEvent.equal(evt, l.commEvent);
        });
        _.each(listeners, (l) => {
            existingListeners = _.filter(existingListeners, (el) => {
                var shouldRemove = CommEvent.equal(el.commEvent, l.commEvent);
                if (shouldRemove) {
                    this.annotate({
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
    }

    private getEnvVar(envVarName: string, cb: (e: Error, value: string) => void) {
        var emit = this.getCommEmit(this.envVarEvent);
        this.request<string, string>(emit, envVarName, (e, token) => {
            cb(e, token);
        });
    }
}

export = AuthWorker;