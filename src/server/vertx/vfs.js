/*
 *
 * exists
 * scandir
 *
 * TODO
 * fileinfo
 * mkdir
 * move
 * upload
 * copy
 * delete
 * write
 * read
 *
 * File permissions
 */

module.exports = (function(){
  'use strict';


  var VFS = {};


  function getMime(file, config) {
    var i = file.lastIndexOf('.'),
      ext = (i === -1) ? 'default' : file.substr(i),
      mimeTypes = config.mimes;
    return mimeTypes[ext.toLowerCase()] || mimeTypes.default;
  }


  VFS.getRealPath = function(incPath){

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
      if ( ppcs[0] && ppcs[1] ) upOne = protocol + '/' + ppcs[ppcs.length - 2];
      else if ( ppcs[1] ) upOne = protocol + '/';
    }

    if (DEBUG) {
      console.log('upOne: ' + upOne);
      console.log('path: ' + path);
      console.log('full path: ' + basePath + path);
    }

    return {basePath:basePath, path:path, full: basePath+path, upOne:upOne};
  };


  VFS.exists = function (args, message) {

    var paths = VFS.getRealPath(args.path);

    console.log('VFS.exists: ' + paths.full);

    fs.exists(paths.full, function (result) {

      console.log(JSON.stringify(result));
      message.reply(result);
    });
  };

  VFS.scandir = function (args, message) {

    var fileProps = [];
    var fileCounter = 0;
    var paths = VFS.getRealPath(args.path);

    console.log('VFS.scandir: ' + paths.full);

    fs.readDir(paths.full, function (res, err) {

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

      fs.props(filePath, function (res, err) {

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
            mtime  = res.lastModifiedTime();
            ctime  = res.creationTime();
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

  return VFS;

})();
