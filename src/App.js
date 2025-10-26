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
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Check if Supabase keys are provided
let supabase;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error("Supabase URL or Anon Key is missing. Realtime features will be disabled.");
  // Provide a dummy client or handle the absence appropriately
  supabase = { channel: () => ({ on: () => ({ subscribe: () => {} }), subscribe: () => {} }), removeChannel: () => Promise.resolve() }; // Dummy object
}


// ##############################################
// ##          CUSTOMER VIEW COMPONENT         ##
// ##############################################
function CustomerView() {
  // --- Form State Variables ---
  const [barbers, setBarbers] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [message, setMessage] = useState(''); // General status messages for the form/queue

  // --- Queue State ---
  const [myQueueEntryId, setMyQueueEntryId] = useState(null); // ID of the customer's entry
  const [joinedBarberId, setJoinedBarberId] = useState(null); // ID of the barber whose queue was joined
  const [liveQueue, setLiveQueue] = useState([]); // Array of current queue entries {id, customer_name, status}
  const [queueMessage, setQueueMessage] = useState(''); // Status message specific to the queue view

  // --- AI State ---
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null); // URL of the AI image
  const [isGenerating, setIsGenerating] = useState(false); // AI generation loading state
  const [isLoading, setIsLoading] = useState(false); // General loading state (for joining queue)

  // --- Fetch Barbers ---
  useEffect(() => {
    const loadBarbers = async () => {
      try {
        const response = await axios.get(`${API_URL}/barbers`);
        setBarbers(response.data);
      } catch (error) {
        console.error('Failed to fetch barbers:', error);
         setMessage('Could not load barbers.'); // Show error to user
      }
    };
    loadBarbers();
  }, []); // Run only once on component mount


  // --- Function to fetch public queue ---
  const fetchPublicQueue = async (barberId) => {
    if (!barberId) return;
    setQueueMessage('Loading queue...');
    try {
      const response = await axios.get(`${API_URL}/queue/public/${barberId}`);
      setLiveQueue(response.data || []); // Ensure it's an array
      setQueueMessage(''); // Clear loading message
    } catch (error) {
      console.error("Failed to fetch public queue:", error);
      setQueueMessage('Could not load queue.');
      setLiveQueue([]); // Clear queue on error
    }
  };

  // --- Effect for Notification Permission and Realtime Updates ---
  useEffect(() => {
    // 1. Ask for Notification permission
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          console.log("Notification permission granted.");
        } else {
          console.log("Notification permission denied.");
        }
      });
    }

    // 2. Set up Supabase listener for the joined barber's queue
    let queueChannel = null;
    if (joinedBarberId && supabase?.channel) { // Check if supabase client is valid
      console.log(`Subscribing to queue changes for barber ID: ${joinedBarberId}`);
      queueChannel = supabase
        .channel(`public_queue_${joinedBarberId}`) // Unique channel name per barber
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'queue_entries',
            filter: `barber_id=eq.${joinedBarberId}` // Only listen for changes related to this barber
          },
          (payload) => {
            console.log('Queue change detected!', payload);
            // Refetch the entire public queue list when any change happens
            fetchPublicQueue(joinedBarberId);

            // Check specifically if MY entry was updated to 'Up Next' for notification
            if (payload.eventType === 'UPDATE' && payload.new.id === myQueueEntryId) {
              const updatedEntry = payload.new;
              if (updatedEntry.status === 'Up Next') {
                console.log('My status is Up Next! Sending notification.');
                if (Notification.permission === "granted") {
                  new Notification("You're next at Dash-Q!", {
                    body: "Please head over to the barbershop now.",
                    // icon: "/favicon.ico" // Optional: Make sure you have a favicon.ico in your public folder
                  });
                } else {
                  // Fallback if permission wasn't granted or notifications aren't supported
                  alert("You're next at Dash-Q! Please head over now.");
                }
                // Optional: Unsubscribe or change state after notification
                // setMyQueueEntryId(null); // Example: reset ID if notification is one-time
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to Supabase Realtime queue updates!');
            // Fetch initial queue state right after successful subscription
            fetchPublicQueue(joinedBarberId);
          } else {
            console.error('Supabase Realtime subscription error:', status, err);
            setQueueMessage('Live updates unavailable.');
          }
        });
    }

    // 3. Cleanup function: Unsubscribe when the component unmounts or joinedBarberId changes
    return () => {
      if (queueChannel && supabase?.removeChannel) {
        supabase.removeChannel(queueChannel).then(() => console.log('Cleaned up queue subscription.'));
      }
    };
    // Dependencies: Rerun effect if the user joins a different barber's queue, or if their own queue entry ID changes
  }, [joinedBarberId, myQueueEntryId]);


  // --- AI Preview Function ---
  const handleGeneratePreview = async () => {
    if (!file || !prompt) {
      setMessage('Please upload a photo and enter a prompt.');
      return;
    }

    setIsGenerating(true);
    setIsLoading(true); // Also disable Join Queue button
    setGeneratedImage(null); // Clear previous image
    setMessage('Step 1/3: Uploading your photo...');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`; // Path within the bucket

    try {
      // 1. Upload file to Supabase Storage
      if (!supabase?.storage) { throw new Error("Supabase storage client not available."); }
      const { error: uploadError } = await supabase.storage
        .from('haircut_references') // Use the correct bucket name
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      // 2. Get the public URL for the uploaded file
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
      setGeneratedImage(newAiUrl); // Set state to display the generated image
      setMessage('Step 3/3: Success! Check out your preview.');

    } catch (error) {
      console.error('Error in AI generation pipeline:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown AI error';
      setMessage(`AI generation failed. ${errorMessage}`);
      // Clear generated image on failure?
      // setGeneratedImage(null);
    } finally {
      setIsGenerating(false);
      setIsLoading(false); // Re-enable Join Queue button
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
    setMessage('Joining queue...'); // Provide feedback

    try {
      // Use the generated AI image URL if it exists, otherwise null
      const imageUrlToSave = generatedImage;

      const response = await axios.post(`${API_URL}/queue`, {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        barber_id: selectedBarber,
        reference_image_url: imageUrlToSave
      });

      const newQueueEntry = response.data;
      setMyQueueEntryId(newQueueEntry.id); // Save MY queue entry ID
      setJoinedBarberId(parseInt(selectedBarber)); // Save the barber ID whose queue was joined

      // Note: fetchPublicQueue is now called automatically by the useEffect when joinedBarberId changes

      // Find barber name for success message (handle case where barbers haven't loaded yet)
      const barberName = barbers.find(b => b.id === parseInt(selectedBarber))?.full_name || `Barber #${selectedBarber}`;
      setMessage(`Success! You joined the queue for ${barberName}. We'll notify you via the app! See your spot below.`);

      // Clear only the form-specific fields, keep state needed for the queue view
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      // Keep selectedBarber if needed for queue view title, or clear if joining another is primary action
      // setSelectedBarber('');
      setFile(null);
      setPrompt('');
      // Keep generatedImage if you want it to persist until they leave queue? Or clear:
      // setGeneratedImage(null);

    } catch (error) {
      console.error('Failed to join queue:', error);
      setMessage(error.response?.data?.error || 'Failed to join queue. Please try again.');
       // Clear potentially sensitive state on failure
       setMyQueueEntryId(null);
       setJoinedBarberId(null);
    } finally {
      setIsLoading(false); // Stop loading indicator
    }
  };

  // --- Function to leave the queue ---
  const handleLeaveQueue = () => {
    // Optionally: Send request to backend to remove/cancel queue entry
    // For now, just reset the frontend state
    if (myQueueEntryId && supabase?.removeChannel) {
        supabase.removeChannel(supabase.channel(`public_queue_${joinedBarberId}`))
            .then(() => console.log('Unsubscribed on leaving queue.'));
    }
    setMyQueueEntryId(null);
    setJoinedBarberId(null);
    setLiveQueue([]);
    setMessage(''); // Clear any old messages
    setQueueMessage('');
    setSelectedBarber(''); // Reset barber selection
    setGeneratedImage(null); // Clear AI image when leaving
  };


  // --- Render Logic ---
  return (
    <div className="card">
      {/* --- Conditionally show Join Form OR Live Queue --- */}
      {!myQueueEntryId ? (
        // --- JOIN FORM ---
        <>
          <h2>Join the Queue</h2>
          <form onSubmit={handleJoinQueue}>
            {/* Name */}
            <div className="form-group">
              <label>Your Name:</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            {/* Phone */}
            <div className="form-group">
              <label>Your Phone (Optional):</label>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            {/* Email */}
            <div className="form-group">
              <label>Your Email (Optional, for notifications):</label>
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
            {/* Barber Selection */}
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

            {/* AI GENERATOR SECTION */}
            <div className="ai-generator">
              <p className="ai-title">AI Haircut Preview (Optional)</p>
              {/* Photo Upload */}
              <div className="form-group">
                <label>1. Upload a clear photo of yourself:</label>
                <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files[0]); setGeneratedImage(null); /* Clear preview if new file selected */ }} />
              </div>
              {/* Prompt Input */}
              <div className="form-group">
                <label>2. Describe your desired haircut:</label>
                <input type="text" value={prompt} placeholder="e.g., 'a short buzz cut' or 'blue hair'" onChange={(e) => setPrompt(e.target.value)} />
              </div>
              {/* Generate Button */}
              <button type="button" onClick={handleGeneratePreview} className="generate-button" disabled={!file || !prompt || isLoading || isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate AI Preview'}
              </button>
              {/* AI Image Preview Area */}
              {isLoading && isGenerating && <p className='loading-text'>Generating image, please wait...</p>}
              {generatedImage && (
                <div className="image-preview">
                  <p>Your AI Preview:</p>
                  <img src={generatedImage} alt="AI Generated Haircut" />
                  <p className="success-text">Happy? Click "Join Queue" to save this photo as reference!</p>
                </div>
              )}
            </div>
            {/* --- END OF AI SECTION --- */}

            {/* Join Queue Button */}
            <button type="submit" disabled={isLoading || isGenerating} className="join-queue-button">
              {isLoading ? 'Joining...' : 'Join Queue'}
            </button>
          </form>
          {message && <p className="message">{message}</p>}
        </>
      ) : (
        // --- LIVE QUEUE VIEW ---
        <div className="live-queue-view">
          <h2>
            Live Queue for {barbers.find(b => b.id === joinedBarberId)?.full_name || `Barber #${joinedBarberId}`}
          </h2>
          {queueMessage && <p className="message">{queueMessage}</p>}
          <ul className="queue-list live">
            {liveQueue.length === 0 && !queueMessage ? (
              <li className="empty-text">The queue is currently empty.</li>
            ) : (
              liveQueue.map((entry, index) => (
                <li
                  key={entry.id}
                  className={`
                    ${entry.id === myQueueEntryId ? 'my-position' : ''}
                    ${entry.status === 'Up Next' ? 'up-next-public' : ''}
                  `}
                >
                  <span>
                    {/* Display Position + Name (You if it's your entry) */}
                    {index + 1}. {entry.id === myQueueEntryId ? `You (${entry.customer_name})` : `Customer #${entry.id}`}
                  </span>
                  <span className="queue-status">{entry.status}</span>
                </li>
              ))
            )}
          </ul>
          <button onClick={handleLeaveQueue} className='leave-queue-button'>
            Leave Queue / Join Another
          </button>
        </div>
      )}
    </div>
  );
}


