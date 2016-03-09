
module.exports = {
    helpers: {
        idHelper: require('./helpers/idHelper')
    },
    options: {
        Options: require('./opts/Options')
    },
    auth: {},
    workers: {
        Worker: require('./workers/Worker'),
        AuthWorker: require('./workers/AuthWorker'),
        ConnectorWorker: require('./workers/ConnectorWorker'),
        EnvironmentWorker: require('./workers/EnvironmentWorker'),
        HiveWorker: require('./workers/HiveWorker'),
        HttpServerWorker: require('./workers/HttpServerWorker'),
        LogWorker: require('./workers/LogWorker'),
        MetricWorker: require('./workers/MetricWorker'),
        SocketWorker: require('./workers/SocketWorker')

    },
    service: {
        Service: require('./service/Service')
    },
    eventing: {
        Event: require('./eventing/Event'),
        Emit: require('./eventing/Emit'),
        CommEvent: require('./eventing/CommEvent'),
        CommEmit: require('./eventing/CommEmit'),
        Comm: require('./eventing/Comm'),
        Eventer: require('./eventing/Eventer')
    },
    collection: {
        Collection: require('./collection/Collection')
    }
};