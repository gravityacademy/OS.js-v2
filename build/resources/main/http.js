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

var eb = vertx.eventBus();
var fs = vertx.fileSystem();
global.DEBUG = true;
global.OSjs = {
  API: require("./api.js"),
  VFS: require("./vfs.js")
};

var options = {
  "outboundPermitteds" : [{ "setAddressRegex" : "/^OSjs/" }],
  "inboundPermitteds" :  [{ "setAddressRegex" : "/^OSjs/" }]};


router.route("/eventbus/*").handler(SockJSHandler.create(vertx).bridge(options).handle);

router.route('GET', "/FS/get/*").handler(function (rc) {
  var path = rc.request().path().replace('/FS/get/', '');
  var paths = OSjs.VFS.getRealPath(path);
  if (DEBUG) console.log('http FS get ' + paths.path);
  rc.response().sendFile(paths.full);
});

router.route().handler(StaticHandler.create().setCachingEnabled(false).setWebRoot("dist-dev").handle);

vertx.createHttpServer().requestHandler(router.accept).listen(8000);


eb.consumer('OSjsCallXHR', function(message) {

  var msg = message.body();     //  {url:url, args:args, options:options}
  var pair = msg.url.substring(1).split('/');
  var call = pair[0];
  var method = pair[1];
  if (DEBUG) {
    console.log( 'calling: ' + call + ' method: ' + method);
    //console.log(JSON.stringify(msg.args));
  }
  switch (call) {
    case 'API': OSjs.API[method](msg.args, message); break;
    case 'FS' : OSjs.VFS[method](msg.args, message); break;
  }
});

eb.consumer('OSjsCallPOST', function(message) {
  console.log('OSjsCallPOST');

  var mes = message.body();
  var paths = OSjs.VFS.getRealPath(mes.args.path);

  fs.writeFile(paths.full, function(result, error){
    if(error) message.reply(false);
    else message.reply(true);
  });
});

eb.consumer('OSjsCallGET', function(message) {
  console.log('OSjsCallGET');

  var mes = message.body();
  var paths = OSjs.VFS.getRealPath(mes.args.path);

  fs.readFile(paths.full, function(result, error){
  	if (error == null) {
      if (DEBUG) console.log('callGet ' + paths.path);
      message.reply(result.toString("UTF-8"));
  	} else {
      console.log('fs error');
      console.log(JSON.stringify(error));
  	}
  })
});

setTimeout(function(){
  console.log('***');
  console.log('*** OS.js vertx is listening on port ' + config.port);
  console.log('***');
}, 300);
