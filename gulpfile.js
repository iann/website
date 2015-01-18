/* jshint node:true */
//'use strict';

var gulp        = require('gulp');
var frontMatter = require('gulp-front-matter');
var marked      = require('gulp-marked');
var minifyHtml  = require('gulp-minify-html');
var rename      = require('gulp-rename');
var clean       = require('gulp-clean');
var gutil       = require('gulp-util');
var path        = require('path');
var swig        = require('swig');
var through     = require('through2');
var connect     = require('connect');
var http        = require('http');

var site  = require('./site.json');
site.time = new Date();

swig.setDefaults({
  loader: swig.loaders.fs(__dirname + '/templates'),
  cache: false
});

var rePostName   = /(\d{4})-(\d{1,2})-(\d{1,2})-(.*)/;

function collectPosts() {
  var posts = [];
  var tags = [];
  return through.obj(function (file, enc, cb) {
    posts.push(file.page);
    posts[posts.length - 1].content = file.contents.toString();

    if (file.page.tags) {
      file.page.tags.forEach(function (tag) {
        if (tags.indexOf(tag) == -1) {
          tags.push(tag);
        }
      });
    }

    this.push(file);
    cb();
  },
  function (cb) {
    posts.sort(function (a, b) {
      return b.date - a.date;
    });
    site.posts = posts;
    site.tags = tags;
    cb();
  });
}

function filename2date() {
  return through.obj(function (file, enc, cb) {
    var basename = path.basename(file.path, '.md');
    var match = rePostName.exec(basename);
    if (match)
    {
      var year     = match[1];
      var month    = match[2];
      var day      = match[3];
      var basename = match[4];
      file.page.date = new Date(year + "-" + month + "-" + day);
      file.page.url  = '/' + year + '/' + month + '/' + day + '/' + basename + '.html';
    }

    this.push(file);
    cb();
  });
}

function summarize(marker) {
  return through.obj(function (file, enc, cb) {
    var summary = file.contents.toString().split(marker)[0]
    file.page.summary = summary;
    this.push(file);
    cb();
  });
}

function applyTemplate(templateFile) {
  var tpl = swig.compileFile(path.join(__dirname, templateFile));

  return through.obj(function (file, enc, cb) {
    var data = {
      site: site,
      page: file.page,
      content: file.contents.toString()
    };
    file.contents = new Buffer(tpl(data), 'utf8');
    this.push(file);
    cb();
  });
}

// gulp.task('html', ['styles'], function () {
//   var lazypipe = require('lazypipe');
//   var cssChannel = lazypipe()
//     .pipe($.csso)
//     .pipe($.replace, 'bower_components/bootstrap-sass-official/assets/fonts/bootstrap','fonts');
//   var assets = $.useref.assets({searchPath: '{.tmp,app}'});
//
//   var postData = {};
//   var templateData = {
//     'globalData': globalData,
//     'postData': postData
//   };
//
//   var handlebarsOptions = {
//     ignorePartials: true, //ignores the unknown footer2 partial in the handlebars template, defaults to false
//     batch : ['app/templates'],
//
//   };
//
//   return gulp.src('app/templates/*.hbs')
//     .pipe(handlebars(templateData, handlebarsOptions))
//     .pipe(rename({
//       extname: '.html'
//     }))
//     .pipe(assets)
//     .pipe($.if('*.js', $.uglify()))
//     .pipe($.if('*.css', cssChannel()))
//     .pipe(assets.restore())
//     .pipe($.useref())
//     .pipe($.if('*.html', $.minifyHtml({conditionals: true, loose: true})))
//     .pipe(gulp.dest('dist'));
// });

gulp.task('assets', function () {
  return gulp.src('assets/**/*')
  .pipe(gulp.dest('build/'));
});

gulp.task('media', function () {
  return gulp.src('content/media/**/*')
  .pipe(gulp.dest('build/media'));
});

gulp.task('pages', function () {
  return gulp.src('content/pages/*.md')
  .pipe(frontMatter({property: 'page', remove: true}))
  .pipe(marked())
  .pipe(applyTemplate('templates/page.html'))
  .pipe(rename({extname: '.html'}))
  .pipe(gulp.dest('build'));
});

gulp.task('posts', function () {
  return gulp.src('content/posts/*.md')
  .pipe(frontMatter({property: 'page', remove: true}))
  .pipe(marked())
  .pipe(summarize('<!--more-->'))
  .pipe(filename2date())
  .pipe(collectPosts())
  .pipe(applyTemplate('templates/post.html'))
  .pipe(rename(function (path) {
    path.extname = ".html";
    var match = rePostName.exec(path.basename);
    if (match)
    {
      var year = match[1];
      var month = match[2];
      var day = match[3];

      path.dirname = year + '/' + month + '/' + day;
      path.basename = match[4];
    }
  }))
  .pipe(gulp.dest('build'));
});

