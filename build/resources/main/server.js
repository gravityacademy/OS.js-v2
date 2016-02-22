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
var eb = vertx.eventBus();
var fs = vertx.fileSystem();
var options = { "outboundPermitteds" : [{ "setAddressRegex" : "/^OSjs/" }],
  "inboundPermitteds" :  [{ "setAddressRegex" : "/^OSjs/" }]};


router.route("/eventbus/*").handler(SockJSHandler.create(vertx).bridge(options).handle);
router.route().handler(StaticHandler.create().setCachingEnabled(false).setWebRoot("dist-dev").handle);

vertx.createHttpServer().requestHandler(router.accept).listen(8000);



function getRealPath(path) {

  console.log(path);
  var basePath = '';

  if ( path.match(/^osjs\:\/\//) ) {

    path = path.replace(/^osjs\:\/\//, '');
    basePath = 'dist-dev';

  } else if ( path.match(/^home\:\/\//) ) {

    path = path.replace(/^home\:\/\//, '');
    basePath = 'vfs/home';

  } else {
    var tmp = path.split(/^(\w+)\:\/\//);
    if ( tmp.length === 3 ) {
      tmp = tmp[1];

      basePath = 'vfs/tmp';
      path = path.replace(/^(\w+)\:\/\//, '');
    }
  }
  return {basePath:basePath, fileName:path, full: basePath+path};
}


var VFS = {};

VFS.exists = function(args,message){

  var paths = getRealPath(args.path);

  console.log('VFS.exists: ' + paths.full);

  fs.exists(paths.full, function (result) {

    console.log(JSON.stringify(result));
    message.reply(result);
  });
};

VFS.scandir = function(args, message) {

  var fileProps = [];
  var fileCounter = 0;
  var paths = getRealPath(args.path);

  /*console.log('^^^^^^^^^^^^^^^');
  console.log(paths.basePath);
  console.log(paths.fileName);
  console.log(paths.full);*/

  console.log('VFS.scandir: ' + paths.full);

  fs.readDir( paths.full, function (res, err) {

    if(err) {

      console.log('file scanning error');
      console.log(err);

    } else {

      //console.log(res);
      nextStep(res);
    }

  });

  function nextStep(fArray){

    fileProps = [];
    fileCounter = 0;

    if (fArray.length > 0) {
      for (var i = 0; i < fArray.length; i++) {
        getProps(fArray[i], fArray.length);
      }
    } else {
      var result = {
        ctime: null,
        filename: "..",
        mime: "",
        mtime: null,
        path: args.path,
        size: 0,
        type: "dir"
      };
      message.reply([result]);
    }
  }

  function getProps(filePath, last) {

    var ppcs = filePath.substring(1).split('/');
    var filename = ppcs[ ppcs.length-1 ];
    var mime = "";
    var type = "file";
    var path;


    fs.props(filePath, function (res, err) {

      if (err) console.log('file props error');
      else {

        //console.log(filename);

        if ( res.isRegularFile() ) mime = "text/plain";
        if ( res.isDirectory() ) type = "dir";

        if(args.path.substr(args.path.length-1,1) === '/') {
          path = args.path + filename;
        } else {
          path = args.path + '/' + filename;
        }

        var fileProp = {
          ctime: res.creationTime(),
          filename: filename,
          mime: mime,
          mtime: res.lastModifiedTime(),
          path: path,
          size: res.size,
          type: type
        };

        fileProps.push(fileProp);

        fileCounter++;
        if (fileCounter === last) message.reply(fileProps);
      }
    });

  }

};


eb.consumer('OSjsCallXHR', function(message) {

  var msg = message.body(); //{url:url, args:args, options:options}
  var pair = msg.url.substring(1).split('/');

  console.log(pair[0]);
  console.log(pair[1]);
  console.log( JSON.stringify(msg.args) );


  if (pair[0] === 'API') API(pair[1], msg.args, message);
  else if (pair[0] === 'FS') FS(pair[1], msg.args, message);


});

function API(method, args, message){

  switch (method) {

    case 'login': login(args, message); break

  }

}

function login(args, message){

  console.log('user login');

  var reply = {
    blacklistedPackages: [],
    userData: {id: 0, username: "lisa", name: "Crazy Lisa", groups: ["admin"]},
    userSettings: {}
  };

  message.reply(reply);
}


function FS(method, args, message){

  switch (method) {

    case 'exists': VFS.exists(args, message); break;
    case 'scandir': VFS.scandir(args, message); break;
    case 'GET': VFS.get(); break;

  }

}


eb.consumer('OSjsCallPOST', function(mes) {

});

eb.consumer('OSjsCallGET', function(message) {

  console.log('OSjsCallGET');

  var mes = message.body();
  var paths = getRealPath(mes.args.path);

  console.log('^^^^^^^^^^^^^^^');
  console.log(paths.basePath);
  console.log(paths.fileName);
  console.log(paths.full);

  fs.readFile(paths.full, function(result, error){

  	if (error == null) {

  	  result = result.toString("UTF-8");

      console.log(result);
      message.reply(result);

  	} else {

      console.log('fs error');
      console.log(JSON.stringify(err));

  	}

  })

});

console.log('***');
console.log('*** OS.js vertx is running');
console.log('***');
