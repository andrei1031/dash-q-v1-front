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
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- Backend API URL ---
const API_URL = 'https://dash-q-backend.onrender.com/api';
// const API_URL = 'http://localhost:3001/api'; // For local testing

// --- Supabase Client Setup ---
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

let supabase;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error("Supabase URL or Anon Key is missing! Check Vercel Environment Variables.");
  // Provide a dummy client for graceful failure
  supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }), signInWithPassword: () => {throw new Error('Supabase client not configured')}, signUp: () => {throw new Error('Supabase client not configured')}, signOut: () => {throw new Error('Supabase client not configured')} },
    channel: () => ({ on: () => ({ subscribe: () => {} }), subscribe: () => { console.warn("Realtime disabled: Supabase client not configured.")} }),
    removeChannel: () => Promise.resolve(),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: new Error('Supabase client not configured') }) }) }) }),
    storage: { from: () => ({ upload: () => {throw new Error('Supabase storage not configured')}, getPublicUrl: () => ({ data: { publicUrl: null } }) }) }
  };
}

// ##############################################
// ##          LOGIN/SIGNUP COMPONENTS         ##
// ##############################################

function AuthForm() {
    // State for username/email/password etc.
    const [username, setUsername] = useState(''); // Used for Login & Signup
    const [email, setEmail] = useState(''); // Only NEEDED for Signup
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState(''); // For Signup
    // Removed barberCode state
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        // Inside AuthForm JSX, the main submit button:
        <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
        </button>
        try {
            if (isLogin) {
                // --- LOGIN via Backend (Username/Password) ---
                console.log(`Attempting login for username: ${username}`);
                if (!username || !password) throw new Error("Username and password required.");

                // 1. Call backend to verify username/password and get user email
                const response = await axios.post(`${API_URL}/login/username`, {
                    username: username.trim(),
                    password: password,
                });

                // 2. If backend verified, use email+password with Supabase client to set session
                if (response.data.user?.email && supabase?.auth) {
                     console.log("Password verified by backend for:", response.data.user.email, "Now signing in client-side...");
                     const { error: clientSignInError } = await supabase.auth.signInWithPassword({
                         email: response.data.user.email, // Use email verified by backend
                         password: password,
                     });
                     if (clientSignInError) {
                         console.error("Client-side sign-in failed after backend verification:", clientSignInError);
                         // Surface specific errors
                         if (clientSignInError.message.includes('Email not confirmed')) {
                             throw new Error("Login failed: Please verify your email address first.");
                         }
                         throw new Error("Login succeeded but failed to establish session.");
                     }
                      console.log("Client-side session established.");
                     // Auth listener in App component will now detect the session and trigger role check/redirect
                 } else {
                    console.error("Backend login response missing user email:", response.data);
                    throw new Error("Login failed to retrieve necessary user details.");
                 }

            } else {
                // --- SIGN UP via Backend (Username/Email/Password/Name) ---
                console.log(`Attempting signup for username: ${username}`);
                 if (!email.trim() || !fullName.trim()) { // Validate all required fields
                     throw new Error("Email and Full Name are required for signup.");
                 }
                // Call backend signup endpoint (removed barberCode)
                const response = await axios.post(`${API_URL}/signup/username`, {
                    username: username.trim(),
                    email: email.trim(),
                    password: password,
                    fullName: fullName.trim()
                    // barberCode is no longer sent
                });
                setMessage(response.data.message || 'Signup successful!');
                // Switch to login view after signup success
                setIsLogin(true);
                // Clear all fields after successful signup
                setUsername(''); setEmail(''); setPassword(''); setFullName('');
            }
        } catch (error) {
            console.error('Auth error:', error);
            // Display error from backend if available, otherwise frontend error
            setMessage(`Authentication failed: ${error.response?.data?.error || error.message || 'An unexpected error occurred.'}`);
        } finally {
            setLoading(false);
        }
    };

    // Render Auth Form (Removed Barber Code Input)
    return (
        <div className="card auth-card">
            <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleAuth}>
                {/* Username */}
                <div className="form-group"> <label>Username:</label> <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength="3" autoComplete="username"/> </div>
                {/* Email (Only for Signup) */}
                {!isLogin && (<div className="form-group"> <label>Email:</label> <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!isLogin} autoComplete="email"/> <small>Needed for account functions.</small> </div>)}
                {/* Password */}
                <div className="form-group"> <label>Password:</label> <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" autoComplete={isLogin ? "current-password" : "new-password"}/> </div>
                {/* Signup Only Fields (No Barber Code) */}
                {!isLogin && (<> <div className="form-group"> <label>Full Name:</label> <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required={!isLogin} autoComplete="name"/> </div> </>)}
                {/* Submit Button */}
                <button type="submit" disabled={loading}>{loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}</button>
            </form>
            {/* Message Area */}
            {message && <p className={`message ${message.includes('successful') || message.includes('created') ? 'success' : 'error'}`}>{message}</p>}
            {/* Toggle Button */}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setMessage(''); }} className="toggle-auth-button">{isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}</button>
        </div>
    );
}


