
(function(Application, GUI, Dialogs, Utils, API, VFS) {
  'use strict';

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  function ApplicationGreenGuac(args, metadata) {
    Application.apply(this, ['ApplicationGreenGuac', args, metadata, {
      src: '//107.170.230.62:8080/guacamole',
      title: metadata.name,
      icon: metadata.icon,
      width: 640,
      height: 480,
      allow_resize: true,
      allow_restore: true,
      allow_maximize: true
    }]);
  }

  ApplicationGreenGuac.prototype = Object.create(Application.prototype);

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationGreenGuac = OSjs.Applications.ApplicationGreenGuac || {};
  OSjs.Applications.ApplicationGreenGuac.Class = ApplicationGreenGuac;

})(OSjs.Helpers.IFrameApplication, OSjs.GUI, OSjs.Dialogs, OSjs.Utils, OSjs.API, OSjs.VFS);
