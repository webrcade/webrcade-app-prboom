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

  SAV_NAME = "sav";

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

  async migrateSaves() {
    const { app, key, storage, CFG_FILE, SAV_PREFIX, SAV_EXT, SAVE_COUNT, SAV_NAME } = this;

    const files = [];

    // Load old saves
    for (let i = -1; i < SAVE_COUNT; i++) {
      const fileName = (i === -1 ? CFG_FILE : SAV_PREFIX + i + SAV_EXT);
      const storagePath = app.getStoragePath(`${key}/${fileName}`);
      try {
        const s = await storage.get(storagePath);
        if (s) {
          files.push({
            name: fileName,
            content: s
          });
        }
      } catch (e) {
        LOG.error(e);
      }
    }

    if (files.length > 0) {
      LOG.info('Migrating local saves.');

      // Persist in new format
      await this.getSaveManager().saveLocal(
        app.getStoragePath(`${key}/${SAV_NAME}`), files);

      // Delete old files
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        await storage.remove(app.getStoragePath(`${key}/${f.name}`));
      }
    }
  }

  async populateFiles() {
    const {
      app,
      key,
      CFG_FILE,
      FS,
      FS_PREFIX,
      SAV_EXT,
      SAV_PREFIX,
      SAVE_COUNT,
      SAV_NAME,
    } = this;

    await this.migrateSaves();

    try {
      // Load from new save format
      const files = await this.getSaveManager().load(
        app.getStoragePath(`${key}/${SAV_NAME}`),
        this.loadMessageCallback,
      );

      // Create the save path (MEM FS)
      FS.mkdir(FS_PREFIX);

      for (let i = -1; i < SAVE_COUNT; i++) {
        const fileName = (i === -1 ? CFG_FILE : SAV_PREFIX + i + SAV_EXT);
        const path = FS_PREFIX + "/" + fileName;
        try {
          const res = FS.analyzePath(path, true);
          if (!res.exists) {
            let s = null;
            for (let j = 0; j < files.length; j++) {
              const f = files[j];
              if (f.name === fileName) {
                s = f.content;
                break;
              }
            }
            if (s) {
              FS.writeFile(path, s);
            }
          }
        } catch (e) {
          LOG.error(e);
        }
      }
    } catch (e) {
      LOG.error('Error loading save state: ' + e);
    }
  }

  async storeFiles() {
    const {
      app,
      key,
      CFG_FILE,
      FS,
      FS_PREFIX,
      SAV_EXT,
      SAV_PREFIX,
      SAVE_COUNT,
      SAV_NAME
    } = this;

    try {
      const files = [];
      for (let i = -1; i < SAVE_COUNT; i++) {
        const fileName = (i === -1 ? CFG_FILE : SAV_PREFIX + i + SAV_EXT);
        const path = FS_PREFIX + "/" + fileName;
        //const storagePath = app.getStoragePath(`${key}/${fileName}`);
        try {
          const res = FS.analyzePath(path, true);
          if (res.exists) {
            const s = FS.readFile(path);
            if (s) {
              //await storage.put(storagePath, s);
              files.push({
                name: fileName,
                content: s
              })
            }
          }
        } catch (e) {
          LOG.error(e);
        }
      }

      if (files.length > 0) {
        await this.getSaveManager().save(
          app.getStoragePath(`${key}/${SAV_NAME}`),
          files,
          this.saveMessageCallback);
      }
    } catch(e) {
      LOG.error('Error persisting save state: ' + e);
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
