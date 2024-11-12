import './App.css';
import GameScreen from './Components/GameScreen';
import Chessboard from 'chessboardjsx';
import Stockfish from './Components/Stockfish';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import Register from './Components/Register';
import Login from './Components/Login';
import UserProfile from './Components/UserProfile';
import GameWithAI from './Components/GameWithAI';
import Scoreboard from './Components/scoreboard';

function App() {
  return (
    <div className='App'>
      <Router>
        <nav className='navigation'>
          <ul style={navStyle}>
            <li>
              <Link to='/register'>Register</Link>
            </li>
            <li>
              <Link to='/login'>Login</Link>
            </li>
            <li>
              <Link to='/gameAI'>Play with AI</Link>
            </li>
            <li>
              <Link to='/gameHuman'>Play with Human</Link>
            </li>
            <li>
              <Link to='/user'>Profile</Link>
            </li>
            <li>
              <Link to='/scoreboard'>Scoreboard</Link>
            </li>
          </ul>
        </nav>
        <hr />
        <div style={mainContentStyle}>
          <Routes>
            <Route path='/' element={<Register />} />
            <Route path='/register' element={<Register />} />
            <Route path='/login' element={<Login />} />
            <Route path='/gameAI' element={<GameWithAI />} />
            <Route path='/gameHuman' element={<GameScreen />} />
            <Route path='/user' element={<UserProfile />} />
            <Route path='/scoreboard' element={<Scoreboard />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
}

const GameWithHuman = () => {
  return (
    <div style={gameContainerStyle}>
      <h1>Game Screen (Human vs Human)</h1>
      <GameScreen />
      <div style={boardsContainer}>
        <Chessboard
          id='human-game'
          position={'start'}
          width={560} // Increased board size
          boardStyle={boardStyle}
          orientation='white'
        />
      </div>
    </div>
  );
};

// Styles
const navStyle = {
  listStyle: 'none',
  display: 'flex',
  gap: '20px',
  padding: '20px',
  justifyContent: 'center',
  backgroundColor: '#f5f5f5',
  margin: 0,
};

const mainContentStyle = {
  padding: '20px',
  maxWidth: '1200px',
  margin: '0 auto',
};

const gameContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
  padding: '20px',
};

const boardsContainer = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  minHeight: '600px',
  padding: '20px',
};

const boardStyle = {
  borderRadius: '8px',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
  backgroundColor: '#fff',
};

export default App;
