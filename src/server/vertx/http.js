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
 */
/* globals vertx: false */

(function(_osjs, _ebus, _path, _fs, Router, SockJSHandler, StaticHandler, CookieHandler) {
  'use strict';

  var instance;

  var System = Java.type("java.lang.System");
  var BodyHandler = require("vertx-web-js/body_handler");
  var LocalSessionStore = require("vertx-web-js/local_session_store");
  var SessionHandler = require("vertx-web-js/session_handler");
  var ShiroAuth = require("vertx-auth-shiro-js/shiro_auth");
  var UserSessionHandler = require("vertx-web-js/user_session_handler");
  var RedirectAuthHandler = require("vertx-web-js/redirect_auth_handler");
  var FormLoginHandler = require("vertx-web-js/form_login_handler");

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

    headers.forEach(function(h) {
      console.log(' - headers apply  - todo');
      routingContext.response().putHeader.apply(h);
    });

    routingContext.response().putHeader('Content-Type', mime);

    if ( pipeFile ) {
      //var stream = _fs.createReadStream(pipeFile, {bufferSize: 64 * 1024});
      //stream.on('end', done);
      //stream.pipe(routingContext);
      //response.write(data).end();

      routingContext.response().sendFile(pipeFile);

    } else {

      if ( instance.handler && instance.handler.onRequestEnd ) {
        instance.handler.onRequestEnd(null, routingContext);
      }
      routingContext.response().end(data);
    }
  }

  /**
   * Respond with a file
   */
  function respondFile(path, routingContext, realPath) {

    if ( instance.config.verbose ) { console.log('respondFile'); }

    if ( !realPath && path.match(/^(ftp|https?)\:\/\//) ) {
      if ( instance.config.vfs.proxy ) {
        try {

          var paths = OSjs.VFS.getRealPath(path);

          if ( instance.config.logging ) { console.log('http FS get ' + paths.path); }

          routingContext.response().sendFile(paths.full);

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

          if ( instance.config.verbose ) { console.log('mime: ' +  mime); }

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

  function startServer(port) {

    var router = Router.router(vertx);
    var authProvider = ShiroAuth.create(vertx, 'PROPERTIES', {});
    var options = {
      "outboundPermitteds" : [{ "setAddressRegex" : "/^OSjs/" }],
      "inboundPermitteds" :  [{ "setAddressRegex" : "/^OSjs/" }]
    };
    router.route("/eventbus/*").handler(SockJSHandler.create(vertx).bridge(options).handle);


    router.route().handler(CookieHandler.create().handle);

    router.route().handler(BodyHandler.create().setUploadsDirectory("uploads").handle);
    router.route().handler(SessionHandler.create(LocalSessionStore.create(vertx)).handle);
    router.route().handler(UserSessionHandler.create(authProvider).handle);
    router.route('/_login').handler(function(c){c.response().sendFile("loginpage.html")});
    router.route('/loginhandler').handler(FormLoginHandler.create(authProvider).handle);
    router.route().handler(RedirectAuthHandler.create(authProvider, "/_login").handle);

    router.route().handler(function(routingContext) {

      var path = routingContext.request().path();

      //path = path.replace('/shiro/','/');
      //path = path.replace('/shiro','/');

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

      function handleCall(isVfs) {
        console.log('handleCall');

        routingContext.request().bodyHandler(function(body) {

          console.log('handleCall2');

          try {

            var args = JSON.parse(body);

            //console.log(JSON.stringify(args));
            console.log('handleCall3');

            instance.request(isVfs, relPath, args, function(error, result) {

              //console.log('--req resulting---');
              console.log('handleCall4');

              respondJSON({result: result, error: error}, routingContext);

            }, routingContext, instance.handler);

          } catch (e) {

            console.error('!!! handleCall Caught exception: @#$@$#%@#$%@#$%@#$%@#$%@#$%@#$%@#$%@#$%@#$%');
            console.error(e);

            respondError(e, routingContext, true);

          }
        });

      }

      function handleUpload() {

        respondError('disabled', routingContext);

        /*routingContext.request().setExpectMultipart(true);
        routingContext.request().bodyHandler(function(body, err) {

          if (err) {
            if (instance.config.logging) {
              respondError(err, routingContext);
            }
          } else {
            instance.handler.checkAPIPrivilege(routingContext, 'upload', function(err) {
              if (err) {
                respondError(err, routingContext);
                return;
              }

              instance.vfs.upload({
                src: files.upload.path,
                name: files.upload.name,
                path: fields.path,
                overwrite: String(fields.overwrite) === 'true'
              }, function(err, result) {
                if (err) {
                  respondError(err, routingContext);
                  return;
                }
                respondText(routingContext, '1');
              }, routingContext);
            });
          }
        });*/

        /*var form = new _multipart.IncomingForm({
          uploadDir: instance.config.tmpdir
        });
        form.parse(routingContext, function(err, fields, files) {
        });*/

      }

      function handleVFSFile() {
        var dpath = path.replace(/^\/(FS|API)(\/get\/)?/, '');
        instance.handler.checkAPIPrivilege(routingContext, 'fs', function(err) {
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

        // Checks if the routingContext was a package resource
        var pmatch = rpath.match(/^packages\/(.*\/.*)\/(.*)/);
        if (pmatch && pmatch.length === 3) {
          instance.handler.checkPackagePrivilege(routingContext, pmatch[1], function(err) {
            if (err) {
              respondError(err, routingContext);
              return;
            }
            if ( instance.config.verbose ) { console.log('..pmatch..'); }

            respondFile(unescape(dpath), routingContext, true);
          });
          return;
        }

        if ( instance.config.verbose ) { console.log('..else..'); }
        // Everything else
        respondFile(unescape(dpath), routingContext, true);
      }

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

    router.route('/logout').handler(function (context) {
      context.clearUser();
      context.response().putHeader("location", "/test").setStatusCode(302).end();
    });

    vertx.createHttpServer().requestHandler(router.accept).listen(port);

  }

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Create HTTP server and listen
   *
   * @param   Object    setup       Configuration (see osjs.js)
   *
   * @option  setup     int       port        Listening port (default=null/auto)
   * @option  setup     String    dirname     Server running dir (ex: /osjs/src/server/node)
   * @option  setup     String    root        Installation root directory (ex: /osjs)
   * @option  setup     String    dist        Build root directory (ex: /osjs/dist)
   * @option  setup     boolean   nw          NW build (default=false)
   * @option  setup     boolean   logging     Enable logging (default=true)
   *
   * @api     http.listen
   */
  module.exports.listen = function(setup) {
    instance = _osjs.init(setup);

    var port = setup.port || instance.config.port;
    startServer(port);
    //_ebus.init(instance);

    instance.handler.onServerStart(function() {
      if ( instance.config.logging ) {
        console.log('***');
        console.log('*** OS.js is listening on http://localhost:' + port);
        console.log('***');
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
  require('./osjs'),
  require('./ebus'),
  require('./path'),
  vertx.fileSystem(),
  require('vertx-web-js/router'),
  require('vertx-web-js/sock_js_handler'),
  require('vertx-web-js/static_handler'),
  require('vertx-web-js/cookie_handler')
);
