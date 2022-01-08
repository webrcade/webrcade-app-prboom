import {
  addDebugDiv,
  registerAudioResume,
  AppWrapper,
  Controller,
  Controllers,
  LOG,
  CIDS
} from "@webrcade/app-common"

export class Boom extends AppWrapper {
  constructor(app, debug = false) {
    super(app, debug);

    this.key = null;

    if (this.debug) {
      this.debugDiv = addDebugDiv();
    }
  }

  SAVE_COUNT = 8;
  FS_PREFIX = "/save";
  CFG_FILE = "prboom.cfg";
  SAV_PREFIX = "prbmsav";
  SAV_EXT = ".dsg";

  createControllers() {
    return new Controllers([
      new Controller()
    ]);
  }

  createTouchListener() {
    // No touch listener
    return null;
  }

  createVisibilityMonitor() {
    // No visibility monitor
    return null;
  }

  createAudioProcessor() {
    // No audio processor
    return null;
  }

  async populateFiles() {
    const {
      app,
      key,
      storage,
      CFG_FILE,
      FS,
      FS_PREFIX,
      SAV_EXT,
      SAV_PREFIX,
      SAVE_COUNT
    } = this;

    // Create the save path (MEM FS)
    FS.mkdir(FS_PREFIX);

    for (let i = -1; i < SAVE_COUNT; i++) {
      const fileName = (i === -1 ? CFG_FILE : SAV_PREFIX + i + SAV_EXT);
      const path = FS_PREFIX + "/" + fileName;
      const storagePath = app.getStoragePath(`${key}/${fileName}`);
      try {
        const res = FS.analyzePath(path, true);
        if (!res.exists) {
          const s = await storage.get(storagePath);
          if (s) {
            FS.writeFile(path, s);
          }
        }
      } catch (e) {
        LOG.error(e);
      }
    }
  }

  async storeFiles() {
    const {
      app,
      key,
      storage,
      CFG_FILE,
      FS,
      FS_PREFIX,
      SAV_EXT,
      SAV_PREFIX,
      SAVE_COUNT
    } = this;

    for (let i = -1; i < SAVE_COUNT; i++) {
      const fileName = (i === -1 ? CFG_FILE : SAV_PREFIX + i + SAV_EXT);
      const path = FS_PREFIX + "/" + fileName;
      const storagePath = app.getStoragePath(`${key}/${fileName}`);
      try {
        const res = FS.analyzePath(path, true);
        if (res.exists) {
          const s = FS.readFile(path);              
          if (s) {
            await storage.put(storagePath, s);
          }
        }
      } catch (e) {
        LOG.error(e);
      }
    }
  }

  loadBoom(key, canvas, loadingCb) {
    const { app, controllers } = this;

    this.key = key;

    return new Promise((resolve, reject) => {
      window.Module = {
        canvas: canvas,
        elementPointerLock: true,
        prSyncFs: async () => { 
          try {
            await this.storeFiles();
          } catch (e) {
            LOG.error(e);
          }
        },
        onAbort: (msg) => { app.exit(msg); },
        onExit: () => { 
          controllers.waitUntilControlReleased(0, CIDS.A)
            .then(() => app.exit())
            .catch((e) => LOG.error(e))
        },
        setWindowTitle: () => { return window.title; },
        //locateFile: (path, prefix) => { return 'js/' + key + "/" + path; },
        //locateFile: (path, prefix) => { return 'https://archive.org/download/webrcade-default-feed/default-feed.zip/default-feed%2Fcontent%2Fdoom%2f' + key + "%2f" + path; },
        locateFile: (path, prefix) => { return 'https://raw.githubusercontent.com/webrcade/webrcade-app-prboom/master/public/js/' + key + "%2f" + path; },        
        onRuntimeInitialized: () => {
          const f = () => {            
            if (window.SDL && window.SDL.audioContext) {
              if (window.SDL.audioContext.state !== 'running') {
                app.setShowOverlay(true);
                registerAudioResume(
                  window.SDL.audioContext,
                  (running) => { setTimeout(() => app.setShowOverlay(!running), 50); },
                  500
                );
              }
            } else {
              setTimeout(f, 1000);
            }
          }          
          setTimeout(f, 1000);          
          resolve();
        },
        setStatus: (status) => {
          let loading = status.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
          if (loading) {
            let progress = loading[2] / loading[4] * 100;
            if (loadingCb) loadingCb(progress);
          }
        },
        preRun: [async () => { 
          const { Module } = window;
          Module.addRunDependency();
          this.FS = window.FS;
          try {
            await this.populateFiles();
          } catch (e) {
            LOG.error(e);
          } finally {
            Module.removeRunDependency();
          }
        }]
      }

      const script = document.createElement('script');
      document.body.appendChild(script);
      script.src = 'js/' + key + '/' + key + '.js';
    });
  }
}
