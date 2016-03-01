(function(){
  'use strict';

  /**
   *
   *
   * create event bus handlers
   *
   *
   */
  module.exports.init = function(instance){


    /*function genUUID(){ return Java.type("java.util.UUID").randomUUID() }

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
      var paths = instance.vfs.getRealPath(mes.args.path);

      _fs.writeFile(paths.full, function (result, error) {
        if (error) message.reply(false);
        else message.reply(true);
      });
    });



    _eb.consumer('OSjsCallGET', function (message) {
      console.log('OSjsCallGET');

      var mes = message.body();
      var paths = instance.vfs.getRealPath(mes.args.path);

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
  */

  }

})();
