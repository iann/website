/* jshint node:true */
//'use strict';

var gulp        = require('gulp');
var frontMatter = require('gulp-front-matter');
var marked      = require('gulp-marked');
var rename      = require('gulp-rename');
var clean       = require('gulp-clean');
var gutil       = require('gulp-util');
var path        = require('path');
var swig        = require('swig');
var through     = require('through2');
var connect     = require('connect');
var browserSync = require('browser-sync');

// optimization includes
var rev         = require('gulp-rev');
var revReplace  = require('gulp-rev-replace');
var useref      = require('gulp-useref');
var filter      = require('gulp-filter');
var uglify      = require('gulp-uglify');
var csso        = require('gulp-csso');
var runSequence = require('run-sequence');
var minifyHtml  = require('gulp-minify-html');
var uncss       = require('gulp-uncss');

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
      file.page.url  = '/' + year + '/' + month + '/' + day + '/' + basename;
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

gulp.task('assets', function () {
  return gulp.src('assets/**/*')
    .pipe(gulp.dest('build/'));
});

gulp.task('media', function () {
  return gulp.src('content/media/**/*')
    .pipe(gulp.dest('build/'))
    .pipe(gulp.dest('dist/'));
});

gulp.task('pages', function () {
  return gulp.src('content/pages/*.md')
  .pipe(frontMatter({property: 'page', remove: true}))
  .pipe(marked())
  .pipe(applyTemplate('templates/page.html'))
  .pipe(rename(function (path) {
      path.extname = '.html';
      path.dirname = path.basename;
      path.basename = 'index';
  }))
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
      var title = match[4];

      path.dirname = year + '/' + month + '/' + day + '/' + title;
      path.basename = "index";
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
  .pipe(gulp.dest('build/'))
  .pipe(gulp.dest('dist/'));
});

gulp.task('browser-sync', function() {
    browserSync({
        server: {
            baseDir: "./build"
        }
    });
});

gulp.task('optimize', function() {
  var htmlFilter = filter("**/*.html");
  var jsFilter = filter("**/*.js");
  var cssFilter = filter("**/*.css");

  var userefAssets = useref.assets();

  var uglifyOptions = {
    preserveComments: 'some'
  }
  return gulp.src("build/**/*.html")
    .pipe(userefAssets)      // Concatenate with gulp-useref
    .pipe(jsFilter)
    .pipe(uglify(uglifyOptions))   // Minify any javascript sources
    .pipe(jsFilter.restore())
    .pipe(cssFilter)
    .pipe(uncss({
            html: ["build/**/*.html"]
    }))
    .pipe(csso())               // Minify any CSS sources
    .pipe(cssFilter.restore())
    .pipe(rev())                // Rename the concatenated files
    .pipe(userefAssets.restore())
    .pipe(useref())
    .pipe(revReplace())         // Substitute in new filenames
    .pipe(htmlFilter)
    .pipe(minifyHtml())
    .pipe(htmlFilter.restore())
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', function () {
  gulp.watch(['assets/**/*'], ['assets']);
  gulp.watch(['content/media'], ['media'])
  gulp.watch(['templates/**/*.html','content/pages/*.md'], ['pages', browserSync.reload]);
  gulp.watch(['templates/**/*.html','content/posts/*.md'], ['posts', 'index', 'archive', 'tags', 'rss', browserSync.reload]);
});

gulp.task('clean', function() {
  return gulp.src(['build', 'dist'], {read: false})
  .pipe(clean());
});

gulp.task('build',
    [ 'assets',
      'pages',
      'media',
      'posts',
      'index',
      'archive',
      'tags',
      'rss' ]
);

gulp.task('dev', function (cb) {
  runSequence('clean',
              [ 'build',
                'browser-sync'],
              'watch',
              cb);
});

gulp.task('prod', function (cb) {
  runSequence('default',
              'optimize',
              cb);
});


gulp.task('default', function (cb) {
  runSequence('clean',
              'build',
              cb);
});
