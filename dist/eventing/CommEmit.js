var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var CommEvent = require('./CommEvent');
var CommEmit = (function (_super) {
    __extends(CommEmit, _super);
    function CommEmit(data) {
        _super.call(this, data);
        this.id = data.id;
        this.emitter = data.emitter;
        this.timestamp = new Date().getTime();
        this.scoc = data.scoc;
    }
    return CommEmit;
})(CommEvent);
module.exports = CommEmit;
//# sourceMappingURL=CommEmit.js.map