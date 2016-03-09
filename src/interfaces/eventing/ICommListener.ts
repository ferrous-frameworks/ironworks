
///<reference path='../../typings/master.d.ts' />

import IronBeam = require('iron-beam');

import IListener = IronBeam.IListener;

import ICommEventData = require('./ICommEventData');

interface ICommListener extends IListener {
    commEvent: ICommEventData;
    annotation: any;
}

export = ICommListener;
