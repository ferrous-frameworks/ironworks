# ironworks
[![travis build](https://travis-ci.org/ferrous-frameworks/ironworks.svg?branch=master)](https://travis-ci.org/ferrous-frameworks/ironworks)

ironworks is a worker (plug-in) based framework to assist in creating a modular, interconnected microservice ecosystem

it provides several built-in workers as well as a base class to create custom workers

[Documentation](http://) *(coming soon)*

## Installation

`npm install ironworks`

## Overview

### services
* a `Service` is a container for workers
* a `Worker` is added to a `Service` using the `use(worker)` method
* when all workers are added, call the `start()` method
* when a `Service` is started, it calls workflow methods on each worker:
    * `preInit(comm, whoService, [callback])`
        * **this is mainly an internal step** - it should not be overridden under normal circumstances
        * `comm` is the instance of `iron-beam` that serves as ironworks shared eventing engine
        * `whoService` is an object with the name and id of the service
        * `callback` accepts an error parameter
        * always `return super.preInit(comm, whoService, [callback])` from this method
    * `init([callback])`
        * this is the step where listeners are created
        * listeners can be created after this step, but certain `Service` features will not take them into account
        * `callback` accepts an error parameter
        * always `return super.init([callback])` from this method
    * `postInit([dependencies], [callback])`
        * this step is used to interact with other workers once they have created their listeners in `init`
        * `dependencies` will be a `Collection` of workers that this worker depends on - those workers will have already completed their `postInit` step
        * `callback` accepts an error parameter
        * always `return super.postInit([dependencies], [callback])` from this method
    * `start([dependencies], [callback])`
        * this step is used to interact with other workers once they have be started
        * `dependencies` will be a `Collection` of workers that this worker depends on - those workers will have already completed their `start` step
        * `callback` accepts an error parameter
        * always `return super.start([dependencies], [callback])` from this method
    * `postStart([dependencies], [callback])`
        * this step is used to interact with other workers after they have been started
        * `dependencies` will be a `Collection` of workers that this worker depends on - those workers will have already completed their `postStart` step
        * `callback` accepts an error parameter
        * always `return super.postStart([dependencies], [callback])` from this method
* call `getWorker(name, callback)` to get a worker from a started service - callback accepts an error and the worker, if found
* call `dispose([callback])` to stop a service which will dispose it's workers and release it's listeners and other references - callback is optional and **does not accept an error parameter** (disposal errors are handled internally through stdout)

### workers
* a `Worker` is a class that overrides service workflow methods in order to add event listeners to accomplish some task
    * eventing methods - ironworks uses 6 pairs of methods for emitters/listeners, instead of just emit/on, so that the parameter signature will be known to the framework
        * `tell('event')` -> `listen('event')`
            * the simplest form where no information is sent or received - the event occurence is all that is needed
        * `inform('information', { some: 'info' })` -> `info('information', (info) => {...})`
            * the emitter is providing information to the listener
        * `confirm('task', (e) => {...})` -> `verify('task', (cb) => {...})`
            * the emitter needs to know when a listener has performed it's task
        * `check('receipt', { product: 'data' }, (e) => {...})` -> `ack('receipt', (product, cb) => {...})`
            * the emitter needs to know when a listener has performed it's task on the provided information
        * `ask('question', (e, answer) => {...})` -> `answer('question', (cb) => {...})`
            * the emitter needs information from the listener
        * `request('action', { request: 'data' }, (e, response) => {...}` -> `respond('action', (req, cb) => {...})`
            * the emitter needs to get information from a listener about the provided information

### event namespacing
ironworks uses a 5 part namespce for all event names - (i.e. - `comm.service-name.request.my-worker.do-task`)
* prefix
    * used to create distinct channels for events inside the same service
    * defaults to 'comm'
* service
    * used to identify the target service name when communicating between mulitple services
* method
    * the name of the "emit" method name used (i.e. - request, tell, check, etc.)
* worker
    * the worker name that houses the listener for the event
* name
    * the name of the event

# built-in workers
* http server
    * can be used to serve static files
    * can provide a REST api for all listeners not annotated with `{ internal: true }`
* socket
    * depends on `HttpServerWorker`
    * can be used to receive communication from other ironworks services via `ConnectorWorker`
    * can provide a `socket.io` api for all listeners not annotated with `{ internal: true }`
* auth
    * depends on `HttpServerWorker` and `SocketWorker`
    * can authenticate event listener endpoints using jwt tokens
    * can authorize event listeners endpoints using roles
* log
    * will log all events to stdout
    * events can be annotated `{ log: { level: [detail number] } }` to control the detail level of the logs
* metric
    * will emit `comm.[service name].inform.iw-metric-[metric worker name].increment` for every event so that counts can be calculated
    * will emit `comm.[service name].inform.iw-metric-[metric worker name].duration` for every event so that execution time averages can be calculated
* connector
    * used to connect to other ironworks services
    * more to come!
* environment
    * used to get environment variables from the system

# examples

#### http file server
```js
import ironworks = require('ironworks');
import Service = ironworks.service.Service;
import HttpServerWorker = ironworks.workers.HttpServerWorker;

new Service('my-file-server')
    .use(new HttpServerWorker({
        port: 9967,
        rootSitePagePath: "index.html", //the file served for the site root
        hapi: { // this entire object is passed to hapi, any valid hapi option can be used
            connections: {
                routes: {
                    files: {
                        relativeTo: path.resolve('./content/public')
                    }
                }
            }
        }
    })
    .start();
```

#### http REST api server
```js
import ironworks = require('ironworks');
import Service = ironworks.service.Service;
import HttpServerWorker = ironworks.workers.HttpServerWorker;

new Service('my-api-service')
    .use(new HttpServerWorker({
        port: 9967,
        apiRoute: 'api' // used to separate the ironworks REST endpoints from your other urls
    })
    .answer('echo-endpoint', (req, cb) => {
        cb(null, req);
    }) // this will create an endpoint at http://hostname:9967/api/comm/my-api-service/ask/iw-service/echo-endpoint?some=data
    .start();
```

#### more examples on the way
