import React, { useState, useEffect, useCallback } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';
import { io } from 'socket.io-client';
import {
  MessageCircle,
  Send,
  Trophy,
  Users,
  Clock,
  ArrowRight,
  Crown,
} from 'lucide-react';

export default function GameScreen() {
  const [socket, setSocket] = useState(null);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('start');
  const [isWhiteTurn, setIsWhiteTurn] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameState, setGameState] = useState('idle'); // idle, searching, playing
  const [playerColor, setPlayerColor] = useState(null);
  const [roomId, setRoomId] = useState(null);

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
      setPlayerColor(color);
      setRoomId(room);
      setGameState('playing');
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

  const handleGameOver = ({ winner, reason }) => {
    setGameOver(true);
    setGameState('idle');

    let message = '';
    if (reason === 'checkmate') {
      message =
        winner === socket?.id
          ? 'You won by checkmate!'
          : 'You lost by checkmate!';
    } else if (reason === 'draw') {
      message = 'Game ended in a draw!';
    } else if (reason === 'resignation') {
      message =
        winner === socket?.id
          ? 'You won by resignation!'
          : 'Opponent resigned!';
    } else if (reason === 'disconnect') {
      message =
        winner === socket?.id
          ? 'You won by disconnection!'
          : 'Opponent disconnected!';
    }

    setGameOverMessage(message);
    addMessage('system', message);
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
      if (gameOver || gameState !== 'playing') return false;

      const isPlayersTurn =
        (isWhiteTurn && playerColor === 'white') ||
        (!isWhiteTurn && playerColor === 'black');

      if (!isPlayersTurn) {
        addMessage('system', "It's not your turn!");
        return false;
      }

      // Check if move is valid
      const move = {
        from: sourceSquare,
        to: targetSquare,
      };

      // Handle pawn promotion
      const piece = game.get(sourceSquare);
      if (
        piece &&
        piece.type === 'p' &&
        (targetSquare[1] === '8' || targetSquare[1] === '1')
      ) {
        move.promotion = 'q'; // Default to queen promotion
      }

      // Validate move locally first
      const testGame = new Chess(game.fen());
      const isValidMove = testGame.move(move);

      if (!isValidMove) {
        addMessage('system', 'Invalid move attempted.');
        return false;
      }

      // Send move to server
      socket.emit('move', { room: roomId, ...move });
      return true;
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
                <h2 className='text-lg font-bold text-gray-800'>Game Status</h2>
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
                        } max-w-[85%] ${msg.sender === 'you' ? 'ml-auto' : ''}`}
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
    </div>
  );
}
