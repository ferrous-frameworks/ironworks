var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Event = require('./Event');
var Emit = (function (_super) {
    __extends(Emit, _super);
    function Emit(data) {
        _super.call(this, data);
        this.id = data.id;
        this.emitter = data.emitter;
        this.timestamp = new Date().getTime();
    }
    return Emit;
})(Event);
module.exports = Emit;
//# sourceMappingURL=Emit.js.map