import React, { useState, useEffect, useCallback } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';
import { io } from 'socket.io-client';
import { doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import Cookies from 'js-cookie';

import {
  MessageCircle,
  Send,
  Trophy,
  Users,
  Clock,
  ArrowRight,
  Crown,
} from 'lucide-react';
import { auth, db } from './config.js';
import { useNavigate } from 'react-router-dom';

export default function GameScreen() {
  const POINTS_CONFIG = {
    WIN: 10, // Points for winning
    DRAW: 5, // Points for draw
    RESIGN: -2, // Points deduction for resigning
  };
  const [socket, setSocket] = useState(null);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('start');
  const [isWhiteTurn, setIsWhiteTurn] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameState, setGameState] = useState('idle'); // idle, searching, playing
  const [playerColor, setPlayerColor] = useState(() => {
    // Initialize playerColor from cookie if it exists
    return Cookies.get('playerColor') || null;
  });
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null); // Initialize as null
  const [showGameOverModal, setShowGameOverModal] = useState(false);

  // Function to set player color and save to cookie
  const setAndSavePlayerColor = (color) => {
    setPlayerColor(color);
    Cookies.set('playerColor', color, { expires: 1 }); // Cookie expires in 1 day
    console.log('Set player color to:', color);
  };

  const clearPlayerColorCookie = () => {
    Cookies.remove('playerColor');
    setPlayerColor(null);
  };

  useEffect(() => {
    console.log('Player Color changed:', playerColor);
  }, [playerColor]);

  const navigate = useNavigate();

  const updatePlayerPoints = async (userEmail, pointsToAdd) => {
    try {
      console.log('Attempting to update points for:', userEmail);
      console.log('Points to add:', pointsToAdd);

      const userRef = doc(db, 'users', userEmail);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.log('Creating new user document');
        await setDoc(userRef, {
          email: userEmail,
          points: pointsToAdd,
          createdAt: new Date(),
        });
      } else {
        console.log('Updating existing user document');
        console.log('Current points:', userDoc.data().points);
        await updateDoc(userRef, {
          points: increment(pointsToAdd),
        });
      }

      // Verify the update
      const updatedDoc = await getDoc(userRef);
      console.log('Updated points:', updatedDoc.data()?.points);
    } catch (error) {
      console.error('Error in updatePlayerPoints:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
    }
  };

  // Combined useEffect for authentication check and loading state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
      } else {
        setCurrentUser(user); // Store the entire user object
        console.log('Auth state changed - current user:', user);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('matchFound', ({ color, room }) => {
      console.log('Match found, playing as:', color);
      // Immediately set the player color
      setPlayerColor(color);
      setRoomId(room);
      setGameState('playing');
      setAndSavePlayerColor(color); // Save color to cookie
      setGame(new Chess());
      setFen('start');
      setIsWhiteTurn(true);
      setGameOver(false);
      setGameOverMessage('');
      setMoveHistory([]);
      setMessages([]);
      addMessage(
        'system',
        `Match found! You are playing as ${color}. ${
          color === 'white' ? "It's your turn!" : "Waiting for white's move..."
        }`
      );
    });

    socket.on(
      'opponentMove',
      ({
        from,
        to,
        promotion,
        isWhiteTurn: newTurn,
        fen: newFen,
        gameOver: gameOverData,
      }) => {
        console.log('Opponent moved:', from, 'to', to);

        setGame((prevGame) => {
          const gameCopy = new Chess(prevGame.fen());
          const moveResult = gameCopy.move({
            from,
            to,
            promotion: promotion || 'q',
          });

          if (moveResult) {
            setFen(gameCopy.fen());
            setIsWhiteTurn(newTurn);
            setMoveHistory((prev) => [...prev, moveResult.san]);
            addMessage('system', `Opponent moved ${moveResult.san}`);

            if (gameOverData) {
              console.log(gameOverData);
              console.log('another: ', playerColor);
              handleGameOver(gameOverData);
            }
          }

          return gameCopy;
        });
      }
    );

    socket.on(
      'moveSuccess',
      ({
        from,
        to,
        promotion,
        isWhiteTurn: newTurn,
        fen: newFen,
        gameOver: gameOverData,
      }) => {
        setGame((prevGame) => {
          const gameCopy = new Chess(prevGame.fen());
          const moveResult = gameCopy.move({
            from,
            to,
            promotion: promotion || 'q',
          });

          if (moveResult) {
            setFen(gameCopy.fen());
            setIsWhiteTurn(newTurn);
            setMoveHistory((prev) => [...prev, moveResult.san]);
            addMessage('system', `You moved ${moveResult.san}`);

            if (gameOverData) {
              handleGameOver(gameOverData);
            }
          }

          return gameCopy;
        });
      }
    );

    socket.on('gameOver', ({ winner, reason }) => {
      handleGameOver({ winner, reason });
    });

    socket.on('error', (message) => {
      addMessage('system', `Error: ${message}`);
    });

    socket.on('chat', ({ sender, message }) => {
      addMessage(sender, message);
    });

    socket.on('disconnect', () => {
      addMessage(
        'system',
        'Disconnected from server. Please refresh the page.'
      );
      setGameState('idle');
      setGameOver(true);
    });

    return () => {
      socket.off('matchFound');
      socket.off('opponentMove');
      socket.off('moveSuccess');
      socket.off('gameOver');
      socket.off('error');
      socket.off('chat');
      socket.off('disconnect');
    };
  }, [socket]);

  const handleGameOver = async (gameOverData) => {
    try {
      console.log('Game Over Data:', gameOverData);
      console.log('Current User:', currentUser?.email);

      // Get player color from cookie as backup
      const storedPlayerColor = Cookies.get('playerColor');
      const finalPlayerColor = playerColor || storedPlayerColor;

      console.log('Player Color (from state):', playerColor);
      console.log('Player Color (from cookie):', storedPlayerColor);
      console.log('Final Player Color used:', finalPlayerColor);
      console.log('Winner Color from Server:', gameOverData.winnerColor);

      setGameOver(true);
      setGameState('idle');
      setShowGameOverModal(true);

      if (!finalPlayerColor) {
        console.error('Could not determine player color');
        return;
      }

      let points = 0;
      let gameOverMessage = '';

      if (gameOverData.reason === 'checkmate') {
        if (gameOverData.winnerColor === finalPlayerColor) {
          points = POINTS_CONFIG.WIN;
          gameOverMessage = '🏆 Congratulations! You win by checkmate!';
        } else {
          points = -POINTS_CONFIG.WIN;
          gameOverMessage = '❌ Checkmate! Your opponent wins.';
        }
      } else if (
        gameOverData.reason === 'draw' ||
        gameOverData.reason === 'stalemate'
      ) {
        points = POINTS_CONFIG.DRAW;
        gameOverMessage = '🤝 Game ended in a draw.';
      } else if (gameOverData.reason === 'resign') {
        if (gameOverData.winnerColor === finalPlayerColor) {
          points = POINTS_CONFIG.WIN;
          gameOverMessage = '🏆 Your opponent resigned. You win!';
        } else {
          points = POINTS_CONFIG.RESIGN;
          gameOverMessage = '❌ You resigned. Game over.';
        }
      }

      console.log('Points calculation:', {
        finalPlayerColor,
        winnerColor: gameOverData.winnerColor,
        points,
        reason: gameOverData.reason,
      });

      setGameOverMessage(gameOverMessage);
      addMessage('system', gameOverMessage);

      if (currentUser?.email) {
        console.log(
          'Updating points for user:',
          currentUser.email,
          'Points:',
          points
        );
        await updatePlayerPoints(currentUser.email, points);
      }

      // Clear the player color cookie after game ends
      clearPlayerColorCookie();
    } catch (error) {
      console.error('Error in handleGameOver:', error);
    }
  };

  const addMessage = useCallback((sender, text) => {
    setMessages((prev) => [
      ...prev,
      {
        sender,
        text,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const handleMove = useCallback(
    (sourceSquare, targetSquare) => {
      // Check if game is active
      if (gameOver || gameState !== 'playing') {
        console.log('Game is not in playing state');
        return false;
      }

      // Verify it's the player's turn
      const isPlayersTurn =
        (isWhiteTurn && playerColor === 'white') ||
        (!isWhiteTurn && playerColor === 'black');

      if (!isPlayersTurn) {
        addMessage('system', "It's not your turn!");
        return false;
      }

      try {
        const move = {
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q',
        };

        // Validate move locally
        const testGame = new Chess(game.fen());
        const isValidMove = testGame.move(move);

        if (!isValidMove) {
          console.log('Invalid move attempted');
          addMessage('system', 'Invalid move attempted.');
          return false;
        }

        // Check game ending conditions
        const gameEndInfo = {
          isCheckmate: testGame.isCheckmate(),
          isStalemate: testGame.isStalemate(),
          isDraw: testGame.isDraw(),
          isInsufficientMaterial: testGame.isInsufficientMaterial(),
          isThreefoldRepetition: testGame.isThreefoldRepetition(),
          isInCheck: testGame.isCheck(),
          turn: testGame.turn(), // 'w' for white, 'b' for black
          winnerColor: testGame.isCheckmate()
            ? testGame.turn() === 'w'
              ? 'black'
              : 'white' // If it's white's turn and checkmate, black won
            : null,
        };

        // Create move info for server
        const moveInfo = {
          room: roomId,
          ...move,
          gameEndInfo,
          fen: testGame.fen(),
          pgn: testGame.pgn(),
          moveNumber: Math.floor((testGame.moveNumber() + 1) / 2),
          lastMove: {
            from: sourceSquare,
            to: targetSquare,
            piece: game.get(sourceSquare).type,
            color: game.get(sourceSquare).color,
            isCapture: testGame.history({ verbose: true }).slice(-1)[0].captured
              ? true
              : false,
          },
        };

        // Send move to server
        socket.emit('move', moveInfo);

        return true;
      } catch (error) {
        console.error('Error in handleMove:', error);
        addMessage('system', 'An error occurred while making the move.');
        return false;
      }
    },
    [
      game,
      gameOver,
      gameState,
      isWhiteTurn,
      playerColor,
      roomId,
      socket,
      addMessage,
    ]
  );

  const startMatchmaking = useCallback(() => {
    if (socket && gameState === 'idle') {
      socket.emit('findMatch');
      setGameState('searching');
      addMessage('system', 'Searching for opponent...');
      setMessages([]);
      setGame(new Chess());
      setFen('start');
      setMoveHistory([]);
      setPlayerColor(null);
      setRoomId(null);
      setGameOver(false);
      clearPlayerColorCookie(); // Clear any existing player color

      setGameOverMessage('');
    }
  }, [socket, gameState, addMessage]);

  const handleResign = useCallback(() => {
    if (gameState === 'playing' && socket && roomId) {
      socket.emit('resign', { room: roomId });
      addMessage('system', 'You resigned. Game over.');
      setGameOver(true);
      setGameState('idle');
      setGameOverMessage('You resigned!');
    }
  }, [gameState, socket, roomId, addMessage]);

  const handleSendMessage = useCallback(
    (e) => {
      e.preventDefault();
      const input = e.target.elements.input;
      const message = input.value.trim();

      if (message && socket && roomId) {
        socket.emit('chat', { room: roomId, message });
        addMessage('you', message);
        input.value = '';
      }
    },
    [socket, roomId, addMessage]
  );
  useEffect(() => {
    return () => {
      clearPlayerColorCookie();
    };
  }, []);
  if (loading)
    return <p>Loading...</p>; // Display loading message while checking auth
  else
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6'>
        <div className='max-w-[1600px] mx-auto bg-white rounded-2xl shadow-2xl border border-gray-100'>
          <div className='flex gap-6 p-8'>
            {/* Game Info Column */}
            <div className='w-64 shrink-0 space-y-6'>
              {/* Game Status Card */}
              <div className='bg-white p-5 rounded-xl border border-gray-100 shadow-sm'>
                <div className='flex items-center gap-2 mb-4'>
                  <Clock className='w-5 h-5 text-indigo-600' />
                  <h2 className='text-lg font-bold text-gray-800'>
                    Game Status
                  </h2>
                </div>

                {gameState === 'playing' && (
                  <div className='mb-4 bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl'>
                    <span className='block mb-2 font-semibold text-gray-700'>
                      Playing as:
                    </span>
                    <div
                      className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg ${
                        playerColor === 'white'
                          ? 'bg-white text-gray-800 border-2 border-gray-200'
                          : 'bg-gray-800 text-white'
                      }`}
                    >
                      <Crown className='w-4 h-4' />
                      <span className='font-medium'>{playerColor}</span>
                    </div>
                  </div>
                )}

                <div className='bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl'>
                  <span className='block mb-2 font-semibold text-gray-700'>
                    Current Turn:
                  </span>
                  <div
                    className={`text-center py-2 px-4 rounded-lg font-medium ${
                      isWhiteTurn
                        ? 'bg-white text-gray-800 border-2 border-gray-200'
                        : 'bg-gray-800 text-white'
                    }`}
                  >
                    {isWhiteTurn ? "White's move" : "Black's move"}
                  </div>
                </div>
              </div>

              {/* Move History Card */}
              <div className='bg-white p-5 rounded-xl border border-gray-100 shadow-sm'>
                <div className='flex items-center gap-2 mb-4'>
                  <Trophy className='w-5 h-5 text-amber-500' />
                  <h2 className='text-lg font-bold text-gray-800'>
                    Move History
                  </h2>
                </div>
                <div className='bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-xl'>
                  <div className='max-h-48 overflow-y-auto custom-scrollbar'>
                    <div className='grid grid-cols-2 gap-2'>
                      {moveHistory.map((move, index) => (
                        <div
                          key={index}
                          className='flex items-center gap-2 text-sm py-2 px-3 bg-white rounded-lg border border-amber-100'
                        >
                          <span className='font-medium text-amber-600'>
                            {index + 1}.
                          </span>
                          <span className='text-gray-700'>{move}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className='space-y-3'>
                {gameState === 'idle' && (
                  <button
                    onClick={startMatchmaking}
                    className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl hover:from-emerald-600 hover:to-green-600 transition-all duration-200 shadow-sm hover:shadow-md font-medium'
                  >
                    <Users className='w-5 h-5' />
                    Find Match
                  </button>
                )}
                {gameState === 'searching' && (
                  <button
                    disabled
                    className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-white rounded-xl font-medium animate-pulse'
                  >
                    <div className='flex items-center gap-2'>
                      Searching
                      <span className='inline-block'>
                        <span className='animate-bounce'>.</span>
                        <span className='animate-bounce delay-100'>.</span>
                        <span className='animate-bounce delay-200'>.</span>
                      </span>
                    </div>
                  </button>
                )}
                {gameState === 'playing' && (
                  <button
                    onClick={handleResign}
                    className='w-full px-4 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 transition-all duration-200 shadow-sm hover:shadow-md font-medium'
                  >
                    Resign Game
                  </button>
                )}
              </div>
            </div>

            {/* Main Game Area - Flexbox for Board and Chat side by side */}
            <div className='flex-1 flex gap-6'>
              {/* Chessboard Column */}
              <div className='flex-1'>
                {gameOverMessage && (
                  <div className='mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-indigo-500 rounded-xl shadow-sm'>
                    <p className='text-indigo-700 font-medium text-lg'>
                      {gameOverMessage}
                    </p>
                  </div>
                )}

                <div className='flex justify-center items-start bg-white p-6 rounded-xl border border-gray-100 shadow-lg'>
                  <Chessboard
                    position={fen}
                    onDrop={({ sourceSquare, targetSquare }) =>
                      handleMove(sourceSquare, targetSquare)
                    }
                    orientation={playerColor || 'white'}
                    draggable={
                      !gameOver &&
                      gameState === 'playing' &&
                      ((isWhiteTurn && playerColor === 'white') ||
                        (!isWhiteTurn && playerColor === 'black'))
                    }
                    boardStyle={{
                      borderRadius: '12px',
                      boxShadow:
                        '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    }}
                    width={520}
                    lightSquareStyle={{ backgroundColor: '#f8fafc' }}
                    darkSquareStyle={{ backgroundColor: '#cbd5e1' }}
                  />
                </div>
              </div>

              {/* Chat Column - Now beside the board */}
              <div className='w-96 shrink-0'>
                <div className='bg-white rounded-xl border border-gray-100 shadow-sm h-full'>
                  <div className='p-5 border-b border-gray-100'>
                    <div className='flex items-center gap-2'>
                      <MessageCircle className='w-5 h-5 text-indigo-600' />
                      <h2 className='text-lg font-bold text-gray-800'>
                        Game Chat
                      </h2>
                    </div>
                  </div>

                  <div className='h-[600px] flex flex-col p-5'>
                    <div className='flex-1 overflow-y-auto custom-scrollbar mb-4 space-y-3'>
                      {messages.map((msg, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-xl ${
                            msg.sender === 'system'
                              ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700'
                              : msg.sender === 'you'
                              ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 ml-auto'
                              : 'bg-gradient-to-r from-gray-50 to-slate-50 text-gray-700'
                          } max-w-[85%] ${
                            msg.sender === 'you' ? 'ml-auto' : ''
                          }`}
                        >
                          <div className='text-sm font-semibold mb-1 flex items-center gap-2'>
                            {msg.sender === 'system' ? '💻 System' : msg.sender}
                          </div>
                          <div className='break-words'>{msg.text}</div>
                          <div className='text-xs opacity-75 mt-1'>
                            {msg.timestamp}
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSendMessage} className='flex gap-2'>
                      <input
                        type='text'
                        id='input'
                        className='flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200'
                        placeholder={
                          gameState === 'playing'
                            ? 'Type a message...'
                            : 'Join a game to chat...'
                        }
                        disabled={gameState !== 'playing'}
                        autoComplete='off'
                      />
                      <button
                        type='submit'
                        className='px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl hover:from-indigo-600 hover:to-blue-600 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed'
                        disabled={gameState !== 'playing'}
                      >
                        <Send className='w-5 h-5' />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {showGameOverModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75'>
            <div className='bg-white rounded-lg p-8 shadow-lg'>
              <h2 className='text-2xl font-bold mb-4'>
                {console.log(gameOverMessage)}
              </h2>
              <button
                onClick={() => setShowGameOverModal(false)}
                className='bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded'
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
}
