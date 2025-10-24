// This is your new App.js file for Phase 2 (with Charts)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// --- NEW: Import Chart.js components ---
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

import './App.css';

// --- NEW: Register Chart.js components ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// --- Our API's "address" ---
const API_URL = 'https://dash-q-backend.onrender.com/api';
// const API_URL = 'http://localhost:3001/api'; // For local testing

// --- Create Supabase Client ---
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

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
// (This component is exactly the same as before)
function BarberDashboard({ onCutComplete }) {
  const [myQueue, setMyQueue] = useState([]);
  const [inProgressCustomer, setInProgressCustomer] = useState(null);

  const MY_BARBER_ID = 1; 
  const MY_BARBER_NAME = "Pareng Jo";

  const fetchQueue = async () => {
    try {
      // Get "Waiting" customers
      const queueRes = await axios.get(`${API_URL}/queue/${MY_BARBER_ID}`);
      setMyQueue(queueRes.data);

      // Check for an "In Progress" customer
      const { data: allEntries } = await supabase
        .from('queue_entries')
        .select('*')
        .eq('barber_id', MY_BARBER_ID)
        .eq('status', 'In Progress')
        .limit(1);

      if (allEntries.length > 0) {
        setInProgressCustomer(allEntries[0]);
      } else {
        setInProgressCustomer(null);
      }

    } catch (error) {
      console.error('Failed to fetch queue:', error);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleNextCustomer = async () => {
    const nextCustomer = myQueue[0];
    if (!nextCustomer) {
      alert('Queue is empty!');
      return;
    }

    try {
      await axios.put(`${API_URL}/queue/next`, {
        queue_id: nextCustomer.id
      });
      fetchQueue();
    } catch (error) {
      console.error('Failed to update customer:', error);
    }
  };

  const handleCompleteCut = async () => {
    if (!inProgressCustomer) return;

    const price = prompt('Enter the price for this service:');
    if (!price || isNaN(price)) {
      alert('Invalid price. Please enter a number.');
      return;
    }

    try {
      await axios.post(`${API_URL}/queue/complete`, {
        queue_id: inProgressCustomer.id,
        barber_id: MY_BARBER_ID,
        price: parseInt(price)
      });
      
      onCutComplete(); 
      fetchQueue();

    } catch (error) {
      console.error('Failed to complete cut:', error);
    }
  };
  
  const getActionButton = () => {
    if (inProgressCustomer) {
      return (
        <button onClick={handleCompleteCut} className="complete-button">
          Complete Cut for {inProgressCustomer.customer_name}
        </button>
      );
    } else {
      return (
        <button onClick={handleNextCustomer} className="next-button">
          Next Customer
        </button>
      );
    }
  };

  return (
    <div className="card">
      <h2>My Queue ({MY_BARBER_NAME})</h2>
      
      {getActionButton()}

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
  // --- NEW: Updated state to hold all our new data ---
  const [analytics, setAnalytics] = useState({ 
    total_earnings: 0, 
    total_cuts: 0,
    dailyData: [] // This will hold the array for the chart
  });
  
  const MY_BARBER_ID = 1; // Still "Pareng Jo"

  const fetchAnalytics = async () => {
    try {
      // Talk to our new ENDPOINT 6
      const response = await axios.get(`${API_URL}/analytics/${MY_BARBER_ID}`);
      setAnalytics(response.data);
    } catch (error)
 {
      console.error('Failed to fetch analytics:', error);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [refreshSignal]); // Refreshes when a cut is completed

  // --- NEW: Prepare the data for the chart ---
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Earnings per Day (Last 7 Days)',
      },
    },
  };

  const chartData = {
    // Format the dates to be readable (e.g., "10/24")
    labels: analytics.dailyData.map(d => new Date(d.day).toLocaleDateString()),
    datasets: [
      {
        label: 'Daily Earnings ($)',
        // Get the earnings number from our data
        data: analytics.dailyData.map(d => d.daily_earnings),
        backgroundColor: 'rgba(52, 199, 89, 0.6)', // Green color
      },
    ],
  };

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
      
      {/* --- NEW: Add the chart --- */}
      <div className="chart-container">
        <Bar options={chartOptions} data={chartData} />
      </div>

      <button onClick={fetchAnalytics} className="refresh-button">Refresh</button>
    </div>
  );
}


// ##############################################
// ##           THE MAIN APP PAGE              ##
// ##############################################
// (This component is exactly the same as before)
function App() {
  const [refreshSignal, setRefreshSignal] = useState(0);

  const handleCutComplete = () => {
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