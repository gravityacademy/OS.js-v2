/*!
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2016, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */
/* globals vertx: false */

(function(_path, _fs, Base64, Buffer) {
  'use strict';

  function readExif(path, mime, cb) {
    /*jshint nonew: false */

    if ( mime.match(/^image/) ) {
      try {
        var CR = require('exif').ExifImage;
        new CR({image: path}, function(err, result) {
          cb(null, JSON.stringify(result, null, 4));
        });
        return;
      } catch ( e ) {
      }
      return;
    }

    cb(false, null);
  }

  function readPermission(mode) {
    var str = '';
    var map = {
      0xC000: 's',
      0xA000: 'l',
      0x8000: '-',
      0x6000: 'b',
      0x4000: 'd',
      0x1000: 'p'
    };

    var type = 'u';
    Object.keys(map).forEach(function(k) {
      if ( (mode & k) === k ) {
        type = map[k];
      }
      return type === 'u';
    });

    // Owner
    str += (function() {
      var ret = ((mode & 0x0100) ? 'r' : '-');
      ret += ((mode & 0x0080) ? 'w' : '-');
      ret += ((mode & 0x0040) ? ((mode & 0x0800) ? 's' : 'x' ) : ((mode & 0x0800) ? 'S' : '-'));
      return ret;
    })();

    // Group
    str += (function() {
      var ret = ((mode & 0x0020) ? 'r' : '-');
      ret += ((mode & 0x0010) ? 'w' : '-');
      ret += ((mode & 0x0008) ? ((mode & 0x0400) ? 's' : 'x' ) : ((mode & 0x0400) ? 'S' : '-'));
      return ret;
    })();

    // World
    str += (function() {
      var ret = ((mode & 0x0004) ? 'r' : '-');
      ret += ((mode & 0x0002) ? 'w' : '-');
      ret += ((mode & 0x0001) ? ((mode & 0x0200) ? 't' : 'x' ) : ((mode & 0x0200) ? 'T' : '-'));
      return ret;
    })();

    return str;
  }

  function pathJoin() {
    var s = _path.join.apply(null, arguments);
    return s.replace(/\\/g, '/');
  }

  function getRealPath(path, config, routingContext) {
    var fullPath = null;
    var protocol = '';

    if ( path.match(/^osjs\:\/\//) ) {

      path = path.replace(/^osjs\:\/\//, '');
      fullPath = _path.join(config.distdir, path);
      protocol = 'osjs://';

    } else if ( path.match(/^home\:\/\//) ) {

      path = path.replace(/^home\:\/\//, '');

      var userdir;
      if (routingContext.getCookie('username')) {
        userdir = routingContext.getCookie('username').getValue();
      }
      if ( !userdir ) {
        throw 'No user session was found';
      }
      fullPath = _path.join(config.vfs.homes, userdir, path);

      protocol = 'home://';
    } else {
      var tmp = path.split(/^(\w+)\:\/\//);
      if ( tmp.length === 3 ) {
        tmp = tmp[1];
        if ( config.vfs.mounts && config.vfs.mounts[tmp] ) {
          protocol = tmp + '://';
          path = path.replace(/^(\w+)\:\/\//, '');
          fullPath = _path.join(config.vfs.mounts[tmp], path);
        }
      }
    }

    if ( !fullPath ) {
      throw new Error('Invalid mountpoint');
    }

    if (path.substr(0,1) === '/') { path = path.substr(1); }
    if (fullPath.substr(0,1) === '/') { fullPath = fullPath.substr(1); }

    return {root: fullPath, path: path, protocol: protocol};
  }

  function getMime(file, config) {
    var i = file.lastIndexOf('.'),
      ext = (i === -1) ? 'default' : file.substr(i),
      mimeTypes = config.mimes;
    return mimeTypes[ext.toLowerCase()] || mimeTypes.default;
  }

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Get real filesystem path
   *
   * NOT AVAILABLE FROM CLIENT
   *
   * @param   String    file        File path
   * @param   Object    config      Server configuration object
   * @param   Object    routingContext     Server routingContext object
   * @return  Object                With `root` (real path), `path` (virtual path), `protocol` (virtual protocol)
   *
   * @api     vfs.getRealPath
   */
  module.exports.getRealPath = getRealPath;

  /**
   * Get file MIME
   *
   * NOT AVAILABLE FROM CLIENT
   *
   * @param   String    file        File path
   * @param   Object    config      Server configuration object
   *
   * @return  String
   *
   * @api     vfs.getMime
   */
  module.exports.getMime = getMime;

  /**
   * Read a file
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    config      Server configuration object
   * @param   Object    routingContext     Server routingContext object
   * @option  args      String    path      Request path
   * @option  args      Object    options   (Optional) Request options
   *
   * @option  opts      boolean   raw     Return raw/binary data (default=false)
   *
   * @return  void
   *
   * @api     vfs.read
   */
  module.exports.read = function(args, routingContext, callback, config) {
    var realPath = getRealPath(args.path, config, routingContext);
    var opts = typeof args.options === 'undefined' ? {} : (args.options || {});

    _fs.exists(realPath.root, function(exists) {
      if ( exists ) {
        _fs.readFile(realPath.root, function(data, error) {
          if ( error ) {
            callback('Error reading file: ' + error);
          } else {
            if ( opts.raw ) {
              callback(false, data);
            } else {
              data = 'data:' + getMime(realPath.root, config) + ';base64,' + (Base64.encode(data.toString('UTF-8')));
              //data = 'data:' + getMime(realPath.root, config) + ';base64,' + (new Buffer(data).toString('base64'));
              callback(false, data.toString());
            }
          }
        });
      } else {
        callback('File not found!');
      }
    });
  };

  /**
   * Write a file
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext     Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    path      Request path
   * @option  args      Mixed     data      Request payload
   * @option  args      Object    options   (Optional) Request options
   *
   * @option  opts      boolean   raw     Write raw/binary data (default=false)
   *
   * @return  void
   *
   * @api     vfs.write
   */
  module.exports.write = function(args, routingContext, callback, config) {
    var data = args.data || '';
    var opts = typeof args.options === 'undefined' ? {} : (args.options || {});
    var realPath = getRealPath(args.path, config, routingContext);

    if ( opts.raw ) {
      console.log(' -----------------------> opts.raw');

      _fs.writeFile(realPath.root, data, 'binary', function(data, error) {
        if ( error ) {
          callback('Error writing file: ' + error);
        } else {
          callback(false, true);
        }
      });

    } else {

      data = unescape(data.substring(data.indexOf(',') + 1));
      data = new Buffer.buffer( Base64.decode(data) );

      //var b64 = Java.type('java.util.Base64');
      //data = Buffer.buffer(b64.getDecoder().decode(data));

      _fs.writeFile(realPath.root, data, function(data, error) {
        if ( error ) {
          callback('Error writing file: ' + error);
        } else {
          callback(false, true);
        }
      });

    }
  };

  /**
   * Delete a file
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext     Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    path      Request path
   * @option  args      Object    options   (Optional) Request options
   *
   * @return  void
   *
   * @api     vfs.delete
   */
  module.exports.delete = function(args, routingContext, callback, config) {
    var opts = typeof args.options === 'undefined' ? {} : (args.options || {});
    var realPath = getRealPath(args.path, config, routingContext);

    _fs.exists(realPath.root, function(exists) {
      if ( !exists ) {
        callback('Target does not exist!');
      } else {
        _fs.delete(realPath.root, function(data, error) {
          if ( error ) {
            callback('Error deleting: ' + error);
          } else {
            callback(false, true);
          }
        });
      }
    });
  };

  /**
   * Copy a file
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext     Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    src       Request source path
   * @option  args      String    dest      Request destination path
   * @option  args      Object    options   (Optional) Request options
   *
   * @return  void
   *
   * @api     vfs.copy
   */
  module.exports.copy = function(args, routingContext, callback, config) {
    var src  = args.src;
    var dst  = args.dest;
    var opts = typeof args.options === 'undefined' ? {} : (args.options || {});

    var realSrc = getRealPath(src, config, routingContext);
    var realDst = getRealPath(dst, config, routingContext);
    var srcPath = realSrc.root; //_path.join(realSrc.root, src);
    var dstPath = realDst.root; //_path.join(realDst.root, dst);
    _fs.exists(srcPath, function(exists) {
      if ( exists ) {
        _fs.exists(dstPath, function(exists) {
          if ( exists ) {
            callback('Target already exist!');
          } else {
            _fs.copy(srcPath, dstPath, function(data, error) {
              if ( error ) {
                callback('Error copying: ' + error);
              } else {
                callback(false, true);
              }
            });
          }
        });
      } else {
        callback('Source does not exist!');
      }
    });
  };

  /**
   * Uploads a file
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext     Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    src         Uploaded file path
   * @option  args      String    name        Destination filename
   * @option  args      String    path        Destination path
   * @option  args      boolean   overwrite   Overwrite (default=false)
   *
   * @return  void
   *
   * @api     vfs.upload
   */
  module.exports.upload = function(args, routingContext, callback, config) {
    var tmpPath = (args.path + '/' + args.name).replace('////', '///'); // FIXME
    var dstPath = getRealPath(tmpPath, config, routingContext).root;
    var overwrite = args.overwrite === true;

    _fs.exists(args.src, function(exists) {
      if ( exists ) {
        _fs.exists(dstPath, function(exists) {
          if ( exists && !overwrite ) {
            callback('Target already exist!');
          } else {
            _fs.move(args.src, dstPath, function(data, error) {
              if ( error ) {
                callback('Error renaming/moving: ' + error);
              } else {
                callback(false, '1');
              }
            });
          }
        });
      } else {
        callback('Source does not exist!');
      }
    });
  };

  /**
   * Move a file
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext     Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    src       Request source path
   * @option  args      String    dest      Request destination path
   * @option  args      Object    options   (Optional) Request options
   *
   * @return  void
   *
   * @api     vfs.move
   */
  module.exports.move = function(args, routingContext, callback, config) {
    var src  = args.src;
    var dst  = args.dest;
    var opts = typeof args.options === 'undefined' ? {} : (args.options || {});

    var realSrc = getRealPath(src, config, routingContext);
    var realDst = getRealPath(dst, config, routingContext);
    var srcPath = realSrc.root; //_path.join(realSrc.root, src);
    var dstPath = realDst.root; //_path.join(realDst.root, dst);
    _fs.exists(srcPath, function(exists) {
      if ( exists ) {
        _fs.exists(dstPath, function(exists) {
          if ( exists ) {
            callback('Target already exist!');
          } else {
            _fs.move(srcPath, dstPath, function(data, error) {
              if ( error ) {
                callback('Error renaming/moving: ' + error);
              } else {
                callback(false, true);
              }
            });
          }
        });
      } else {
        callback('Source does not exist!');
      }
    });
  };

  /**
   * Creates a directory
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext     Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    src       Request source path
   * @option  args      Object    options   (Optional) Request options
   *
   * @return  void
   *
   * @api     vfs.mkdir
   */
  module.exports.mkdir = function(args, routingContext, callback, config) {
    var opts = typeof args.options === 'undefined' ? {} : (args.options || {});
    var realPath = getRealPath(args.path, config, routingContext);
    var path = realPath.path;

    _fs.exists(realPath.root, function(exists) {
      if ( exists ) {
        callback('Target already exist!');
      } else {

        _fs.mkdir(realPath.root, 'rwxrwxrwx', function(data, error) {
          if ( error ) {
            callback('Error creating directory: ' + error);
          } else {
            callback(false, true);
          }
        });
      }
    });
  };

  /**
   * Check if file exists
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext     Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    src       Request source path
   * @option  args      Object    options   (Optional) Request options
   *
   * @return  void
   *
   * @api     vfs.exists
   */
  module.exports.exists = function(args, routingContext, callback, config) {
    var opts = typeof args.options === 'undefined' ? {} : (args.options || {});

    var realPath = getRealPath(args.path, config, routingContext);

    _fs.exists(realPath.root, function(exists) {
      callback(false, exists);
    });
  };

  /**
   * Get metadata about a file
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext     Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    src       Request source path
   * @option  args      Object    options   (Optional) Request options
   *
   * @return  void
   *
   * @api     vfs.fileinfo
   */
  module.exports.fileinfo = function(args, routingContext, callback, config) {

    var opts = typeof args.options === 'undefined' ? {} : (args.options || {});
    var realPath = getRealPath(args.path, config, routingContext);
    var path = realPath.path;
    _fs.exists(realPath.root, function(exists) {
      if ( !exists ) {
        callback('No such file or directory!');
      } else {
        _fs.props(realPath.root, function(props, error) {
          if ( error ) {
            callback('Error getting file information: ' + error);
          } else {

            var mime = getMime(realPath.root, config);
            var data = {
              path:         realPath.protocol + realPath.path,
              filename:     _path.basename(realPath.root),
              size:         props.size,
              mime:         mime,
              //permissions:  readPermission(stat.mode),
              ctime:        props.creationTime() || null,
              mtime:        props.lastModifiedTime() || null
            };

            callback(null, data);

            /*readExif(realPath.root, mime, function(error, result) {
              if ( !error && result ) {
                data.exif = result || error || 'No EXIF data available';
              }
              callback(result ? null : error, data);
            });*/

          }
        });
      }
    });
  };

  /**
   * Scans given directory
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext    Server response object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    src       Request source path
   * @option  args      Object    options   (Optional) Request options
   *
   * @return  void
   *
   * @api     vfs.scandir
   */
  module.exports.scandir = function(args, routingContext, callback, config) {
    var opts = typeof args.options === 'undefined' ? {} : (args.options || {});
    var realPath = getRealPath(args.path, config, routingContext);
    var path = realPath.path;

    _fs.readDir(realPath.root, function(files, error) {

      if ( error ) {
        callback('Error reading directory: ' + error);

      } else {
        var result = [];
        var ofpath, fpath, fprops, ftype, fsize, ctime, mtime;

        var tmp = realPath.path.replace(/^\/+?/, '');

        if (tmp.length && tmp.split('/').length) {
          tmp = tmp.split('/');
          tmp.pop();
          tmp = tmp.join('/');

          result.push({
            filename: '..',
            path: realPath.protocol + _path.join('/', tmp),
            size: 0,
            mime: '',
            type: 'dir',
            ctime: null,
            mtime: null
          });
        }

        for (var i = 0; i < files.length; i++) {

          var pccs = files[i].split('/');
          var file = pccs[pccs.length - 1];

          ofpath = pathJoin(path, file);
          fpath = _path.join(realPath.root, file);

          try {
            fprops = _fs.propsBlocking(fpath);
            ftype = fprops.isDirectory() ? 'dir' : 'file';
            fsize = fprops.size;
            mtime = fprops.lastModifiedTime();
            ctime = fprops.creationTime();

          } catch (e) {

            ftype = 'file';
            fsize = 0;
            ctime = null;
            mtime = null;
          }

          result.push({
            filename: file,
            path: realPath.protocol + ofpath,
            size: fsize,
            mime: ftype === 'file' ? getMime(files[i], config) : '',
            type: ftype,
            ctime: ctime,
            mtime: mtime
          });
        }

        callback(false, result);
      }
    });
  };

})(
  require('./path'),
  vertx.fileSystem(),
  require('./base64.js'),
  require('vertx-js/buffer')
);