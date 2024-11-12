import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Chess } from 'chess.js';

const STOCKFISH = window.STOCKFISH;
const game = new Chess();

class Stockfish extends Component {
  static propTypes = { children: PropTypes.func };

  constructor(props) {
    super(props);
    this.state = { fen: 'start' };
    this.engine = null;
  }

  componentDidMount() {
    // Initialize engine once and store it
    this.engine =
      typeof STOCKFISH === 'function'
        ? STOCKFISH()
        : new Worker('stockfish.js');

    // Configure engine
    this.engine.postMessage('uci');
    this.engine.postMessage('isready');

    // Set up message handler
    this.engine.onmessage = (event) => {
      const line = event.data;
      console.log('Engine:', line); // Debug log

      // Look for the best move command from engine
      const match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);

      if (match) {
        const engineMove = game.move({
          from: match[1],
          to: match[2],
          promotion: match[3],
        });

        if (engineMove) {
          console.log('Engine moved:', engineMove); // Debug log
          this.setState({ fen: game.fen() });
        }
      }
    };
  }

  componentWillUnmount() {
    if (this.engine) {
      this.engine.postMessage('quit');
    }
  }

  makeEngineMove = () => {
    const moves = game
      .history({ verbose: true })
      .map((move) => move.from + move.to + (move.promotion || ''))
      .join(' ');

    console.log('Current position:', game.fen()); // Debug log
    console.log('Move history:', moves); // Debug log

    this.engine.postMessage('position startpos moves ' + moves);
    this.engine.postMessage('go depth 10'); // Search 10 moves deep
  };

  onDrop = ({ sourceSquare, targetSquare }) => {
    // Make player's move
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    // If illegal move, return
    if (move === null) return false;

    console.log('Player moved:', move); // Debug log

    // Update state and trigger engine move
    return new Promise((resolve) => {
      this.setState({ fen: game.fen() }, () => {
        resolve();
        setTimeout(() => {
          if (!game.isGameOver()) {
            this.makeEngineMove();
          }
        }, 300);
      });
    });
  };

  render() {
    const { fen } = this.state;
    return this.props.children({ position: fen, onDrop: this.onDrop });
  }
}

export default Stockfish;
