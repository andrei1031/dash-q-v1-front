import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// --- Chart.js Imports ---
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

// --- Register Chart.js components ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// --- Backend API URL ---
// Make sure this points to your deployed Render URL
const API_URL = 'https://dash-q-backend.onrender.com/api';
// const API_URL = 'http://localhost:3001/api'; // For local testing

// --- Supabase Client Setup ---
// Make sure your Vercel Environment Variables are set:
// REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// ##############################################
// ##          CUSTOMER VIEW COMPONENT         ##
// ##############################################
function CustomerView() {
  // --- State Variables ---
  const [barbers, setBarbers] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState(''); // Added Email
  const [message, setMessage] = useState('');
  const [myQueueEntryId, setMyQueueEntryId] = useState(null); // For realtime subscription

  // --- AI State ---
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // General loading state

  // --- Fetch Barbers ---
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

  // --- Effect for Notification Permission and Subscription ---
  useEffect(() => {
    // 1. Ask for permission
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          console.log("Notification permission granted.");
        } else {
          console.log("Notification permission denied.");
        }
      });
    }

    // 2. Set up Supabase listener if we have an ID
    let channel = null;
    if (myQueueEntryId) {
      console.log(`Subscribing to changes for queue entry ID: ${myQueueEntryId}`);
      channel = supabase
        .channel(`queue_entry_${myQueueEntryId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'queue_entries',
            filter: `id=eq.${myQueueEntryId}`
          },
          (payload) => {
            console.log('Change received!', payload);
            const updatedEntry = payload.new;
            if (updatedEntry.status === 'Up Next') {
              console.log('My status is Up Next! Sending notification.');
              // 3. Show Notification
              if (Notification.permission === "granted") {
                new Notification("You're next at Dash-Q!", {
                  body: "Please head over to the barbershop now.",
                  // icon: "/favicon.ico" // Optional: Make sure you have a favicon
                });
              } else {
                alert("You're next at Dash-Q! Please head over now.");
              }
              // Unsubscribe after notification
              if (channel) {
                supabase.removeChannel(channel).then(() => console.log('Unsubscribed'));
              }
              setMyQueueEntryId(null); // Reset
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to Supabase Realtime!');
          } else {
            console.error('Supabase Realtime subscription error:', status, err);
          }
        });
    }

    // 4. Cleanup
    return () => {
      if (channel) {
        supabase.removeChannel(channel).then(() => console.log('Cleaned up subscription.'));
      }
    };
  }, [myQueueEntryId]);

  // --- AI Preview Function ---
  const handleGeneratePreview = async () => {
    if (!file || !prompt) {
      setMessage('Please upload a photo and enter a prompt.');
      return;
    }

    setIsGenerating(true);
    setIsLoading(true);
    setGeneratedImage(null);
    setMessage('Step 1/3: Uploading your photo...');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
      // 1. Upload file
      const { error: uploadError } = await supabase.storage
        .from('haircut_references')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('haircut_references')
        .getPublicUrl(filePath);
      const imageUrl = urlData.publicUrl;

      // 3. Call backend AI endpoint
      setMessage('Step 2/3: Generating AI haircut... (this takes ~15-30s)');
      const response = await axios.post(`${API_URL}/generate-haircut`, {
        imageUrl: imageUrl,
        prompt: prompt
      });

      const newAiUrl = response.data.generatedImageUrl;
      setGeneratedImage(newAiUrl);
      setMessage('Step 3/3: Success! Check out your preview.');

    } catch (error) {
      console.error('Error in AI generation pipeline:', error);
       const errorMessage = error.response?.data?.error || error.message || 'Unknown AI error';
      setMessage(`AI generation failed. ${errorMessage}`);
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  // --- Join Queue Function ---
  const handleJoinQueue = async (e) => {
    e.preventDefault();

    if (!customerName || !selectedBarber) {
      setMessage('Please enter your name and select a barber.');
      return;
    }

    setIsLoading(true);

    try {
      // Use the AI image if generated, otherwise null
      const imageUrlToSave = generatedImage;

      const response = await axios.post(`${API_URL}/queue`, {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail, // Send email
        barber_id: selectedBarber,
        reference_image_url: imageUrlToSave
      });

      const newQueueEntry = response.data;
      setMyQueueEntryId(newQueueEntry.id); // Save ID to start listening

      const barberName = barbers.find(b => b.id === parseInt(selectedBarber)).full_name;
      setMessage(`Success! You're #${newQueueEntry.id} in line for ${barberName}. We'll notify you via the app!`);

      // Clear the form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setSelectedBarber('');
      setFile(null);
      setPrompt('');
      setGeneratedImage(null);

    } catch (error) {
      console.error('Failed to join queue:', error);
      setMessage('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <div className="card">
        <h2>Join the Queue</h2>
        <form onSubmit={handleJoinQueue}>
          {/* --- Standard Queue Form --- */}
          <div className="form-group">
            <label>Your Name:</label>
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required/>
          </div>
          <div className="form-group">
            <label>Your Phone (Optional):</label>
            <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
           <div className="form-group">
            <label>Your Email (Optional):</label>
            <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Select a Barber:</label>
            <select value={selectedBarber} onChange={(e) => setSelectedBarber(e.target.value)} required>
              <option value="">-- Choose a barber --</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* --- AI GENERATOR SECTION --- */}
          <div className="ai-generator">
            <p className="ai-title">AI Haircut Preview (Optional)</p>
            <div className="form-group">
              <label>1. Upload a clear photo of yourself:</label>
              <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files[0]); setGeneratedImage(null); }} />
            </div>
            <div className="form-group">
              <label>2. Describe your desired haircut:</label>
              <input type="text" value={prompt} placeholder="e.g., 'a short buzz cut' or 'blue hair'" onChange={(e) => setPrompt(e.target.value)} />
            </div>
            <button type="button" onClick={handleGeneratePreview} className="generate-button" disabled={!file || !prompt || isLoading || isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate AI Preview'}
            </button>

            {/* --- AI Image Preview --- */}
             {isLoading && isGenerating && <p>Generating image...</p>}
            {generatedImage && (
              <div className="image-preview">
                <p>Your AI Preview:</p>
                <img src={generatedImage} alt="AI Generated Haircut" />
                <p className="success-text">Happy? Click "Join Queue" to save this photo!</p>
              </div>
            )}
          </div>
          {/* --- END OF AI SECTION --- */}

          <button type="submit" disabled={isLoading} className="join-queue-button">
            {isLoading ? '...' : 'Join Queue'}
          </button>
        </form>
        {message && <p className="message">{message}</p>}
      </div>
    );
}


// ##############################################
// ##         BARBER DASHBOARD COMPONENT       ##
// ##############################################
function BarberDashboard({ onCutComplete }) {
  const [queueDetails, setQueueDetails] = useState({ waiting: [], inProgress: null, upNext: null });
  const [error, setError] = useState('');

  // --- Hardcoded Barber ID ---
  const MY_BARBER_ID = 1;
  const MY_BARBER_NAME = "Pareng Jo"; // TODO: Fetch this dynamically later

  // --- Fetch Detailed Queue Data ---
  const fetchQueueDetails = async () => {
    setError(''); // Clear previous errors
    try {
      const response = await axios.get(`${API_URL}/queue/details/${MY_BARBER_ID}`);
      setQueueDetails(response.data);
    } catch (err) {
      console.error('Failed to fetch queue details:', err);
      setError('Could not load queue details.');
      setQueueDetails({ waiting: [], inProgress: null, upNext: null }); // Reset on error
    }
  };

  // --- Initial Load & Refresh Signal ---
  useEffect(() => {
    fetchQueueDetails();
  }, [onCutComplete]); // Re-fetch when a cut is completed (via refreshSignal prop)


  // --- Event Handlers ---
  const handleNextCustomer = async () => {
     // Determine who to actually move next
    const customerToMoveNext = queueDetails.upNext || (queueDetails.waiting.length > 0 ? queueDetails.waiting[0] : null);

    if (!customerToMoveNext) {
      alert('Queue is empty!');
      return;
    }
     if (queueDetails.inProgress) {
      alert(`Please complete the cut for ${queueDetails.inProgress.customer_name} first.`);
      return;
    }

    try {
      await axios.put(`${API_URL}/queue/next`, {
        queue_id: customerToMoveNext.id,
        barber_id: MY_BARBER_ID
      });
      // Refresh the queue after action
      fetchQueueDetails();
    } catch (err) {
      console.error('Failed to move next customer:', err);
       setError(err.response?.data?.error || 'Failed to call next customer.');
    }
  };

  const handleCompleteCut = async () => {
    if (!queueDetails.inProgress) return;

    const price = prompt(`Enter the price for ${queueDetails.inProgress.customer_name}:`);
     if (price === null) return; // Handle cancel
    const parsedPrice = parseInt(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert('Invalid price. Please enter a positive number.');
      return;
    }

    try {
      await axios.post(`${API_URL}/queue/complete`, {
        queue_id: queueDetails.inProgress.id,
        barber_id: MY_BARBER_ID,
        price: parsedPrice
      });

      onCutComplete(); // Signal parent to refresh analytics
      fetchQueueDetails(); // Refresh local queue state

    } catch (err) {
      console.error('Failed to complete cut:', err);
       setError(err.response?.data?.error || 'Failed to complete cut.');
    }
  };

  // Determine which action button to show
  const getActionButton = () => {
    if (queueDetails.inProgress) {
      return (
        <button onClick={handleCompleteCut} className="complete-button">
          Complete Cut for {queueDetails.inProgress.customer_name}
        </button>
      );
    } else if (queueDetails.upNext || queueDetails.waiting.length > 0) {
       const nextPersonName = queueDetails.upNext?.customer_name || queueDetails.waiting[0]?.customer_name;
      return (
        <button onClick={handleNextCustomer} className="next-button">
          Call Next: {nextPersonName}
        </button>
      );
    } else {
      return (
        <button className="next-button disabled" disabled>
          Queue Empty
        </button>
      );
    }
  };


 return (
    <div className="card">
      <h2>My Queue ({MY_BARBER_NAME})</h2>
      {error && <p className="error-message">{error}</p>}
      {getActionButton()}

      <h3 className="queue-subtitle">In the Chair</h3>
      {queueDetails.inProgress ? (
        <ul className="queue-list"><li className="in-progress">
          <strong>{queueDetails.inProgress.customer_name}</strong>
           {queueDetails.inProgress.reference_image_url && (
            <a href={queueDetails.inProgress.reference_image_url} target="_blank" rel="noopener noreferrer" className="photo-link">
              See Ref Photo
            </a>
          )}
        </li></ul>
      ) : (
        <p className="empty-text">Chair is empty</p>
      )}

       <h3 className="queue-subtitle">Up Next</h3>
      {queueDetails.upNext ? (
        <ul className="queue-list"><li className="up-next">
          <strong>{queueDetails.upNext.customer_name}</strong>
           {queueDetails.upNext.reference_image_url && (
            <a href={queueDetails.upNext.reference_image_url} target="_blank" rel="noopener noreferrer" className="photo-link">
              See Ref Photo
            </a>
          )}
        </li></ul>
      ) : (
        <p className="empty-text">Nobody is marked 'Up Next'</p>
      )}


      <h3 className="queue-subtitle">Waiting</h3>
      <ul className="queue-list">
        {queueDetails.waiting.length === 0 ? (
          <li className="empty-text">Waiting queue is empty.</li>
        ) : (
          queueDetails.waiting.map((customer) => (
            <li key={customer.id}>
              {customer.customer_name}
              {customer.reference_image_url && (
                <a href={customer.reference_image_url} target="_blank" rel="noopener noreferrer" className="photo-link">
                  See Ref Photo
                </a>
              )}
            </li>
          ))
        )}
      </ul>
       <button onClick={fetchQueueDetails} className="refresh-button small">Refresh Queue</button>
    </div>
  );
}


// ##############################################
// ##       ANALYTICS DASHBOARD COMPONENT      ##
// ##############################################
function AnalyticsDashboard({ refreshSignal }) {
  const [analytics, setAnalytics] = useState({
    total_earnings: 0,
    total_cuts: 0,
    dailyData: []
  });
  const [error, setError] = useState('');

  // Hardcoded Barber ID
  const MY_BARBER_ID = 1;

  const fetchAnalytics = async () => {
    setError('');
    try {
      const response = await axios.get(`${API_URL}/analytics/${MY_BARBER_ID}`);
      setAnalytics(response.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Could not load analytics.');
      setAnalytics({ total_earnings: 0, total_cuts: 0, dailyData: [] }); // Reset on error
    }
  };

  // Fetch on initial load and when refreshSignal changes
  useEffect(() => {
    fetchAnalytics();
  }, [refreshSignal]);

  // Chart Configuration
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Earnings per Day (Last 7 Days)' },
    },
    scales: { // Ensure y-axis starts at 0
        y: { beginAtZero: true }
    }
  };

  const chartData = {
    labels: analytics.dailyData.map(d => new Date(d.day).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })), // Format date nicely
    datasets: [
      {
        label: 'Daily Earnings ($)',
        data: analytics.dailyData.map(d => d.daily_earnings),
        backgroundColor: 'rgba(52, 199, 89, 0.6)', // Green
        borderColor: 'rgba(52, 199, 89, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="card analytics-card">
      <h2>Today's Dashboard</h2>
       {error && <p className="error-message">{error}</p>}
      <div className="analytics-item">
        <span className="analytics-label">Total Earnings</span>
        <span className="analytics-value">${analytics.total_earnings}</span>
      </div>
      <div className="analytics-item">
        <span className="analytics-label">Total Cuts</span>
        <span className="analytics-value">{analytics.total_cuts}</span>
      </div>

      <div className="chart-container">
        {/* Only render chart if there's data */}
        {analytics.dailyData.length > 0 ? (
           <Bar options={chartOptions} data={chartData} />
        ) : (
           <p className='empty-text'>No earnings data for the chart yet.</p>
        )}
      </div>

      <button onClick={fetchAnalytics} className="refresh-button">Refresh Stats</button>
    </div>
  );
}


// ##############################################
// ##           THE MAIN APP PAGE              ##
// ##############################################
function App() {
  const [refreshSignal, setRefreshSignal] = useState(0);

  // This function is passed down to BarberDashboard
  // and called when a cut is completed.
  const handleCutComplete = () => {
    setRefreshSignal(prev => prev + 1); // Incrementing triggers useEffect in AnalyticsDashboard
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to Dash-Q!</h1>
      </header>
      <div className="container">
        <CustomerView />
        {/* Pass the callback function to BarberDashboard */}
        <BarberDashboard onCutComplete={handleCutComplete} />
        {/* Pass the signal state to AnalyticsDashboard */}
        <AnalyticsDashboard refreshSignal={refreshSignal} />
      </div>
    </div>
  );
}

export default App;