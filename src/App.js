import React, { useState, useEffect, useCallback, useRef } from 'react'; // --- MODIFIED: Added useCallback ---
import io from 'socket.io-client';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// --- Chart.js Imports ---
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

import './App.css';

const SOCKET_URL = 'https://dash-q-backend.onrender.com'; // Your backend URL
// const SOCKET_URL = 'http://localhost:3001'; // For local testing
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

function ChatWindow({ currentUser_id, otherUser_id }) { // Pass user IDs as props
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket server
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;

    // Register this user with the server
    socket.emit('register', currentUser_id);

    // Listen for incoming messages
    socket.on('chat message', (incomingMessage) => {
      // Only add messages relevant to this chat window
      if (incomingMessage.senderId === otherUser_id) {
          setMessages((prevMessages) => [...prevMessages, incomingMessage]);
      }
    });

    // Handle connection errors (optional but recommended)
    socket.on('connect_error', (err) => {
        console.error("WebSocket Connection Error:", err);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [currentUser_id, otherUser_id]); // Reconnect if users change

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socketRef.current) {
      const messageData = { 
          senderId: currentUser_id, 
          recipientId: otherUser_id, 
          message: newMessage 
      };
      socketRef.current.emit('chat message', messageData);
      // Add message to local state immediately (optimistic update)
      setMessages((prevMessages) => [...prevMessages, { senderId: currentUser_id, message: newMessage }]);
      setNewMessage('');
    }
  };

  return (
    <div className="chat-window">
      <div className="message-list">
        {messages.map((msg, index) => (
          <div key={index} className={msg.senderId === currentUser_id ? 'my-message' : 'other-message'}>
            {msg.message}
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="message-input-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}


// ##############################################
// ##          LOGIN/SIGNUP COMPONENTS         ##
// ##############################################

function AuthForm() {
    // State for username/email/password etc.
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [barberCode, setBarberCode] = useState(''); // For Barber Signup
    const [pin, setPin] = useState(''); // Barber PIN input for login
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedRole, setSelectedRole] = useState('customer'); // 'customer' or 'barber'

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (isLogin) {
                // --- LOGIN Logic (Username/Password) ---
                if (!username || !password) throw new Error("Username and password required.");
                if (selectedRole === 'barber' && !pin) throw new Error("Barber PIN required for barber login.");

                // 1. Call backend to verify credentials and get user email
                const response = await axios.post(`${API_URL}/login/username`, {
                    username: username.trim(), password: password, role: selectedRole, pin: selectedRole === 'barber' ? pin : undefined
                });

                // 2. If backend verified, use email+pass with Supabase client to set session.
                if (response.data.user?.email && supabase?.auth) {
                     const { error: clientSignInError } = await supabase.auth.signInWithPassword({
                         email: response.data.user.email, password: password,
                     });
                     if (clientSignInError) { throw clientSignInError; }
                 } else { throw new Error("Login failed: Invalid response from server."); }

            } else {
                // --- SIGN UP Logic ---
                 if (!email.trim() || !fullName.trim()) { throw new Error("Email and Full Name are required for signup."); }
                 if (selectedRole === 'barber' && !barberCode.trim()) { throw new Error("Barber Code required for barber signup."); }

                // Call backend signup endpoint
                const response = await axios.post(`${API_URL}/signup/username`, {
                    username: username.trim(), email: email.trim(), password: password, fullName: fullName.trim(),
                    role: selectedRole, barberCode: selectedRole === 'barber' ? barberCode.trim() : undefined
                });
                setMessage(response.data.message || 'Signup successful!');
                setIsLogin(true); // Switch to login view after signup
                // Clear all fields after successful signup
                setUsername(''); setEmail(''); setPassword(''); setFullName(''); setBarberCode(''); setPin(''); setSelectedRole('customer');
            }
        } catch (error) {
            console.error('Auth error:', error);
            setMessage(`Authentication failed: ${error.response?.data?.error || error.message || 'An unexpected error occurred.'}`);
        } finally {
            setLoading(false);
        }
    };

    // Render Auth Form
    return (
        <div className="card auth-card">
            <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleAuth}>
                {/* Username */}
                <div className="form-group"> <label>Username:</label> <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength="3" autoComplete="username"/> </div>
                {/* Password */}
                <div className="form-group"> <label>Password:</label> <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" autoComplete={isLogin ? "current-password" : "new-password"}/> </div>

                {/* --- Login Specific Fields (Role Toggle & PIN) --- */}
                {isLogin && (
                    <div className="login-role-select">
                        <label>Login As:</label>
                        <div className="role-toggle">
                            <button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button>
                            <button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button>
                        </div>
                        {selectedRole === 'barber' && ( // PIN only if barber login
                            <div className="form-group pin-input">
                                <label>Barber PIN:</label>
                                <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} required={selectedRole === 'barber'} autoComplete="off" />
                            </div>
                        )}
                    </div>
                )}

                {/* --- Signup Specific Fields --- */}
                {!isLogin && (
                  <>
                    {/* Role Toggle for Signup */}
                    <div className="signup-role-select">
                        <label>Sign Up As:</label>
                        <div className="role-toggle">
                             <button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button>
                             <button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button>
                        </div>
                    </div>
                    {/* Email for Signup */}
                    <div className="form-group"><label>Email:</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!isLogin} autoComplete="email"/><small>Needed for account functions.</small></div>
                    {/* Full Name for Signup */}
                    <div className="form-group"> <label>Full Name:</label> <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required={!isLogin} autoComplete="name"/> </div>
                    {/* Barber Code for Signup (Conditional) */}
                    {selectedRole === 'barber' && (
                         <div className="form-group">
                            <label>Barber Code:</label>
                            <input type="text" value={barberCode} placeholder="Enter secret barber code" onChange={(e) => setBarberCode(e.target.value)} required={selectedRole === 'barber' && !isLogin} />
                            <small>Required to sign up as a barber.</small>
                         </div>
                    )}
                  </>
                )}

                {/* Submit Button */}
                <button type="submit" disabled={loading}>{loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}</button>
            </form>
            {/* Message Area */}
            {message && <p className={`message ${message.includes('successful') || message.includes('created') ? 'success' : 'error'}`}>{message}</p>}
            {/* Toggle Button */}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setMessage(''); setSelectedRole('customer'); setPin(''); setBarberCode(''); /* Reset states on toggle */ }} className="toggle-auth-button">{isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}</button>
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
function BarberAppLayout({ session, barberProfile, setBarberProfile }) {
    const [refreshSignal, setRefreshSignal] = useState(0);

    // --- Auto-Offline on Browser/Tab Close ---
    useEffect(() => {
        const handleBeforeUnload = (e) => { // Removed async, not reliable with beacon
            if (barberProfile?.id && session?.user) {
                // Use sendBeacon for reliable sync request on page close
                navigator.sendBeacon(
                    `${API_URL}/barber/availability`, 
                    JSON.stringify({ 
                        barberId: barberProfile.id, 
                        isAvailable: false, 
                        userId: session.user.id 
                    })
                );
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [barberProfile, session]); // Dependency on profile/session ensures data is current

    const handleLogout = async () => {
        if (!barberProfile || !session?.user || !supabase?.auth) return;

        try {
            // 1. Attempt to set status offline
            await axios.put(`${API_URL}/barber/availability`, {
                 barberId: barberProfile.id, isAvailable: false, userId: session.user.id
            });
        } catch (error) { console.error("Error setting offline on logout:", error); }
        finally {
            // 2. CRITICAL: Clear the session in browser storage and redirect
            await supabase.auth.signOut(); 
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
                     {/* My Queue (BarberDashboard) */}
                     <BarberDashboard
                        barberId={currentBarberId}
                        barberName={currentBarberName}
                        onCutComplete={handleCutComplete}
                        session={session}
                     />
                     {/* Analytics Dashboard */}
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
         
         try {
             // --- Tell backend to clear the session flag ---
             await axios.put(`${API_URL}/logout/flag`, { 
                 userId: session.user.id 
             });
         } catch (error) {
             console.error("Error clearing customer session flag:", error);
         }
         
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
// ##      BLINKING TAB HELPER FUNCTIONS       ##
// ##############################################
// --- NEW: Moved blinking logic outside the component ---
// These are defined once and won't be recreated on every render.
let blinkInterval = null;
let originalTitle = document.title;
const alertTitle = "!! IT'S YOUR TURN !!";

/**
 * Starts the blinking browser tab.
 */
function startBlinking() {
    if (blinkInterval) return; // Already blinking
    
    originalTitle = document.title; // Capture the title *at the time of starting*
    let isOriginalTitle = true;
  
    blinkInterval = setInterval(() => {
        document.title = isOriginalTitle ? alertTitle : originalTitle;
        isOriginalTitle = !isOriginalTitle;
    }, 1000); // Blinks every 1 second
}

/**
 * Stops the blinking browser tab and resets the title.
 */
function stopBlinking() {
    if (!blinkInterval) return; // Not blinking
    
    clearInterval(blinkInterval);
    blinkInterval = null;
    document.title = originalTitle; // Reset to original
}


// ##############################################
// ##      CHILD COMPONENTS (Customer/Barber)  ##
// ##############################################

// --- CustomerView (Handles Joining Queue & Live View for Customers) ---
function CustomerView({ session }) {
   const [barbers, setBarbers] = useState([]);
   const [selectedBarber, setSelectedBarber] = useState('');
   const [customerName, setCustomerName] = useState(
       () => session.user?.user_metadata?.full_name || ''
   );
   const [customerPhone, setCustomerPhone] = useState(''); // This one stays blank
   const [customerEmail, setCustomerEmail] = useState(
       () => session.user?.email || ''
   );
   const [message, setMessage] = useState('');
   const [player_id, setPlayerId] = useState(null);

   const [myQueueEntryId, setMyQueueEntryId] = useState(
       () => localStorage.getItem('myQueueEntryId') || null
   );
   const [joinedBarberId, setJoinedBarberId] = useState(
       () => localStorage.getItem('joinedBarberId') || null
   );

   const [liveQueue, setLiveQueue] = useState([]);
   const [queueMessage, setQueueMessage] = useState('');
   const [estimatedWait, setEstimatedWait] = useState(0);
   const [peopleWaiting, setPeopleWaiting] = useState(0);
   const [file, setFile] = useState(null);
   const [prompt, setPrompt] = useState('');
   const [generatedImage, setGeneratedImage] = useState(null);
   const [isGenerating, setIsGenerating] = useState(false);
   const [isLoading, setIsLoading] = useState(false); // Used for join/leave/AI
   const [isQueueLoading, setIsQueueLoading] = useState(true); // --- NEW: State for initial queue load ---
   const [services, setServices] = useState([]);
   const [selectedServiceId, setSelectedServiceId] = useState('');
   const [isChatOpen, setIsChatOpen] = useState(false);
   const [chatTargetBarberUserId, setChatTargetBarberUserId] = useState(null);
   const [isYourTurnModalOpen, setIsYourTurnModalOpen] = useState(false);

   // --- Moved Calculations inside component body ---
   // These will re-calculate whenever liveQueue changes
   const nowServing = liveQueue.find(entry => entry.status === 'In Progress');
   const upNext = liveQueue.find(entry => entry.status === 'Up Next');
   const currentBarberName = barbers.find(b => b.id === parseInt(joinedBarberId))?.full_name || `Barber #${joinedBarberId}`;


   // Fetch Public Queue Data
   // --- MODIFIED: Added useCallback and loading state ---
   const fetchPublicQueue = useCallback(async (barberId) => {
      if (!barberId) {
          setLiveQueue([]);
          setIsQueueLoading(false); // Stop loading if no barber
          return;
      }
      setIsQueueLoading(true); // Start loading before fetch
      try {
        const response = await axios.get(`${API_URL}/queue/public/${barberId}`);
        setLiveQueue(response.data || []);
      } catch (error) {
          console.error("Failed fetch public queue:", error);
          setLiveQueue([]);
          setQueueMessage("Could not load queue data."); // Show error
      } finally {
          setIsQueueLoading(false); // Stop loading after fetch/error
      }
    }, []); // Empty dependency array for useCallback

   // --- Fetch Service Menu (Runs only once) ---
   useEffect(() => {
        const fetchServices = async () => {
            try {
                const response = await axios.get(`${API_URL}/services`);
                setServices(response.data || []);
            } catch (error) {
                console.error('Failed to fetch services:', error);
            }
        };
        fetchServices();
    }, []); // Run only once

   // --- OneSignal Setup ---
    useEffect(() => {
    if (window.OneSignal) {
            window.OneSignal.push(function() {
                window.OneSignal.showSlidedownPrompt();
            });
            window.OneSignal.push(function() {
                window.OneSignal.getUserId(function(userId) {
                    console.log("OneSignal Player ID:", userId);
                    setPlayerId(userId);
                });
            });
        }
    }, []);

   // Fetch Available Barbers (Runs every 15s)
   useEffect(() => {
    const loadBarbers = async () => {
      try {
        const response = await axios.get(`${API_URL}/barbers`);
        setBarbers(response.data || []);
         setMessage(prev => (prev === 'Loading available barbers...' ? '' : prev));
      } catch (error) { console.error('Failed fetch available barbers:', error); setMessage('Could not load barbers.'); setBarbers([]); }
    };
    loadBarbers();
    const intervalId = setInterval(loadBarbers, 15000);
    return () => clearInterval(intervalId);
   }, []);

    // --- Effect to manage stopBlinking listeners ---
    useEffect(() => {
        const handleFocus = () => stopBlinking();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                stopBlinking();
            }
        };
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
            stopBlinking(); // Ensure blinking stops if component unmounts while blinking
        };
    }, []);


    // --- Realtime and Notification Effect (For AFTER joining) ---
   useEffect(() => {
        // --- MODIFIED: Trigger initial fetch when joinedBarberId changes ---
        if (joinedBarberId) {
            fetchPublicQueue(joinedBarberId);
        } else {
            setLiveQueue([]); // Clear queue if not joined
            setIsQueueLoading(false);
        }

        // Request notification permission
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
             Notification.requestPermission();
        }

        let queueChannel = null;
        let refreshInterval = null;

        // Only subscribe if the user has joined a queue
        if (joinedBarberId && supabase?.channel) {
            console.log(`Subscribing queue changes: barber ${joinedBarberId}`);
            queueChannel = supabase.channel(`public_queue_${joinedBarberId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${joinedBarberId}` }, (payload) => {
                    console.log("Realtime Update Received:", payload); // Add log
                    fetchPublicQueue(joinedBarberId); // Refresh list on any change

                    // Check if *my* status updated to 'Up Next'
                    if (payload.eventType === 'UPDATE' &&
                        payload.new.id.toString() === myQueueEntryId && // Compare as strings
                        payload.new.status === 'Up Next')
                    {
                        console.log('My status is Up Next! Triggering ALL alerts.');
                        startBlinking();
                        setIsYourTurnModalOpen(true);
                        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                        try {
                            const audio = new Audio('/buzzer.mp3');
                            audio.play().catch(e => console.warn("Audio autoplay blocked.", e));
                        } catch (e) { console.error("Audio play failed:", e); }
                        if (Notification.permission === "granted") {
                            new Notification("You're next at Dash-Q!", { body: "Please head over now." });
                        }
                    }
                })
                .subscribe((status, err) => {
                     if (status === 'SUBSCRIBED') {
                         console.log('Subscribed to Realtime queue!');
                         setQueueMessage(''); // Clear error message on successful subscribe
                         fetchPublicQueue(joinedBarberId); // Fetch again on successful subscribe
                     } else {
                         console.error('Supabase Realtime subscription error:', status, err);
                         setQueueMessage('Live updates unavailable.');
                     }
                });

            // Fallback refresh interval
            refreshInterval = setInterval(() => {
                console.log("Periodic refresh fetching queue...");
                fetchPublicQueue(joinedBarberId);
             }, 15000);
        }

        // Cleanup function
        return () => {
            console.log("Cleaning up queue subscription and interval for barber:", joinedBarberId);
            if (queueChannel && supabase?.removeChannel) {
                 supabase.removeChannel(queueChannel).catch(err => console.error("Error removing channel:", err));
             }
            if (refreshInterval) { clearInterval(refreshInterval); }
        };
    // --- MODIFIED: Added fetchPublicQueue to dependencies ---
    }, [joinedBarberId, myQueueEntryId, fetchPublicQueue]);


    // --- EWT Calculation Effect (Runs BEFORE joining) ---
    useEffect(() => {
        if (selectedBarber && !myQueueEntryId) { // Only run if selecting barber *before* joining
            fetchPublicQueue(selectedBarber);
        } else if (!selectedBarber && !myQueueEntryId) {
            setLiveQueue([]); // Clear queue if no barber selected
        }
    // --- MODIFIED: Added myQueueEntryId and fetchPublicQueue ---
    }, [selectedBarber, myQueueEntryId, fetchPublicQueue]);

    // --- EWT Calculation (based on liveQueue) ---
    useEffect(() => {
        const calculateWaitTime = () => {
            const relevantEntries = liveQueue.filter(
                entry => entry.status === 'Waiting' || entry.status === 'Up Next'
            );
            setPeopleWaiting(relevantEntries.length);

            // Calculate wait time based ONLY on people ahead of the current user
            const myIndex = liveQueue.findIndex(entry => entry.id.toString() === myQueueEntryId);
            const peopleAhead = myIndex !== -1 ? liveQueue.slice(0, myIndex) : liveQueue; // If not found (or before joining), consider everyone

            const totalWait = peopleAhead.reduce((sum, entry) => {
                // Include 'In Progress' duration if someone is being served
                if (entry.status === 'Waiting' || entry.status === 'Up Next' || entry.status === 'In Progress') {
                    const duration = entry.services?.duration_minutes || 30; // Default 30 mins
                    return sum + duration;
                }
                return sum;
            }, 0);

            setEstimatedWait(totalWait);
        };

        calculateWaitTime();
    }, [liveQueue, myQueueEntryId]); // Recalculate when queue or my position changes


   // AI Preview Handler
const handleGeneratePreview = async () => {
    // Check if file and prompt exist
    if (!file || !prompt) { 
        setMessage('Please upload a photo and enter a prompt.'); 
        return; 
    }
    
    // Set loading/generating states
    setIsGenerating(true); 
    setIsLoading(true); // Also set general loading state
    setGeneratedImage(null); // Clear previous image
    setMessage('Step 1/3: Uploading...'); 
    
    // Create a unique file path
    const filePath = `${Date.now()}.${file.name.split('.').pop()}`;
    
    try {
        // Check if Supabase storage is configured
        if (!supabase?.storage) throw new Error("Supabase storage not available.");
        
        // Upload the file to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('haircut_references') // Your bucket name
            .upload(filePath, file);
            
        if (uploadError) throw uploadError; // Throw error if upload fails
        
        // Get the public URL of the uploaded file
        const { data: urlData } = supabase.storage
            .from('haircut_references')
            .getPublicUrl(filePath);
            
        if (!urlData?.publicUrl) throw new Error("Could not get public URL for uploaded file.");
        
        const imageUrl = urlData.publicUrl; // Store the URL
        
        // Update status message
        setMessage('Step 2/3: Generating AI haircut... (takes ~15-30s)');
        
        // Call your backend endpoint to trigger AI generation
        const response = await axios.post(`${API_URL}/generate-haircut`, { 
            imageUrl, // Send the image URL
            prompt    // Send the user's prompt
        });
        
        // Set the generated image URL received from the backend
        setGeneratedImage(response.data.generatedImageUrl); 
        setMessage('Step 3/3: Success! Check preview.'); // Update status message
        
    } catch (error) { 
        // Handle errors during the process
        console.error('AI generation pipeline error:', error); 
        setMessage(`AI failed: ${error.response?.data?.error || error.message}`); // Show error message
    } finally { 
        // Reset loading states regardless of success or failure
        setIsGenerating(false); 
        setIsLoading(false); 
    }
};

    // Join Queue Handler
   const handleJoinQueue = async (e) => {
        e.preventDefault();
        if (!customerName || !selectedBarber || !selectedServiceId) { setMessage('Name, Barber, AND Service required.'); return; }
        if (myQueueEntryId) { setMessage('You are already checked in!'); return; }
        setIsLoading(true); setMessage('Joining queue...');
        try {
            const imageUrlToSave = generatedImage;
            const response = await axios.post(`${API_URL}/queue`, {
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_email: customerEmail,
                barber_id: selectedBarber,
                reference_image_url: imageUrlToSave, // Note: imageUrlToSave is defined just above this line
                service_id: selectedServiceId,
                player_id: player_id, // <-- Make sure player_id state is correctly set
                user_id: session.user.id // <-- ADD THIS LINE
            });
            const newEntry = response.data;
            const newBarberId = parseInt(selectedBarber);
            setMyQueueEntryId(newEntry.id.toString()); // Store as string
            setJoinedBarberId(newBarberId.toString()); // Store as string
            localStorage.setItem('myQueueEntryId', newEntry.id.toString());
            localStorage.setItem('joinedBarberId', newBarberId.toString());
            setMessage(`Success! You joined for ${barbers.find(b => b.id === newBarberId)?.full_name || `Barber #${newBarberId}`}.`);
            // Clear only specific fields
            setSelectedBarber(''); setFile(null); setPrompt(''); setSelectedServiceId(''); setGeneratedImage(null);
        } catch (error) {
            console.error('Failed to join queue:', error);
            const errorMessage = error.response?.data?.error || error.message;
            setMessage(errorMessage.includes('unavailable') ? errorMessage : 'Failed to join. Try again.');
            setMyQueueEntryId(null); setJoinedBarberId(null);
            localStorage.removeItem('myQueueEntryId');
            localStorage.removeItem('joinedBarberId');
        } finally { setIsLoading(false); }
    };

    // Leave Queue Handler
   const handleLeaveQueue = async () => {
        if (!myQueueEntryId) return;
        setIsLoading(true); // Indicate loading
        // Unsubscribe handled by useEffect cleanup when joinedBarberId changes
        try {
            await axios.delete(`${API_URL}/queue/${myQueueEntryId}`);
            setMessage("You left the queue.");
            localStorage.removeItem('myQueueEntryId');
            localStorage.removeItem('joinedBarberId');
            setMyQueueEntryId(null);
            setJoinedBarberId(null); // This triggers useEffect cleanup
            setLiveQueue([]); setQueueMessage(''); setSelectedBarber(''); setGeneratedImage(null); setFile(null); setPrompt(''); setSelectedServiceId('');
        } catch (error) {
            console.error("Failed to leave queue:", error);
            setMessage("Error leaving queue.");
        } finally {
            setIsLoading(false);
        }
    };

   // --- Handler for the modal's "Okay" button ---
   const handleModalClose = () => {
        setIsYourTurnModalOpen(false);
        stopBlinking();
   };

    // --- ADDED DEBUG LOG ---
   console.log("RENDERING CustomerView:", {
       myQueueEntryId,
       joinedBarberId,
       liveQueue_length: liveQueue.length, // Log length instead of full array
       nowServing: nowServing ? nowServing.id : null, // Log only ID
       upNext: upNext ? upNext.id : null, // Log only ID
       peopleWaiting,
       estimatedWait,
       isQueueLoading, // Log loading state
       queueMessage // Log message state
   });

   // --- Render Customer View ---
   return (
      <div className="card">
        {/* --- "Your Turn" Modal --- */}
        <div
            id="your-turn-modal-overlay"
            className="modal-overlay"
            style={{ display: isYourTurnModalOpen ? 'flex' : 'none' }}
        >
            <div className="modal-content">
                <h2>It's Your Turn!</h2>
                <p>The barber is ready for you now.</p>
                <button id="close-modal-btn" onClick={handleModalClose}>Okay!</button>
            </div>
        </div>

        {/* --- Join Form or Live Queue View --- */}
        {!myQueueEntryId ? (
           <> {/* --- JOIN FORM JSX --- */}
               <h2>Join the Queue</h2>
                <form onSubmit={handleJoinQueue}>
                    {/* Name (prefilled) */}
                    <div className="form-group">
                        <label>Your Name:</label>
                        <input type="text" value={customerName} required readOnly className="prefilled-input" />
                    </div>
                    {/* Phone (optional) */}
                    <div className="form-group">
                        <label>Your Phone (Optional):</label>
                        <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g., 09171234567" />
                    </div>
                     {/* Email (prefilled) */}
                    <div className="form-group">
                        <label>Your Email:</label> {/* Changed label */}
                        <input type="email" value={customerEmail} readOnly className="prefilled-input" />
                    </div>
                    {/* Service Selection */}
                    <div className="form-group">
                        <label>Select Service:</label>
                        <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} required>
                            <option value="">-- Choose service --</option>
                            {services.map((service) => (
                                <option key={service.id} value={service.id}>{service.name} ({service.duration_minutes} min / ₱{service.price_php})</option>
                            ))}
                        </select>
                    </div>
                    {/* Barber Selection */}
                    <div className="form-group">
                        <label>Select Available Barber:</label>
                        <select value={selectedBarber} onChange={(e) => setSelectedBarber(e.target.value)} required>
                            <option value="">-- Choose --</option>
                            {barbers.length > 0
                                ? barbers.map((b) => (<option key={b.id} value={b.id}>{b.full_name}</option>))
                                : <option disabled>No barbers currently available</option>}
                        </select>
                    </div>
                    {/* EWT Display (before joining) */}
                    {selectedBarber && (
                        <div className="ewt-container">
                            <div className="ewt-item"><span>Currently waiting</span><strong>{peopleWaiting} {peopleWaiting === 1 ? 'person' : 'people'}</strong></div>
                            <div className="ewt-item"><span>Estimated wait</span><strong>~ {estimatedWait} min</strong></div>
                        </div>
                    )}
                    {/* --- AI Section --- */}
                    <div className="ai-generator">
                        <p className="ai-title">AI Haircut Preview (Optional)</p>
                        {/* File Upload */}
                        <div className="form-group">
                            <label>1. Upload photo:</label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => { 
                                    setFile(e.target.files[0]); // Get the first file selected
                                    setGeneratedImage(null); // Clear previous preview on new file select
                                }} 
                            />
                        </div>
                        {/* Prompt Input */}
                        <div className="form-group">
                            <label>2. Describe haircut:</label>
                            <input 
                                type="text" 
                                value={prompt} 
                                placeholder="e.g., 'buzz cut', 'modern mullet'" // Added example
                                onChange={(e) => setPrompt(e.target.value)} 
                            />
                        </div>
                        {/* Generate Button */}
                        <button 
                            type="button" 
                            onClick={handleGeneratePreview} 
                            className="generate-button" 
                            // Disable button if no file/prompt, or if loading/generating
                            disabled={!file || !prompt || isLoading || isGenerating} 
                        >
                            {isGenerating ? 'Generating...' : 'Generate AI Preview'}
                        </button>
                        {/* Loading Indicator */}
                        {isLoading && isGenerating && <p className='loading-text'>Generating preview...</p>} 
                        {/* Image Preview */}
                        {generatedImage && (
                            <div className="image-preview">
                                <p>AI Preview:</p>
                                <img src={generatedImage} alt="AI Generated Haircut Preview"/>
                                <p className="success-text">Like it? Join the queue!</p>
                            </div>
                        )}
                    </div>
                    {/* Join Button */}
                    <button type="submit" disabled={isLoading || isGenerating || barbers.length === 0} className="join-queue-button">{isLoading ? 'Joining...' : (barbers.length === 0 ? 'No Barbers Available' : 'Join Queue')}</button>
                </form>
                {/* Messages */}
                {message && <p className={`message ${message.toLowerCase().includes('failed') || message.toLowerCase().includes('error') ? 'error' : ''}`}>{message}</p>}
           </>
        ) : (
           <div className="live-queue-view"> {/* --- LIVE QUEUE VIEW JSX --- */}
               {/* Header: Show barber name only if joinedBarberId exists */}
               <h2>Live Queue for {joinedBarberId ? currentBarberName : '...'}</h2>

               {/* Your Queue Number */}
               <div className="queue-number-display">
                   Your Queue Number is: <strong>#{myQueueEntryId}</strong>
               </div>

               {/* Now Serving / Up Next Display */}
               <div className="current-serving-display">
                   <div className="serving-item now-serving">
                       <span>Now Serving</span>
                       <strong>{nowServing ? `Customer #${nowServing.id}` : '---'}</strong>
                   </div>
                   <div className="serving-item up-next">
                       <span>Up Next</span>
                       <strong>{upNext ? `Customer #${upNext.id}` : '---'}</strong>
                   </div>
               </div>

                {/* Status Messages: Display errors or loading indicator */}
               {queueMessage && <p className="message error">{queueMessage}</p>}
               {isQueueLoading && !queueMessage && <p className="loading-text">Loading queue...</p>}

               {/* EWT Display (after joining) */}
               <div className="ewt-container">
                   <div className="ewt-item"><span>Currently waiting</span><strong>{peopleWaiting} {peopleWaiting === 1 ? 'person' : 'people'}</strong></div>
                   <div className="ewt-item"><span>Estimated wait</span><strong>~ {estimatedWait} min</strong></div>
               </div>

                {/* --- Queue List --- */}
               <ul className="queue-list live">
                   {/* --- MODIFIED: Show message only if not loading AND queue is empty --- */}
                   {!isQueueLoading && liveQueue.length === 0 && !queueMessage ? (
                       <li className="empty-text">Queue is empty.</li>
                   ) : (
                       liveQueue.map((entry, index) => (
                           <li key={entry.id} className={`${entry.id.toString() === myQueueEntryId ? 'my-position' : ''} ${entry.status === 'Up Next' ? 'up-next-public' : ''} ${entry.status === 'In Progress' ? 'in-progress-public' : ''}`}>
                               {/* --- MODIFIED: Use entry.id consistently --- */}
                               <span>{index + 1}. {entry.id.toString() === myQueueEntryId ? `You (${entry.customer_name})` : `Customer #${entry.id}`}</span>
                               <span className="queue-status">{entry.status}</span>
                           </li>
                       ))
                   )}
               </ul>

               {/* --- Chat Button --- */}
               {!isChatOpen && myQueueEntryId && (
                   <button onClick={() => { 
                    // Find the barber's user_id based on joinedBarberId
                    const targetBarber = barbers.find(b => b.id === parseInt(joinedBarberId));
                    
                    // --- THIS IS THE CRITICAL CHECK ---
                    if (targetBarber && targetBarber.user_id) { 
                        setChatTargetBarberUserId(targetBarber.user_id);
                        setIsChatOpen(true); // <--- This line isn't being reached
                    } else {
                        // --- THIS MUST BE HAPPENING ---
                        console.error("Could not find barber user ID for chat.", { joinedBarberId, barbers, targetBarber }); 
                        setMessage("Could not initiate chat: Barber details missing."); // Show user feedback
                    }
                    }} className="chat-toggle-button">Chat with Barber</button>
               )}
               {isChatOpen && (<button onClick={() => setIsChatOpen(false)} className="chat-toggle-button close">Close Chat</button>)}

               {/* --- Chat Window --- */}
               {isChatOpen && chatTargetBarberUserId && (
                   <ChatWindow currentUser_id={session.user.id} otherUser_id={chatTargetBarberUserId} />
               )}

               {/* --- Leave Button --- */}
               <button onClick={handleLeaveQueue} disabled={isLoading} className='leave-queue-button'>{isLoading ? 'Leaving...' : 'Leave Queue / Join Another'}</button>
           </div>
        )}
      </div>
    );
}