// ##############################################
// ##      BARBER-SPECIFIC COMPONENTS          ##
// ##############################################

function AvailabilityToggle({ barberProfile, session, onAvailabilityChange }) {
    const isAvailable = barberProfile?.is_available || false;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleToggle = async () => {
        if (!barberProfile || !session?.user) return;
        setLoading(true);
        setError('');
        const newAvailability = !isAvailable;
        try {
            const response = await axios.put(`${API_URL}/barber/availability`, {
                barberId: barberProfile.id, isAvailable: newAvailability, userId: session.user.id
            });
            onAvailabilityChange(response.data.is_available); // Notify parent
        } catch (err) {
            console.error("Failed toggle availability:", err); setError(err.response?.data?.error || "Could not update.");
        } finally { setLoading(false); }
    };

    return (
        <div className="availability-toggle">
            <p>Status: <strong>{isAvailable ? 'Available' : 'Offline'}</strong></p>
            <button onClick={handleToggle} disabled={loading} className={isAvailable ? 'go-offline-button' : 'go-online-button'}>{loading ? '...' : (isAvailable ? 'Go Offline' : 'Go Online')}</button>
             {error && <p className="error-message small">{error}</p>}
        </div>
    );
}

// Main Layout for Logged-In Barbers
function BarberAppLayout({ session, barberProfile, setBarberProfile }) { // Removed checkUserRole prop
    const [refreshSignal, setRefreshSignal] = useState(0);

    const handleLogout = async () => {
        if (!barberProfile || !session?.user || !supabase?.auth) return;
        try {
            // Set offline first
            await axios.put(`${API_URL}/barber/availability`, {
                 barberId: barberProfile.id, isAvailable: false, userId: session.user.id
            });
        } catch (error) { console.error("Error setting offline on logout:", error); }
        finally {
             await supabase.auth.signOut(); // Sign out regardless
             setBarberProfile(null); // Clear profile in parent state
        }
    };

    const handleCutComplete = () => { setRefreshSignal(prev => prev + 1); };

    // Callback for AvailabilityToggle to update parent state
    const handleAvailabilityChange = (newAvailabilityStatus) => {
         setBarberProfile(prev => prev ? { ...prev, is_available: newAvailabilityStatus } : null);
    };

    const currentBarberId = barberProfile?.id;
    const currentBarberName = barberProfile?.full_name;

    return (
        <div className="app-layout barber-layout">
            <header className="app-header">
                <h1>Barber: {currentBarberName || 'Loading...'}</h1>
                 <div className='header-controls'>
                     {/* Pass barberProfile from App state */}
                     {barberProfile && <AvailabilityToggle barberProfile={barberProfile} session={session} onAvailabilityChange={handleAvailabilityChange}/>}
                     <button onClick={handleLogout} className='logout-button'>Logout</button>
                 </div>
            </header>
            <div className="container">
                {currentBarberId ? (
                   <>
                     <BarberDashboard
                        barberId={currentBarberId}
                        barberName={currentBarberName}
                        onCutComplete={handleCutComplete}
                     />
                     <AnalyticsDashboard
                        barberId={currentBarberId}
                        refreshSignal={refreshSignal}
                      />
                   </>
                ) : (
                    <div className="card"><p>Loading barber details...</p></div> // Handle profile loading state
                )}
            </div>
        </div>
    );
}


