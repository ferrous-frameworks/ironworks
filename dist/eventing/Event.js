var Event = (function () {
    function Event(data) {
        this.name = data.name;
    }
    Event.prototype.getText = function () {
        return this.name;
    };
    Event.prototype.equal = function (event) {
        return this.name === event.name;
    };
    return Event;
})();
module.exports = Event;
//# sourceMappingURL=Event.js.map