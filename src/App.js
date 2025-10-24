// This is your new App.js file for Phase 2
import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Our tool for making API calls
import './App.css';

// --- Our API's "address" ---
// !!! --- IMPORTANT --- !!!
// Change this to your Render URL when deploying!
// const API_URL = 'https://dash-q-backend.onrender.com/api';
const API_URL = 'http://localhost:3001/api'; // For local testing


// ##############################################
// ##          CUSTOMER VIEW COMPONENT         ##
// ##############################################
// (This component is exactly the same as before)
function CustomerView() {
  const [barbers, setBarbers] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadBarbers = async () => {
      try {
        const response = await axios.get(`${API_URL}/barbers`);
        setBarbers(response.data);
      } catch (error) {
        console.error('Failed to fetch barbers:', error);
      }
    };
    loadBarbers();
  }, []);

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!customerName || !selectedBarber) {
      setMessage('Please enter your name and select a barber.');
      return;
    }
    try {
      await axios.post(`${API_URL}/queue`, {
        customer_name: customerName,
        customer_phone: customerPhone,
        barber_id: selectedBarber
      });
      // We'll use the barber's name in the success message
      const barberName = barbers.find(b => b.id === parseInt(selectedBarber)).full_name;
      setMessage(`Success! You've been added to the queue for ${barberName}.`);
      setCustomerName('');
      setCustomerPhone('');
      setSelectedBarber('');
    } catch (error) {
      console.error('Failed to join queue:', error);
      setMessage('Something went wrong. Please try again.');
    }
  };

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
// --- !!! THIS COMPONENT HAS BEEN UPDATED !!! ---
function BarberDashboard({ onCutComplete }) { // We pass in a new "prop"
  const [myQueue, setMyQueue] = useState([]);
  const [inProgressCustomer, setInProgressCustomer] = useState(null);

  // !!! --- SIMPLIFICATION FOR PHASE 1 --- !!!
  const MY_BARBER_ID = 1; // We're still "John Cuts" / "Pareng Jo"
  const MY_BARBER_NAME = "Pareng Jo"; // Hardcode name for the title

  // --- Data Fetching ---
  const fetchQueue = async () => {
    try {
      // Get "Waiting" customers
      const queueRes = await axios.get(`${API_URL}/queue/${MY_BARBER_ID}`);
      setMyQueue(queueRes.data);

      // --- NEW ---
      // Check for an "In Progress" customer
      // (This is not efficient, but it's simple for Phase 2)
      const { data: allEntries } = await supabase
        .from('queue_entries')
        .select('*')
        .eq('barber_id', MY_BARBER_ID)
        .eq('status', 'In Progress')
        .limit(1); // Should only ever be one

      if (allEntries.length > 0) {
        setInProgressCustomer(allEntries[0]);
      } else {
        setInProgressCustomer(null);
      }

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
      // Refresh the queue
      fetchQueue();
    } catch (error) {
      console.error('Failed to update customer:', error);
    }
  };

  // --- NEW ---
  const handleCompleteCut = async () => {
    if (!inProgressCustomer) return;

    // Ask the barber for the price
    const price = prompt('Enter the price for this service:');
    if (!price || isNaN(price)) {
      alert('Invalid price. Please enter a number.');
      return;
    }

    try {
      // Talk to our new ENDPOINT 5
      await axios.post(`${API_URL}/queue/complete`, {
        queue_id: inProgressCustomer.id,
        barber_id: MY_BARBER_ID,
        price: parseInt(price)
      });
      
      // Tell the AnalyticsDashboard to refresh!
      onCutComplete(); 
      
      // Refresh our own queue
      fetchQueue();

    } catch (error) {
      console.error('Failed to complete cut:', error);
    }
  };
  
  // --- NEW ---
  // The logic for what button to show
  const getActionButton = () => {
    if (inProgressCustomer) {
      // If someone is in the chair, show the "Complete" button
      return (
        <button onClick={handleCompleteCut} className="complete-button">
          Complete Cut for {inProgressCustomer.customer_name}
        </button>
      );
    } else {
      // If the chair is empty, show the "Next" button
      return (
        <button onClick={handleNextCustomer} className="next-button">
          Next Customer
        </button>
      );
    }
  };

  // --- JSX (The HTML part) ---
  return (
    <div className="card">
      <h2>My Queue ({MY_BARBER_NAME})</h2>
      
      {getActionButton()}

      {/* --- NEW: Show "In Progress" customer --- */}
      <h3 className="queue-subtitle">In the Chair</h3>
      {inProgressCustomer ? (
        <ul className="queue-list"><li className="in-progress">
          <strong>{inProgressCustomer.customer_name}</strong>
        </li></ul>
      ) : (
        <p className="empty-text">Chair is empty</p>
      )}

      <h3 className="queue-subtitle">Waiting</h3>
      <ul className="queue-list">
        {myQueue.length === 0 ? (
          <li className="empty-text">Your queue is empty.</li>
        ) : (
          myQueue.map((customer) => (
            <li key={customer.id}>
              {customer.customer_name}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}


// ##############################################
// ##       ANALYTICS DASHBOARD COMPONENT      ##
// ##############################################
// --- !!! THIS COMPONENT IS ALL NEW !!! ---
function AnalyticsDashboard({ refreshSignal }) {
  const [analytics, setAnalytics] = useState({ total_earnings: 0, total_cuts: 0 });
  
  const MY_BARBER_ID = 1; // Still "Pareng Jo"

  const fetchAnalytics = async () => {
    try {
      // Talk to our new ENDPOINT 6
      const response = await axios.get(`${API_URL}/analytics/${MY_BARBER_ID}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  // This effect runs when the component loads
  // AND when the "refreshSignal" changes
  useEffect(() => {
    fetchAnalytics();
  }, [refreshSignal]); // The signal comes from the parent App

  return (
    <div className="card analytics-card">
      <h2>Today's Dashboard</h2>
      <div className="analytics-item">
        <span className="analytics-label">Total Earnings</span>
        <span className="analytics-value">${analytics.total_earnings}</span>
      </div>
      <div className="analytics-item">
        <span className="analytics-label">Total Cuts</span>
        <span className="analytics-value">{analytics.total_cuts}</span>
      </div>
      <button onClick={fetchAnalytics} className="refresh-button">Refresh</button>
    </div>
  );
}


// ##############################################
// ##           THE MAIN APP PAGE              ##
// ##############################################
// --- !!! THIS COMPONENT IS UPDATED !!! ---
function App() {
  // This "signal" state is used to tell the analytics
  // dashboard to refresh itself when a cut is completed.
  const [refreshSignal, setRefreshSignal] = useState(0);

  const handleCutComplete = () => {
    // Just change the value to trigger the effect
    setRefreshSignal(prev => prev + 1);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to Dash-Q!</h1>
      </header>
      <div className="container">
        <CustomerView />
        <BarberDashboard onCutComplete={handleCutComplete} />
        <AnalyticsDashboard refreshSignal={refreshSignal} />
      </div>
    </div>
  );
}

export default App;