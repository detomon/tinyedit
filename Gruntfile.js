module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		sass: {
			options: {
				sourceMap: true
			},
			dist: {
				files: {
					'css/code-editor.css': 'css/code-editor.scss'
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
					'js/code-editor.js'
				],
				dest: 'js/code-editor.min.js',
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
