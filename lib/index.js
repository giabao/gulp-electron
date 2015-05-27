var File, PLUGIN_NAME, PluginError, ProgressBar, async, childProcess, electron, fs, getApmPath, grs, isDir, isExists, isFile, mv, path, rm, spawn, through, util, wrench;

fs = require('fs-extra');

grs = require('grs');

path = require('path');

async = require('async');

wrench = require('wrench');

mv = require('mv');

rm = require('rimraf');

util = require('gulp-util');

PluginError = util.PluginError;

through = require('through2');

childProcess = require('child_process');

ProgressBar = require('progress');

File = require('vinyl');

var unzip = require('unzip');
var fstream = require('fstream');
var gulp = require('gulp');
var zip = require('gulp-zip');

PLUGIN_NAME = 'gulp-electron';

module.exports = electron = function(options) {
  var bufferContents, endStream, packageJson;
  options = options || {};
  if (!options.release || !options.version || !options.src || !options.cache) {
    throw new PluginError('Miss version or release path.');
  }
  packageJson = options.packageJson;
  if (typeof options.packageJson === 'string') {
    packageJson = require(packageJson);
  }
  if (options.platforms == null) {
    options.platforms = ['darwin'];
  }
  if (options.apm == null) {
    options.apm = getApmPath();
  }
  if (options.symbols == null) {
    options.symbols = false;
  }
  if (options.rebuild == null) {
    options.rebuild = false;
  }
  if (options.ext == null) {
    options.ext = 'zip';
  }
  if (typeof options.platforms === 'string') {
    options.platforms = [options.platforms];
  }
  bufferContents = function(file, enc, callback) {
    return callback();
  };
  endStream = function(callback) {
    var platforms, push;
    push = this.push;
    platforms = ['darwin', 'win32', 'linux', 'darwin-x64', 'linux-ia32', 'linux-x64', 'win32-ia32', 'win32-x64'];
    return async.eachSeries(options.platforms, function(platform, cb) {
      var _src, binName, cache, cacheFile, cachePath, cacheZip, cacheedPath, defaultAppName, electronFile, electronFileDir, electronFilePath, pkg, pkgZip, pkgZipDir, pkgZipPath, platformDir, platformPath, platformZipDir, platformZipPath, src, suffix, targetApp, targetAppPath, targetDir, targetDirPath, targetPath;
      if (platform === 'osx') {
        platform = 'darwin';
      }
      if (platform === 'win') {
        platform = 'win32';
      }
      if (platforms.indexOf(platform) < 0) {
        throw new PluginError("Not support platform " + platform);
      }
      if (options.ext == null) {
        options.ext = "zip";
      }
      cacheZip = cache = "electron-" + options.version + "-" + platform;
      if (options.symbols) {
        cacheZip += '-symbols';
      }
      cacheZip += "." + options.ext;
      pkgZip = pkg = packageJson.name + "-" + packageJson.version + "-" + platform;
      if (options.symbols) {
        pkgZip += '-symbols';
      }
      pkgZip += "." + options.ext;
      cachePath = path.resolve(options.cache, options.version);
      cacheFile = path.resolve(cachePath, cacheZip);
      cacheedPath = path.resolve(cachePath, cache);
      pkgZipDir = path.join(options.release, options.version);
      pkgZipPath = path.resolve(pkgZipDir);
      platformDir = path.join(pkgZipDir, platform);
      platformPath = path.resolve(platformDir);
      platformZipDir = path.join(pkgZipDir, packageJson.name);
      platformZipPath = path.resolve(platformZipDir);
      src = "";
      targetApp = "";
      defaultAppName = "Electron";
      suffix = "";
      if (platform.indexOf('darwin') >= 0) {
        suffix = ".app";
        electronFile = "Electron" + suffix;
      } else if (platform.indexOf('win') >= 0) {
        suffix = ".exe";
        electronFile = "electron" + suffix;
      } else {
        electronFile = "electron";
      }
      electronFileDir = path.join(platformDir, electronFile);
      electronFilePath = path.resolve(electronFileDir);
      binName = packageJson.name + suffix;
      targetAppPath = path.join(platformPath, binName);
      _src = 'resources/app';
      if (platform.indexOf('darwin') >= 0) {
        _src = binName + '/Contents/Resources/app/';
      }
      targetDir = path.join(packageJson.name, _src);
      targetDirPath = path.resolve(platformDir, _src);
      targetPath = path.resolve(platformPath);
      return async.series([
        function(next) {
          var bar;
          if (!isFile(cacheFile)) {
            util.log(PLUGIN_NAME, "download " + platform + " " + options.version + " cache filie.");
            wrench.mkdirSyncRecursive(cachePath);
            bar = null;
            return grs({
              repo: 'atom/electron',
              tag: options.version,
              name: cacheZip
            }).on('error', function(error) {
              throw new PluginError(error);
            }).on('size', function(size) {
              return bar = new ProgressBar(pkg + " [:bar] :percent :etas", {
                complete: '>',
                incomplete: ' ',
                width: 20,
                total: size
              });
            }).pipe(through(function(chunk, enc, cb) {
              bar.tick(chunk.length);
              this.push(chunk);
              return cb();
            })).pipe(fs.createWriteStream(cacheFile)).on('close', function() {
              return next();
            }).on('error', next);
          } else {
            return next();
          }
        }, function(next) {
          if (!isDir(cacheedPath)) {
            wrench.mkdirSyncRecursive(cacheedPath);
            util.log(PLUGIN_NAME, "unzip " + platform + " " + options.version + " electron.");
            return fs.createReadStream(cacheFile)
              .pipe(unzip.Parse())
              .pipe(fstream.Writer(cacheedPath))
              .on('close', function() {
                return next();
              }).on('error', next);
          } else {
            return next();
          }
        }, function(next) {
          if (options.rebuild) {
            util.log(PLUGIN_NAME, "Rebuilding modules");
            return spawn({
              cmd: options.apm,
              args: ['rebuild']
            }, next);
          } else {
            return next();
          }
        }, function(next) {
          wrench.mkdirSyncRecursive(platformPath);
          wrench.copyDirSyncRecursive(cacheedPath, platformPath, {
            forceDelete: true,
            excludeHiddenUnix: false,
            inflateSymlinks: false
          });
          return next();
        }, function(next) {
          if (!isExists(targetAppPath)) {
            return mv(electronFilePath, targetAppPath, function() {
              return next();
            });
          } else {
            return next();
          }
        }, function(next) {
          if (!isExists(targetDirPath)) {
            return rm(targetDirPath, next);
          } else {
            return next();
          }
        }, function(next) {
          util.log(PLUGIN_NAME, options.src + " -> " + targetDir + " distributing");
          fs.emptyDirSync(targetDirPath);
          for(var i=0; i < options.src.length; i++) {
            fs.copySync(options.src[i], targetDirPath + '/' + options.src[i]);
          }
          return next();
        }, function(next) {
          util.log(PLUGIN_NAME, (path.join(options.release, pkgZip)) + " packaging from " + platformPath);
          return gulp.src(platformPath + "/**")
            .pipe(zip(pkgZip))
            .pipe(gulp.dest(options.release))
            .on('close', function() {
              return next();
            }).on('error', next);;
        }
      ], function(error, results) {
        var _zip;
        _zip = path.join(pkgZipDir, pkgZip);
        util.log(PLUGIN_NAME, _zip + " distribute done.");
        return cb();
      });
    }, function(error, results) {
      util.log(PLUGIN_NAME, "all distribute done.");
      return callback();
    });
  };
  return through.obj(bufferContents, endStream);
};

