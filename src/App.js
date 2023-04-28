import {
  setMessageAnchorId,
  settings,
  Resources,
  WebrcadeApp,
  LOG,
  TEXT_IDS,
} from '@webrcade/app-common';
import { Boom } from './boom';

import './App.scss';

class App extends WebrcadeApp {
  boom = null;
  GAMES = ['doom1', 'freedoom1', 'freedoom2'];

  componentDidMount() {
    super.componentDidMount();

    setMessageAnchorId('GameCanvas');

    if (this.boom === null) {
      this.boom = new Boom(this, this.isDebug());
    }

    const { appProps, boom, ModeEnum, GAMES } = this;

    try {
      // Get the game that was specified
      let game = appProps.game;

      if (!game) throw new Error('A game was not specified.');
      game = game.toLowerCase();
      let found = false;
      for (let i = 0; !found && i < GAMES.length; i++) {
        found = GAMES[i] === game;
      }
      if (!found) throw new Error('Unknown game: ' + game);

      settings.load().finally(() => {
        boom.loadBoom(game, this.canvas, (percent) => {
            this.setState({ loadingPercent: percent | 0 });
          })
          // .then(() => settings.setBilinearFilterEnabled(true))
          .then(() => this.setState({ mode: ModeEnum.LOADED }))
          .catch((msg) => {
            LOG.error(msg);
            this.exit(
              this.isDebug()
                ? msg
                : Resources.getText(TEXT_IDS.ERROR_RETRIEVING_GAME),
            );
          });
        });
    } catch (e) {
      this.exit(e);
    }
  }

  componentDidUpdate() {
    const { mode } = this.state;
    const { canvas, ModeEnum } = this;

    if (mode === ModeEnum.LOADED) {
      this.boom.updateScreenSize();
      canvas.style.display = 'block';
      window.focus();
    }
  }

  renderCanvas() {
    return (
      <canvas
        style={this.getCanvasStyles()}
        ref={(canvas) => {
          this.canvas = canvas;
        }}
        id="GameCanvas"
      ></canvas>
    );
  }

  render() {
    const { mode } = this.state;
    const { ModeEnum } = this;

    return (
      <>
        {super.render()}
        {mode === ModeEnum.LOADING ? this.renderLoading() : null}
        {this.renderCanvas()}
      </>
    );
  }

  async onPreExit() {
    try {
      await super.onPreExit();
      await this.boom.storeFiles();
    } catch (e) {
      LOG.error(e);
    }
  }
}

export default App;
