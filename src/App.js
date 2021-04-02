import { WebrcadeApp } from '@webrcade/app-common'
import { Boom } from './boom'

import './App.scss';
import '@webrcade/app-common/dist/index.css'

class App extends WebrcadeApp {
  boom = null;
  GAMES = ['doom1', 'freedoom1', 'freedoom2'];

  componentDidMount() {
    super.componentDidMount();    

    if (this.boom === null) {
      this.boom = new Boom(this, this.isDebug());
    }    

    const { appProps, boom, ModeEnum, GAMES } = this;

    // Get the game that was specified
    let game = appProps.game;
    if (!game) throw new Error("A game was not specified.");
    game = game.toLowerCase();
    let found = false;
    for (let i = 0; !found && i < GAMES.length; i++) {
      found = GAMES[i] === game;
    }    
    if (!found) throw new Error("Unknown game: " + game);    

    boom.loadBoom(game, this.canvas, 
        (percent) => { this.setState({loadingPercent: percent|0}) })
      .then(() => this.setState({mode: ModeEnum.LOADED}))
      .catch(msg => { this.exit("Error: " + msg); })
  }

  componentDidUpdate() {
    const { mode } = this.state;
    const { ModeEnum, canvas} = this;
    
    if (mode === ModeEnum.LOADED) {
      canvas.style.display = 'block';
      window.focus();      
    }
  }

  renderCanvas() {
    return (
      <canvas ref={canvas => { this.canvas = canvas;}} id="GameCanvas"></canvas>
    );
  }

  render() {
    const { mode } = this.state;
    const { ModeEnum } = this;

    return (
      <>
        { mode === ModeEnum.LOADING ? this.renderLoading() : null}
        { this.renderCanvas() }
      </>
    );
  }
}

export default App;
