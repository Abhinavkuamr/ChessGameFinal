const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

let waitingPlayers = [];
const activeGames = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('findMatch', () => {
    console.log('Player searching for match:', socket.id);
    // Remove player from waiting list if they're already there
    waitingPlayers = waitingPlayers.filter((id) => id !== socket.id);
    if (waitingPlayers.length === 0) {
      waitingPlayers.push(socket.id);
      socket.emit('searchingMatch');
    } else {
      const opponent = waitingPlayers.shift();
      const room = `game-${Date.now()}`;
      // Create game session
      activeGames.set(room, {
        white: opponent,
        black: socket.id,
        moves: [],
      });
      // Join both players to the room
      socket.join(room);
      io.sockets.sockets.get(opponent)?.join(room);
      // Notify players of their colors
      io.to(opponent).emit('matchFound', { color: 'white', room });
      socket.emit('matchFound', { color: 'black', room });
    }
  });

  socket.on('move', ({ room, from, to }) => {
    console.log('Move received:', { room, from, to });
    if (!activeGames.has(room)) {
      console.log('Room not found:', room);
      return;
    }
    const game = activeGames.get(room);
    // Verify it's the correct player's turn
    const isWhiteMove = game.moves.length % 2 === 0;
    const isCorrectPlayer =
      (isWhiteMove && socket.id === game.white) ||
      (!isWhiteMove && socket.id === game.black);
    if (!isCorrectPlayer) {
      console.log('Wrong player tried to move');
      socket.emit('invalidMove', "It's not your turn.");
      return;
    }
    // Update the game state
    game.moves.push({ from, to });

    // Broadcast the move to the other player
    const isWhiteTurn = game.moves.length % 2 === 0;
    socket.to(room).emit('opponentMove', {
      from,
      to,
      isWhiteTurn,
    });
    // Notify the current player that the move was successful
    socket.emit('moveSuccess', {
      from,
      to,
      isWhiteTurn,
    });
  });

  socket.on('chat', ({ room, message }) => {
    if (!activeGames.has(room)) return;
    socket.to(room).emit('chat', {
      sender: 'opponent',
      message,
    });
  });

  socket.on('resign', ({ room }) => {
    if (!activeGames.has(room)) return;
    const game = activeGames.get(room);
    const winner = socket.id === game.white ? game.black : game.white;
    socket.to(room).emit('gameOver', { winner });
    activeGames.delete(room);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove from waiting players
    waitingPlayers = waitingPlayers.filter((id) => id !== socket.id);
    // Handle disconnection from active games
    for (const [room, game] of activeGames.entries()) {
      if (game.white === socket.id || game.black === socket.id) {
        const winner = socket.id === game.white ? game.black : game.white;
        socket.to(room).emit('gameOver', { winner });
        activeGames.delete(room);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
