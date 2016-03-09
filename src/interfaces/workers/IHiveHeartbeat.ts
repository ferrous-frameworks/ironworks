
import IServiceListener = require('../service/IServiceListener');

interface IHiveHeartbeat {
    availableListeners: IServiceListener[];
}

export = IHiveHeartbeat;
