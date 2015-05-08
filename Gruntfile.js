/* jshint node:true */

function mixin(destination, source) {
	for (var key in source) {
		destination[key] = source[key];
	}
	return destination;
}

module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-string-replace');
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('grunt-tslint');
	grunt.loadNpmTasks('dts-generator');
	grunt.loadNpmTasks('intern');

	var compilerOptions = grunt.file.readJSON('tsconfig.json').compilerOptions;

	grunt.initConfig({
		name: 'dojo-core',
		all: [ 'src/**/*.ts', 'typings/tsd.d.ts' ],
		tests: [ 'tests/**/*.ts', 'typings/tsd.d.ts' ],
		devDirectory: compilerOptions.outDir,

		clean: {
			dist: {
				src: [ 'dist/' ]
			},
			dev: {
				src: [ '<%= devDirectory %>' ]
			},
			src: {
				src: [ '{src,tests}/**/*.js' ],
				filter: function (path) {
					// Only clean the .js file if a .js.map file also exists
					var mapPath = path + '.map';
					if (grunt.file.exists(mapPath)) {
						grunt.file.delete(mapPath);
						return true;
					}
					return false;
				}
			},
			coverage: {
				src: [ 'html-report/' ]
			}
		},

		copy: {
			staticFiles: {
				expand: true,
				cwd: '.',
				src: [ 'README.md', 'LICENSE', 'package.json', 'bower.json' ],
				dest: 'dist/'
			},
			typings: {
				expand: true,
				cwd: 'typings/',
				src: [ '**/*.d.ts', '!tsd.d.ts' ],
				dest: 'dist/typings/'
			},
			testData: {
				expand: true,
				cwd: 'tests/',
				src: [ '**/*.json' ],
				dest: '_build/tests/'
			}
		},

		dtsGenerator: {
			options: {
				baseDir: 'src',
				name: '<%= name %>'
			},
			dist: {
				options: {
					out: 'dist/typings/<%= name %>/<%= name %>-2.0.d.ts'
				},
				src: [ '<%= all %>' ]
			}
		},

		intern: {
			options: {
				grep: grunt.option('grep') || '.*',
				runType: 'runner',
				config: '<%= devDirectory %>/tests/intern'
			},
			runner: {
				options: {
					reporters: [ 'runner', 'lcovhtml' ]
				}
			},
			local: {
				options: {
					config: '<%= devDirectory %>/tests/intern-local',
					reporters: [ 'runner', 'lcovhtml' ]
				}
			},
			client: {
				options: {
					runType: 'client',
					reporters: [ 'console', 'lcovhtml' ]
				}
			},
			streams: {
				/*  before using, run: npm install requirejs */
				options: {
					runType: 'client',
					reporters: [ 'console', 'lcovhtml' ],
					config: '<%= devDirectory %>/tests/intern-streams'
				}
			},
			proxy: {
				options: {
					proxyOnly: true
				}
			}
		},

		rename: {
			sourceMaps: {
				expand: true,
				cwd: 'dist/',
				src: [ '**/*.js.map', '!_debug/**/*.js.map' ],
				dest: 'dist/_debug/'
			}
		},

		rewriteSourceMaps: {
			dist: {
				src: [ 'dist/_debug/**/*.js.map' ]
			}
		},

		'string-replace': {
			testIgnoreUmdWrapper: {
				options: {
					replacements: [
						{
							pattern: /(.*)/,
							replacement: '$1/* istanbul ignore next */'
						}
					]
				},
				files: [
					{
						src: ['<%= devDirectory %>/**/*.js'],
						dest: '<%= devDirectory %>'
					}
				]
			}
		},

		ts: {
			options: mixin(
				compilerOptions,
				{
					failOnTypeErrors: true,
					fast: 'never'
				}
			),
			dev: {
				outDir: '<%= devDirectory %>',
				src: [ '<%= all %>', '<%= tests %>' ]
			},
			dist: {
				options: {
					mapRoot: '../dist/_debug'
				},
				outDir: 'dist',
				src: [ '<%= all %>' ]
			}
		},

		tslint: {
			options: {
				configuration: grunt.file.readJSON('tslint.json')
			},
			src: {
				src: [
					'<%= all %>',
					'<%= tests %>',
					'!typings/**/*.ts',
					'!tests/typings/**/*.ts'
				]
			}
		},

		watch: {
			src: {
				options: {
					atBegin: true
				},
				files: [ '<%= all %>', '<%= tests %>' ],
				tasks: [
					'dev',
					'tslint'
				]
			}
		}
	});

	grunt.registerMultiTask('rewriteSourceMaps', function () {
		this.filesSrc.forEach(function (file) {
			var map = JSON.parse(grunt.file.read(file));
			var sourcesContent = map.sourcesContent = [];
			var path = require('path');
			map.sources = map.sources.map(function (source, index) {
				sourcesContent[index] = grunt.file.read(path.resolve(path.dirname(file), source));
				return source.replace(/^.*\/src\//, '');
			});
			grunt.file.write(file, JSON.stringify(map));
		});
		grunt.log.writeln('Rewrote ' + this.filesSrc.length + ' source maps');
	});

	grunt.registerMultiTask('rename', function () {
		this.files.forEach(function (file) {
			if (grunt.file.isFile(file.src[0])) {
				grunt.file.mkdir(require('path').dirname(file.dest));
			}
			require('fs').renameSync(file.src[0], file.dest);
			grunt.verbose.writeln('Renamed ' + file.src[0] + ' to ' + file.dest);
		});
		grunt.log.writeln('Moved ' + this.files.length + ' files');
	});

	grunt.registerTask('dev', [
		'ts:dev'
	]);
	grunt.registerTask('dist', [
		'ts:dist',
		'rename:sourceMaps',
		'rewriteSourceMaps',
		'copy:typings',
		'copy:staticFiles',
		'dtsGenerator:dist'
	]);
	grunt.registerTask('testPrep', ['dev', 'string-replace:testIgnoreUmdWrapper', 'copy:testData']);
	grunt.registerTask('test', [ 'testPrep', 'intern:client' ]);
	grunt.registerTask('test-streams', [ 'testPrep', 'intern:streams' ]);
	grunt.registerTask('test-local', [ 'testPrep', 'intern:local' ]);
	grunt.registerTask('test-proxy', [ 'testPrep', 'intern:proxy' ]);
	grunt.registerTask('ci', [ 'tslint', 'test' ]);
	grunt.registerTask('default', [ 'clean', 'dev' ]);
};
