var File, PLUGIN_NAME, PluginError, ProgressBar, async, chalk, childProcess, electron, fs, getApmPath, grs, isDir, isExists, isFile, mv, path, rm, spawn, through, util, wrench;

fs = require('fs');

grs = require('grs');

path = require('path');

async = require('async');

wrench = require('wrench');

mv = require('mv');

rm = require('rimraf');

util = require('gulp-util');

chalk = require('chalk');

PluginError = util.PluginError;

through = require('through2');

childProcess = require('child_process');

ProgressBar = require('progress');

File = require('vinyl');

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
    options.platforms = ['darwin-x64'];
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
      var binName, cache, cacheFile, cachePath, cacheZip, cacheedPath, copyOption, defaultAppName, electronFile, packagingCmd, pkg, pkgZip, pkgZipDir, pkgZipPath, platformDir, platformPath, platformZipDir, platformZipPath, src, suffix, targetApp, targetAppPath, targetDir, targetDirPath, targetPath, unpackagingCmd, _src;
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
      pkgZip = pkg = "" + packageJson.name + "-" + packageJson.version + "-" + platform;
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
      binName = packageJson.name + suffix;
      targetAppPath = path.join(platformPath, binName);
      _src = 'resources/app';
      if (platform.indexOf('darwin') >= 0) {
        _src = binName + '/Contents/Resources/app/';
      }
      targetDir = path.join(packageJson.name, _src);
      targetDirPath = path.resolve(platformZipDir, _src);
      targetPath = path.resolve(platformPath);
      copyOption = {
        forceDelete: true,
        excludeHiddenUnix: false,
        inflateSymlinks: false
      };
      unpackagingCmd = {
        win32: {
          cmd: '7z',
          args: ['e', cacheFile, '-o', cacheedPath]
        },
        darwin: {
          cmd: 'unzip',
          args: ['-o', cacheFile, '-d', cacheedPath]
        },
        linux: {
          cmd: 'unzip',
          args: ['-o', cacheFile, '-d', cacheedPath]
        }
      };
      packagingCmd = {
        win32: {
          cmd: '7z',
          args: ['a', pkgZip, options.packageJson.name],
          opts: {
            cwd: pkgZipPath
          }
        },
        darwin: {
          cmd: 'ditto',
          args: ['-c', '-k', '--sequesterRsrc', '--keepParent', options.packageJson.name, pkgZip],
          opts: {
            cwd: pkgZipPath
          }
        },
        linux: {
          cmd: 'zip',
          args: ['-9', '-y', '-r', pkgZip, options.packageJson.name],
          opts: {
            cwd: pkgZipPath
          }
        }
      };
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
              return bar = new ProgressBar("" + pkg + " [:bar] :percent :etas", {
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
            return spawn(unpackagingCmd[process.platform], next);
          } else {
            return next();
          }
        }, function(next) {
          wrench.mkdirSyncRecursive(platformPath);
          wrench.copyDirSyncRecursive(cacheedPath, platformPath, copyOption);
          return next();
        }, function(next) {
          return rm(targetAppPath, function() {
            return mv(electronFile, targetAppPath, next);
          });
        }, function(next) {
          if (!isExists(targetDirPath)) {
            return rm(targetDirPath, next);
          } else {
            return next();
          }
        }, function(next) {
          util.log(PLUGIN_NAME, "" + options.src + " -> " + targetDir + " distributing");
          wrench.mkdirSyncRecursive(targetDirPath);
          wrench.copyDirSyncRecursive(options.src, targetDirPath, copyOption);
          return next();
        }, function(next) {
          util.log(PLUGIN_NAME, " packaging");
          if (!options.packaging) {
            return next();
          }
          return rm(platformZipPath, function() {
            return mv(platformPath, platformZipPath, function() {
              var cmd;
              cmd = packagingCmd[process.platform];
              util.log(PLUGIN_NAME, "" + cmd + " packaging");
              return rm(pkgZip, function() {
                return spawn(cmd, function() {
                  return mv(platformZipPath, platformPath, next);
                });
              });
            });
          });
        }
      ], function(error, results) {
        var _zip;
        _zip = path.join(pkgZipDir, pkgZip);
        util.log(PLUGIN_NAME, "" + _zip + " distribute done.");
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