// ##############################################
// ##       CUSTOMER-SPECIFIC COMPONENTS        ##
// ##############################################

// Main Layout for Logged-In Customers
function CustomerAppLayout({ session }) {
    const handleLogout = async () => {
         if (!supabase?.auth) return;
        await supabase.auth.signOut();
    };

    return (
         <div className="app-layout customer-layout">
            <header className="app-header">
                <h1>Dash-Q Customer</h1>
                 <button onClick={handleLogout} className='logout-button'>Logout</button>
            </header>
            <div className="container">
                <CustomerView session={session} />
            </div>
        </div>
    );
}


// ##############################################
// ##      CHILD COMPONENTS (Customer/Barber)  ##
// ##############################################

// --- CustomerView (Handles Joining Queue & Live View for Customers) ---
function CustomerView({ session }) { // Accept session if needed
   const [barbers, setBarbers] = useState([]); // Available barbers
   const [selectedBarber, setSelectedBarber] = useState('');
   const [customerName, setCustomerName] = useState('');
   const [customerPhone, setCustomerPhone] = useState('');
   const [customerEmail, setCustomerEmail] = useState('');
   const [message, setMessage] = useState('');

   // Queue State
   const [myQueueEntryId, setMyQueueEntryId] = useState(null);
   const [joinedBarberId, setJoinedBarberId] = useState(null);
   const [liveQueue, setLiveQueue] = useState([]);
   const [queueMessage, setQueueMessage] = useState('');

   // AI State
   const [file, setFile] = useState(null);
   const [prompt, setPrompt] = useState('');
   const [generatedImage, setGeneratedImage] = useState(null);
   const [isGenerating, setIsGenerating] = useState(false);
   const [isLoading, setIsLoading] = useState(false); // For joining queue

   // Fetch Available Barbers
   useEffect(() => {
        const loadAvailableBarbers = async () => {
          setMessage('Loading available barbers...');
          try {
            // This endpoint now correctly filters by is_available=true on the backend
            const response = await axios.get(`${API_URL}/barbers`);
            setBarbers(response.data || []);
             setMessage('');
          } catch (error) { console.error('Failed fetch available barbers:', error); setMessage('Could not load barbers.'); setBarbers([]); }
        };
        loadAvailableBarbers();
    }, []); // Run only once

   // Fetch Public Queue Data
   const fetchPublicQueue = async (barberId) => {
      if (!barberId) return;
      setQueueMessage('Loading queue...');
      try {
        const response = await axios.get(`${API_URL}/queue/public/${barberId}`);
        setLiveQueue(response.data || []);
        setQueueMessage('');
      } catch (error) { console.error("Failed fetch public queue:", error); setQueueMessage('Could not load queue.'); setLiveQueue([]); }
    };

    // Realtime and Notification Effect
   useEffect(() => {
        // Ask for Notification permission
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); }

        let queueChannel = null;
        // Only subscribe if the user has joined a queue
        if (joinedBarberId && supabase?.channel) {
            console.log(`Subscribing queue changes: barber ${joinedBarberId}`);
            queueChannel = supabase.channel(`public_queue_${joinedBarberId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${joinedBarberId}` }, (payload) => {
                    console.log('Queue change! Payload:', payload);
                    fetchPublicQueue(joinedBarberId); // Refresh list on any change

                    // Check for MY notification trigger
                    if (payload.eventType === 'UPDATE' && payload.new.id === myQueueEntryId && payload.new.status === 'Up Next') {
                        console.log('My status is Up Next! Notify!');
                        if (Notification.permission === "granted") { new Notification("You're next at Dash-Q!", { body: "Please head over now." }); }
                        else { alert("You're next at Dash-Q! Please head over now."); }
                    }
                })
                .subscribe((status, err) => {
                     if (status === 'SUBSCRIBED') { console.log('Subscribed to Realtime queue!'); fetchPublicQueue(joinedBarberId); } // Fetch on subscribe
                     else { console.error('Supabase Realtime subscription error:', status, err); setQueueMessage('Live updates unavailable.'); }
                });
        }
        // Cleanup function
        return () => {
            if (queueChannel && supabase?.removeChannel) { supabase.removeChannel(queueChannel).then(() => console.log('Cleaned up queue subscription.')); }
        };
    }, [joinedBarberId, myQueueEntryId]); // Rerun if joinedBarberId or myQueueEntryId changes

   // AI Preview Handler
   const handleGeneratePreview = async () => {
        if (!file || !prompt) { setMessage('Please upload a photo and enter a prompt.'); return; }
        setIsGenerating(true); setIsLoading(true); setGeneratedImage(null); setMessage('Step 1/3: Uploading...');
        const filePath = `${Date.now()}.${file.name.split('.').pop()}`;
        try {
            if (!supabase?.storage) throw new Error("Supabase storage not available.");
            const { error: uploadError } = await supabase.storage.from('haircut_references').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('haircut_references').getPublicUrl(filePath);
            if (!urlData?.publicUrl) throw new Error("Could not get public URL for uploaded file."); // Add check
            const imageUrl = urlData.publicUrl;

            setMessage('Step 2/3: Generating AI haircut... (takes ~15-30s)');
            const response = await axios.post(`${API_URL}/generate-haircut`, { imageUrl, prompt });
            setGeneratedImage(response.data.generatedImageUrl); setMessage('Step 3/3: Success! Check preview.');
        } catch (error) { console.error('AI generation pipeline error:', error); setMessage(`AI failed: ${error.response?.data?.error || error.message}`);
        } finally { setIsGenerating(false); setIsLoading(false); }
    };

    // Join Queue Handler
   const handleJoinQueue = async (e) => {
        e.preventDefault();
        if (!customerName || !selectedBarber) { setMessage('Name and Barber required.'); return; }
        setIsLoading(true); setMessage('Joining queue...');
        try {
            const response = await axios.post(`${API_URL}/queue`, {
                customer_name: customerName, customer_phone: customerPhone, customer_email: customerEmail,
                barber_id: selectedBarber, reference_image_url: generatedImage // Send AI image if exists
            });
            const newEntry = response.data;
            setMyQueueEntryId(newEntry.id); setJoinedBarberId(parseInt(selectedBarber));
            const barberName = barbers.find(b => b.id === parseInt(selectedBarber))?.full_name || `Barber #${selectedBarber}`;
            setMessage(`Success! You joined for ${barberName}. We'll notify you! See queue below.`);
            // Clear only form fields needed for re-entry
            setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); setFile(null); setPrompt('');
            // Keep selectedBarber for the queue view title
        } catch (error) { console.error('Failed to join queue:', error); setMessage(error.response?.data?.error || 'Failed to join.'); setMyQueueEntryId(null); setJoinedBarberId(null); // Reset queue state on failure
        } finally { setIsLoading(false); }
    };

    // Leave Queue Handler
   const handleLeaveQueue = () => {
        // Unsubscribe from Realtime
        if (joinedBarberId && supabase?.removeChannel) {
            supabase.removeChannel(supabase.channel(`public_queue_${joinedBarberId}`))
                .then(() => console.log('Unsubscribed on leaving queue.'));
        }
        // Reset state to show the join form again
        setMyQueueEntryId(null); setJoinedBarberId(null); setLiveQueue([]); setMessage(''); setQueueMessage(''); setSelectedBarber(''); setGeneratedImage(null); setFile(null); setPrompt('');
    };

   // --- Render Customer View ---
   return (
      <div className="card">
        {!myQueueEntryId ? (
           <> {/* --- JOIN FORM JSX --- */}
               <h2>Join the Queue</h2>
                <form onSubmit={handleJoinQueue}>
                  <div className="form-group"><label>Your Name:</label><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required /></div>
                  <div className="form-group"><label>Your Phone (Optional):</label><input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
                  <div className="form-group"><label>Your Email (Optional):</label><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
                  <div className="form-group">
                      <label>Select Available Barber:</label>
                      <select value={selectedBarber} onChange={(e) => setSelectedBarber(e.target.value)} required>
                          <option value="">-- Choose --</option>
                          {barbers.length > 0
                              ? barbers.map((b) => (<option key={b.id} value={b.id}>{b.full_name}</option>))
                              : <option disabled>No barbers currently available</option>}
                      </select>
                  </div>
                  {/* --- AI Section --- */}
                  <div className="ai-generator"><p className="ai-title">AI Haircut Preview (Optional)</p><div className="form-group"><label>1. Upload photo:</label><input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files[0]); setGeneratedImage(null); }} /></div><div className="form-group"><label>2. Describe haircut:</label><input type="text" value={prompt} placeholder="e.g., 'buzz cut'" onChange={(e) => setPrompt(e.target.value)} /></div><button type="button" onClick={handleGeneratePreview} className="generate-button" disabled={!file || !prompt || isLoading || isGenerating}>{isGenerating ? 'Generating...' : 'Generate AI Preview'}</button>{isLoading && isGenerating && <p className='loading-text'>Generating...</p>}{generatedImage && (<div className="image-preview"><p>AI Preview:</p><img src={generatedImage} alt="AI Generated"/><p className="success-text">Like it? Join Queue!</p></div>)}</div>
                  {/* --- Join Button --- */}
                  <button type="submit" disabled={isLoading || isGenerating || barbers.length === 0} className="join-queue-button">{isLoading ? 'Joining...' : (barbers.length === 0 ? 'No Barbers Available' : 'Join Queue')}</button>
                </form>
                {/* Display Messages */}
                {message && <p className={`message ${message.toLowerCase().includes('failed') || message.toLowerCase().includes('could not load') ? 'error' : ''}`}>{message}</p>}
           </>
        ) : (
           <div className="live-queue-view"> {/* --- LIVE QUEUE VIEW JSX --- */}
               <h2>Live Queue for {barbers.find(b => b.id === joinedBarberId)?.full_name || `Barber #${joinedBarberId}`}</h2>
               {queueMessage && <p className="message">{queueMessage}</p>}
               <ul className="queue-list live">{liveQueue.length === 0 && !queueMessage ? (<li className="empty-text">Queue is empty.</li>) : (liveQueue.map((entry, index) => (<li key={entry.id} className={`${entry.id === myQueueEntryId ? 'my-position' : ''} ${entry.status === 'Up Next' ? 'up-next-public' : ''}`}><span>{index + 1}. {entry.id === myQueueEntryId ? `You (${entry.customer_name})` : `Customer #${entry.id}`}</span><span className="queue-status">{entry.status}</span></li>)))}</ul>
               <button onClick={handleLeaveQueue} className='leave-queue-button'>Leave Queue / Join Another</button>
           </div>
        )}
      </div>
    );
}

