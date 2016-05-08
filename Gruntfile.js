module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		sass: {
			options: {
				sourceMap: true
			},
			dist: {
				files: {
					'css/tinyedit.css': 'css/tinyedit.scss',
				}
			}
		},

		postcss: {
			options: {
				map: {
					inline: false
				},
				processors: [
					require('pixrem')(),
					require('autoprefixer')({browsers: 'last 5 versions'}),
					require('cssnano')()
				]
			},
			dist: {
				src: 'css/*.css'
			}
		},

		uglify: {
			dist: {
				src: [
					'js/tinyedit.js'
				],
				dest: 'js/tinyedit.min.js',
				options: {
					sourceMap: true,
					sourceMapIncludeSources: true
				}
			}
		}

	});

	grunt.loadNpmTasks('grunt-sass');
	grunt.loadNpmTasks('grunt-postcss');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.registerTask('default', [
		'sass',
		'uglify',
		'postcss'
	]);

};