isDir = function() {
  var filepath;
  filepath = path.join.apply(path, arguments);
  return fs.existsSync(filepath) && !fs.statSync(filepath).isFile();
};

isFile = function() {
  var filepath;
  filepath = path.join.apply(path, arguments);
  return fs.existsSync(filepath) && fs.statSync(filepath).isFile();
};

isExists = function() {
  var filepath;
  filepath = path.join.apply(path, arguments);
  return fs.existsSync(filepath);
};

getApmPath = function() {
  var apmPath;
  apmPath = path.join('apm', 'node_modules', 'atom-package-manager', 'bin', 'apm');
  if (!isFile(apmPath)) {
    return apmPath = 'apm';
  }
};

spawn = function(options, callback) {
  var error, proc, stderr, stdout;
  stdout = [];
  stderr = [];
  error = null;
  proc = childProcess.spawn(options.cmd, options.args, options.opts);
  proc.stdout.on('data', function(data) {
    stdout.push(data.toString());
    if (process.NODE_ENV === 'test') {
      return util.log(data.toString());
    }
  });
  proc.stderr.on('data', function(data) {
    return stderr.push(data.toString());
  });
  return proc.on('exit', function(code, signal) {
    var results;
    if (code !== 0) {
      error = new Error(signal);
    }
    results = {
      stderr: stderr.join(''),
      stdout: stdout.join(''),
      code: code
    };
    if (code !== 0) {
      throw new PluginError(PLUGIN_NAME, results.stderr || 'unknow error , maybe you can try delete the zip packages.');
    }
    return callback(error, results);
  });
};