function dummy(file) {
  var stream = through.obj(function(file, enc, cb) {
    this.push(file);
    cb();
  });

  if (site)
  {
    var file = new gutil.File({
      path: file,
      contents: new Buffer('')
    });
    file.page = {}
    stream.write(file);
  }

  stream.end();
  stream.emit("end");

  return stream;
}

gulp.task('index', ['posts'], function () {
  return dummy('index.html')
  .pipe(applyTemplate('templates/index.html'))
  .pipe(gulp.dest('build/'));
});

function posts(basename, count) {
  var stream = through.obj(function(file, enc, cb) {
    this.push(file);
    cb();
  });

  if (site.posts)
  {
    var c     = 0;
    var page  = 0;
    var posts = [];
    site.posts.forEach(function (post) {
      posts.push(post);
      c++;
      if (c == count) {
        var file = new gutil.File({
          path: basename + (page == 0 ? '' : page) + '.html',
          contents: new Buffer('')
        });
        console.log('page=' + page + ' c=' + c + ' posts.length=' + site.posts.length);
        file.page = {
          posts: posts,
          prevPage: page != 0 ? basename + ((page-1) == 0 ? '' : page-1) + '.html' : null,
          nextPage: (page+1) * count < site.posts.length ? basename + (page+1) + '.html' : null,
        };
        stream.write(file);

        c = 0;
        posts = [];
        page++;
      }
    });

    if (posts.length != 0) {
      var file = new gutil.File({
        path: basename + (page == 0 ? '' : page) + '.html',
        contents: new Buffer('')
      });
      file.page = {
        posts: posts,
        prevPage: page != 0 ? basename + ((page-1) == 0 ? '' : page) + '.html' : null,
        nextPage: null,
      };
      stream.write(file);
    }
  }

  stream.end();
  stream.emit("end");

  return stream;
}

gulp.task('archive', ['posts'], function () {
  return posts('journal', 10)
  .pipe(applyTemplate('templates/journal.html'))
  .pipe(gulp.dest('build/'));
});

function tags() {
  var stream = through.obj(function(file, enc, cb) {
    this.push(file);
    cb();
  });

  if (site.tags)
  {
    site.tags.forEach(function (tag) {
      var file = new gutil.File({
        path: tag + '.html',
        contents: new Buffer('')
      });
      file.page = {title: tag, tag: tag}

      stream.write(file);
    });
  }

  stream.end();
  stream.emit("end");

  return stream;
}

gulp.task('tags', ['posts'], function () {
  return tags()
  .pipe(applyTemplate('templates/tag.html'))
  .pipe(gulp.dest('build/tag'));
});

gulp.task('rss', ['posts'], function () {
  return dummy('atom.xml')
  .pipe(applyTemplate('templates/atom.xml'))
  .pipe(gulp.dest('build/'));
});

gulp.task('default', ['assets', 'pages', 'media', 'posts', 'index', 'archive', 'tags', 'rss']);

// quickfix for yeehaa's gulp step (TODO build a sane gulp step)
gulp.task('test', ['default']);

gulp.task('clean', function() {
  return gulp.src('build', {read: false})
  .pipe(clean());
});

gulp.task('watch', ['default'], function () {
  gulp.watch(['assets/**/*'], ['assets']);
  gulp.watch(['content/media'], ['media'])
  gulp.watch(['templates/page.html','content/pages/*.md'], ['pages']);
  gulp.watch(['templates/post.html', 'templates/index.html', 'templates/journal.html','content/posts/*.md'], ['posts', 'index', 'archive', 'tags', 'rss']);

  var app = connect()
  .use(connect.static('build'))
  .use(connect.directory('build'));

  http.createServer(app).listen(3000);
});