// --- BarberDashboard (Handles Barber's Queue Management) ---
// Accepts props: barberId, barberName, onCutComplete
function BarberDashboard({ barberId, barberName, onCutComplete, session}) {
    const [queueDetails, setQueueDetails] = useState({ waiting: [], inProgress: null, upNext: null });
    const [error, setError] = useState('');
    const [fetchError, setFetchError] = useState(''); // State for specific fetch errors
    const socketRef = useRef(null); // --- NEW: Ref for WebSocket ---
    const [chatMessages, setChatMessages] = useState({}); // --- NEW: Store messages {customerId: [msgs]} ---
    const [barberNewMessage, setBarberNewMessage] = useState('');
    const [openChatCustomerId, setOpenChatCustomerId] = useState(null);
    
    // --- NEW: WebSocket Connection Effect for Barber ---
    useEffect(() => {
        if (!session?.user?.id) return; // Need user ID to register

        // Connect to WebSocket server
        socketRef.current = io(SOCKET_URL);
        const socket = socketRef.current;
        const barberUserId = session.user.id;

        console.log(`Barber connecting WebSocket as user ${barberUserId}`);
        // Register this barber user with the server
        socket.emit('register', barberUserId);

        // Listen for incoming chat messages
        socket.on('chat message', (incomingMessage) => {
          console.log(`[Barber] Received message from ${incomingMessage.senderId}:`, incomingMessage.message);
          
          // Store message associated with the sender (customer)
          setChatMessages(prev => {
              const customerId = incomingMessage.senderId;
              const existingMessages = prev[customerId] || [];
              return {
                  ...prev,
                  [customerId]: [...existingMessages, incomingMessage]
              };
          });
          
          // TODO: Add notification for new message (e.g., highlight customer)
          // TODO: If chat window for this customer is open, show message immediately
        });

        // Handle connection errors
        socket.on('connect_error', (err) => {
            console.error("[Barber] WebSocket Connection Error:", err);
        });

        // Cleanup on unmount
        return () => {
          console.log("[Barber] Disconnecting WebSocket.");
          socket.disconnect();
        };
      }, [session]); // Depend on session to get user ID
    // --- END NEW WebSocket Effect ---

    // Fetch queue details function
    // Fetch queue details function
        const fetchQueueDetails = async () => {
            console.log(`[BarberDashboard] Fetching queue details for barber ${barberId}...`);
            setFetchError(''); // Clear previous fetch error
            // --- FIX: Check barberId first ---
            if (!barberId) {
                console.warn('[BarberDashboard] fetchQueueDetails called without barberId.');
                return; // Exit if no barberId
            }
            // setError(''); // Clear general error maybe, or handle differently
            try {
                const response = await axios.get(`${API_URL}/queue/details/${barberId}`);
                console.log('[BarberDashboard] Successfully fetched queue details:', response.data);
                setQueueDetails(response.data);
            } catch (err) {
                // --- FIX: Removed stray 'c' ---
                console.error('[BarberDashboard] Failed fetch queue details:', err);
                const errMsg = err.response?.data?.error || err.message || 'Could not load queue details.';
                setError(errMsg); // Set general error state
                setFetchError(errMsg); // Set specific fetch error state
                setQueueDetails({ waiting: [], inProgress: null, upNext: null }); // Reset on error
            }
        };

    // UseEffect for initial load and realtime subscription
    useEffect(() => {
    if (!barberId || !supabase?.channel) return;

    let dashboardRefreshInterval = null; // Variable to hold the periodic refresh timer

    fetchQueueDetails(); // Initial fetch

    // 1. Setup Realtime subscription
    const channel = supabase.channel(`barber_queue_${barberId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${barberId}` }, (payload) => {
                console.log('Barber dashboard received queue update (via Realtime):', payload);
                fetchQueueDetails(); // Refetch details when any change occurs
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`Barber dashboard subscribed to queue ${barberId}`);
                } else {
                    console.error(`Barber dashboard subscription error: ${status}`, err);
                }
            });

    // 2. Set up 15-second periodic refresh (Backup for Realtime)
    dashboardRefreshInterval = setInterval(() => {
        console.log('Dashboard periodic refresh: Fetching queue details...');
        fetchQueueDetails();
    }, 15000);

    // 3. Cleanup function
        return () => {
            if (channel && supabase?.removeChannel) {
                supabase.removeChannel(channel).then(() => console.log('Barber dashboard unsubscribed.'));
            }
        // --- CRITICAL: Clear the interval on unmount/re-run ---
            if (dashboardRefreshInterval) {
                clearInterval(dashboardRefreshInterval);
            }
        };
    }, [barberId]); // Depend on barberId

    // Handler for calling the next customer
    const handleNextCustomer = async () => {
        const next = queueDetails.upNext || (queueDetails.waiting.length > 0 ? queueDetails.waiting[0] : null);
        if (!next) { alert('Queue empty!'); return; }
        if (queueDetails.inProgress) { alert(`Complete ${queueDetails.inProgress.customer_name} first.`); return; }
        setError('');
        try { 
            // --- MODIFIED: Use the RPC call ---
            await axios.put(`${API_URL}/queue/next`, { queue_id: next.id, barber_id: barberId }); 
        }
        catch (err) { console.error('Failed next customer:', err); setError(err.response?.data?.error || 'Failed call next.'); }
        // Realtime listener will handle the state update
    };

    // Handler for completing a cut
    const handleCompleteCut = async () => {
        if (!queueDetails.inProgress) return;

        // --- 1. Retrieve Service Name and Price ---
        const serviceName = queueDetails.inProgress.services?.name || 'Service';
        const servicePrice = parseFloat(queueDetails.inProgress.services?.price_php) || 0;
        
        // --- 2. Prompt for the TIP amount ---
        const tipAmount = prompt(`Service: ${serviceName} (₱${servicePrice.toFixed(2)}). \n\nPlease enter TIP amount (e.g., 50):`);
        
        if (tipAmount === null) return; // Handle user canceling prompt
        
        // --- 3. Validate the Tip ---
        const parsedTip = parseInt(tipAmount);
        if (isNaN(parsedTip) || parsedTip < 0) {
          alert('Invalid tip amount. Please enter a non-negative number (or 0).');
          return;
        }

        setError(''); // Clear previous errors
        
        // --- 4. Send Completion Request to Backend ---
        try {
          await axios.post(`${API_URL}/queue/complete`, {
            queue_id: queueDetails.inProgress.id,
            barber_id: barberId,
            tip_amount: parsedTip // <-- Send 'tip_amount'
          });

          onCutComplete(); // Signal parent to refresh analytics
          
          const totalProfitLogged = servicePrice + parsedTip;
          alert(`Cut completed! Total logged profit: ₱${totalProfitLogged.toFixed(2)}`);

        } catch (err) {
          console.error('Failed complete cut:', err);
          setError(err.response?.data?.error || 'Failed to complete cut. Server error.');
        }
    };

    const handleCancel = async (customerToCancel) => {
        // --- ADD LOG ---
        console.log("[handleCancel] Clicked for customer:", customerToCancel); 
        if (!customerToCancel) {
            console.error("[handleCancel] No customer data provided.");
            return;
        }

        const confirmCancel = window.confirm(`Are you sure you want to mark Customer #${customerToCancel.id} (${customerToCancel.customer_name}) as Cancelled/No-Show? This cannot be undone and will not log earnings.`);
        if (!confirmCancel) {
            console.log("[handleCancel] User aborted cancellation."); // --- ADD LOG ---
            return;
        }
        
        // --- ADD LOG ---
        console.log("[handleCancel] Sending PUT request to /api/queue/cancel", { queue_id: customerToCancel.id, barber_id: barberId });
        setError(''); 
        try {
            const response = await axios.put(`${API_URL}/queue/cancel`, {
                queue_id: customerToCancel.id,
                barber_id: barberId 
            });
            // --- ADD LOG ---
            console.log("[handleCancel] Success response:", response.data);
            // Realtime update should refresh the queue
        } catch (err) {
            // --- ADD LOG ---
            console.error('[handleCancel] Failed to cancel customer:', err.response?.data || err.message); 
            setError(err.response?.data?.error || 'Failed to mark as cancelled.');
        }
    };

    // --- NEW: Function to send message from Barber ---
    const sendBarberMessage = (recipientId, messageText) => {
        if (messageText.trim() && socketRef.current && session?.user?.id) {
            const messageData = {
                senderId: session.user.id, // Barber's user ID
                recipientId: recipientId,   // Customer's user ID
                message: messageText
            };
            socketRef.current.emit('chat message', messageData);
            
            // Optimistically update local state for the barber's view
             setChatMessages(prev => {
              const customerId = recipientId;
              const existingMessages = prev[customerId] || [];
              return {
                  ...prev,
                  [customerId]: [...existingMessages, { senderId: session.user.id, message: messageText }]
              };
          });
        }
    };

    // Determine which button to show
    const getActionButton = () => {
        if (queueDetails.inProgress) {
             // --- MODIFIED: Show Customer ID in button ---
            return <button onClick={handleCompleteCut} className="complete-button">Complete: #{queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}</button>;
        }
        const nextPerson = queueDetails.upNext || (queueDetails.waiting.length > 0 ? queueDetails.waiting[0] : null);
        if (nextPerson) {
             // --- MODIFIED: Show Customer ID in button ---
            return <button onClick={handleNextCustomer} className="next-button">Call: #{nextPerson.id} - {nextPerson.customer_name}</button>;
        }
        return <button className="next-button disabled" disabled>Queue Empty</button>;
    };

    const openChat = (customer) => {
        if (customer && customer.profiles && customer.profiles.id) {
            setOpenChatCustomerId(customer.profiles.id); // Set the customer's USER ID
        } else {
            console.error("Cannot open chat: Customer user ID not found.", customer);
            setError("Could not get customer details for chat.");
        }
    };
    
    // --- Helper function to close chat ---
    const closeChat = () => {
        setOpenChatCustomerId(null);
        setBarberNewMessage(''); // Clear input when closing
    };
    // --- ADD LOG before return ---
    console.log("[BarberDashboard] Rendering with state:", {
        barberId,
        queueDetails,
        error,
        fetchError, // Log the fetch error state too
        openChatCustomerId
    });
    // --- END ADD ---
    // Render the dashboard UI
    return (
        <div className="card">
            <h2>My Queue ({barberName || '...'})</h2>

            {/* --- NEW: "Now Serving / Up Next" Display --- */}
            {/* This uses the same CSS as the customer page */}
            <div className="current-serving-display">
                <div className="serving-item now-serving">
                    <span>Now Serving</span>
                    <strong>
                        {/* Display Customer ID if someone is 'In Progress', otherwise show '---' */}
                        {queueDetails.inProgress ? `Customer #${queueDetails.inProgress.id}` : '---'}
                    </strong>
                </div>
                <div className="serving-item up-next">
                    <span>Up Next</span>
                    <strong>
                        {/* Display Customer ID if someone is 'Up Next', otherwise show '---' */}
                        {queueDetails.upNext ? `Customer #${queueDetails.upNext.id}` : '---'}
                    </strong>
                </div>
            </div>
            {/* --- END NEW DISPLAY --- */}

            {error && <p className="error-message">{error}</p>}
            <div className="action-buttons-container">
                        {queueDetails.inProgress ? (
                            <>
                                <button onClick={handleCompleteCut} className="complete-button">
                                    Complete: #{queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}
                                </button>
                                {/* --- NEW Cancel Button for In Progress --- */}
                                <button onClick={() => handleCancel(queueDetails.inProgress)} className="cancel-button">
                                    Cancel / No-Show
                                </button>
                            </>
                        ) : queueDetails.upNext ? (
                             <button onClick={handleNextCustomer} className="next-button">
                                Call: #{queueDetails.upNext.id} - {queueDetails.upNext.customer_name}
                            </button>
                            // Optionally add cancel for Up Next too:
                            // <button onClick={() => handleCancel(queueDetails.upNext)} className="cancel-button small">Cancel Up Next</button>
                        ) : queueDetails.waiting.length > 0 ? (
                            <button onClick={handleNextCustomer} className="next-button">
                                Call: #{queueDetails.waiting[0].id} - {queueDetails.waiting[0].customer_name}
                            </button>
                        ) : (
                            <button className="next-button disabled" disabled>Queue Empty</button>
                        )}
            </div>
            <h3 className="queue-subtitle">In Chair</h3>
            {queueDetails.inProgress ? (
                <ul className="queue-list"><li className="in-progress">
                    <strong>#{queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}</strong>
                    {/* --- MODIFIED --- */}
                    <button
                        onClick={() => openChat(queueDetails.inProgress)}
                        className="chat-icon-button"
                        title={queueDetails.inProgress.profiles?.id ? "Chat" : "Cannot chat with guest"}
                        disabled={!queueDetails.inProgress.profiles?.id} // Disable if no profile ID
                    >💬</button>
                    {/* ... ref photo link ... */}
                </li></ul>
            ) : (<p className="empty-text">Chair empty</p>)}

            <h3 className="queue-subtitle">Up Next</h3>
            {queueDetails.upNext ? (
                <ul className="queue-list"><li className="up-next">
                    <strong>#{queueDetails.upNext.id} - {queueDetails.upNext.customer_name}</strong>
                    {/* --- MODIFIED --- */}
                     <button
                        onClick={() => openChat(queueDetails.upNext)}
                        className="chat-icon-button"
                        title={queueDetails.upNext.profiles?.id ? "Chat" : "Cannot chat with guest"}
                        disabled={!queueDetails.upNext.profiles?.id} // Disable if no profile ID
                    >💬</button>
                    {/* ... ref photo link ... */}
                </li></ul>
            ) : (<p className="empty-text">Nobody Up Next</p>)}

            <h3 className="queue-subtitle">Waiting</h3>
            <ul className="queue-list">{queueDetails.waiting.length === 0 ? (<li className="empty-text">Waiting queue empty.</li>)
            : (
                queueDetails.waiting.map(c => (
                    <li key={c.id}>
                        #{c.id} - {c.customer_name}
                        {/* --- MODIFIED --- */}
                        <button
                            onClick={() => openChat(c)}
                            className="chat-icon-button"
                            title={c.profiles?.id ? "Chat" : "Cannot chat with guest"}
                            disabled={!c.profiles?.id} // Disable if no profile ID
                        >💬</button>
                         {/* ... ref photo link ... */}
                    </li>
                ))
            )}</ul>

             {/* --- NEW: Conditionally Render Chat Window --- */}
            {openChatCustomerId && (
                <div className="barber-chat-container"> {/* Added a container */}
                    <h4>Chat with Customer</h4> 
                    {/* Use the existing ChatWindow component, but slightly differently */}
                     <div className="chat-window"> {/* Re-using customer CSS */}
                        <div className="message-list">
                           {/* Display messages for the currently open chat */}
                           {(chatMessages[openChatCustomerId] || []).map((msg, index) => (
                              <div key={index} className={msg.senderId === session.user.id ? 'my-message' : 'other-message'}>
                                {msg.message}
                              </div>
                            ))}
                        </div>
                        {/* Barber's message input form */}
                        <form onSubmit={(e) => { 
                                e.preventDefault(); 
                                sendBarberMessage(openChatCustomerId, barberNewMessage); 
                                setBarberNewMessage(''); // Clear input after send
                            }} className="message-input-form">
                            <input
                              type="text"
                              value={barberNewMessage}
                              onChange={(e) => setBarberNewMessage(e.target.value)}
                              placeholder="Type a message..."
                            />
                            <button type="submit">Send</button>
                        </form>
                    </div>
                    <button onClick={closeChat} className="chat-toggle-button close small">Close Chat</button>
                </div>
            )}
            {/* --- END NEW --- */}

            <button onClick={fetchQueueDetails} className="refresh-button small">Refresh Queue</button>
        </div>
    );
}

