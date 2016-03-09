
import ICommEventData = require('../eventing/ICommEventData');

interface IServiceListener {
    commEvent: ICommEventData;
    annotation: any;
}

export = IServiceListener;