// ##############################################
// ##         BARBER DASHBOARD COMPONENT       ##
// ##############################################
function BarberDashboard({ onCutComplete }) {
  // State holds all queue segments
  const [queueDetails, setQueueDetails] = useState({ waiting: [], inProgress: null, upNext: null });
  const [error, setError] = useState('');

  // --- Hardcoded Barber ID (Replace with login logic later) ---
  const MY_BARBER_ID = 1;
  const MY_BARBER_NAME = "Pareng Jo"; // TODO: Fetch this dynamically

  // --- Fetch Detailed Queue Data ---
  const fetchQueueDetails = async () => {
    setError('');
    try {
      const response = await axios.get(`${API_URL}/queue/details/${MY_BARBER_ID}`);
      setQueueDetails(response.data);
    } catch (err) {
      console.error('Failed to fetch queue details:', err);
      setError('Could not load queue details.');
      setQueueDetails({ waiting: [], inProgress: null, upNext: null }); // Reset on error
    }
  };

  // --- Load initially and also listen for Realtime updates ---
   useEffect(() => {
    fetchQueueDetails(); // Initial fetch

    // Subscribe to changes for this barber's queue
    let barberChannel = null;
    if (supabase?.channel) {
        barberChannel = supabase
            .channel(`barber_queue_${MY_BARBER_ID}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${MY_BARBER_ID}` },
                (payload) => {
                    console.log('Barber dashboard received queue update:', payload);
                    fetchQueueDetails(); // Refetch details when any change occurs
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                    console.log(`Barber dashboard subscribed to queue ${MY_BARBER_ID}`);
                 } else {
                     console.error(`Barber dashboard subscription error: ${status}`, err);
                 }
            });
    }

    // Cleanup subscription on component unmount
    return () => {
        if (barberChannel && supabase?.removeChannel) {
            supabase.removeChannel(barberChannel).then(() => console.log('Barber dashboard unsubscribed.'));
        }
    };
}, [MY_BARBER_ID]); // Dependency array includes MY_BARBER_ID in case it changes


  // --- Event Handlers ---
  const handleNextCustomer = async () => {
    // Determine who to call next: prioritize 'Up Next', then first 'Waiting'
    const customerToMoveNext = queueDetails.upNext || (queueDetails.waiting.length > 0 ? queueDetails.waiting[0] : null);

    if (!customerToMoveNext) {
      alert('Queue is empty!');
      return;
    }
    // Prevent calling next if someone is already in the chair
    if (queueDetails.inProgress) {
      alert(`Please complete the cut for ${queueDetails.inProgress.customer_name} first.`);
      return;
    }

    setError(''); // Clear previous errors
    try {
      await axios.put(`${API_URL}/queue/next`, {
        queue_id: customerToMoveNext.id,
        barber_id: MY_BARBER_ID
      });
      // No need to call fetchQueueDetails manually, Realtime listener will trigger it
    } catch (err) {
      console.error('Failed to move next customer:', err);
      setError(err.response?.data?.error || 'Failed to call next customer.');
    }
  };

  const handleCompleteCut = async () => {
    if (!queueDetails.inProgress) return;

    const price = prompt(`Enter the price for ${queueDetails.inProgress.customer_name}:`);
    if (price === null) return; // Handle user canceling prompt
    const parsedPrice = parseInt(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert('Invalid price. Please enter a positive number.');
      return;
    }

    setError(''); // Clear previous errors
    try {
      await axios.post(`${API_URL}/queue/complete`, {
        queue_id: queueDetails.inProgress.id,
        barber_id: MY_BARBER_ID,
        price: parsedPrice
      });

      onCutComplete(); // Signal parent to refresh analytics
      // No need to call fetchQueueDetails manually, Realtime listener will trigger it
    } catch (err) {
      console.error('Failed to complete cut:', err);
      setError(err.response?.data?.error || 'Failed to complete cut.');
    }
  };

  // --- Determine Button Logic ---
  const getActionButton = () => {
    if (queueDetails.inProgress) {
      return (
        <button onClick={handleCompleteCut} className="complete-button">
          Complete Cut for {queueDetails.inProgress.customer_name}
        </button>
      );
    } else if (queueDetails.upNext || queueDetails.waiting.length > 0) {
      // Show the name of the person who will be called next
      const nextPersonName = queueDetails.upNext?.customer_name || queueDetails.waiting[0]?.customer_name || 'Next';
      return (
        <button onClick={handleNextCustomer} className="next-button">
          Call: {nextPersonName}
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

  // --- Render Barber Dashboard ---
 return (
    <div className="card">
      <h2>My Queue ({MY_BARBER_NAME})</h2>
      {error && <p className="error-message">{error}</p>}
      {getActionButton()}

      {/* In the Chair Section */}
      <h3 className="queue-subtitle">In the Chair</h3>
      {queueDetails.inProgress ? (
        <ul className="queue-list"><li className="in-progress">
          <strong>{queueDetails.inProgress.customer_name}</strong>
           {/* Link to Reference Photo if available */}
           {queueDetails.inProgress.reference_image_url && (
            <a href={queueDetails.inProgress.reference_image_url} target="_blank" rel="noopener noreferrer" className="photo-link">
              See Ref Photo
            </a>
          )}
        </li></ul>
      ) : (
        <p className="empty-text">Chair is empty</p>
      )}

      {/* Up Next Section */}
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

      {/* Waiting Section */}
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
       {/* Manual Refresh Button (Good backup) */}
       <button onClick={fetchQueueDetails} className="refresh-button small">Refresh Queue</button>
    </div>
  );
}


// ##############################################
// ##       ANALYTICS DASHBOARD COMPONENT      ##
// ##############################################
function AnalyticsDashboard({ refreshSignal }) {
  // State holds all analytics data pieces
  const [analytics, setAnalytics] = useState({
    totalEarningsToday: 0, totalCutsToday: 0,
    totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [],
    busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0
  });
  const [error, setError] = useState('');

  // Hardcoded Barber ID (Replace with login later)
  const MY_BARBER_ID = 1;

  // --- Fetch Expanded Analytics ---
  const fetchAnalytics = async () => {
    setError('');
    try {
      const response = await axios.get(`${API_URL}/analytics/${MY_BARBER_ID}`);
      // Ensure default values if API response is missing fields
      setAnalytics({
          dailyData: [], // Ensure array type
          busiestDay: { name: 'N/A', earnings: 0 }, // Ensure object structure
          ...response.data // Spread API data, potentially overwriting defaults
      });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Could not load analytics.');
      // Reset state on error
      setAnalytics({
         totalEarningsToday: 0, totalCutsToday: 0,
         totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [],
         busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0
      });
    }
  };

  // Fetch on initial load and when refreshSignal (from parent) changes
  useEffect(() => {
    fetchAnalytics();
  }, [refreshSignal, MY_BARBER_ID]); // Include MY_BARBER_ID if it could change

  // --- Calculate Averages ---
  // Use nullish coalescing (??) for safety in case values are undefined/null
  const avgPriceToday = (analytics.totalCutsToday ?? 0) > 0
    ? ((analytics.totalEarningsToday ?? 0) / analytics.totalCutsToday).toFixed(2)
    : '0.00';
  const avgPriceWeek = (analytics.totalCutsWeek ?? 0) > 0
    ? ((analytics.totalEarningsWeek ?? 0) / analytics.totalCutsWeek).toFixed(2)
    : '0.00';

  // --- Chart Configuration ---
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allow chart to fill container height
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Earnings per Day (Last 7 Days)' },
    },
    scales: { y: { beginAtZero: true } }
  };

  // Ensure dailyData is an array before mapping
  const dailyDataSafe = Array.isArray(analytics.dailyData) ? analytics.dailyData : [];

  const chartData = {
    // Format date nicely, handle potential invalid dates gracefully
    labels: dailyDataSafe.map(d => {
        try {
            return new Date(d.day + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
        } catch (e) { return 'Invalid Date'; }
    }),
    datasets: [
      {
        label: 'Daily Earnings ($)',
        data: dailyDataSafe.map(d => d.daily_earnings ?? 0), // Use 0 if earnings are null/undefined
        backgroundColor: 'rgba(52, 199, 89, 0.6)',
        borderColor: 'rgba(52, 199, 89, 1)',
        borderWidth: 1,
      },
    ],
  };

  // --- Render Analytics Dashboard ---
  return (
    <div className="card analytics-card">
      <h2>Dashboard</h2>
      {error && <p className="error-message">{error}</p>}

      {/* Today Section */}
      <h3 className="analytics-subtitle">Today</h3>
      <div className="analytics-grid">
         <div className="analytics-item">
            <span className="analytics-label">Earnings</span>
            <span className="analytics-value">${analytics.totalEarningsToday ?? 0}</span>
          </div>
          <div className="analytics-item">
            <span className="analytics-label">Cuts</span>
            <span className="analytics-value">{analytics.totalCutsToday ?? 0}</span>
          </div>
           <div className="analytics-item">
            <span className="analytics-label">Avg Price</span>
            <span className="analytics-value small">${avgPriceToday}</span>
          </div>
          <div className="analytics-item">
            <span className="analytics-label">Queue Size</span>
            <span className="analytics-value small">{analytics.currentQueueSize ?? 0}</span>
          </div>
      </div>

      {/* Week Section */}
       <h3 className="analytics-subtitle">Last 7 Days</h3>
       <div className="analytics-grid">
          <div className="analytics-item">
            <span className="analytics-label">Total Earnings</span>
            <span className="analytics-value">${analytics.totalEarningsWeek ?? 0}</span>
          </div>
          <div className="analytics-item">
            <span className="analytics-label">Total Cuts</span>
            <span className="analytics-value">{analytics.totalCutsWeek ?? 0}</span>
          </div>
           <div className="analytics-item">
            <span className="analytics-label">Avg Price</span>
            <span className="analytics-value small">${avgPriceWeek}</span>
          </div>
           <div className="analytics-item">
            <span className="analytics-label">Busiest Day</span>
            <span className="analytics-value small">{analytics.busiestDay?.name ?? 'N/A'} (${analytics.busiestDay?.earnings ?? 0})</span>
          </div>
       </div>

      {/* Chart */}
      <div className="chart-container">
        {dailyDataSafe.length > 0 ? (
           <div style={{ height: '250px' }}> {/* Give chart container explicit height */}
             <Bar options={chartOptions} data={chartData} />
           </div>
        ) : (
           <p className='empty-text'>No earnings data for the chart yet.</p>
        )}
      </div>

      {/* Refresh Button */}
      <button onClick={fetchAnalytics} className="refresh-button">Refresh Stats</button>
    </div>
  );
}


// ##############################################
// ##           THE MAIN APP PAGE              ##
// ##############################################
function App() {
  // State to signal analytics refresh
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Callback function passed to BarberDashboard
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
        <BarberDashboard onCutComplete={handleCutComplete} />
        <AnalyticsDashboard refreshSignal={refreshSignal} />
      </div>
    </div>
  );
}

export default App;