// --- BarberDashboard (Handles Barber's Queue Management) ---
// Accepts props: barberId, barberName, onCutComplete
function BarberDashboard({ barberId, barberName, onCutComplete }) {
    const [queueDetails, setQueueDetails] = useState({ waiting: [], inProgress: null, upNext: null });
    const [error, setError] = useState('');

    // Fetch queue details function
    const fetchQueueDetails = async () => {
        if (!barberId) return; setError('');
        try { const response = await axios.get(`${API_URL}/queue/details/${barberId}`); setQueueDetails(response.data); }
        catch (err) { console.error('Failed fetch queue details:', err); setError('Could not load queue.'); setQueueDetails({ waiting: [], inProgress: null, upNext: null }); }
    };

    // UseEffect for initial load and realtime subscription
    useEffect(() => {
        if (!barberId || !supabase?.channel) return;
        fetchQueueDetails(); // Initial fetch
        const channel = supabase.channel(`barber_queue_${barberId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${barberId}` }, (payload) => { fetchQueueDetails(); }) // Refetch on any change
            .subscribe((status, err) => { if (status !== 'SUBSCRIBED') console.error(`Barber subscription error: ${status}`, err); });
        // Cleanup function
        return () => { if (channel && supabase?.removeChannel) supabase.removeChannel(channel); };
    }, [barberId]); // Re-subscribe if barberId changes

    // Handler for calling the next customer
    const handleNextCustomer = async () => {
        const next = queueDetails.upNext || (queueDetails.waiting.length > 0 ? queueDetails.waiting[0] : null);
        if (!next) { alert('Queue empty!'); return; }
        if (queueDetails.inProgress) { alert(`Complete ${queueDetails.inProgress.customer_name} first.`); return; }
        setError('');
        try { await axios.put(`${API_URL}/queue/next`, { queue_id: next.id, barber_id: barberId }); } // Send request
        catch (err) { console.error('Failed next customer:', err); setError(err.response?.data?.error || 'Failed call next.'); }
        // Realtime listener will handle the state update
    };

    // Handler for completing a cut
    const handleCompleteCut = async () => {
        if (!queueDetails.inProgress) return;
        const price = prompt(`Enter price for ${queueDetails.inProgress.customer_name}:`);
        if (price === null) return; const p = parseInt(price);
        if (isNaN(p) || p < 0) { alert('Invalid price.'); return; }
        setError('');
        try { await axios.post(`${API_URL}/queue/complete`, { queue_id: queueDetails.inProgress.id, barber_id: barberId, price: p }); onCutComplete(); } // Call callback
        catch (err) { console.error('Failed complete cut:', err); setError(err.response?.data?.error || 'Failed complete cut.'); }
        // Realtime listener will handle the state update
    };

    // Determine which button to show
    const getActionButton = () => {
        if (queueDetails.inProgress) return <button onClick={handleCompleteCut} className="complete-button">Complete: {queueDetails.inProgress.customer_name}</button>;
        const nextPerson = queueDetails.upNext || (queueDetails.waiting.length > 0 ? queueDetails.waiting[0] : null);
        if (nextPerson) return <button onClick={handleNextCustomer} className="next-button">Call: {nextPerson.customer_name}</button>;
        return <button className="next-button disabled" disabled>Queue Empty</button>;
    };

    // Render the dashboard UI
    return ( <div className="card"><h2>My Queue ({barberName || '...'})</h2>{error && <p className="error-message">{error}</p>}{getActionButton()}<h3 className="queue-subtitle">In Chair</h3>{queueDetails.inProgress ? (<ul className="queue-list"><li className="in-progress"><strong>{queueDetails.inProgress.customer_name}</strong>{queueDetails.inProgress.reference_image_url && (<a href={queueDetails.inProgress.reference_image_url} target="_blank" rel="noopener noreferrer" className="photo-link">Ref Photo</a>)}</li></ul>) : (<p className="empty-text">Chair empty</p>)}<h3 className="queue-subtitle">Up Next</h3>{queueDetails.upNext ? (<ul className="queue-list"><li className="up-next"><strong>{queueDetails.upNext.customer_name}</strong>{queueDetails.upNext.reference_image_url && (<a href={queueDetails.upNext.reference_image_url} target="_blank" rel="noopener noreferrer" className="photo-link">Ref Photo</a>)}</li></ul>) : (<p className="empty-text">Nobody Up Next</p>)}<h3 className="queue-subtitle">Waiting</h3><ul className="queue-list">{queueDetails.waiting.length === 0 ? (<li className="empty-text">Waiting queue empty.</li>) : (queueDetails.waiting.map(c => (<li key={c.id}>{c.customer_name}{c.reference_image_url && (<a href={c.reference_image_url} target="_blank" rel="noopener noreferrer" className="photo-link">Ref Photo</a>)}</li>)))}</ul><button onClick={fetchQueueDetails} className="refresh-button small">Refresh Queue</button></div> );
}

