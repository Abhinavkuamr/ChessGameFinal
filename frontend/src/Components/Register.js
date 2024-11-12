import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if email, password, and username are provided
    if (!email || !password || !username) {
      setError('Please enter email, password, and username');
      return;
    }

    setLoading(true);

    try {
      // Create user with email and password using Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Check if the username already exists in Firestore
      const userDocRef = doc(db, 'users', email);
      const docSnapshot = await getDoc(userDocRef);

      if (docSnapshot.exists()) {
        // If the document already exists, set an error
        setError('Username already taken, please choose another one');
        setLoading(false);
        return;
      }

      // Create a new document with the username as the document ID if it doesn't exist
      await setDoc(userDocRef, {
        email: user.email,
        points: 0,
        username: username,
      });

      // If successful, clear form and reset error state
      setEmail('');
      setPassword('');
      setUsername('');
      setError('');
      alert('Registration successful!');

      // Navigate to the user page after registration
      navigate('/user');
    } catch (error) {
      // Handle any errors that occur during registration
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email: </label>
          <input
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password: </label>
          <input
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Username: </label>
          <input
            type='text'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <button type='submit' disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </div>
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </form>
    </div>
  );
};

export default Register;
