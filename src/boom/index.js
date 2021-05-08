import {
  addDebugDiv,
  registerAudioResume,
  Storage,
  Controller,
  Controllers,
  CIDS
} from "@webrcade/app-common"

export class Boom {
  constructor(app, debug = false) {
    this.app = app;
    this.debug = debug;
    this.storage = new Storage();

    this.controllers = new Controllers([
      new Controller()
    ]);

    if (this.debug) {
      this.debugDiv = addDebugDiv();
    }
  }

  SAVE_COUNT = 8;
  FS_PREFIX = "/save";
  CFG_FILE = "prboom.cfg";
  SAV_PREFIX = "prbmsav";
  SAV_EXT = ".dsg";

  async populateFiles() {
    const {
      FS,
      FS_PREFIX,
      SAVE_COUNT,
      CFG_FILE,
      SAV_PREFIX,
      SAV_EXT,
      app,
      storage
    } = this;

    // Create the save path (MEM FS)
    FS.mkdir(FS_PREFIX);

    for (let i = -1; i < SAVE_COUNT; i++) {
      const fileName = (i === -1 ? CFG_FILE : SAV_PREFIX + i + SAV_EXT);
      const path = FS_PREFIX + "/" + fileName;
      const storagePath = app.getStoragePath(fileName);
      try {
        const res = FS.analyzePath(path, true);
        if (!res.exists) {
          const s = await storage.get(storagePath);
          if (s) {
            FS.writeFile(path, s);
          }
        }
      } catch (e) {
        // TODO: Proper error handling
        console.error(e);
      }
    }
  }

  async storeFiles() {
    const {
      FS,
      FS_PREFIX,
      SAVE_COUNT,
      CFG_FILE,
      SAV_PREFIX,
      SAV_EXT,
      app,
      storage
    } = this;

    for (let i = -1; i < SAVE_COUNT; i++) {
      const fileName = (i === -1 ? CFG_FILE : SAV_PREFIX + i + SAV_EXT);
      const path = FS_PREFIX + "/" + fileName;
      const storagePath = app.getStoragePath(fileName);
      try {
        const res = FS.analyzePath(path, true);
        if (res.exists) {
          const s = FS.readFile(path);              
          if (s) {
            await storage.put(storagePath, s);
          }
        }
      } catch (e) {
        // TODO: Remove old value?
        // TODO: Proper error handling
        console.error(e);
      }
    }
  }

  loadBoom(key, canvas, loadingCb) {
    const { app, controllers } = this;

    return new Promise((resolve, reject) => {
      window.Module = {
        canvas: canvas,
        elementPointerLock: true,
        prSyncFs: async () => { 
          try {
            await this.storeFiles();
          } catch (e) {
            // TODO: Proper error handling
            console.error(e);
          }
        },
        onAbort: (msg) => { app.exit(msg); },
        onExit: () => { 
          controllers.waitUntilControlReleased(0, CIDS.A)
          .then(() => app.exit())
          .catch((e) => console.error(e))
        },
        setWindowTitle: () => { return window.title; },
        locateFile: (path, prefix) => { return 'js/' + key + "/" + path; },
        onRuntimeInitialized: () => {
          setTimeout(() => {
            registerAudioResume(window.SDL.audioContext)
            resolve();
          }, 10);
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
            // TODO: Proper error handlng
            console.error(e);
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