// --- AnalyticsDashboard (Displays Barber Stats) ---
// Accepts props: barberId, refreshSignal
function AnalyticsDashboard({ barberId, refreshSignal }) {
   const [analytics, setAnalytics] = useState({ totalEarningsToday: 0, totalCutsToday: 0, totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0,totalCutsAllTime: 0 });
   const [error, setError] = useState('');

   // Fetch analytics data function
   const fetchAnalytics = async () => {
      if (!barberId) return; setError('');
      try { const response = await axios.get(`${API_URL}/analytics/${barberId}`); setAnalytics({ dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, ...response.data }); } // Set state with defaults
      catch (err) { console.error('Failed fetch analytics:', err); setError('Could not load analytics.'); setAnalytics({ totalEarningsToday: 0, totalCutsToday: 0, totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0 }); } // Reset on error
    };

    // UseEffect to fetch data on load and when signal/barberId changes
    useEffect(() => { fetchAnalytics(); }, [refreshSignal, barberId]);

    // --- NEW: Carbon Footprint Calculation ---
   // We'll use 5g CO2e as a proxy for one paper entry
    const CARBON_SAVED_PER_CUSTOMER_G = 5; 

    const carbonSavedToday = (analytics.totalCutsToday ?? 0) * CARBON_SAVED_PER_CUSTOMER_G;
    const carbonSavedAllTime = (analytics.totalCutsAllTime ?? 0) * CARBON_SAVED_PER_CUSTOMER_G;
   
    // Calculate derived values (averages)
    const avgPriceToday = (analytics.totalCutsToday ?? 0) > 0 ? ((analytics.totalEarningsToday ?? 0) / analytics.totalCutsToday).toFixed(2) : '0.00';
    const avgPriceWeek = (analytics.totalCutsWeek ?? 0) > 0 ? ((analytics.totalEarningsWeek ?? 0) / analytics.totalCutsWeek).toFixed(2) : '0.00';

    // Chart configuration for the earnings bar chart
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Earnings per Day (Last 7 Days)' } }, scales: { y: { beginAtZero: true } } };
    const dailyDataSafe = Array.isArray(analytics.dailyData) ? analytics.dailyData : []; // Ensure it's an array
    // Prepare chart data
    const chartData = { labels: dailyDataSafe.map(d => { try { return new Date(d.day + 'T00:00:00Z').toLocaleString(undefined, { month: 'numeric', day: 'numeric' }); } catch (e) { return '?'; } }), datasets: [{ label: 'Daily Earnings (₱)', data: dailyDataSafe.map(d => d.daily_earnings ?? 0), backgroundColor: 'rgba(52, 199, 89, 0.6)', borderColor: 'rgba(52, 199, 89, 1)', borderWidth: 1 }] }; // <-- ₱ Symbol

    // Render the analytics dashboard UI
    return ( <div className="card analytics-card"><h2>Dashboard</h2>{error && <p className="error-message">{error}</p>}<h3 className="analytics-subtitle">Today</h3><div className="analytics-grid"><div className="analytics-item"><span className="analytics-label">Earnings</span><span className="analytics-value">₱{analytics.totalEarningsToday ?? 0}</span></div><div className="analytics-item"><span className="analytics-label">Cuts</span><span className="analytics-value">{analytics.totalCutsToday ?? 0}</span></div><div className="analytics-item"><span className="analytics-label">Avg Price</span><span className="analytics-value small">₱{avgPriceToday}</span></div><div className="analytics-item"><span className="analytics-label">Queue Size</span><span className="analytics-value small">{analytics.currentQueueSize ?? 0}</span></div></div><h3 className="analytics-subtitle">Last 7 Days</h3><div className="analytics-grid"><div className="analytics-item"><span className="analytics-label">Total Earnings</span><span className="analytics-value">₱{analytics.totalEarningsWeek ?? 0}</span></div><div className="analytics-item"><span className="analytics-label">Total Cuts</span><span className="analytics-value">{analytics.totalCutsWeek ?? 0}</span></div><div className="analytics-item"><span className="analytics-label">Avg Price</span><span className="analytics-value small">₱{avgPriceWeek}</span></div><div className="analytics-item"><span className="analytics-label">Busiest Day</span><span className="analytics-value small">{analytics.busiestDay?.name ?? 'N/A'} (₱{analytics.busiestDay?.earnings ?? 0})</span></div></div><div 
        className="carbon-footprint-section"><h3 className="analytics-subtitle">Carbon Footprint Reduced</h3>
        <div className="analytics-grid carbon-grid">
            <div className="analytics-item">
                <span className="analytics-label">Today</span>
                <span className="analytics-value carbon">
                    {carbonSavedToday}g <span className="carbon-unit">(gCO2e)</span>
                </span>
            </div>
            <div className="analytics-item">
                <span className="analytics-label">Total (All-Time)</span>
                <span className="analytics-value carbon">
                    {carbonSavedAllTime}g <span className="carbon-unit">(gCO2e)</span>
                </span>
            </div>
        </div>
        <p className="carbon-footnote">
            By going digital, you reduce your carbon footprint from transportation, paper, and plastic.
        </p>
    </div>
        <div className="chart-container">{dailyDataSafe.length > 0 ? (<div style={{ height: '250px' }}><Bar options={chartOptions} data={chartData} /></div>) : (<p className='empty-text'>No chart data yet.</p>)}</div><button onClick={fetchAnalytics} className="refresh-button">Refresh Stats</button></div> );
}


// ##############################################
// ##           MAIN APP COMPONENT             ##
// ##############################################
function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null); // null = loading, 'customer', 'barber'
  const [barberProfile, setBarberProfile] = useState(null); // Holds { id, user_id, full_name, is_available } for logged in barber
  const [loadingRole, setLoadingRole] = useState(true); // Tracks initial session/role check

  // --- NEW: OneSignal Setup ---
  useEffect(() => {
    if (!window.OneSignal) { // Prevent re-running
      window.OneSignal = window.OneSignal || [];
      window.OneSignal.push(function() {
        window.OneSignal.init({
          appId: process.env.REACT_APP_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true, // Good for testing
          autoResubscribe: true, // Resubscribe if they clear cache
          notifyButton: {
            enable: false, // We will use our own button/prompt
          },
        });
      });
    }

    return () => {
      // Cleanup if needed, but OneSignal usually persists
    };
  }, []); // Empty dependency array ensures it runs only once on mount


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