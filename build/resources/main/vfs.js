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
 *
 * vertx version  -tfs
 */
(function(_eb, _fs, _Buffer, _Base64) {
  'use strict';


  function getRealPath(incPath){

    var path, basePath = '', protocol;
    var upOne = false;

    if ( incPath.match(/^osjs\:\/\//) ) {

      path = incPath.replace(/^osjs\:\/\//, '');
      basePath = 'dist-dev';
      protocol = 'osjs://';

    } else if ( incPath.match(/^home\:\/\//) ) {

      path = incPath.replace(/^home\:\/\//, '');
      basePath = 'vfs/home';
      protocol = 'home://';

    } else {
      var tmp = incPath.split(/^(\w+)\:\/\//);
      if ( tmp.length === 3 ) {
        tmp = tmp[1];
        protocol = tmp + '://';
        basePath = 'vfs/tmp';
        path = incPath.replace(/^(\w+)\:\/\//, '');
      }
    }

    if ( path != '/' ) {
      var ppcs = path.split('/');

      if ( ppcs.length === 2 ) {

        upOne = protocol + '/';

      } else if ( ppcs.length > 2 ) {

        upOne = protocol;

        for (var i = 1; i < ppcs.length-1; i++) {

          upOne += '/' + ppcs[i];
        }
      }
    }

    if (DEBUG) {
      console.log('upOne: ' + upOne);
      console.log('path: ' + path);
      console.log('full path: ' + basePath + path);
    }

    return {basePath:basePath, path:path, full: basePath+path, upOne:upOne};
  }


  function getMime(file, config) {
    var i = file.lastIndexOf('.'),
      ext = (i === -1) ? 'default' : file.substr(i),
      mimeTypes = config.mimes;
    return mimeTypes[ext.toLowerCase()] || mimeTypes.default;
  }


  module.exports.getRealPath = getRealPath;

  module.exports.getMime = getMime;

  module.exports.write = function(args, message){

    console.log('VFS.write');

    var paths = getRealPath(args.path);
    var data = args.data;


    if ( args.opts && args.opts.raw ) {

      console.log('trying to write raw... ');


    } else {

      data = decodeURI(data.substring(data.indexOf(',') + 1));
      data = new Buffer.buffer(Base64.decode(data));

      _fs.writeFile(paths.full, data, function(data, error) {

        if ( error ) {
          console.log('Error writing file: ' + error);
          message.reply( {result:false, error:true} );

        } else {
          message.reply( {result:true, error:false} );

        }
      });
    }

  };

  module.exports.write = function(args, message) {

  };
  module.exports.delete = function(args, message) {

  };
  module.exports.copy = function(args, message) {

  };
  module.exports.upload = function(args, message) {

  };
  module.exports.move = function(args, message) {

  };
  module.exports.mkdir = function(args, message) {

  };


  module.exports.exists = function(args, message) {

    var paths = getRealPath(args.path);

    console.log('VFS.exists: ' + paths.full);

    _fs.exists(paths.full, function(result) {

      console.log(JSON.stringify(result));
      message.reply(result);
    });
  };


  module.exports.fileinfo = function(args, message) {

  };


  module.exports.scandir = function(args, message) {

    var fileProps = [];
    var fileCounter = 0;
    var paths = getRealPath(args.path);

    console.log('VFS.scandir: ' + paths.full);

    _fs.readDir(paths.full, function(res, err) {

      if (err) {

        console.log('file scanning error');
        console.log(err);

      } else {

        //console.log(res);
        nextStep(res);
      }

    });

    function nextStep(fArray) {

      fileProps = [];
      fileCounter = 0;

      if (paths.upOne) {
        fileProps.push({
          ctime: null,
          filename: "..",
          mime: "",
          mtime: null,
          path: paths.upOne,
          size: 0,
          type: "dir"
        });
      }

      if (fArray.length > 0) {
        for (var i = 0; i < fArray.length; i++) {
          getProps(fArray[i], fArray.length);
        }
      } else {
        message.reply(fileProps);
      }
    }

    function getProps(filePath, last) {

      var ppcs = filePath.substring(1).split('/');
      var filename = ppcs[ppcs.length - 1];
      var type = "file";
      var path;
      var ftype, fsize, ctime, mtime;

      _fs.props(filePath, function (res, err) {

        if (err) {

          console.log('file props error');
          console.log(err);
          fileCounter++;
          if (fileCounter === last) message.reply(fileProps);

        } else {

          //console.log(filename);

          if (res.isRegularFile()) ftype = "text/plain";
          if (res.isDirectory()) type = "dir";

          if (args.path.substr(args.path.length - 1, 1) === '/') {
            path = args.path + filename;
          } else {
            path = args.path + '/' + filename;
          }

          try {
            ftype  = res.isRegularFile() ? 'file' : 'dir';
            fsize  = res.size;
            ctime  = res.creationTime();
            mtime  = res.lastModifiedTime();
          } catch ( e ) {
            ftype = 'file';
            fsize = 0;
            ctime = null;
            mtime = null;
          }

          fileProps.push( {
            filename: filename,
            path: path,
            size: fsize,
            mime: ftype === 'file' ? getMime(filename, config) : '',
            type: ftype,
            ctime: ctime,
            mtime: mtime
          });

          fileCounter++;
          if (fileCounter === last) message.reply(fileProps);
        }
      });
    }

  };

})(
  vertx.eventBus(),
  vertx.fileSystem(),
  require("vertx-js/buffer"),
  require("./base64")
);
