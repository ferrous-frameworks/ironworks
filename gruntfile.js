var path = require('path');

var _ = require('lodash');

var tsConfigInit = require('./utils/tsc/tsConfigInit');

module.exports = function(grunt) {

    var pathToNode = grunt.option('path-to-node');
    if (_.isUndefined(pathToNode)) {
        pathToNode = path.join(process.execPath, '/../../');
    }

    var tsBin = path.join(pathToNode, 'lib/node_modules/typescript/bin');
    var nodeBin = path.join(pathToNode, 'bin');
    var projectRoot = __dirname;



    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-bump');

    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-replace');
    
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        nodeBin: nodeBin,
        tscExec: path.join(tsBin, 'tsc'),
        shell: {
            tsd: {
                command: [
                    'mkdir -p src'
                    , 'cd src'
                    , 'mkdir -p typings'
                    , 'cd typings'
                    , 'mkdir -p tsd'
                    , 'cd ' + projectRoot
                    , '<%= nodeBin %>/tsd reinstall -s'
                ].join('&&')
            },

            tsc: {
                options: {
                    stdout: false,
                    callback: function (e, stdout, stderr, cb) {
                        grunt.log.subhead('typescript compiler results ---');
                        if (stdout.length === 0) {
                            grunt.log.ok();
                        }
                        else {
                            var grouped = _.groupBy(_.initial(stdout.split('\n')), function (error) {
                                return error.substring(0, error.indexOf('('));
                            });
                            _.each(grouped, function (errors, file) {
                                grunt.log.subhead(file);
                                var filename = path.basename(file);
                                _.each(errors, function (e) {
                                    grunt.log.error(e);
                                });
                                grunt.log.writeln();
                            });
                        }
                        cb(e);
                    }
                },
                command: '<%= tscExec %> --project ./'
            },
            addDistToGit: {
                command: 'git add dist/* dist/**/*'
            }
        },

        mochaTest: {
            all: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/**/*.test.js']
            },
            log: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/LogWorker.test.js']
            },
            broadcast: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/BroadcastWorker.test.js']
            },
            auth: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/AuthWorker.test.js']
            },
            socket: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/SocketWorker.test.js']
            },
            service: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/service/Service.test.js']
            },
            worker: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/Worker.test.js']
            },
            metric: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/MetricWorker.test.js']
            },
            environment: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/EnvironmentWorker.test.js']
            },
            connector: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/ConnectorWorker.test.js']
            },
            hive: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/HiveWorker.test.js']
            },
            httpServer: {
                options: {
                    colors: true,
                    log: true,
                    logErrors: true,
                    timeout: 6000
                },
                src: ['src/tests/workers/HttpServerWorker.test.js']
            }
        },
        bump: {
            options: {
                files: ['package.json'],
                updateConfigs: [],
                commit: true,
                commitMessage: 'Release v%VERSION%',
                commitFiles: ['package.json'],
                createTag: true,
                tagName: 'v%VERSION%',
                tagMessage: 'Version %VERSION%',
                push: false,
                pushTo: 'upstream',
                gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
                globalReplace: false,
                prereleaseName: false,
                regExp: false
            }
        },
        copy: {
            dist: {
                files: [{
                    options: {
                        noProcess: 'src/**/*.test.js'
                    },
                    expand: true,
                    cwd: 'src/',
                    src: ['**/*.js', '**/*.d.ts', '*.d.ts', '../package.json'],
                    dest: 'dist/'
                }]
            }
        },
        clean: {
            dist: [ "dist" ]
        },
        replace: {
            replaceNodeModuleInMasterD: {
                options: {
                    patterns: [
                        {
                            match: /node_modules/g,
                            replacement: function () {
                                return '..';
                            }
                        }
                    ]
                },
                files: [
                    {expand: true, flatten: true, src: ['dist/typings/master.d.ts'], dest: 'dist/typings'}
                ]
            }
        }
    });


    grunt.registerTask('tsconfig', 'initialize tsconfig.json with the current project files', function () {
        var done = this.async();
        tsConfigInit({
            dirsToCompile: [
                'src'
            ],
            pathToTsConfig: './tsconfig.json'
        }, function (e, results) {
            if (_.isUndefined(e)) {
                grunt.log.subhead('tsconfig.json init results ---');
                _.each(results.tsFiles, function (tsf) {
                    grunt.log.ok("included " + tsf);
                });
                _.each(results.ignored, function (ignored) {
                    grunt.log.ok("ignored directory " + ignored);
                });
                grunt.log.ok();
                done();
                return;
            }
            done(e);
        });
    });

    grunt.registerTask('help', 'ironworks grunt help', function () {
        console.log("--- IRONWORKS GRUNT HELP ---");
        console.log("\t --- options ---");
        console.log("\t\t--path-to-node: path to the node bin directory. e.g. - /usr/bin/node/");
    });


    grunt.registerTask('prep', [
        'shell:tsd',
        'tsconfig'
    ]);

    grunt.registerTask('build', [
        'shell:tsc',
        'clean:dist',
        'copy:dist',
        'replace:replaceNodeModuleInMasterD',
        'shell:addDistToGit'
    ]);

    grunt.registerTask('prep-n-build', [
        'prep',
        'build'
    ]);

    grunt.registerTask('test', [
        'mochaTest:all'
    ]);

    grunt.registerTask('build-n-test', [
        'build',
        'test'
    ]);

    grunt.registerTask('default', [
        'prep',
        'build',
        'test'
    ]);
};