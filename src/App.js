// This is your main App.js file
import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Our tool for making API calls
import './App.css';

// --- Our API's "address" ---
// This tells React to talk to our backend server on port 3001
const API_URL = 'http://localhost:3001/api';

// ##############################################
// ##          CUSTOMER VIEW COMPONENT         ##
// ##############################################
function CustomerView() {
  // --- State Variables ---
  // These are React's "memory"
  const [barbers, setBarbers] = useState([]); // A list of barbers
  const [selectedBarber, setSelectedBarber] = useState(''); // Which barber the user clicked
  const [customerName, setCustomerName] = useState(''); // The name from the input box
  const [customerPhone, setCustomerPhone] = useState(''); // The phone from the input box
  const [message, setMessage] = useState(''); // A success/error message

  // --- Data Fetching ---
  // This "effect" runs once when the component first loads
  useEffect(() => {
    // Define the async function to fetch barbers
    const loadBarbers = async () => {
      try {
        // Talk to our backend's ENDPOINT 1
        const response = await axios.get(`${API_URL}/barbers`);
        setBarbers(response.data); // Store the barbers in our "memory"
      } catch (error) {
        console.error('Failed to fetch barbers:', error);
      }
    };
    
    loadBarbers(); // Call the function
  }, []); // The empty array [] means "only run this once"

  // --- Event Handlers ---
  // This function runs when the "Join Queue" button is clicked
  const handleJoinQueue = async (e) => {
    e.preventDefault(); // Stop the form from reloading the page
    
    if (!customerName || !selectedBarber) {
      setMessage('Please enter your name and select a barber.');
      return;
    }

    try {
      // Talk to our backend's ENDPOINT 2
      await axios.post(`${API_URL}/queue`, {
        customer_name: customerName,
        customer_phone: customerPhone,
        barber_id: selectedBarber
      });

      setMessage(`Success! You've been added to the queue for Barber ID ${selectedBarber}.`);
      // Clear the form
      setCustomerName('');
      setCustomerPhone('');
      setSelectedBarber('');

    } catch (error) {
      console.error('Failed to join queue:', error);
      setMessage('Something went wrong. Please try again.');
    }
  };

  // --- JSX (The HTML part) ---
  return (
    <div className="card">
      <h2>Join the Queue</h2>
      <form onSubmit={handleJoinQueue}>
        <div className="form-group">
          <label>Your Name:</label>
          <input 
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Your Phone (for SMS):</label>
          <input 
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Select a Barber:</label>
          <select 
            value={selectedBarber} 
            onChange={(e) => setSelectedBarber(e.target.value)}
          >
            <option value="">-- Choose a barber --</option>
            {barbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.full_name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Join Queue</button>
      </form>
      {message && <p className="message">{message}</p>}
    </div>
  );
}

// ##############################################
// ##         BARBER DASHBOARD COMPONENT       ##
// ##############################################
function BarberDashboard() {
  // --- State Variables ---
  const [myQueue, setMyQueue] = useState([]); // The list of waiting customers
  
  // !!! --- SIMPLIFICATION FOR PHASE 1 --- !!!
  // We are "hardcoding" the barber's ID to 1 (for John Cuts).
  // In a real app, this would come from a Login system.
  const MY_BARBER_ID = 2; 

  // --- Data Fetching ---
  const fetchQueue = async () => {
    try {
      // Talk to our backend's ENDPOINT 3
      const response = await axios.get(`${API_URL}/queue/${MY_BARBER_ID}`);
      setMyQueue(response.data); // Store the queue in "memory"
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    }
  };

  // This effect runs when the component loads
  useEffect(() => {
    fetchQueue(); 
  }, []);

  // --- Event Handlers ---
  const handleNextCustomer = async () => {
    // Find the first customer in the list
    const nextCustomer = myQueue[0];
    if (!nextCustomer) {
      alert('Queue is empty!');
      return;
    }

    try {
      // Talk to our backend's ENDPOINT 4
      await axios.put(`${API_URL}/queue/next`, {
        queue_id: nextCustomer.id
      });
      
      // After successfully updating, refresh the queue list
      fetchQueue(); 
      alert(`Bringing up ${nextCustomer.customer_name}!`);

    } catch (error) {
      console.error('Failed to update customer:', error);
    }
  };

  // --- JSX (The HTML part) ---
  return (
    <div className="card">
      {/* We'll pretend this is for "John Cuts" (ID 1) */}
      <h2>My Queue (Barber: John Cuts)</h2>
      
      <button onClick={handleNextCustomer} className="next-button">
        Next Customer
      </button>

      <ul className="queue-list">
        {myQueue.length === 0 ? (
          <li>Your queue is empty.</li>
        ) : (
          myQueue.map((customer) => (
            <li key={customer.id}>
              <strong>{customer.customer_name}</strong> ({customer.customer_phone})
            </li>
          ))
        )}
      </ul>
    </div>
  );
}


// ##############################################
// ##           THE MAIN APP PAGE              ##
// ##############################################
// This just holds our two components side-by-side
function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to Dash-Q!</h1>
      </header>
      <div className="container">
        <CustomerView />
        <BarberDashboard />
      </div>
    </div>
  );
}

export default App;