// --- AnalyticsDashboard (Displays Barber Stats) ---
// Accepts props: barberId, refreshSignal
function AnalyticsDashboard({ barberId, refreshSignal }) {
   const [analytics, setAnalytics] = useState({ totalEarningsToday: 0, totalCutsToday: 0, totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0 });
   const [error, setError] = useState('');

   // Fetch analytics data function
   const fetchAnalytics = async () => {
      if (!barberId) return; setError('');
      try { const response = await axios.get(`${API_URL}/analytics/${barberId}`); setAnalytics({ dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, ...response.data }); } // Set state with defaults
      catch (err) { console.error('Failed fetch analytics:', err); setError('Could not load analytics.'); setAnalytics({ totalEarningsToday: 0, totalCutsToday: 0, totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0 }); } // Reset on error
    };

    // UseEffect to fetch data on load and when signal/barberId changes
    useEffect(() => { fetchAnalytics(); }, [refreshSignal, barberId]);

    // Calculate derived values (averages)
    const avgPriceToday = (analytics.totalCutsToday ?? 0) > 0 ? ((analytics.totalEarningsToday ?? 0) / analytics.totalCutsToday).toFixed(2) : '0.00';
    const avgPriceWeek = (analytics.totalCutsWeek ?? 0) > 0 ? ((analytics.totalEarningsWeek ?? 0) / analytics.totalCutsWeek).toFixed(2) : '0.00';

    // Chart configuration
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Earnings per Day (Last 7 Days)' } }, scales: { y: { beginAtZero: true } } };
    const dailyDataSafe = Array.isArray(analytics.dailyData) ? analytics.dailyData : []; // Ensure it's an array
    // Prepare chart data
    const chartData = { labels: dailyDataSafe.map(d => { try { return new Date(d.day + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }); } catch (e) { return '?'; } }), datasets: [{ label: 'Daily Earnings ($)', data: dailyDataSafe.map(d => d.daily_earnings ?? 0), backgroundColor: 'rgba(52, 199, 89, 0.6)', borderColor: 'rgba(52, 199, 89, 1)', borderWidth: 1 }] };

    // Render the analytics dashboard UI
    return ( <div className="card analytics-card"><h2>Dashboard</h2>{error && <p className="error-message">{error}</p>}<h3 className="analytics-subtitle">Today</h3><div className="analytics-grid"><div className="analytics-item"><span className="analytics-label">Earnings</span><span className="analytics-value">${analytics.totalEarningsToday ?? 0}</span></div><div className="analytics-item"><span className="analytics-label">Cuts</span><span className="analytics-value">{analytics.totalCutsToday ?? 0}</span></div><div className="analytics-item"><span className="analytics-label">Avg Price</span><span className="analytics-value small">${avgPriceToday}</span></div><div className="analytics-item"><span className="analytics-label">Queue Size</span><span className="analytics-value small">{analytics.currentQueueSize ?? 0}</span></div></div><h3 className="analytics-subtitle">Last 7 Days</h3><div className="analytics-grid"><div className="analytics-item"><span className="analytics-label">Total Earnings</span><span className="analytics-value">${analytics.totalEarningsWeek ?? 0}</span></div><div className="analytics-item"><span className="analytics-label">Total Cuts</span><span className="analytics-value">{analytics.totalCutsWeek ?? 0}</span></div><div className="analytics-item"><span className="analytics-label">Avg Price</span><span className="analytics-value small">${avgPriceWeek}</span></div><div className="analytics-item"><span className="analytics-label">Busiest Day</span><span className="analytics-value small">{analytics.busiestDay?.name ?? 'N/A'} (${analytics.busiestDay?.earnings ?? 0})</span></div></div><div className="chart-container">{dailyDataSafe.length > 0 ? (<div style={{ height: '250px' }}><Bar options={chartOptions} data={chartData} /></div>) : (<p className='empty-text'>No chart data yet.</p>)}</div><button onClick={fetchAnalytics} className="refresh-button">Refresh Stats</button></div> );
}


