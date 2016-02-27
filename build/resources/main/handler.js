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
(function(_path, Cookie) {
  'use strict';

  var ignorePrivilegesAPI = ['login'];
  var ignorePrivilegesVFS = ['getMime', 'getRealPath'];

  var verboseAuth;

  /**
   * Internal for registering a API method. This wraps the methods so that
   * privilege checks etc are performed
   */
  function registerAPIMethod(handler, instance, fn, fref) {
    if ( !instance.api[fn] ) {
      if ( ignorePrivilegesAPI.indexOf(fn) < 0 ) {
        instance.api[fn] = function(args, callback, routingContext, config) {
          handler.checkAPIPrivilege(routingContext, fn, function(err) {
            if ( err ) {
              callback(err);
              return;
            }

            fref.apply(fref, [args, callback, routingContext, config, handler]);
          });
        };
      } else {
        instance.api[fn] = fref;
      }
    }
  }

  /**
   * Internal for registering a VFS method. This wraps the methods so that
   * privilege checks etc are performed
   */
  function registerVFSMethod(handler, instance, fn, fref) {

    if ( !instance.vfs[fn] ) {
      if ( ignorePrivilegesVFS.indexOf(fn) < 0 ) {

        instance.vfs[fn] = function(args, callback, routingContext) {
          handler.checkAPIPrivilege(routingContext, 'fs', function(err) {
            if ( err ) {
              callback(err);
              return;
            }

            handler.checkVFSPrivilege(routingContext, fn, args, function(err) {
              if ( err ) {
                callback(err);
                return;
              }

              fref.apply(fref, [args, routingContext, callback, instance.config, handler]);
            });
          });
        };
      } else {
        instance.vfs[fn] = fref;
      }
    }
  }

  /**
   * Internal for registerin lists of API method(s)
   */
  function registerMethods(handler, instance, api, vfs) {
    Object.keys(vfs || {}).forEach(function(fn) {
      registerVFSMethod(handler, instance, fn, vfs[fn]);
    });
    Object.keys(api || {}).forEach(function(fn) {
      registerAPIMethod(handler, instance, fn, api[fn]);
    });
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEFAULT HANDLER
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Server Handler Instance
   *
   * This is what is responsible for all API and VFS communication and user
   * session(s).
   *
   * @param   Object      instance      Current server instance
   * @param   Object      applyAPI      Apply these API methods
   * @param   Object      applyVFS      Apply these VFS methods
   *
   * @api handler.Handler
   * @class
   */
  function DefaultHandler(instance, applyAPI, applyVFS) {
    registerMethods(this, instance, applyAPI, applyVFS);
    this.instance = instance;
  }

  /**
   * Gets the username of currently active user
   *
   * @param   Object      routingContext      Server routingContext object
   *
   * @method Handler::getUserName()
   */
  DefaultHandler.prototype.getUserName = function(routingContext) {
    if (verboseAuth) console.log(' ******* getUserName *******');

    return 'demo';
    //return routingContext.getCookie('username').getValue();
  };

  /**
   * Gets the groups of currently active user
   *
   * @param   Object      routingContext      Server routingContext object
   *
   * @method Handler::getUserGroups()
   */
  DefaultHandler.prototype.getUserGroups = function(routingContext) {
    if (verboseAuth) console.log(' ******* getUserGroups ************************************');

    var groups = [];
    try {
      groups = ["admin"];
      //groups = JSON.parse(routingContext.getCookie('groups').getValue()); //todo decodeurl
    } catch ( e ) {
      groups = [];
    }
    return groups;
  };

  /**
   * Gets the blacklisted packages of active user
   *
   * @param   Object      routingContext      Server routingContext object
   * @param   Function    callback      Callback function => fn(error, result)
   *
   * @async
   * @return  void
   * @method  Handler::getUserBlacklistedPackages()
   */
  DefaultHandler.prototype.getUserBlacklistedPackages = function(routingContext, callback) {
    callback(false, []);
  };

  /**
   * Sets the user data of active user
   *
   * @param   Object      routingContext      Server routingContext object
   * @param   Object      data          Session data
   * @param   Function    callback      Callback function => fn(error, result)
   *
   * @async
   * @return void
   * @method Handler::setUserData()
   */
  DefaultHandler.prototype.setUserData = function(routingContext, data, callback) {

    if (verboseAuth) {
      console.log('setUserData');
      console.log(JSON.stringify(data));
    }

    if ( data === null ) {

      if (verboseAuth) console.log('++++ setting null cookies ++++');

      routingContext.addCookie(Cookie.cookie('username', null));
      routingContext.addCookie(Cookie.cookie('groups', null));
    } else {
      if (verboseAuth) {
        console.log('++++ setting cookies ++++');
        console.log(JSON.stringify(data.groups));
      }
      routingContext.addCookie(Cookie.cookie('username', data.username));
      routingContext.addCookie(Cookie.cookie('groups', encodeURI(JSON.stringify(data.groups))));
    }

    callback(false, true);
  };

  /**
   * Check if routingContext has access to given API routingContext
   *
   * THIS IS THE METHOD CALLED FROM THE SERVER
   *
   * @param   Object      routingContext      Server routingContext object
   * @param   Mixed       privilege     Check against given privilege(s)
   * @param   Function    callback      Callback function => fn(err, result)
   *
   * @return  boolean                   Return true for normal, false for custom callback
   *
   * @async
   * @method Handler::checkAPIPrivilege()
   */
  DefaultHandler.prototype.checkAPIPrivilege = function(routingContext, privilege, callback) {

    if (verboseAuth) console.log('**checkAPIPrivilege**');

    var self = this;
    this._checkHasSession(routingContext, function(err) {
      if ( err ) {
        callback(err);
        return;
      }
      self._checkHasAPIPrivilege(routingContext, privilege, callback);
    });
  };

  /**
   * Check if routingContext has access to given VFS routingContext
   *
   * THIS IS THE METHOD CALLED FROM THE SERVER
   *
   * @param   Object      routingContext      Server routingContext object
   * @param   String      method        VFS Method name
   * @param   Object      args          VFS Method arguments
   * @param   Function    callback      Callback function => fn(err, result)
   *
   * @return  boolean                   Return true for normal, false for custom callback
   *
   * @async
   * @method Handler::checkVFSPrivilege()
   */
  DefaultHandler.prototype.checkVFSPrivilege = function(routingContext, method, args, callback) {

    if (verboseAuth) console.log('******* checkVFSPrivilege ******');

    var self = this;
    this._checkHasSession(routingContext, function(err) {
      if ( err ) {
        callback(err);
        return;
      }
      self._checkHasVFSPrivilege(routingContext, method, args, callback);
    });
  };

  /**
   * Check if routingContext has access to given Package
   *
   * THIS IS THE METHOD CALLED FROM THE SERVER
   *
   * @param   Object      routingContext      Server routingContext object
   * @param   String      packageName   Name of Package (ex: repo/name)
   * @param   Function    callback      Callback function => fn(err, result)
   *
   * @return  boolean                   Return true for normal, false for custom callback
   *
   * @async
   * @method Handler::checkPackagePrivilege()
   */
  DefaultHandler.prototype.checkPackagePrivilege = function(routingContext, packageName, callback) {
    var self = this;
    this._checkHasSession(routingContext, function(err) {
      if ( err ) {
        callback(err);
        return;
      }
      self._checkHasPackagePrivilege(routingContext, packageName, callback);
    });
  };

  /**
   * Event fired when server starts
   *
   * @async
   * @method Handler::onServerStart()
   */
  DefaultHandler.prototype.onServerStart = function(cb) {
    cb();
  };

  /**
   * Event fired when server ends
   *
   * @async
   * @method Handler::onServerEnd()
   */
  DefaultHandler.prototype.onServerEnd = function(cb) {
    cb();
  };

  /**
   * Event fired when server gets a login
   *
   * @param     Object        routingContext      Server routingContext object
   * @param     Object        data          The login data
   * @param     Function      callback      Callback fuction
   *
   * @async
   * @method Handler::onLogin()
   */
  DefaultHandler.prototype.onLogin = function(routingContext, data, callback) {

    if (verboseAuth) console.log('handler.js onLogin');

    var self = this;

    function finished() {
      if ( data.blacklistedPackages ) {
        callback(false, data);
      } else {
        self.getUserBlacklistedPackages(routingContext, function(error, blacklist) {
          if ( error ) {
            callback(error);
          } else {
            data.blacklistedPackages = blacklist || [];
          }
          callback(false, data);
        });
      }
    }

    data.userSettings = data.userSettings || {};

    if (verboseAuth) console.log('userSettings: '+ data.userSettings);

    this.setUserData(routingContext, data.userData, function() {
      finished();
    });
  };

  /**
   * Event fired when server gets a logout
   *
   * @param     Object        routingContext      Server routingContext object
   * @param     Function      callback      Callback fuction
   *
   * @async
   * @method Handler::onLogout()
   */
  DefaultHandler.prototype.onLogout = function(routingContext, callback) {
    this.setUserData(routingContext, null, function() {
      callback(false, true);
    });
  };

  /**
   * Default method for checking if User has given group(s)
   *
   * If the user has group 'admin' it will automatically granted full access
   *
   * @param   Object      routingContext      Server routingContext object
   * @param   String      groupname     Group name(s) (can also be an array)
   * @param   Function    callback      Callback function => fn(err, result)
   *
   * @return  boolean
   *
   * @async
   * @method Handler::_checkHasGroup()
   */
  DefaultHandler.prototype._checkHasGroup = function(routingContext, groupnames, callback) {
    groupnames = groupnames || [];
    if ( !(groupnames instanceof Array) && groupnames ) {
      groupnames = [groupnames];
    }

    var self = this;
    var allowed = (function() {
      if ( typeof groupnames !== 'boolean' ) {
        var groups = self.getUserGroups(routingContext);
        if ( groups.indexOf('admin') < 0 ) {
          var allowed = true;
          groupnames.forEach(function(p) {
            if ( groups.indexOf(p) < 0 ) {
              allowed = false;
            }
            return allowed;
          });
          return allowed;
        }
      }

      return true;
    })();

    callback(false, allowed);
  };

  /**
   * Default method for checking if user has a session
   *
   * @param   Object      routingContext      Server routingContext object
   * @param   Function    callback      Callback function => fn(err, result)
   *
   * @async
   * @method Handler::_checkHasSession()
   */
  DefaultHandler.prototype._checkHasSession = function(routingContext, callback) {
    if (verboseAuth) console.log(' ******  _checkHasSession  ******');

    if ( !this.instance.setup.nw && !this.getUserName(routingContext) ) {
      callback('You have no OS.js Session, please log in!');
      return;
    }
    callback(false, true);
  };

  /**
   * Default method for checking blacklisted package permissions
   *
   * @param   Object      routingContext      Server routingContext object
   * @param   String      packageName   Name of the package
   * @param   Function    callback      Callback function => fn(err, result)
   *
   * @async
   * @method Handler::_checkHasBlacklistedPackage()
   */
  DefaultHandler.prototype._checkHasBlacklistedPackage = function(routingContext, packageName, callback) {
    if (verboseAuth) console.log(' ******  _checkHasBlacklistedPackage  ******');

    this.getUserBlacklistedPackages(routingContext, function(error, list) {
      if ( error ) {
        callback(error, false);
      } else {
        callback(false, (list || []).indexOf(packageName) >= 0);
      }
    });
  };

  /**
   * Check if active user has given API privilege
   *
   * @async
   * @see Handler::checkAPIPrivilege()
   * @method Handler::_checkHasAPIPrivilege()
   */
  DefaultHandler.prototype._checkHasAPIPrivilege = function(routingContext, privilege, callback) {
    if (verboseAuth) console.log(' ******  _checkHasAPIPrivilege  ******');

    var map = this.instance.config.api.groups;
    if ( map && privilege && map[privilege] ) {
      this._checkHasGroup(routingContext, privilege, function(err, res) {
        if ( !res && !err ) {
          err = 'You are not allowed to use this API function!';
        }
        callback(err, res);
      });
      return;
    }

    callback(false, true);
  };

  /**
   * Check if active user has given VFS privilege
   *
   * This method only checks for the 'mount' location. You can
   * override this to make it check for given method name as well
   *
   * @async
   * @see Handler::checkVFSPrivilege()
   * @method Handler::_checkHasVFSPrivilege()
   */
  DefaultHandler.prototype._checkHasVFSPrivilege = function(routingContext, method, args, callback) {
    if (verboseAuth) console.log(' ******  _checkHasVFSPrivilege  ******');

    var mount = this.instance.vfs.getRealPath(args.path || args.src, this.instance.config, routingContext);
    var cfg = this.instance.config.vfs.groups;
    var against;

    try {
      against = cfg[mount.protocol.replace(/\:\/\/$/, '')];
    } catch ( e ) {}

    if ( against ) {
      this._checkHasGroup(routingContext, against, function(err, res) {
        if ( !res && !err ) {
          err = 'You are not allowed to use this VFS function!';
        }
        callback(err, res);
      });
      return;
    }

    callback(false, true);
  };

  /**
   * Check if active user has given Package privilege
   *
   * This method checks user groups against the ones defined in package metadata
   *
   * @async
   * @see Handler::checkPackagePrivilege()
   * @method Handler::_checkHasPackagePrivilege()
   */
  DefaultHandler.prototype._checkHasPackagePrivilege = function(routingContext, packageName, callback) {
    if (verboseAuth) console.log(' ******  _checkHasPackagePrivilege  ******');

    var packages = this.instance.metadata;
    var self = this;

    function notallowed(err) {
      callback(err || 'You are not allowed to load this Package');
    }

    if ( packages && packages[packageName] && packages[packageName].groups ) {
      this._checkHasGroup(routingContext, packages[packageName].groups, function(err, res) {
        if ( err ) {
          notallowed(err);
        } else {
          if ( res ) {
            self._checkHasBlacklistedPackage(routingContext, packageName, function(err, res) {
              if ( err || !res ) {
                notallowed(err);
              } else {
                callback(false, true);
              }
            });
          } else {
            notallowed();
          }
        }
      });
      return;
    }

    callback(false, true);
  };

  /////////////////////////////////////////////////////////////////////////////
  // NW HANDLER
  /////////////////////////////////////////////////////////////////////////////

  /**
   * @api handler.NWHandler
   * @see handler.Handler
   * @class
   */
  function NWHandler(instance) {
    DefaultHandler.call(this, instance, {
      login: function(args, callback, routingContext, config, handler) {
        handler.onLogin(routingContext, {
          userData: {
            id: 0,
            username: 'nw',
            name: 'NW.js User',
            groups: ['admin']
          }
        }, callback);
      },
      logout: function(args, callback, routingContext, config, handler) {
        handler.onLogout(routingContext, callback);
      }
    });
  }

  NWHandler.prototype = Object.create(DefaultHandler.prototype);
  NWHandler.constructor = DefaultHandler;

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Initializes the handler
   *
   * @param   Object      instance      Current server instance
   *
   * @return  Handler
   *
   * @see osjs.js
   * @api handler.init()
   */
  module.exports.init = function(instance) {

    verboseAuth = instance.config.verboseAuth;

    // Register 'handler' API methods
    var handler;
    var hs = _path.join('handlers', instance.config.handler, 'handler.js');

    console.log(hs);

    if ( instance.setup.nw ) {
      handler = new NWHandler(instance);
    } else {
      handler = require(hs).register(instance, DefaultHandler);
    }

    registerMethods(handler, instance, instance._api, instance._vfs);

    return handler;
  };
})(
  require('./path'),
  require("vertx-web-js/cookie")
);
