
var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var findit = require('findit');

module.exports = function (tsConfigInfo, cb) {
    if (_.isUndefined(tsConfigInfo)) {
        tsConfigInfo = {};
    }
    var root = tsConfigInfo.root;
    var dirsToCompile = tsConfigInfo.dirsToCompile;
    var pathToTsConfig = tsConfigInfo.pathToTsConfig;
    if (_.isUndefined(root)) {
        root = '.';
    }
    if (root.substring(root.length - 1) !== path.sep) {
        root += path.sep;
    }
    if (_.isUndefined(pathToTsConfig)) {
        pathToTsConfig = path.resolve(path.join(root, 'tsconfig.json'));
    }
    else {
        pathToTsConfig = path.resolve(path.join(root, pathToTsConfig));
    }

    var ignored = [];
    var tsFiles = [];

    var finder = findit(root);

    finder.on('directory', function (dir, stat, stop) {
        if (dir === './') {
            return;
        }
        var projectRootDir = dir.split(path.sep)[0];
        if (_.contains(dirsToCompile, projectRootDir)) {
            return;
        }
        ignored.push(dir);
        stop();
    });

    finder.on('file', function (file) {
        if (path.extname(file) === '.ts') {
            tsFiles.push('./' + file);
        }
    });

    finder.once('end', function () {
        path.join(root, 'tsconfig.json');
        var tsconfig = require(pathToTsConfig);
        tsconfig.files = _.sortBy(tsFiles);
        fs.writeFile(pathToTsConfig, JSON.stringify(tsconfig, null, "\t"), {
            encoding: 'utf8',
            flags: 'w'
        }, function (e) {
            if (!_.isUndefined(e) && e !== null) {
                cb(e);
            }
            else {
                cb(void 0, {
                    ignored: ignored,
                    tsFiles: tsFiles
                });
            }
        });
    });

    finder.once('error', function (e) {
        finder.removeAllListeners('directory');
        finder.removeAllListeners('file');
        finder.removeAllListeners('end');
        cb(e);
    });
};
