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

(function(_path, _fs) {
  'use strict';

  /////////////////////////////////////////////////////////////////////////////
  // GLOBALS
  /////////////////////////////////////////////////////////////////////////////

  var apiNamespace = {};
  var vfsNamespace = {};
  var config = {};

  function defaultResponse() {
    return {
      statusCode: 200
    };
  }

  function defaultRequest() {
    return {
      cookies: {
        get: function(k) {
          if ( k === 'username' ) {
            return 'demo';
          } else if ( k === 'groups' ) {
            return ['admin'];
          }
          return null;
        },
        set: function() {
        }
      }
    };
  }

  /////////////////////////////////////////////////////////////////////////////
  // METHODS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * API Request proxy
   */
  function request(isVfs, method, args, callback, routingContext, handler) {
    if (config.logging) { console.log('-----***** request *****-----'); }

    //routingContext.response = routingContext.response || defaultResponse();
    //routingContext.request = routingContext.request || defaultRequest();

    if ( isVfs ) {
      if ( vfsNamespace[method] && ((['getMime', 'getRealPath']).indexOf(method) < 0) ) {
        vfsNamespace[method](args, callback, routingContext, config, handler);

        if (config.logging) { console.log('vfsNamespace method: ' + method); }

        return;
      }
      throw 'Invalid VFS method: ' + method;
    } else {
      if ( apiNamespace[method] ) {

        if (config.logging) { console.log('apiNamespace method: ' + method); }

        apiNamespace[method](args, callback, routingContext, config, handler);

        return;
      }
    }

    throw 'Invalid method: ' + method;
  }

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Initializes OS.js APIs and configurations
   *
   * @param   Object    setup       Configuration
   *
   * @option  setup     int       port        Listening port (default=null/auto)
   * @option  setup     String    dist        Build name (default=dist)
   * @option  setup     String    dirname     Server running dir (ex: /osjs/src/server/node)
   * @option  setup     String    root        Installation root directory (ex: /osjs)
   * @option  setup     boolean   nw          NW build (default=false)
   * @option  setup     boolean   logging     Enable logging (default=true)
   * @option  setup     Mixed     settings    (Optional) Auto-detected. Path to Settings JSON file or Object
   * @option  setup     String    repodir     (Optional) Auto-detected. Package repository root directory (ex: /osjs/src/packages)
   * @option  setup     String    distdir     (Optional) Auto-detected. Build root directory (ex: /osjs/dist)
   *
   * @return  Object                          Returns an object with `api`, `vfs`, `request`, `handler` and `config`/`setup` helpers
   *
   * @api     osjs.init
   */
  module.exports.init = function(setup) {

    setup.dist     = setup.dist     || 'dist';
    setup.settings = setup.settings || _path.join(_path.dirname(setup.dirname), 'settings.json');
    setup.repodir  = setup.repodir  || _path.join(setup.root, 'src', 'packages');
    setup.distdir  = setup.distdir  || _path.join(setup.root, setup.dist);
    setup.logging  = typeof setup.logging === 'undefined' || setup.logging === true;

    if ( setup.nw ) {
      setup.repodir = _path.join(setup.root, 'packages');
      setup.distdir = setup.root;
    }

    // Register manifest
    var metadata = JSON.parse( _fs.readFileBlocking( _path.join(_path.dirname(setup.dirname), 'packages.json') ) );

    // Register configuration
    config = require('./config.js').init(setup);

    // Public namespace
    var instance = {
      _vfs: require('./vfs.js'),
      _api: require('./api.js'),
      api: apiNamespace,
      vfs: vfsNamespace,
      metadata: metadata,
      request: request,
      config: config,
      setup: setup
    };

    // Register handler
    instance.handler = require('./handler.js').init(instance);

    // Register package extensions
    if ( config.extensions ) {
      var exts = config.extensions;
      exts.forEach(function(f) {
        if ( f.match(/\.js$/) ) {
          require(config.rootdir + f).register(apiNamespace, vfsNamespace, instance);
        }
      });
    }

    return instance;
  };

})(
  require('./path'),
  vertx.fileSystem()
);