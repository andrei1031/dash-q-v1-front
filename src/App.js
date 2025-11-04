import React, { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
// Note: Konva imports are removed as they are no longer needed
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// --- Chart.js Imports ---
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

import './App.css';

// --- Global Constants ---
const SOCKET_URL = 'https://dash-q-backend.onrender.com'; // Your backend URL
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
const API_URL = 'https://dash-q-backend.onrender.com/api';

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

// --- Helper Function: Calculate Distance ---
/**
 * Calculates the distance between two lat/lon points in meters
 */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in meters
}

// ##############################################
// ##              CHAT COMPONENT              ##
// ##############################################
// Props: currentUser_id, otherUser_id, messages = [], onSendMessage
function ChatWindow({ currentUser_id, otherUser_id, messages = [], onSendMessage }) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && onSendMessage) {
      onSendMessage(otherUser_id, newMessage); // Call parent handler
      setNewMessage(''); // Clear input
    } else {
      console.warn("[ChatWindow] Cannot send message, handler missing or message empty.");
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
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="message-input-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" disabled={!onSendMessage}>Send</button>
      </form>
    </div>
  );
}


// ##############################################
// ##          LOGIN/SIGNUP COMPONENTS         ##
// ##############################################
function AuthForm() {
    const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(true); // For signup modal
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [barberCode, setBarberCode] = useState('');
    const [pin, setPin] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedRole, setSelectedRole] = useState('customer');

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true); setMessage('');
        try {
            if (isLogin) {
                 if (!username || !password) throw new Error("Username/password required.");
                 if (selectedRole === 'barber' && !pin) throw new Error("Barber PIN required.");
                 const response = await axios.post(`${API_URL}/login/username`, { username: username.trim(), password, role: selectedRole, pin: selectedRole === 'barber' ? pin : undefined });
                 if (response.data.user?.email && supabase?.auth) {
                      const { error } = await supabase.auth.signInWithPassword({ email: response.data.user.email, password });
                      if (error) throw error;
                  } else { throw new Error("Login failed: Invalid server response."); }
            } else {
                 if (!email.trim() || !fullName.trim()) throw new Error("Email/Full Name required.");
                 if (selectedRole === 'barber' && !barberCode.trim()) throw new Error("Barber Code required.");
                 const response = await axios.post(`${API_URL}/signup/username`, { username: username.trim(), email: email.trim(), password, fullName: fullName.trim(), role: selectedRole, barberCode: selectedRole === 'barber' ? barberCode.trim() : undefined });
                 setMessage(response.data.message || 'Account created! You can now log in.');
                 setIsLogin(true);
                 setUsername(''); setEmail(''); setPassword(''); setFullName(''); setBarberCode(''); setPin(''); setSelectedRole('customer');
            }
        } catch (error) { console.error('Auth error:', error); setMessage(`Authentication failed: ${error.response?.data?.error || error.message || 'Unexpected error.'}`); }
        finally { setLoading(false); }
    };

    return (
        <div className="card auth-card">
            {/* --- Welcome Modal (Only shows on Sign Up) --- */}
            <div
                className="modal-overlay"
                style={{ display: (isWelcomeModalOpen && !isLogin) ? 'flex' : 'none' }}
            >
                <div className="modal-content">
                    <h2>Welcome to Dash-Q!</h2>
                    <p>This application was proudly developed by:<br/>
                       <strong>Aquino, Zaldy Castro Jr.</strong><br/>
                       <strong>Galima, Denmark Perpose</strong><br/>
                       <strong>Saldivar, Reuben Andrei Santos</strong>
                       <br/><br/>from<br/><br/>
                       <strong>University of the Cordilleras</strong>
                    </p>
                    <button id="close-welcome-modal-btn" onClick={() => setIsWelcomeModalOpen(false)}>
                        Get Started
                    </button>
                </div>
            </div>

            <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleAuth}>
                <div className="form-group"><label>Username:</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength="3" autoComplete="username"/></div>
                <div className="form-group"><label>Password:</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" autoComplete={isLogin ? "current-password" : "new-password"}/></div>
                {isLogin && (<div className="login-role-select"><label>Login As:</label><div className="role-toggle"><button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button><button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button></div>{selectedRole === 'barber' && (<div className="form-group pin-input"><label>Barber PIN:</label><input type="password" value={pin} onChange={(e) => setPin(e.target.value)} required={selectedRole === 'barber'} autoComplete="off" /></div>)}</div>)}
                {!isLogin && (<><div className="signup-role-select"><label>Sign Up As:</label><div className="role-toggle"><button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button><button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button></div></div><div className="form-group"><label>Email:</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!isLogin} autoComplete="email"/><small>Needed for account functions.</small></div><div className="form-group"><label>Full Name:</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required={!isLogin} autoComplete="name"/></div>{selectedRole === 'barber' && (<div className="form-group"><label>Barber Code:</label><input type="text" value={barberCode} placeholder="Secret code" onChange={(e) => setBarberCode(e.target.value)} required={selectedRole === 'barber' && !isLogin} /><small>Required.</small></div>)}</>)}
                <button type="submit" disabled={loading}>{loading ? '...' : (isLogin ? 'Login' : 'Sign Up')}</button>
            </form>
            {message && <p className={`message ${message.includes('successful') || message.includes('created') || message.includes('can now log in') ? 'success' : 'error'}`}>{message}</p>}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setMessage(''); setSelectedRole('customer'); setPin(''); setBarberCode(''); }} className="toggle-auth-button">{isLogin ? 'Need account? Sign Up' : 'Have account? Login'}</button>
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
        setLoading(true); setError('');
        const newAvailability = !isAvailable;
        try {
            const response = await axios.put(`${API_URL}/barber/availability`, {
                barberId: barberProfile.id, isAvailable: newAvailability, userId: session.user.id
            });
            onAvailabilityChange(response.data.is_available); // This prop is passed from BarberAppLayout
        } catch (err) { console.error("Failed toggle availability:", err); setError(err.response?.data?.error || "Could not update."); }
        finally { setLoading(false); }
    };
    return ( <div className="availability-toggle"><p>Status: <strong>{isAvailable ? 'Available' : 'Offline'}</strong></p><button onClick={handleToggle} disabled={loading} className={isAvailable ? 'go-offline-button' : 'go-online-button'}>{loading ? '...' : (isAvailable ? 'Go Offline' : 'Go Online')}</button>{error && <p className="error-message small">{error}</p>}</div> );
}

