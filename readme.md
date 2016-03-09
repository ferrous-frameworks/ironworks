# Initial release of ironworks framework.

## features:
- **whoIAm** system includes **IAm**, **IWho** and **IWhoQuery** used to identify objects in the system.
- **Options** class to manage defaultable options to any class, supports inheriting options from a base class via adoption.
- **Collection** class utilizes the **whoIAm** system and is backed by *async* to provide easy to use object list management.
- **Service** class initializes and starts a collection of **IWorkers** and to constructs the **Comm** eventing engine.
- **Worker** class should be inherited into custom worker objects to handle the business logic of your application, these can be dependent on other workers.
- **Comm** eventing engine provides an opinionated way to emit and listen to namespaced events on any object in your **Service**. By using the pre-built **ISocketWorker** and **ICfClientWorker** you can allow other services to emit events into your service and you can emit events to them.
- **Interceptor** engine allows you to chain synchronous interceptors on an event that can inspect or modify arguments emitted out and any response by the listener via callback.
- **HttpWorker** provides a static file and/or rest api server backed by *hapi*. The full hapi server object is available.
- **LogWorker** logs all emits and callback responses to stdout and stderr
- **RedisWorker** provides a *Redis* client