// // generated on 2015-01-04 using generator-gulp-webapp 0.2.0
// var gulp = require('gulp');
// var $ = require('gulp-load-plugins')();
// var handlebars = require('gulp-compile-handlebars');
// var rename = require('gulp-rename');
// var globalData = require('./config.json');
//
// gulp.task('styles', function () {
//   return gulp.src('app/styles/main.scss')
//     .pipe($.plumber())
//     .pipe($.rubySass({
//       style: 'expanded',
//       precision: 10
//     }))
//     .pipe($.autoprefixer({browsers: ['last 1 version']}))
//     .pipe(gulp.dest('.tmp/styles'));
// });
//
// gulp.task('jshint', function () {
//   return gulp.src('app/scripts/**/*.js')
//     .pipe($.jshint())
//     .pipe($.jshint.reporter('jshint-stylish'))
//     .pipe($.jshint.reporter('fail'));
// });
//
// gulp.task('html', ['styles'], function () {
//   var lazypipe = require('lazypipe');
//   var cssChannel = lazypipe()
//     .pipe($.csso)
//     .pipe($.replace, 'bower_components/bootstrap-sass-official/assets/fonts/bootstrap','fonts');
//   var assets = $.useref.assets({searchPath: '{.tmp,app}'});
//
//   var postData = {};
//   var templateData = {
//     'globalData': globalData,
//     'postData': postData
//   };
//
//   var handlebarsOptions = {
//     ignorePartials: true, //ignores the unknown footer2 partial in the handlebars template, defaults to false
//     batch : ['app/templates'],
//
//   };
//
//   return gulp.src('app/templates/*.hbs')
//     .pipe(handlebars(templateData, handlebarsOptions))
//     .pipe(rename({
//       extname: '.html'
//     }))
//     .pipe(assets)
//     .pipe($.if('*.js', $.uglify()))
//     .pipe($.if('*.css', cssChannel()))
//     .pipe(assets.restore())
//     .pipe($.useref())
//     .pipe($.if('*.html', $.minifyHtml({conditionals: true, loose: true})))
//     .pipe(gulp.dest('dist'));
// });
//
// gulp.task('pages', function () {
//   return gulp.src('app/about/*.md')
//   .pipe($.frontMatter({property: 'page', remove: true}))
//   .pipe($.markdown())
//   .pipe(rename({extname: '.html'}))
//   .pipe(gulp.dest('dist'));
// });
//
// gulp.task('images', function () {
//   return gulp.src('app/images/**/*')
//     .pipe($.cache($.imagemin({
//       progressive: true,
//       interlaced: true
//     })))
//     .pipe(gulp.dest('dist/images'));
// });
//
// gulp.task('fonts', function () {
//   return gulp.src(require('main-bower-files')().concat('app/fonts/**/*'))
//     .pipe($.filter('**/*.{eot,svg,ttf,woff}'))
//     .pipe($.flatten())
//     .pipe(gulp.dest('dist/fonts'));
// });
//
// gulp.task('extras', function () {
//   return gulp.src([
//     'app/*.*',
//     '!app/*.html',
//     'node_modules/apache-server-configs/dist/.htaccess'
//   ], {
//     dot: true
//   }).pipe(gulp.dest('dist'));
// });
//
// gulp.task('clean', require('del').bind(null, ['.tmp', 'dist']));
//
// gulp.task('connect', ['styles'], function () {
//   var serveStatic = require('serve-static');
//   var serveIndex = require('serve-index');
//   var app = require('connect')()
//     .use(require('connect-livereload')({port: 35729}))
//     .use(serveStatic('.tmp'))
//     .use(serveStatic('app'))
//     // paths to bower_components should be relative to the current file
//     // e.g. in app/index.html you should use ../bower_components
//     .use('/bower_components', serveStatic('bower_components'))
//     .use(serveIndex('app'));
//
//   require('http').createServer(app)
//     .listen(9000)
//     .on('listening', function () {
//       console.log('Started connect web server on http://localhost:9000');
//     });
// });
//
// gulp.task('serve', ['connect', 'watch'], function () {
//   require('opn')('http://localhost:9000');
// });
//
// // inject bower components
// gulp.task('wiredep', function () {
//   var wiredep = require('wiredep').stream;
//
//   gulp.src('app/styles/*.scss')
//     .pipe(wiredep())
//     .pipe(gulp.dest('app/styles'));
//
//   gulp.src('app/*.html')
//     .pipe(wiredep({exclude: ['bootstrap-sass-official']}))
//     .pipe(gulp.dest('app'));
// });
//
// gulp.task('watch', ['connect'], function () {
//   $.livereload.listen();
//
//   // watch for changes
//   gulp.watch([
//     'app/*.html',
//     '.tmp/styles/**/*.css',
//     'app/scripts/**/*.js',
//     'app/images/**/*'
//   ]).on('change', $.livereload.changed);
//
//   gulp.watch('app/styles/**/*.scss', ['styles']);
//   gulp.watch('bower.json', ['wiredep']);
// });
//
// gulp.task('build', ['jshint', 'pages', 'html', 'images', 'fonts', 'extras'], function () {
//   return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
// });
//
// gulp.task('default', ['clean'], function () {
//   gulp.start('build');
// });
