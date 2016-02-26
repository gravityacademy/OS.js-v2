module.exports = (function() {
  'use strict';

  var API = {};


  API.login = function(args, message) {

    console.log('user login');
    var reply = {
      blacklistedPackages: [],
      userData: {id: 0, username: "lisa", name: "Crazy Lisa", groups: ["admin"]},
      userSettings: {}
    };
    message.reply(reply);
  };


  return API


})();
