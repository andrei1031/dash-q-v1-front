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
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [barberCode, setBarberCode] = useState(''); // For barber signup
    const [fullName, setFullName] = useState('');     // For barber signup
    const [isLogin, setIsLogin] = useState(true);   // Toggle between Login and Signup
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        if (!supabase?.auth) { setMessage("Authentication service is unavailable."); return; }
        setLoading(true);
        setMessage('');

        // --- Use Barber Code from Environment or default ---
        const CORRECT_BARBER_CODE = process.env.REACT_APP_BARBER_SIGNUP_CODE || '08082025'; // Consider env variable

        try {
            let error;
            if (isLogin) {
                // --- Login ---
                ({ error } = await supabase.auth.signInWithPassword({ email, password }));
                if (error) throw error;
                // Success: Auth listener in App will handle redirect/role check
            } else {
                // --- Sign Up ---
                const isAttemptingBarberSignup = barberCode.trim() !== '';

                if (isAttemptingBarberSignup && barberCode.trim() === CORRECT_BARBER_CODE) {
                    // --- Barber Signup via Backend ---
                    if (!fullName.trim()) { throw new Error("Full Name is required for barber signup."); }
                    console.log('Attempting barber signup via backend...');
                    const response = await axios.post(`${API_URL}/signup/barber`, {
                        email, password, barberCode: barberCode.trim(), fullName: fullName.trim()
                    });
                    setMessage(response.data.message || 'Barber signup successful! Please login.');
                    // Clear form for login after successful barber signup
                    setEmail(''); setPassword(''); setBarberCode(''); setFullName(''); setIsLogin(true); // Switch to login view

                } else {
                    // --- Customer Signup or Failed Barber Code ---
                     if (isAttemptingBarberSignup) { // Code entered but was wrong
                         setMessage('Invalid Barber Code. Signing up as customer.');
                         // Fall through to customer signup
                     } else {
                        console.log('Attempting customer signup via Supabase client...');
                     }

                    ({ error } = await supabase.auth.signUp({
                         email,
                         password,
                         // Optional: Add metadata for customer name if needed later
                         // options: { data: { full_name: fullName.trim() } }
                    }));
                    if (error) throw error;
                    setMessage('Customer signup successful! Check your email for verification if required.');
                     // Clear form after successful customer signup
                    setEmail(''); setPassword(''); setBarberCode(''); setFullName('');
                }
            }
        } catch (error) {
            console.error('Auth error:', error);
            // Prioritize backend error message if available (from barber signup)
            setMessage(`Authentication failed: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card auth-card">
            <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleAuth}>
                <div className="form-group">
                    <label>Email:</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"/>
                </div>
                <div className="form-group">
                    <label>Password:</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" autoComplete={isLogin ? "current-password" : "new-password"}/>
                </div>

                {!isLogin && ( // Only show these for Sign Up
                  <>
                    <div className="form-group">
                      <label>Full Name:</label>
                      {/* Make required only if attempting barber signup or always? Let's make it always for signup */}
                      <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required={!isLogin} autoComplete="name"/>
                    </div>
                    <div className="form-group">
                      <label>Barber Code (Optional):</label>
                      <input type="text" value={barberCode} placeholder="Enter code ONLY if you are a barber" onChange={(e) => setBarberCode(e.target.value)} />
                       <small>Leave blank to sign up as a customer.</small>
                    </div>
                  </>
                )}

                <button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                </button>
            </form>
            {message && <p className={`message ${message.includes('successful') ? 'success' : 'error'}`}>{message}</p>}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setMessage(''); /* Clear message on toggle */ }} className="toggle-auth-button">
                {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
            </button>
        </div>
    );
}


// ##############################################
// ##      BARBER-SPECIFIC COMPONENTS          ##
// ##############################################

function AvailabilityToggle({ barberProfile, session, onAvailabilityChange }) { // Add callback
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
                barberId: barberProfile.id,
                isAvailable: newAvailability,
                userId: session.user.id
            });
            // Call the callback to update the parent's state
            onAvailabilityChange(response.data.is_available);
            console.log("Availability updated:", response.data);
        } catch (err) {
            console.error("Failed to toggle availability:", err);
            setError(err.response?.data?.error || "Could not update status.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="availability-toggle">
            <p>Status: <strong>{isAvailable ? 'Available' : 'Offline'}</strong></p>
            <button onClick={handleToggle} disabled={loading} className={isAvailable ? 'go-offline-button' : 'go-online-button'}>
                {loading ? '...' : (isAvailable ? 'Go Offline' : 'Go Online')}
            </button>
             {error && <p className="error-message small">{error}</p>}
        </div>
    );
}

// Main Layout for Logged-In Barbers
function BarberAppLayout({ session, barberProfile, setBarberProfile, checkUserRole }) { // Pass checkUserRole down
    const [refreshSignal, setRefreshSignal] = useState(0);

    const handleLogout = async () => {
        if (!barberProfile || !session?.user || !supabase?.auth) return;
        try {
            await axios.put(`${API_URL}/barber/availability`, {
                 barberId: barberProfile.id, isAvailable: false, userId: session.user.id
            });
        } catch (error) { console.error("Error setting offline on logout:", error); }
        finally {
             await supabase.auth.signOut();
             setBarberProfile(null); // Clear profile in parent state immediately
        }
    };

    const handleCutComplete = () => { setRefreshSignal(prev => prev + 1); };

    // Callback for AvailabilityToggle to update parent state
    const handleAvailabilityChange = (newAvailabilityStatus) => {
         setBarberProfile(prev => prev ? { ...prev, is_available: newAvailabilityStatus } : null);
    };


    const currentBarberId = barberProfile?.id;
    const currentBarberName = barberProfile?.full_name;

    // Fetch/Re-check barber profile on mount/session change if needed
    // The main App component already does this, but adding a refresh might be useful
    // useEffect(() => { checkUserRole(session?.user); }, [session, checkUserRole]);


    return (
        <div className="app-layout barber-layout">
            <header className="app-header">
                <h1>Barber Dashboard ({currentBarberName || '...'})</h1>
                 <div className='header-controls'>
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
                    <div className="card"><p>Loading barber details...</p></div>
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
// ##      MODIFIED CHILD COMPONENTS           ##
// ##############################################

// --- CustomerView (Handles Joining Queue & Live View for Customers) ---
function CustomerView({ session }) {
   const [barbers, setBarbers] = useState([]); // Available barbers
   const [selectedBarber, setSelectedBarber] = useState('');
   const [customerName, setCustomerName] = useState('');
   const [customerPhone, setCustomerPhone] = useState('');
   const [customerEmail, setCustomerEmail] = useState('');
   const [message, setMessage] = useState(''); // General messages

   // Queue State
   const [myQueueEntryId, setMyQueueEntryId] = useState(null);
   const [joinedBarberId, setJoinedBarberId] = useState(null);
   const [liveQueue, setLiveQueue] = useState([]);
   const [queueMessage, setQueueMessage] = useState(''); // Queue specific messages

   // AI State
   const [file, setFile] = useState(null);
   const [prompt, setPrompt] = useState('');
   const [generatedImage, setGeneratedImage] = useState(null);
   const [isGenerating, setIsGenerating] = useState(false);
   const [isLoading, setIsLoading] = useState(false); // For joining queue mainly

   // Fetch Available Barbers
   useEffect(() => {
        const loadAvailableBarbers = async () => {
          setMessage('Loading available barbers...');
          try {
            const response = await axios.get(`${API_URL}/barbers`);
            setBarbers(response.data || []);
             setMessage('');
          } catch (error) { console.error('Failed fetch available barbers:', error); setMessage('Could not load barbers.'); }
        };
        loadAvailableBarbers();
    }, []);

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
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); }

        let queueChannel = null;
        if (joinedBarberId && supabase?.channel) {
            console.log(`Subscribing queue changes: barber ${joinedBarberId}`);
            queueChannel = supabase.channel(`public_queue_${joinedBarberId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${joinedBarberId}` }, (payload) => {
                    console.log('Queue change! Payload:', payload);
                    fetchPublicQueue(joinedBarberId); // Refresh list on any change

                    // Check for MY notification
                    if (payload.eventType === 'UPDATE' && payload.new.id === myQueueEntryId && payload.new.status === 'Up Next') {
                        console.log('My status is Up Next! Notify!');
                        if (Notification.permission === "granted") { new Notification("You're next at Dash-Q!", { body: "Please head over now." }); }
                        else { alert("You're next at Dash-Q! Please head over now."); }
                    }
                })
                .subscribe((status, err) => {
                     if (status === 'SUBSCRIBED') { console.log('Subscribed to Realtime queue!'); fetchPublicQueue(joinedBarberId); }
                     else { console.error('Supabase Realtime subscription error:', status, err); setQueueMessage('Live updates unavailable.'); }
                });
        }
        return () => { // Cleanup
            if (queueChannel && supabase?.removeChannel) { supabase.removeChannel(queueChannel); console.log("Cleaned up queue subscription."); }
        };
    }, [joinedBarberId, myQueueEntryId]); // Dependencies

   // AI Preview Handler
   const handleGeneratePreview = async () => { /* ... code from previous version ... */ };
   // Join Queue Handler
   const handleJoinQueue = async (e) => { /* ... code from previous version ... */ };
   // Leave Queue Handler (using correct function name now)
   const handleLeaveQueue = () => {
        if (joinedBarberId && supabase?.removeChannel) { supabase.removeChannel(supabase.channel(`public_queue_${joinedBarberId}`)).then(() => console.log('Unsubscribed on leaving queue.')); }
        setMyQueueEntryId(null); setJoinedBarberId(null); setLiveQueue([]); setMessage(''); setQueueMessage(''); setSelectedBarber(''); setGeneratedImage(null); setFile(null); setPrompt('');
    };

   // --- Render Customer View ---
   return (
      <div className="card">
        {!myQueueEntryId ? (
           <> {/* --- JOIN FORM JSX --- */}
               <h2>Join the Queue</h2>
                <form onSubmit={handleJoinQueue}>
                  {/* Form fields: Name, Phone, Email, Barber Select */}
                  <div className="form-group"><label>Your Name:</label><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required /></div>
                  <div className="form-group"><label>Your Phone (Optional):</label><input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
                  <div className="form-group"><label>Your Email (Optional):</label><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
                  <div className="form-group"><label>Select Available Barber:</label><select value={selectedBarber} onChange={(e) => setSelectedBarber(e.target.value)} required><option value="">-- Choose --</option>{barbers.length > 0 ? barbers.map((b) => (<option key={b.id} value={b.id}>{b.full_name}</option>)) : <option disabled>No barbers available</option>}</select></div>

                  {/* AI Section */}
                  <div className="ai-generator"><p className="ai-title">AI Haircut Preview (Optional)</p><div className="form-group"><label>1. Upload photo:</label><input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files[0]); setGeneratedImage(null); }} /></div><div className="form-group"><label>2. Describe haircut:</label><input type="text" value={prompt} placeholder="e.g., 'buzz cut'" onChange={(e) => setPrompt(e.target.value)} /></div><button type="button" onClick={handleGeneratePreview} className="generate-button" disabled={!file || !prompt || isLoading || isGenerating}>{isGenerating ? 'Generating...' : 'Generate AI Preview'}</button>{isLoading && isGenerating && <p className='loading-text'>Generating...</p>}{generatedImage && (<div className="image-preview"><p>AI Preview:</p><img src={generatedImage} alt="AI Generated"/><p className="success-text">Like it? Join Queue!</p></div>)}</div>

                  {/* Submit Button */}
                  <button type="submit" disabled={isLoading || isGenerating || barbers.length === 0} className="join-queue-button">{isLoading ? 'Joining...' : (barbers.length === 0 ? 'No Barbers Available' : 'Join Queue')}</button>
                </form>
                {message && <p className="message">{message}</p>}
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
// (No changes needed from previous complete version - accepts props)
function BarberDashboard({ barberId, barberName, onCutComplete }) { /* ... code from previous version ... */ }

// --- AnalyticsDashboard (Displays Barber Stats) ---
// (No changes needed from previous complete version - accepts props)
function AnalyticsDashboard({ barberId, refreshSignal }) { /* ... code from previous version ... */ }


// ##############################################
// ##           MAIN APP COMPONENT             ##
// ##############################################
function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null); // null = loading, 'customer', 'barber'
  const [barberProfile, setBarberProfile] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // Check Session and Role
  useEffect(() => {
    if (!supabase?.auth) { console.error("Supabase auth not initialized."); setLoadingRole(false); return; }

    // Initial check
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      checkUserRole(currentSession?.user); // Chain role check
    }).catch(err => { console.error("Error getting session:", err); setLoadingRole(false); });

    // Listener for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      // Reset state before re-checking
      setUserRole(null); setBarberProfile(null); setLoadingRole(true);
      checkUserRole(currentSession?.user);
    });

    return () => subscription?.unsubscribe();
  }, []); // Run only on mount


  // Helper to Check Role via Backend
  const checkUserRole = async (user) => {
     if (!user) { setUserRole('customer'); setBarberProfile(null); setLoadingRole(false); return; }
     setLoadingRole(true);
     try {
         const response = await axios.get(`${API_URL}/barber/profile/${user.id}`);
         // Status 200 means profile found -> barber
         setUserRole('barber');
         setBarberProfile(response.data);
         console.log("User role: Barber", response.data);
         // Auto-set available on login if profile exists and they aren't already available
         if (!response.data.is_available) {
              updateAvailability(response.data.id, user.id, true);
         }
     } catch(error) {
         if (error.response && error.response.status === 404) {
             // Backend confirmed: Not a barber
             setUserRole('customer');
             console.log("User role: Customer (profile not found)");
         } else {
             console.error("Error checking/fetching barber profile:", error);
             setUserRole('customer'); // Default to customer on other errors
         }
         setBarberProfile(null); // Ensure profile is null if not barber
     } finally {
         setLoadingRole(false);
     }
  };

   // Helper to Update Availability
   const updateAvailability = async (barberId, userId, isAvailable) => {
       if (!barberId || !userId) return;
       try {
           const response = await axios.put(`${API_URL}/barber/availability`, { barberId, userId, isAvailable });
           // Update local profile state to reflect change immediately
            setBarberProfile(prev => prev ? { ...prev, is_available: response.data.is_available } : null);
       }
       catch (error) { console.error("Failed to update availability state:", error); }
   };

  // --- Render based on state ---
  if (loadingRole || (session && userRole === null)) { // Show loading until role is determined
      return <div className="loading-fullscreen">Loading...</div>;
  }

  if (!session) {
    return <AuthForm />; // Show login/signup
  } else if (userRole === 'barber' && barberProfile) { // Ensure profile is loaded too
    // Pass checkUserRole down so layout can potentially refresh profile
    return <BarberAppLayout session={session} barberProfile={barberProfile} setBarberProfile={setBarberProfile} checkUserRole={checkUserRole} />;
  } else { // Customer or barber profile failed to load
    return <CustomerAppLayout session={session} />;
  }
}

export default App;