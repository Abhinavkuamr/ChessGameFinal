import React from 'react';
import Stockfish from './Stockfish';
import Chessboard from 'chessboardjsx';

export default function GameWithAI() {
  return (
    <div>
      <h1>AI vs Human</h1>
      <div style={boardsContainer}>
        <Stockfish>
          {({ position, onDrop }) => (
            <Chessboard
              id='stockfish'
              position={position}
              width={320}
              onDrop={onDrop}
              boardStyle={boardStyle}
              orientation='black'
            />
          )}
        </Stockfish>
      </div>
    </div>
  );
}

const boardsContainer = {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
};
const boardStyle = {
  borderRadius: '5px',
  boxShadow: `0 5px 15px rgba(0, 0, 0, 0.5)`,
};
