# ironworks
[![travis build](https://travis-ci.org/ferrous-frameworks/ironworks.svg?branch=master)](https://travis-ci.org/ferrous-frameworks/ironworks)

ironworks is a worker (plug-in) based framework to assist in creating a modular, interconnected microservice ecosystem

it provides several built-in workers as well as a base class to create custom workers

[Documentation](http://) *(coming soon)*

## Installation

`npm install ironworks`

## Concepts

### services
* a `Service` is a container for workers
* a `Worker` is added to a `Service` using the `use(worker)` method
* when all workers are added, call the `start()` method
* when a `Service` is started, it calls workflow methods on each worker:
    *  *Note: when overriding any of these methods - **the super method must be called and all parameters should be sent***
    *  `preInit(comm, whoService, [callback])`
        *  **this is mainly an internal step** - it should not be overridden by the end user under normal circumstances
        *  `comm` is the instance of `iron-beam` that serves as ironworks shared eventing engine
        *  `whoService` is an object with the name and id of the service
        *  `callback` accepts an error parameter
    *  `init([callback])`
        *  this is the step where listeners are created
        *  listeners can be created after this step, but certain `Service` features will not take them into account
        *  `callback` accepts an error parameter
    *  `postInit([dependencies], [callback])`
        *  this step is used to interact with other workers once they have created their listeners in `init`
        *  `dependencies` will be a `Collection` of workers that this worker depends on - those workers will have already completed their `postInit` step
        *  `callback` accepts an error parameter
    *  `start([dependencies], [callback])`
        *  this step is used to interact with other workers once they have be started
        *  `dependencies` will be a `Collection` of workers that this worker depends on - those workers will have already completed their `start` step
        *  `callback` accepts an error parameter
    *  `postStart([dependencies], [callback])`
        *  this step is used to interact with other workers after they have been started
        *  `dependencies` will be a `Collection` of workers that this worker depends on - those workers will have already completed their `postStart` step
        *  `callback` accepts an error parameter
*  use the `getWorker(name, callback)` method to get a worker from a started service - callback accepts an error and the worker, if found
*  call the `dispose([callback])` to stop a service which will dispose it's workers and release it's listeners and other references - callback is optional and **does not accept an error parameter** (disposal errors are handled internally through stdout)

### workers
* a `Worker` is a class that overrides service workflow methods in order to add event listeners to accomplish some task
