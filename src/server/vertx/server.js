
var ctx = vertx.getOrCreateContext();
global.config = ctx.config();

if(JSON.stringify(config) == '{}'){

  console.log('########## conf Missing ######');

} else {

  require('./http.js');

}

