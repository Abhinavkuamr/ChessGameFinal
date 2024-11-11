import './App.css';
import GameScreen from './Components/GameScreen';
import Chessboard from 'chessboardjsx'; // Make sure you import Chessboard as well
import Stockfish from './Components/Stockfish';

function App() {
  return (
    <div className='App'>
      <h1>Game Screen</h1>
      <GameScreen />
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

export default App;

const boardsContainer = {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
};
const boardStyle = {
  borderRadius: '5px',
  boxShadow: `0 5px 15px rgba(0, 0, 0, 0.5)`,
};
