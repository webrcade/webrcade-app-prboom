import {
  addDebugDiv
} from "@webrcade/app-common"

export class Boom {
  constructor(app, debug = false) {
    this.app = app;
    this.debug = debug;

    if (this.debug) {
      this.debugDiv = addDebugDiv();      
    }
  }

  loadBoom(key, canvas, loadingCb) {
    const { app } = this;

    return new Promise((resolve, reject) => {
      window.Module = {
        canvas: canvas,
        elementPointerLock: true,
        prSyncFs: () => { /*Storage.syncFs();*/ },
        onAbort: (msg) => { app.exit(msg); },
        onExit: () => { app.exit(); },
        setWindowTitle: () => { return window.title; },
        locateFile: (path, prefix) => { return 'js/' + key + "/" + path; },
        setStatus: (status) => {
            let loading = status.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
            if (loading) {
                let progress = loading[2] / loading[4] * 100;
                if (loadingCb) loadingCb(progress);
                if (progress === 100) {
                  resolve();
                }
            }
        },
        preRun: [() => { /*Storage.mountAndPopulateFs(key);*/ }]
      }  

      const script = document.createElement('script');
      document.body.appendChild(script);
      script.src = 'js/' + key + '/' + key + '.js';
    });
  }
}