// --- AnalyticsDashboard (Displays Barber Stats) ---
function AnalyticsDashboard({ barberId, refreshSignal }) {
   const [analytics, setAnalytics] = useState({ totalEarningsToday: 0, totalCutsToday: 0, totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0,totalCutsAllTime: 0 });
   const [error, setError] = useState('');
   const [showEarnings, setShowEarnings] = useState(true);

   // --- FIX: Wrap in useCallback ---
   const fetchAnalytics = useCallback(async () => {
      if (!barberId) return; setError('');
      try { 
          const response = await axios.get(`${API_URL}/analytics/${barberId}`); 
          setAnalytics({ dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, ...response.data });
          setShowEarnings(response.data?.showEarningsAnalytics ?? true);
      } 
      catch (err) { console.error('Failed fetch analytics:', err); setError('Could not load analytics.'); setAnalytics({ totalEarningsToday: 0, totalCutsToday: 0, totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0 }); }
    }, [barberId]); // Correct dependency

    // --- FIX: Add fetchAnalytics to dependency array ---
    useEffect(() => { fetchAnalytics(); }, [refreshSignal, barberId, fetchAnalytics]);

    const avgPriceToday = (analytics.totalCutsToday ?? 0) > 0 ? ((analytics.totalEarningsToday ?? 0) / analytics.totalCutsToday).toFixed(2) : '0.00';
    const avgPriceWeek = (analytics.totalCutsWeek ?? 0) > 0 ? ((analytics.totalEarningsWeek ?? 0) / analytics.totalCutsWeek).toFixed(2) : '0.00';
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Earnings per Day (Last 7 Days)' } }, scales: { y: { beginAtZero: true } } };
    const dailyDataSafe = Array.isArray(analytics.dailyData) ? analytics.dailyData : [];
    const chartData = { labels: dailyDataSafe.map(d => { try { return new Date(d.day + 'T00:00:00Z').toLocaleString(undefined, { month: 'numeric', day: 'numeric' }); } catch (e) { return '?'; } }), datasets: [{ label: 'Daily Earnings (₱)', data: dailyDataSafe.map(d => d.daily_earnings ?? 0), backgroundColor: 'rgba(52, 199, 89, 0.6)', borderColor: 'rgba(52, 199, 89, 1)', borderWidth: 1 }] };
    const carbonSavedToday = 5; 
    const carbonSavedWeekly = (dailyDataSafe.length) * 5; 

    return ( <div className="card analytics-card">
        <div className="dashboard-header">
            <h2>Dashboard</h2>
            <button onClick={() => setShowEarnings(!showEarnings)} className="toggle-visibility-button">
                {showEarnings ? '👁️ Hide' : '👁️ Show'} Earnings
            </button>
        </div>
        {error && <p className="error-message">{error}</p>}
        <h3 className="analytics-subtitle">Today</h3>
        <div className="analytics-grid">
            {showEarnings && <div className="analytics-item"><span className="analytics-label">Earnings</span><span className="analytics-value">₱{analytics.totalEarningsToday ?? 0}</span></div>}
            <div className="analytics-item"><span className="analytics-label">Cuts</span><span className="analytics-value">{analytics.totalCutsToday ?? 0}</span></div>
            {showEarnings && <div className="analytics-item"><span className="analytics-label">Avg Price</span><span className="analytics-value small">₱{avgPriceToday}</span></div>}
            <div className="analytics-item"><span className="analytics-label">Queue Size</span><span className="analytics-value small">{analytics.currentQueueSize ?? 0}</span></div>
        </div>
        <h3 className="analytics-subtitle">Last 7 Days</h3>
        <div className="analytics-grid">
            {showEarnings && <div className="analytics-item"><span className="analytics-label">Total Earnings</span><span className="analytics-value">₱{analytics.totalEarningsWeek ?? 0}</span></div>}
            <div className="analytics-item"><span className="analytics-label">Total Cuts</span><span className="analytics-value">{analytics.totalCutsWeek ?? 0}</span></div>
            {showEarnings && <div className="analytics-item"><span className="analytics-label">Avg Price</span><span className="analytics-value small">₱{avgPriceWeek}</span></div>}
            <div className="analytics-item"><span className="analytics-label">Busiest Day</span><span className="analytics-value small">{analytics.busiestDay?.name ?? 'N/A'} {showEarnings && `(₱${analytics.busiestDay?.earnings ?? 0})`}</span></div>
        </div>
        <div className="carbon-footprint-section">
            <h3 className="analytics-subtitle">Carbon Footprint Reduced</h3>
            <div className="analytics-grid carbon-grid">
                <div className="analytics-item"><span className="analytics-label">Today</span><span className="analytics-value carbon">{carbonSavedToday}g <span className="carbon-unit">(gCO2e)</span></span></div>
                <div className="analytics-item"><span className="analytics-label">Last 7 Days</span><span className="analytics-value carbon">{carbonSavedWeekly}g <span className="carbon-unit">(gCO2e)</span></span></div>
            </div>
        </div>
        {showEarnings && (
            <div className="chart-container">
                {dailyDataSafe.length > 0 ? (<div style={{ height: '250px' }}><Bar options={chartOptions} data={chartData} /></div>) : (<p className='empty-text'>No chart data yet.</p>)}
            </div>
        )}
        <button onClick={fetchAnalytics} className="refresh-button">Refresh Stats</button>
    </div> );
}

