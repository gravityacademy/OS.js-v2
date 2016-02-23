var Buffer = require("vertx-js/buffer");
var Router = require("vertx-web-js/router");
var SockJSHandler = require("vertx-web-js/sock_js_handler");
var StaticHandler = require("vertx-web-js/static_handler");
var BridgeEvent = require("vertx-web-js/bridge_event");
var System = Java.type("java.lang.System");
var CookieHandler = require("vertx-web-js/cookie_handler");
var BodyHandler = require("vertx-web-js/body_handler");
var LocalSessionStore = require("vertx-web-js/local_session_store");
var SessionHandler = require("vertx-web-js/session_handler");
var ShiroAuth = require("vertx-auth-shiro-js/shiro_auth");
var UserSessionHandler = require("vertx-web-js/user_session_handler");
var RedirectAuthHandler = require("vertx-web-js/redirect_auth_handler");
var FormLoginHandler = require("vertx-web-js/form_login_handler");
var User = require("vertx-auth-common-js/user");
var router = Router.router(vertx);

global.eb = vertx.eventBus();
global.fs = vertx.fileSystem();
global.DEBUG = false;
global.OSjs = {
  API: require("./api.js"),
  VFS: require("./vfs.js")
};


var options = {
  "outboundPermitteds" : [{ "setAddressRegex" : "/^OSjs/" }],
  "inboundPermitteds" :  [{ "setAddressRegex" : "/^OSjs/" }]};


router.route("/eventbus/*").handler(SockJSHandler.create(vertx).bridge(options).handle);
router.route().handler(StaticHandler.create().setCachingEnabled(false).setWebRoot("dist-dev").handle);

vertx.createHttpServer().requestHandler(router.accept).listen(8000);


eb.consumer('OSjsCallXHR', function(message) {

  var msg = message.body();     //  {url:url, args:args, options:options}
  var pair = msg.url.substring(1).split('/');

  if (DEBUG) {
    console.log(pair[0]);
    console.log(pair[1]);
    console.log(JSON.stringify(msg.args));
  }

  switch (pair[0]) {
    case 'API': _api(pair[1], msg.args, message); break;
    case 'FS' : _fs(pair[1], msg.args, message); break;
  }

});

function _api(method, args, message){
  switch (method) {
    case 'login': OSjs.API.login(args, message); break
  }
}

function _fs(method, args, message){
  switch (method) {
    case 'exists': OSjs.VFS.exists(args, message); break;
    case 'scandir': OSjs.VFS.scandir(args, message); break;
  }
}



eb.consumer('OSjsCallPOST', function(mes) {

});

eb.consumer('OSjsCallGET', function(message) {

  console.log('OSjsCallGET');

  var mes = message.body();
  var paths = OSjs.VFS.getRealPath(mes.args.path);

  fs.readFile(paths.full, function(result, error){

  	if (error == null) {
  	  result = result.toString("UTF-8");
      if (DEBUG) console.log(result);
      message.reply(result);
  	} else {
      console.log('fs error');
      console.log(JSON.stringify(err));
  	}

  })

});

console.log('***');
console.log('*** OS.js vertx is listening on port ' + config.port);
console.log('***');
