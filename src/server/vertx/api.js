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
(function(_path) {
  'use strict';

  /////////////////////////////////////////////////////////////////////////////
  // DEFAULT API METHODS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Login Wrapper. This is just a placeholder. The function is bound in the handler
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext    Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    username    Username
   * @option  args      String    password    Password
   *
   * @return  void
   *
   * @api     api.login
   */
  module.exports.login = function(args, callback, routingContext, config) {
    callback('No handler assigned', {});
  };

  /**
   * Logout Wrapper. This is just a placeholder. The function is bound in the handler
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext    Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @return  void
   *
   * @api     api.logout
   */
  module.exports.logout = function(args, callback, routingContext, config) {
    callback('No handler assigned', {});
  };

  /**
   * Settings storing Wrapper. This is just a placeholder. The function is bound in the handler
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext    Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      Object    settings    Settings Tree
   *
   * @return  void
   *
   * @api     api.settings
   */
  module.exports.settings = function(args, callback, routingContext, config) {
    callback('No handler assigned', {});
  };

  /**
   * Application API Call
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext    Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    path        Package Path (ex: default/FileManager)
   * @option  args      String    method      API Method name
   * @option  args      Array     arguments   List of arguments to API Method
   *
   * @return  void
   *
   * @api     api.application
   */
  module.exports.application = function(args, callback, routingContext, config) {
    var apath = args.path || null;
    var ameth = args.method || null;
    var aargs = args['arguments'] || [];

    var aroot = _path.join(config.repodir, apath);
    var fpath = _path.join(aroot, 'api.js');

    try {
      require(fpath)[ameth](aargs, function(error, result) {
        callback(error, result);
      }, routingContext);
    } catch ( e ) {
      if ( config.logging !== false ) {
        console.warn(e.stack, e.trace);
      }
      callback('Application API error or missing: ' + e.toString(), null);
    }
  };

  /**
   * cURL API Call
   *
   * Gives an object like: {httpCode: -1, body: '...'}
   *
   * @param   Object    args        API Call Arguments
   * @param   Function  callback    Callback function => fn(error, result)
   * @param   Object    routingContext    Server routingContext object
   * @param   Object    config      Server configuration object
   *
   * @option  args      String    method      HTTP Call method (GET/POST/HEAD)
   * @option  args      String    url         HTTP Call URL
   * @option  args      Object    query       HTTP POST Payload
   * @option  args      int       timeout     Timeout in seconds (default=0)
   * @option  args      boolean   binary      Return binary (default=false)
   * @option  args      String    mime        (Optional) If binary, which MIME
   *
   * @return  void
   * @link    http://os.js.org/doc/tutorials/using-curl.html
   *
   * @api     api.curl
   */
  module.exports.curl = function(args, callback, routingContext, config) {
    var url = args.url;
    var method = args.method || 'GET';
    var query = args.query || {};
    var timeout = args.timeout || 0;
    var binary = args.binary === true;
    var mime = args.mime || null;
    var headers = args.routingContext.request().getHeaders() || {};

    if ( !mime && binary ) {
      mime = 'application/octet-stream';
    }

    if ( !url ) {
      callback('cURL expects an \'url\'');
      return;
    }

    var opts = {
      url: url,
      method: method,
      timeout: timeout * 1000,
      headers: headers
    };

    if ( method === 'POST' ) {
      opts.json = true;
      opts.body = query;
    }

    if ( binary ) {
      opts.encoding = null;
    }

    /*require('request')(opts, function(error, response, body) {
      if ( error ) {
        callback(error);
        return;
      }

      if ( binary && body ) {
        body = 'data:' + mime + ';base64,' + (body.toString('base64'));
      }

      var data = {
        httpCode: response.statusCode,
        body: body
      };

      callback(false, data);
    });*/
    callback(true, 'temp disabled');

  };

})(
  require('./path')
);