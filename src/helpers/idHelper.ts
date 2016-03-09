
///<reference path='../typings/master.d.ts' />

import uuid = require('uuid');
import _ = require('lodash');

export function newId(v4?:any): string {
    if(_.isUndefined(v4)){
        return uuid.v4();
    }
    return uuid.v1();
}
