(function(_osjs, _path, _eb, _fs, Router, SockJSHandler, StaticHandler, CookieHandler, Cookie){
  'use strict';

  var instance;

  /////////////////////////////////////////////////////////////////////////////
  // HELPERS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Respond to HTTP Call
   */
  function respond(data, mime, routingContext, headers, code, pipeFile) {

    if ( instance.config.logging ) {
      log(timestamp(), '>>>', code, mime, pipeFile || typeof data);
    }

    function done() {
      console.log('******** Done *********');
      if ( instance.handler && instance.handler.onRequestEnd ) {
        instance.handler.onRequestEnd(null, routingContext);
      }
      routingContext.respond().end();
    }

    headers.forEach(function(h) {

      console.log('&*&*&*&*&&*&*&*& headers apply &*&*&*&  todo');

      routingContext.response().putHeader.apply(h);
    });

    routingContext.response().putHeader('Content-Type', mime);

    if ( pipeFile ) {
      //console.log('pipeFile: ' + pipeFile);

      //var stream = _fs.createReadStream(pipeFile, {bufferSize: 64 * 1024});
      //stream.on('end', done);
      //stream.pipe(routingContext);

      //routingContext.write(data).end();
      routingContext.response().sendFile(pipeFile);


    } else {
      //console.log('not pipeFile');

      routingContext.response().end(data);
      //done();
    }
  }

  /**
   * Respond with a file
   */
  function respondFile(path, routingContext, realPath) {

    if ( instance.config.verbose ) console.log('respondFile o0o0o0o0ooo0o');

    if ( !realPath && path.match(/^(ftp|https?)\:\/\//) ) {
      if ( instance.config.vfs.proxy ) {
        try {


          var paths = OSjs.VFS.getRealPath(path);

          if ( instance.config.logging ) console.log('http FS get ' + paths.path);

          routingContext.sendFile(paths.full);



        } catch ( e ) {
          console.error('!!! respondFile Caught exception' + e);
          console.warn(e.stack);
          respondError(e, routingContext);
        }
      } else {
        console.log('VFS Proxy is disabled');
        respondError('VFS Proxy is disabled', routingContext);
      }
      return;
    }

    try {
      var fullPath = realPath ? path : instance.vfs.getRealPath(path, instance.config, routingContext).root;
      _fs.exists(fullPath, function(exists) {
        if ( exists ) {

          var mime = instance.vfs.getMime(fullPath, instance.config);

          if ( instance.config.verbose ) console.log('mime: ' +  mime);

          respond(null, mime, routingContext, [], 200, fullPath);

        } else {
          respondNotFound(null, routingContext, fullPath);
        }
      });
    } catch ( e ) {
      console.error('!!! respondFile2 Caught exception', e);
      console.warn(e.stack);
      respondError(e, routingContext, true);
    }
  }

  /**
   * Respond with JSON data
   */
  function respondJSON(data, routingContext, headers, code) {
    respond(JSON.stringify(data), 'application/json', routingContext, headers || [], code || 200);
  }

  /**
   * Respond with an error
   */
  function respondError(message, routingContext, json) {
    if ( json ) {
      message = 'Internal Server Error (HTTP 500): ' + message.toString();
      respondJSON({result: null, error: message}, routingContext, [], 500);
    } else {
      respond(message.toString(), 'text/plain', routingContext, [], 500);
    }
  }

  /**
   * Respond with text
   */
  function respondText(routingContext, message) {
    respond(message, 'text/plain', routingContext, [], 200);
  }

  /**
   * Respond with 404
   */
  function respondNotFound(message, routingContext, fullPath) {
    message = message || '404 Not Found';
    respond(message, null, routingContext, [], 404, false);
  }

  /**
   * Gets timestamp
   */
  function timestamp() {
    var now = new Date();
    return now.toISOString();
  }

  /**
   * Logs a line
   */
  function log() {
    console.log(Array.prototype.slice.call(arguments).join(' '));
  }



  /////////////////////////////////////////////////////////////////////////////
  // HTTP
  /////////////////////////////////////////////////////////////////////////////


  function startServer() {

    var router = Router.router(vertx);
    var options = {
      "outboundPermitteds" : [{ "setAddressRegex" : "/^OSjs/" }],
      "inboundPermitteds" :  [{ "setAddressRegex" : "/^OSjs/" }]};
    router.route("/eventbus/*").handler(SockJSHandler.create(vertx).bridge(options).handle);


    router.route().handler(CookieHandler.create().handle);
    router.route().handler(function (routingContext) {

      var path = routingContext.request().path();

      if (path === '/') {
        path += 'index.html';
      }

      if ( instance.config.logging ) {
       log(timestamp(), '<<<', path);
       }

      if (instance.handler && instance.handler.onRequestStart) {
        instance.handler.onRequestStart(routingContext);
      }

      var isVfsCall = path.match(/^\/FS/) !== null;
      var relPath = path.replace(/^\/(FS|API)\/?/, '');

      if ( instance.config.verbose ) {
        console.log(routingContext.request().method());
        console.log('-=-=-=- isVfsCall: ' + isVfsCall);
        console.log('-=-=-=- relPath: ' + relPath);
      }

      function handleCall(isVfs) {

        routingContext.request().bodyHandler(function (body) {

          try {

            var args = JSON.parse(body);

            //console.log(JSON.stringify(args));

            instance.request(isVfs, relPath, args, function (error, result) {

              //console.log('--req resulting---');

              respondJSON({result: result, error: error}, routingContext);

            }, routingContext, instance.handler);

          } catch (e) {

            console.error('!!! handleCall Caught exception: @#$@$#%@#$%@#$%@#$%@#$%@#$%@#$%@#$%@#$%@#$%');
            console.error(e);

            //respondError(e, routingContext, true);

          }
        });

      }


      function handleUpload() {
        var form = new _multipart.IncomingForm({
          uploadDir: instance.config.tmpdir
        });

        form.parse(routingContext, function (err, fields, files) {
          if (err) {
            if (instance.config.logging) {
              respondError(err, routingContext);
            }
          } else {
            instance.handler.checkAPIPrivilege(routingContext, 'upload', function (err) {
              if (err) {
                respondError(err, routingContext);
                return;
              }

              instance.vfs.upload({
                src: files.upload.path,
                name: files.upload.name,
                path: fields.path,
                overwrite: String(fields.overwrite) === 'true'
              }, function (err, result) {
                if (err) {
                  respondError(err, routingContext);
                  return;
                }
                respondText(routingContext, '1');
              }, routingContext);
            });
          }
        });
      }

      function handleVFSFile() {
        var dpath = path.replace(/^\/(FS|API)(\/get\/)?/, '');
        instance.handler.checkAPIPrivilege(routingContext, 'fs', function (err) {
          if (err) {
            respondError(err, routingContext);
            return;
          }
          respondFile(unescape(dpath), routingContext, false);
        });
      }


      function handleDistFile() {
        var rpath = path.replace(/^\/+/, '');
        var dpath = _path.join(instance.config.distdir, rpath);

        //console.log('rpath: ' + rpath);
        //console.log('dpath: ' + dpath);

        // Checks if the routingContext was a package resource
        var pmatch = rpath.match(/^packages\/(.*\/.*)\/(.*)/);
        if (pmatch && pmatch.length === 3) {
          instance.handler.checkPackagePrivilege(routingContext, pmatch[1], function (err) {
            if (err) {
              respondError(err, routingContext);
              return;
            }
            if ( instance.config.verbose ) console.log('..pmatch..');

            respondFile(unescape(dpath), routingContext, true);
          });
          return;
        }

        if ( instance.config.verbose ) console.log('..else..');
        // Everything else
        respondFile(unescape(dpath), routingContext, true);
      }

      /* -= - -= - - -= -= -=- =- =- =- - =- =- =- =-= -= -- =- =- =- =-*/

      if (routingContext.request().method() === 'POST') {
        if (isVfsCall) {
          if (relPath === 'upload') {
            handleUpload();
          } else {
            handleCall(true);
          }
        } else {
          handleCall(false);
        }
      } else {
        if (isVfsCall) {
          handleVFSFile();
        } else { // dist files
          handleDistFile();
        }
      }

    });


    vertx.createHttpServer().requestHandler(router.accept).listen(8000);


    _eb.consumer('OSjsCallXHR', function (message) {

      var msg = message.body();     //  {url:url, args:args, options:options}
      var pair = msg.url.substring(1).split('/');
      var call = pair[0];
      var method = pair[1];
      if ( instance.config.logging ) {
        console.log('calling: ' + call + ' method: ' + method);
        //console.log(JSON.stringify(msg.args));
      }
      if (call === 'API') API[method](msg.args, message);
      if (call === 'FS')  VFS[method](msg.args, message);
    });



    _eb.consumer('OSjsCallPOST', function (message) {
      console.log('OSjsCallPOST');

      var mes = message.body();
      var paths = OSjs.VFS.getRealPath(mes.args.path);

      _fs.writeFile(paths.full, function (result, error) {
        if (error) message.reply(false);
        else message.reply(true);
      });
    });



    _eb.consumer('OSjsCallGET', function (message) {
      console.log('OSjsCallGET');

      var mes = message.body();
      var paths = OSjs.VFS.getRealPath(mes.args.path);

      _fs.readFile(paths.full, function (result, error) {
        if (error == null) {

          if ( instance.config.logging ) console.log('callGet ' + paths.path);

          message.reply(result.toString("UTF-8"));
        } else {
          console.log('fs error');
          console.log(JSON.stringify(error));
        }
      })
    });

  }

  /******************************************/


  module.exports.listen = function(setup) {
    instance = _osjs.init(setup);
    startServer();

    instance.handler.onServerStart(function() {
      var port = setup.port || instance.config.port;
      if ( instance.config.logging ) {
        setTimeout(function(){
          console.log('***');
          console.log('*** OS.js(v) is listening on http://localhost:' + port);
          console.log('***');
        }, 5);
      }
    });

  };

  /**
   * Closes the active HTTP server
   *
   * @param   Function  cb          Callback function
   *
   * @api     http.close
   */
  module.exports.close = function(cb) {
    cb = cb || function() {};

    instance.handler.onServerEnd(function() {
      cb();
      vertx.close();
    });

  };


})(
  require("./osjs"),
  require("./path"),
  vertx.eventBus(),
  vertx.fileSystem(),
  require("vertx-web-js/router"),
  require("vertx-web-js/sock_js_handler"),
  require("vertx-web-js/static_handler"),
  require("vertx-web-js/cookie_handler"),
  require("vertx-web-js/cookie")
);