// ##############################################
// ##           MAIN APP COMPONENT             ##
// ##############################################
function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null); // null = loading, 'customer', 'barber'
  const [barberProfile, setBarberProfile] = useState(null); // Holds { id, user_id, full_name, is_available } for logged in barber
  const [loadingRole, setLoadingRole] = useState(true); // Tracks initial session/role check

  // --- Check Session and Role on Load & Auth Changes ---
  useEffect(() => {
    if (!supabase?.auth) { console.error("Supabase auth not initialized."); setLoadingRole(false); return; }

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      checkUserRole(currentSession?.user); // Chain role check after getting session
    }).catch(err => { console.error("Error getting initial session:", err); setLoadingRole(false); }); // Stop loading on error

    // 2. Listen for Auth State Changes (SIGN_IN, SIGNED_OUT, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
       console.log("Auth State Change Detected:", _event, currentSession);
       setSession(currentSession); // Update session state immediately
       // Reset role/profile before re-checking if user exists
       setUserRole(null); setBarberProfile(null); setLoadingRole(true);
       if (currentSession?.user) {
            checkUserRole(currentSession.user); // Check role if user exists
       } else {
            // User logged out or session expired
            setLoadingRole(false); // No role to check, stop loading
       }
    });

    // 3. Cleanup listener on component unmount
    return () => subscription?.unsubscribe();
  }, []); // Run only once on mount


  // --- Helper to Check Role via Backend ---
  const checkUserRole = async (user) => {
     if (!user) { // No user logged in
         setUserRole('customer'); // Default to customer view (though App logic will show AuthForm)
         setBarberProfile(null);
         setLoadingRole(false);
         return;
     }
     setLoadingRole(true); // Indicate we are checking the role
     try {
         // Call backend endpoint to get profile based on user_id
         const response = await axios.get(`${API_URL}/barber/profile/${user.id}`);
         // If backend returns a profile (status 200), user is a barber
         setUserRole('barber');
         setBarberProfile(response.data); // Store the fetched profile data
         console.log("User role determined: Barber", response.data);
         // Auto-set available ONLY if profile exists AND they are currently offline
         // This ensures barbers appear online when they log in / refresh
         if (response.data && !response.data.is_available) {
              updateAvailability(response.data.id, user.id, true); // Mark available
         }
     } catch(error) {
         if (error.response && error.response.status === 404) {
             // Backend confirmed: No barber profile found for this user ID
             setUserRole('customer');
             console.log("User role determined: Customer (profile not found for ID:", user.id, ")");
         } else {
             // Other errors (network, server error fetching profile, etc.)
             console.error("Error checking/fetching barber profile via backend:", error);
             setUserRole('customer'); // Default to customer on other errors
         }
         setBarberProfile(null); // Ensure profile is null if not barber or on error
     } finally {
         setLoadingRole(false); // Role check finished
     }
  };

   // --- Helper to Update Availability (called by toggle or login) ---
   const updateAvailability = async (barberId, userId, isAvailable) => {
       if (!barberId || !userId) return;
       try {
           // Call backend to update DB
           const response = await axios.put(`${API_URL}/barber/availability`, { barberId, userId, isAvailable });
           // Update local profile state immediately based on successful response
           // This keeps the UI (like the toggle) consistent
            setBarberProfile(prev => prev ? { ...prev, is_available: response.data.is_available } : null);
       } catch (error) {
            console.error("Failed to update availability state:", error);
            // Optionally show an error message to the barber
       }
   };


  // --- Render Logic based on Authentication and Role ---
  if (loadingRole) { // Show loading until the initial session AND role check are complete
      return <div className="loading-fullscreen">Loading Application...</div>;
  }

  if (!session) {
    // If no user session, show the Login/Signup form
    return <AuthForm />;
  }
  // If session exists, but role is still loading (should be brief after initial load)
  else if (userRole === null) {
     return <div className="loading-fullscreen">Verifying User Role...</div>;
  }
  // If role is barber AND profile is successfully loaded
  else if (userRole === 'barber' && barberProfile) {
    // Pass setBarberProfile down so layout can clear it on logout
    return <BarberAppLayout session={session} barberProfile={barberProfile} setBarberProfile={setBarberProfile} />;
  }
  // Otherwise (role is customer, or maybe barber profile failed to load but they are logged in)
  else {
    return <CustomerAppLayout session={session} />;
  }
}

export default App;