// --- BarberDashboard (Handles Barber's Queue Management) ---
function BarberDashboard({ barberId, barberName, onCutComplete, session}) {
    const [queueDetails, setQueueDetails] = useState({ waiting: [], inProgress: null, upNext: null });
    const [error, setError] = useState('');
    const [fetchError, setFetchError] = useState('');
    const socketRef = useRef(null);
    const [chatMessages, setChatMessages] = useState({});
    const [openChatCustomerId, setOpenChatCustomerId] = useState(null); // This is the CUSTOMER'S USER ID
    const [unreadMessages, setUnreadMessages] = useState({});

    // --- FIX: Wrap fetchQueueDetails in useCallback ---
    const fetchQueueDetails = useCallback(async () => {
        console.log(`[BarberDashboard] Fetching queue details for barber ${barberId}...`);
        setFetchError('');
        if (!barberId) { console.warn('[BarberDashboard] fetchQueueDetails called without barberId.'); return; }
        try {
            const response = await axios.get(`${API_URL}/queue/details/${barberId}`);
            console.log('[BarberDashboard] Successfully fetched queue details:', response.data);
            setQueueDetails(response.data);
         } catch (err) {
            console.error('[BarberDashboard] Failed fetch queue details:', err);
            const errMsg = err.response?.data?.error || err.message || 'Could not load queue details.';
            setError(errMsg);
            setFetchError(errMsg);
            setQueueDetails({ waiting: [], inProgress: null, upNext: null });
        }
    }, [barberId]); // Correct dependency

    // --- WebSocket Connection Effect for Barber ---
    useEffect(() => {
        if (!session?.user?.id) return;
        if (!socketRef.current) {
            console.log("[Barber] Connecting WebSocket...");
            socketRef.current = io(SOCKET_URL);
            const socket = socketRef.current;
            const barberUserId = session.user.id;
            socket.emit('register', barberUserId);
            socket.on('connect', () => { console.log(`[Barber] WebSocket connected.`); });

            const messageListener = (incomingMessage) => {
                console.log(`[Barber] Received message from ${incomingMessage.senderId}:`, incomingMessage.message);
                const customerId = incomingMessage.senderId;
                setChatMessages(prev => { const msgs = prev[customerId] || []; return { ...prev, [customerId]: [...msgs, incomingMessage] }; });
                // Use functional update to get latest state
                setOpenChatCustomerId(currentOpenChatId => {
                     console.log(`[Barber] Checking if message sender ${customerId} matches open chat ${currentOpenChatId}`);
                     if (customerId !== currentOpenChatId) {
                         console.log(`[Barber] Chat not open for ${customerId}. Marking as unread.`);
                         setUnreadMessages(prevUnread => ({ ...prevUnread, [customerId]: true }));
                     } else { console.log(`[Barber] Chat is open for ${customerId}. Not marking as unread.`); }
                     return currentOpenChatId;
                });
            };
            socket.on('chat message', messageListener);
            socket.on('connect_error', (err) => { console.error("[Barber] WebSocket Connection Error:", err); });
            socket.on('disconnect', (reason) => { console.log("[Barber] WebSocket disconnected:", reason); socketRef.current = null; });
        }
        return () => { if (socketRef.current) { console.log("[Barber] Cleaning up WebSocket connection."); socketRef.current.disconnect(); socketRef.current = null; } };
    }, [session]); // Dependency only on session

    // UseEffect for initial load and realtime subscription
    useEffect(() => {
        if (!barberId || !supabase?.channel) return;
        let dashboardRefreshInterval = null;
        fetchQueueDetails(); // Initial fetch
        const channel = supabase.channel(`barber_queue_${barberId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${barberId}` }, (payload) => {
                console.log('Barber dashboard received queue update (via Realtime):', payload);
                fetchQueueDetails(); // Refetch details
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') { console.log(`Barber dashboard subscribed to queue ${barberId}`); } 
                else { console.error(`Barber dashboard subscription error: ${status}`, err); }
            });
        dashboardRefreshInterval = setInterval(() => { console.log('Dashboard periodic refresh...'); fetchQueueDetails(); }, 15000);
        return () => {
            if (channel && supabase?.removeChannel) { supabase.removeChannel(channel).then(() => console.log('Barber unsubscribed.')); }
            if (dashboardRefreshInterval) { clearInterval(dashboardRefreshInterval); }
        };
    }, [barberId, fetchQueueDetails]); // <<< FIX: Added fetchQueueDetails

    // --- Handlers ---
    const handleNextCustomer = async () => {
        const next = queueDetails.upNext || (queueDetails.waiting.length > 0 ? queueDetails.waiting[0] : null);
        if (!next) { alert('Queue empty!'); return; }
        if (queueDetails.inProgress) { alert(`Complete ${queueDetails.inProgress.customer_name} first.`); return; }
        setError('');
        try { await axios.put(`${API_URL}/queue/next`, { queue_id: next.id, barber_id: barberId }); }
        catch (err) { console.error('Failed next customer:', err); setError(err.response?.data?.error || 'Failed call next.'); }
    };
    const handleCompleteCut = async () => {
        if (!queueDetails.inProgress) return;
        const serviceName = queueDetails.inProgress.services?.name || 'Service';
        const servicePrice = parseFloat(queueDetails.inProgress.services?.price_php) || 0;
        const tipAmount = prompt(`Service: ${serviceName} (₱${servicePrice.toFixed(2)}). \n\nPlease enter TIP amount (e.g., 50):`);
        if (tipAmount === null) return;
        const parsedTip = parseInt(tipAmount);
        if (isNaN(parsedTip) || parsedTip < 0) { alert('Invalid tip. Please enter 0 or more.'); return; }
        setError('');
        try {
          await axios.post(`${API_URL}/queue/complete`, {
            queue_id: queueDetails.inProgress.id,
            barber_id: barberId,
            tip_amount: parsedTip
          });
          onCutComplete();
          alert(`Cut completed! Total logged profit: ₱${(servicePrice + parsedTip).toFixed(2)}`);
        } catch (err) { console.error('Failed complete cut:', err); setError(err.response?.data?.error || 'Failed to complete cut.'); }
    };
    const handleCancel = async (customerToCancel) => {
        if (!customerToCancel) return;
        const confirmCancel = window.confirm(`Are you sure you want to mark Customer #${customerToCancel.id} (${customerToCancel.customer_name}) as Cancelled/No-Show? This will not log earnings.`);
        if (!confirmCancel) return;
        console.log("[handleCancel] Sending PUT request to /api/queue/cancel", { queue_id: customerToCancel.id, barber_id: barberId });
        setError(''); 
        try {
            await axios.put(`${API_URL}/queue/cancel`, {
                queue_id: customerToCancel.id,
                barber_id: barberId 
            });
        } catch (err) {
            console.error('[handleCancel] Failed to cancel customer:', err.response?.data || err.message); 
            setError(err.response?.data?.error || 'Failed to mark as cancelled.');
        }
    };
    const sendBarberMessage = (recipientId, messageText) => {
        if (messageText.trim() && socketRef.current?.connected && session?.user?.id) {
            const messageData = { senderId: session.user.id, recipientId, message: messageText };
            socketRef.current.emit('chat message', messageData);
            setChatMessages(prev => {
              const customerId = recipientId;
              const existingMessages = prev[customerId] || [];
              return { ...prev, [customerId]: [...existingMessages, { senderId: session.user.id, message: messageText }] };
            });
        } else { console.warn("Cannot send barber msg, socket disconnected?"); }
    };
    const openChat = (customer) => {
        const customerUserId = customer?.profiles?.id;
        if (customerUserId) {
            console.log(`[openChat] Opening chat for ${customerUserId}`);
            setOpenChatCustomerId(customerUserId);
            setUnreadMessages(prev => {
                const updated = { ...prev };
                delete updated[customerUserId]; // Mark as read
                return updated;
            });
        } else { console.error("Cannot open chat: Customer user ID missing.", customer); setError("Could not get customer details."); }
    };
    const closeChat = () => { setOpenChatCustomerId(null); };

    // --- Debug Log ---
    console.log("[BarberDashboard] Rendering with state:", { barberId, queueDetails: { waiting: queueDetails.waiting.length, inProgress: !!queueDetails.inProgress, upNext: !!queueDetails.upNext }, error, fetchError, openChatCustomerId, unreadMessages });

    // --- Render Barber Dashboard ---
    return (
        <div className="card">
            <h2>My Queue ({barberName || '...'})</h2>
            {fetchError && <p className="error-message large">Error loading queue: {fetchError}</p>}
            {!fetchError && (
                <>
                    <div className="current-serving-display">
                        <div className="serving-item now-serving"><span>Now Serving</span><strong>{queueDetails.inProgress ? `Customer #${queueDetails.inProgress.id}` : '---'}</strong></div>
                        <div className="serving-item up-next"><span>Up Next</span><strong>{queueDetails.upNext ? `Customer #${queueDetails.upNext.id}` : '---'}</strong></div>
                    </div>
                    {error && !fetchError && <p className="error-message">{error}</p>}
                    <div className="action-buttons-container">
                        {queueDetails.inProgress ? (
                            <>
                                <button onClick={handleCompleteCut} className="complete-button">Complete: #{queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}</button>
                                <button onClick={() => handleCancel(queueDetails.inProgress)} className="cancel-button">Cancel / No-Show</button>
                            </>
                        ) : queueDetails.upNext ? (
                             <button onClick={handleNextCustomer} className="next-button">Call: #{queueDetails.upNext.id} - {queueDetails.upNext.customer_name}</button>
                        ) : queueDetails.waiting.length > 0 ? (
                            <button onClick={handleNextCustomer} className="next-button">Call: #{queueDetails.waiting[0].id} - {queueDetails.waiting[0].customer_name}</button>
                        ) : ( <button className="next-button disabled" disabled>Queue Empty</button> )}
                    </div>
                    <h3 className="queue-subtitle">In Chair</h3>
                    {queueDetails.inProgress ? (<ul className="queue-list"><li className="in-progress"><div><strong>#{queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}</strong>{queueDetails.inProgress.share_ai_image && queueDetails.inProgress.ai_haircut_image_url && (<a href={queueDetails.inProgress.ai_haircut_image_url} target="_blank" rel="noopener noreferrer" className="photo-link ai-link">View AI Preview</a>)}</div><button onClick={() => openChat(queueDetails.inProgress)} className="chat-icon-button" title={queueDetails.inProgress.profiles?.id ? "Chat" : "Guest"} disabled={!queueDetails.inProgress.profiles?.id}>💬{queueDetails.inProgress.profiles?.id && unreadMessages[queueDetails.inProgress.profiles.id] && (<span className="notification-badge">1</span>)}</button></li></ul>) : (<p className="empty-text">Chair empty</p>)}
                    <h3 className="queue-subtitle">Up Next</h3>
                    {queueDetails.upNext ? (<ul className="queue-list"><li className="up-next"><div><strong>#{queueDetails.upNext.id} - {queueDetails.upNext.customer_name}</strong>{queueDetails.upNext.share_ai_image && queueDetails.upNext.ai_haircut_image_url && (<a href={queueDetails.upNext.ai_haircut_image_url} target="_blank" rel="noopener noreferrer" className="photo-link ai-link">View AI Preview</a>)}</div><button onClick={() => openChat(queueDetails.upNext)} className="chat-icon-button" title={queueDetails.upNext.profiles?.id ? "Chat" : "Guest"} disabled={!queueDetails.upNext.profiles?.id}>💬{queueDetails.upNext.profiles?.id && unreadMessages[queueDetails.upNext.profiles.id] && (<span className="notification-badge">1</span>)}</button></li></ul>) : (<p className="empty-text">Nobody Up Next</p>)}
                    <h3 className="queue-subtitle">Waiting</h3>
                    <ul className="queue-list">{queueDetails.waiting.length === 0 ? (<li className="empty-text">Waiting queue empty.</li>) : (queueDetails.waiting.map(c => (<li key={c.id}><div>#{c.id} - {c.customer_name}{c.share_ai_image && c.ai_haircut_image_url && (<a href={c.ai_haircut_image_url} target="_blank" rel="noopener noreferrer" className="photo-link ai-link">View AI Preview</a>)}</div><button onClick={() => openChat(c)} className="chat-icon-button" title={c.profiles?.id ? "Chat" : "Guest"} disabled={!c.profiles?.id}>💬{c.profiles?.id && unreadMessages[c.profiles.id] && (<span className="notification-badge">1</span>)}</button></li>)))}</ul>
                    
                    {openChatCustomerId && (
                        <div className="barber-chat-container">
                            <h4>Chat with Customer</h4>
                             <ChatWindow
                                currentUser_id={session.user.id}
                                otherUser_id={openChatCustomerId}
                                messages={chatMessages[openChatCustomerId] || []}
                                onSendMessage={sendBarberMessage}
                                isVisible={!!openChatCustomerId} // Pass visibility
                             />
                            <button onClick={closeChat} className="chat-toggle-button close small">Close Chat</button>
                        </div>
                    )}
                    <button onClick={fetchQueueDetails} className="refresh-button small">Refresh Queue</button>
                </>
            )}
        </div>
    );
}

// --- CustomerAppLayout defined here, so App can find it ---
function CustomerAppLayout({ session }) {
    const handleLogout = async () => {
         if (!supabase?.auth) return;
         try { await axios.put(`${API_URL}/logout/flag`, { userId: session.user.id }); } 
         catch (error) { console.error("Error clearing customer session flag:", error); }
         await supabase.auth.signOut();
    };
    return ( <div className="app-layout customer-layout"><header className="app-header"><h1>Dash-Q Customer</h1><button onClick={handleLogout} className='logout-button'>Logout</button></header><div className="container"><CustomerView session={session} /></div></div> );
}

// --- BarberAppLayout defined here, so App can find it ---
function BarberAppLayout({ session, barberProfile, setBarberProfile }) {
    const [refreshSignal, setRefreshSignal] = useState(0);
    
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (barberProfile?.id && session?.user) {
                navigator.sendBeacon(`${API_URL}/barber/availability`, JSON.stringify({ barberId: barberProfile.id, isAvailable: false, userId: session.user.id }));
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [barberProfile, session]);
    
    const handleLogout = async () => {
        if (!barberProfile || !session?.user || !supabase?.auth) return;
        try { await axios.put(`${API_URL}/barber/availability`, { barberId: barberProfile.id, isAvailable: false, userId: session.user.id }); } 
        catch (error) { console.error("Error setting offline on logout:", error); }
        finally { await supabase.auth.signOut(); }
    };
    
    // --- FIX: Define the function that was missing ---
    const handleCutComplete = () => setRefreshSignal(prev => prev + 1); 
    
    // --- FIX: Define the function that was missing ---
    const handleAvailabilityChange = (newStatus) => { setBarberProfile(prev => prev ? { ...prev, is_available: newStatus } : null); };
    
    const currentBarberId = barberProfile?.id;
    const currentBarberName = barberProfile?.full_name;
    
    return ( <div className="app-layout barber-layout"><header className="app-header"><h1>Barber: {currentBarberName || '...'}</h1><div className='header-controls'>{barberProfile && <AvailabilityToggle {...{ barberProfile, session, onAvailabilityChange: handleAvailabilityChange }}/>}<button onClick={handleLogout} className='logout-button'>Logout</button></div></header><div className="container">{currentBarberId ? (<><BarberDashboard {...{ barberId: currentBarberId, barberName: currentBarberName, onCutComplete: handleCutComplete, session }} /><AnalyticsDashboard {...{ barberId: currentBarberId, refreshSignal }} /></>) : (<div className="card"><p>Loading...</p></div>)}</div></div> );
}

// ##############################################
// ##           MAIN APP COMPONENT             ##
// ##############################################
function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [barberProfile, setBarberProfile] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // --- OneSignal Setup ---
  useEffect(() => {
    if (!window.OneSignal) {
      window.OneSignal = window.OneSignal || [];
      window.OneSignal.push(function() {
        window.OneSignal.init({
          appId: process.env.REACT_APP_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          notifyButton: { enable: false },
        });
      });
    }
    return () => { /* Cleanup if needed */ };
  }, []);

  // --- Helper to Update Availability (wrapped in useCallback) ---
  const updateAvailability = useCallback(async (barberId, userId, isAvailable) => {
       if (!barberId || !userId) return;
       try {
           const response = await axios.put(`${API_URL}/barber/availability`, { barberId, userId, isAvailable });
            setBarberProfile(prev => prev ? { ...prev, is_available: response.data.is_available } : null);
       } catch (error) {
            console.error("Failed to update availability state:", error);
       }
   }, []); // Empty dependency array, it doesn't depend on props/state

  // --- Helper to Check Role (wrapped in useCallback) ---
  const checkUserRole = useCallback(async (user) => {
     if (!user) {
         setUserRole('customer'); setBarberProfile(null); setLoadingRole(false); return;
     }
     setLoadingRole(true);
     try {
         const response = await axios.get(`${API_URL}/barber/profile/${user.id}`);
         setUserRole('barber');
         setBarberProfile(response.data);
         console.log("User role determined: Barber", response.data);
         if (response.data && !response.data.is_available) {
              updateAvailability(response.data.id, user.id, true);
         }
     } catch(error) {
         if (error.response && error.response.status === 404) {
             setUserRole('customer');
             console.log("User role determined: Customer (profile not found for ID:", user.id, ")");
         } else {
             console.error("Error checking/fetching barber profile:", error);
             setUserRole('customer');
         }
         setBarberProfile(null);
     } finally {
         setLoadingRole(false);
     }
  }, [updateAvailability]); // Depends on updateAvailability

  // --- Auth State Change Listener ---
  useEffect(() => {
    if (!supabase?.auth) { console.error("Supabase auth not initialized."); setLoadingRole(false); return; }
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      checkUserRole(currentSession?.user);
    }).catch(err => { console.error("Error getting initial session:", err); setLoadingRole(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
       console.log("Auth State Change Detected:", _event, currentSession);
       setSession(currentSession);
       setUserRole(null); setBarberProfile(null); setLoadingRole(true);
       if (currentSession?.user) {
            checkUserRole(currentSession.user);
       } else {
            setLoadingRole(false);
       }
    });

    return () => subscription?.unsubscribe();
  }, [checkUserRole]); // <<< FIX: Added checkUserRole to dependencies

  // --- Render Logic ---
  if (loadingRole) { return <div className="loading-fullscreen">Loading Application...</div>; }
  if (!session) { return <AuthForm />; }
  else if (userRole === null) { return <div className="loading-fullscreen">Verifying User Role...</div>; }
  else if (userRole === 'barber' && barberProfile) { return <BarberAppLayout session={session} barberProfile={barberProfile} setBarberProfile={setBarberProfile} />; }
  else { return <CustomerAppLayout session={session} />; }
}

export default App;

