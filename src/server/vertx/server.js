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

var options = { "outboundPermitteds" : [{ "setAddressRegex" : "/^OSv/" }],
    			"inboundPermitteds" :  [{ "setAddressRegex" : "/^OSv/" }]};

var router = Router.router(vertx);
var eb = vertx.eventBus();
var fs = vertx.fileSystem();

router.route("/eventbus/*").handler(SockJSHandler.create(vertx).bridge(options).handle);


router.route().handler(StaticHandler.create().setCachingEnabled(false).setWebRoot("dist-dev").handle);

vertx.createHttpServer().requestHandler(router.accept).listen(8000);


eb.consumer('OSv-API', function(message) {

  var msg = message.body();

  var api = msg.api;
  var data = msg.data;

  console.log( 'API call: ' + api + ' ' + data.method);

  message.reply(true);

});


eb.consumer('OSv-GET', function(message) {

  var path = '../..'+ message.body();

  //console.log( path );


  fs.readFile(path, function(result, error){

  	if (error == null) {

  	  result = result.toString("UTF-8");

	  //console.log(result)
	  message.reply(result);

  	} else {

	  console.log('fs error');
	  console.log(JSON.stringify(err));

  	}

  })

  

});

