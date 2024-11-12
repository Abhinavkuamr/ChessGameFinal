const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js'); // Add this dependency
const cors = require('cors');

const app = express();
app.use(cors());
const httpServer = createServer(app);

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000, // Increase ping timeout to handle longer operations
});

// Game state management
let waitingPlayers = [];
const activeGames = new Map();

// Utility function to get opponent's socket ID
const getOpponentId = (game, playerId) => {
  return playerId === game.white ? game.black : game.white;
};

// Handle player disconnection
const handlePlayerDisconnection = (socket, reason = 'disconnected') => {
  // Remove from waiting players if they were searching
  waitingPlayers = waitingPlayers.filter((id) => id !== socket.id);

  // Handle active games
  for (const [room, game] of activeGames.entries()) {
    if (game.white === socket.id || game.black === socket.id) {
      const winner = socket.id === game.white ? game.black : game.white;

      // Notify the opponent about the disconnection
      socket.to(room).emit('gameOver', {
        winner,
        reason: `Opponent ${reason}`,
        winnerColor: socket.id === game.white ? 'black' : 'white',
      });

      // Clean up the game
      activeGames.delete(room);

      // Log the game end
      console.log(`Game in room ${room} ended due to player disconnection`);
    }
  }
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle find match request
  socket.on('findMatch', () => {
    console.log('Player searching for match:', socket.id);

    // Remove player from any existing waiting list
    waitingPlayers = waitingPlayers.filter((id) => id !== socket.id);

    // Check if there's a waiting player
    if (waitingPlayers.length === 0) {
      waitingPlayers.push(socket.id);
      socket.emit('searchingMatch');
    } else {
      const opponent = waitingPlayers.shift();
      const room = `game-${Date.now()}`;

      // Initialize game state
      const gameState = new Chess();

      // Create game session with detailed information
      activeGames.set(room, {
        white: opponent,
        black: socket.id,
        moves: [],
        gameState: gameState.fen(),
        startTime: Date.now(),
        lastMoveTime: Date.now(),
        pgn: gameState.pgn(),
      });

      // Join both players to the room
      socket.join(room);
      io.sockets.sockets.get(opponent)?.join(room);

      // Notify players of their colors and game start
      io.to(opponent).emit('matchFound', {
        color: 'white',
        room,
        initialFen: gameState.fen(),
      });

      socket.emit('matchFound', {
        color: 'black',
        room,
        initialFen: gameState.fen(),
      });

      console.log(
        `Match created in room ${room}: White - ${opponent}, Black - ${socket.id}`
      );
    }
  });

  // Handle move
  socket.on(
    'move',
    ({ room, from, to, promotion, gameEndInfo, fen, pgn, lastMove }) => {
      console.log('Move received:', { room, from, to });

      // Validate room exists
      if (!activeGames.has(room)) {
        console.log('Room not found:', room);
        socket.emit('error', 'Game not found');
        return;
      }

      const game = activeGames.get(room);

      // Validate player's turn
      const isWhiteMove = game.moves.length % 2 === 0;
      const isCorrectPlayer =
        (isWhiteMove && socket.id === game.white) ||
        (!isWhiteMove && socket.id === game.black);

      if (!isCorrectPlayer) {
        console.log('Wrong player tried to move');
        socket.emit('error', "It's not your turn");
        return;
      }

      try {
        // Validate move using chess.js
        const chessGame = new Chess(game.gameState);
        const moveResult = chessGame.move({
          from,
          to,
          promotion: promotion || 'q',
        });

        if (!moveResult) {
          socket.emit('error', 'Invalid move');
          return;
        }

        // Update game state
        game.moves.push({ from, to, promotion });
        game.gameState = chessGame.fen();
        game.pgn = chessGame.pgn();
        game.lastMoveTime = Date.now();

        const isWhiteTurn = game.moves.length % 2 === 0;

        // Prepare game over state if any
        let gameOver = null;
        if (gameEndInfo.isCheckmate) {
          gameOver = {
            winner: !isWhiteTurn ? 'white' : 'black',
            reason: 'checkmate',
            winnerColor: !isWhiteTurn ? 'white' : 'black',
          };
        } else if (gameEndInfo.isStalemate) {
          gameOver = {
            winner: 'draw',
            reason: 'stalemate',
          };
        } else if (gameEndInfo.isDraw) {
          gameOver = {
            winner: 'draw',
            reason: 'draw',
          };
        } else if (gameEndInfo.isInsufficientMaterial) {
          gameOver = {
            winner: 'draw',
            reason: 'insufficient material',
          };
        } else if (gameEndInfo.isThreefoldRepetition) {
          gameOver = {
            winner: 'draw',
            reason: 'threefold repetition',
          };
        }

        // Prepare move data to send to both players
        const moveData = {
          from,
          to,
          promotion,
          isWhiteTurn,
          fen: game.gameState,
          pgn: game.pgn,
          lastMove,
          gameOver,
          isCheck: gameEndInfo.isInCheck,
        };

        // Send move to opponent
        socket.to(room).emit('opponentMove', moveData);

        // Confirm move to current player
        socket.emit('moveSuccess', moveData);

        // If game is over, clean up
        if (gameOver) {
          console.log(`Game over in room ${room}: ${gameOver.reason}`);
          activeGames.delete(room);
        }
      } catch (error) {
        console.error('Error processing move:', error);
        socket.emit('error', 'Error processing move');
      }
    }
  );

  // Handle chat messages
  socket.on('chat', ({ room, message }) => {
    if (!activeGames.has(room)) {
      socket.emit('error', 'Game not found');
      return;
    }

    // Sanitize message (you might want to add more thorough sanitization)
    const sanitizedMessage = message.slice(0, 500); // Limit message length

    socket.to(room).emit('chat', {
      sender: 'opponent',
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle resign
  socket.on('resign', ({ room }) => {
    if (!activeGames.has(room)) {
      socket.emit('error', 'Game not found');
      return;
    }

    const game = activeGames.get(room);
    const winner = socket.id === game.white ? game.black : game.white;
    const winnerColor = socket.id === game.white ? 'black' : 'white';

    // Notify both players
    io.to(room).emit('gameOver', {
      winner,
      reason: 'resignation',
      winnerColor,
    });

    // Clean up game
    activeGames.delete(room);
    console.log(`Game in room ${room} ended due to resignation`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    handlePlayerDisconnection(socket);
  });
});

// Error handling for the server
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
