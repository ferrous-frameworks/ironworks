var uuid = require('uuid');
var _ = require('lodash');
function newId(v4) {
    if (_.isUndefined(v4)) {
        return uuid.v4();
    }
    return uuid.v1();
}
exports.newId = newId;
//# sourceMappingURL=idHelper.js.map