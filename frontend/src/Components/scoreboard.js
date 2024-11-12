import React, { useState, useEffect } from 'react';
import { db } from './config'; // Import your Firebase configuration
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

const Scoreboard = () => {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        const playersRef = collection(db, 'users');
        const q = query(playersRef, orderBy('points', 'desc'));
        const querySnapshot = await getDocs(q);

        const playerData = [];
        querySnapshot.forEach((doc) => {
          playerData.push({ id: doc.id, ...doc.data() });
        });

        setPlayers(playerData);
      } catch (error) {
        console.error('Error fetching player data:', error);
      }
    };

    fetchPlayerData();
  }, []);

  return (
    <div>
      <h2>Scoreboard</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Username</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr key={player.id}>
              <td>{index + 1}</td>
              <td>{player.username}</td>
              <td>{player.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Scoreboard;
