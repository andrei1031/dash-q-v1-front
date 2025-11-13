import React, { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// --- Chart.js Imports ---
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

import './App.css';

// --- SOUND NOTIFICATION SETUP ---
const queueNotificationSound = new Audio('/queue_sound.mp3');
const messageNotificationSound = new Audio('/chat_sound.mp3');

/**
 * Helper function to play a sound, with error handling
 * for browser autoplay policies.
 */
const playSound = (audioElement) => {
    if (!audioElement) return;
    audioElement.currentTime = 0;
    audioElement.play().catch(error => {
        console.warn("Sound notification was blocked by the browser:", error.message);
    });
};


// --- Global Constants ---
const SOCKET_URL = 'https://dash-q-backend.onrender.com';
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
        auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }), signInWithPassword: () => { throw new Error('Supabase client not configured') }, signUp: () => { throw new Error('Supabase client not configured') }, signOut: () => { throw new Error('Supabase client not configured') } },
        channel: () => ({ on: () => ({ subscribe: () => { } }), subscribe: () => { console.warn("Realtime disabled: Supabase client not configured.") } }),
        removeChannel: () => Promise.resolve(),
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: new Error('Supabase client not configured') }) }) }) }),
        storage: { from: () => ({ upload: () => { throw new Error('Supabase storage not configured') }, getPublicUrl: () => ({ data: { publicUrl: null } }) }) }
    };
}

// --- Helper Function: Calculate Distance ---
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ##############################################
// ##     BLINKING TAB HELPER FUNCTIONS        ##
// ##############################################
let blinkInterval = null;
let originalTitle = document.title;
const alertTitle = "!! IT'S YOUR TURN !!";

function startBlinking() {
    if (blinkInterval) return;
    originalTitle = document.title;
    let isOriginalTitle = true;
    blinkInterval = setInterval(() => {
        document.title = isOriginalTitle ? alertTitle : originalTitle;
        isOriginalTitle = !isOriginalTitle;
    }, 1000);
}

function stopBlinking() {
    if (!blinkInterval) return;
    clearInterval(blinkInterval);
    blinkInterval = null;
    document.title = originalTitle;
}

function isIOsDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// ##############################################
// ##           CHAT COMPONENT               ##
// ##############################################
function ChatWindow({ currentUser_id, otherUser_id, messages = [], onSendMessage }) {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && onSendMessage) {
            onSendMessage(otherUser_id, newMessage);
            setNewMessage('');
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
// ##       LOGIN/SIGNUP COMPONENTS          ##
// ##############################################
// ##############################################
// ##       LOGIN/SIGNUP COMPONENTS          ##
// ##############################################
function AuthForm() {
    const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [barberCode, setBarberCode] = useState('');
    const [pin, setPin] = useState('');

    // <<< --- 1. REPLACE 'isLogin' STATE WITH 'authView' --- >>>
    const [authView, setAuthView] = useState('login'); // 'login', 'signup', or 'forgotPassword'

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedRole, setSelectedRole] = useState('customer');
    const [showPassword, setShowPassword] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true); setMessage('');
        try {
            // <<< --- 2. CHECK THE 'authView' STATE --- >>>
            if (authView === 'login') {
                if (!username || !password) throw new Error("Username/password required.");
                if (selectedRole === 'barber' && !pin) throw new Error("Barber PIN required.");
                const response = await axios.post(`${API_URL}/login/username`, { username: username.trim(), password, role: selectedRole, pin: selectedRole === 'barber' ? pin : undefined });
                if (response.data.user?.email && supabase?.auth) {
                    const { error } = await supabase.auth.signInWithPassword({ email: response.data.user.email, password });
                    if (error) throw error;
                } else { throw new Error("Login failed: Invalid server response."); }
            } else { // This is now just for 'signup'
                if (!email.trim() || !fullName.trim()) throw new Error("Email/Full Name required.");
                if (selectedRole === 'barber' && !barberCode.trim()) throw new Error("Barber Code required.");
                const response = await axios.post(`${API_URL}/signup/username`, { username: username.trim(), email: email.trim(), password, fullName: fullName.trim(), role: selectedRole, barberCode: selectedRole === 'barber' ? barberCode.trim() : undefined });
                setMessage(response.data.message || 'Account created! You can now log in.');
                setAuthView('login'); // <<< --- 3. GO BACK TO LOGIN VIEW --- >>>
                setUsername(''); setEmail(''); setPassword(''); setFullName(''); setBarberCode(''); setPin(''); setSelectedRole('customer');
            }
        } catch (error) { console.error('Auth error:', error); setMessage(`Authentication failed: ${error.response?.data?.error || error.message || 'Unexpected error.'}`); }
        finally { setLoading(false); }
    };

    // <<< --- 4. ADD NEW HANDLER FOR FORGOT PASSWORD --- >>>
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            if (!email) throw new Error("Email is required.");

            // --- NEW STEP: Check if email exists first ---
            console.log(`Checking if email ${email} exists...`);
            const checkResponse = await axios.post(`${API_URL}/check-email`, { email });

            if (!checkResponse.data.found) {
                console.log("Email not found, but showing generic message.");
                // We show a generic success message for security.
                // This prevents attackers from guessing registered emails.
                setMessage('If an account exists for this email, a reset link has been sent.');
                setLoading(false);
                return;
            }
            // --- END NEW STEP ---

            // If we get here, the email *does* exist. Proceed to send the reset link.
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin, // Redirects back to your main app page
            });
            if (error) {
                // Handle Supabase's rate limit error specifically
                if (error.message.includes('rate limit')) {
                    throw new Error('Email rate limit exceeded. Please wait a moment.');
                }
                throw error;
            }

            setMessage('Password reset link sent! Please check your email.');
            // Go back to login view so they can't spam the button
            setTimeout(() => {
                setAuthView('login');
                setEmail(''); // Clear email field
                setMessage('');
            }, 3000);

        } catch (error) {
            console.error('Forgot password error:', error);
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };
    // <<< --- END OF NEW HANDLER --- >>>


    return (
        <div className="card auth-card">
            {/* --- Welcome Modal (Only shows on Sign Up) --- */}
            <div
                className="modal-overlay"
                style={{ display: (isWelcomeModalOpen && authView === 'signup') ? 'flex' : 'none' }} // <<< 5. UPDATE THIS CHECK
            >
                <div className="modal-content">
                    <h2>Welcome to Dash-Q!</h2>
                    <p>This application was proudly developed by:<br />
                        <strong>Aquino, Zaldy Castro Jr.</strong><br />
                        <strong>Galima, Denmark Perpose</strong><br />
                        <strong>Saldivar, Reuben Andrei Santos</strong>
                        <br /><br />from<br /><br />
                        <strong>University of the Cordilleras</strong>
                    </p>
                    <button id="close-welcome-modal-btn" onClick={() => setIsWelcomeModalOpen(false)}>
                        Get Started
                    </button>
                </div>
            </div>

            {/* <<< --- 6. NEW CONDITIONAL RENDERING --- >>> */}

            {authView === 'forgotPassword' ? (
                <>
                    <h2>Reset Password</h2>
                    <form onSubmit={handleForgotPassword}>
                        <p>Enter your email. We will send you a link to reset your password.</p>
                        <div className="form-group">
                            <label>Email:</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>
                        <button type="submit" disabled={loading}>
                            {loading ? '...' : 'Send Reset Link'}
                        </button>
                    </form>
                    <button type="button" onClick={() => { setAuthView('login'); setMessage(''); }} className="toggle-auth-button">
                        Back to Login
                    </button>
                </>
            ) : (
                <>
                    <h2>{authView === 'login' ? 'Login' : 'Sign Up'}</h2>
                    <form onSubmit={handleAuth}>
                        <div className="form-group"><label>Username:</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength="3" autoComplete="username" /></div>

                        <div className="form-group password-group">
                            <label>Password:</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength="6"
                                autoComplete={authView === 'login' ? "current-password" : "new-password"}
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>

                        {authView === 'login' && (
                            <>
                                <div className="login-role-select"><label>Login As:</label><div className="role-toggle"><button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button><button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button></div>{selectedRole === 'barber' && (<div className="form-group pin-input"><label>Barber PIN:</label><input type="password" value={pin} onChange={(e) => setPin(e.target.value)} required={selectedRole === 'barber'} autoComplete="off" /></div>)}</div>

                                {/* <<< --- 7. ADD FORGOT PASSWORD BUTTON --- >>> */}
                                <div className="forgot-password-link">
                                    <button type="button" onClick={() => { setAuthView('forgotPassword'); setMessage(''); setEmail(''); }}>
                                        Forgot Password?
                                    </button>
                                </div>
                            </>
                        )}

                        {authView === 'signup' && (
                            <>
                                <div className="signup-role-select"><label>Sign Up As:</label><div className="role-toggle"><button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button><button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button></div></div>
                                <div className="form-group"><label>Email:</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /><small>Needed for account functions.</small></div>
                                <div className="form-group"><label>Full Name:</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" /></div>
                                {selectedRole === 'barber' && (<div className="form-group"><label>Barber Code:</label><input type="text" value={barberCode} placeholder="Secret code" onChange={(e) => setBarberCode(e.target.value)} required={selectedRole === 'barber'} /><small>Required.</small></div>)}
                            </>
                        )}

                        <button type="submit" disabled={loading}>{loading ? '...' : (authView === 'login' ? 'Login' : 'Sign Up')}</button>
                    </form>
                </>
            )}

            {message && <p className={`message ${message.includes('successful') || message.includes('created') || message.includes('can now log in') || message.includes('sent') ? 'success' : 'error'}`}>{message}</p>}

            {/* <<< --- 8. UPDATE THIS BUTTON LOGIC --- >>> */}
            {authView !== 'forgotPassword' && (
                <button type="button" onClick={() => { setAuthView(authView === 'login' ? 'signup' : 'login'); setMessage(''); setSelectedRole('customer'); setPin(''); setBarberCode(''); }} className="toggle-auth-button">
                    {authView === 'login' ? 'Need account? Sign Up' : 'Have account? Login'}
                </button>
            )}
        </div>
    );
}

// ##############################################
// ##       UPDATE PASSWORD COMPONENT          ##
// ##############################################
function UpdatePasswordForm({ onPasswordUpdated }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        if (password.length < 6) {
            setMessage('Password must be at least 6 characters.');
            setLoading(false);
            return;
        }

        try {
            // Supabase client automatically reads the token from the URL
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;

            setMessage('Password updated successfully! You can now log in.');
            // Wait 2 seconds, then go back to the login screen
            setTimeout(() => {
                onPasswordUpdated();
            }, 2000);

        } catch (error) {
            console.error('Error updating password:', error);
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card auth-card">
            <h2>Set Your New Password</h2>
            <p>You have been verified. Please enter a new password.</p>
            <form onSubmit={handlePasswordReset}>
                <div className="form-group password-group">
                    <label>New Password:</label>
                    <input
                        type='password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength="6"
                    />
                </div>
                <button type="submit" disabled={loading}>
                    {loading ? '...' : 'Set New Password'}
                </button>
            </form>
            {message && (
                <p className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}

// ##############################################
// ##     BARBER-SPECIFIC COMPONENTS         ##
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
            onAvailabilityChange(response.data.is_available);
        } catch (err) { console.error("Failed toggle availability:", err); setError(err.response?.data?.error || "Could not update."); }
        finally { setLoading(false); }
    };
    return (<div className="availability-toggle"><p>Status: <strong>{isAvailable ? 'Available' : 'Offline'}</strong></p><button onClick={handleToggle} disabled={loading} className={isAvailable ? 'go-offline-button' : 'go-online-button'}>{loading ? '...' : (isAvailable ? 'Go Offline' : 'Go Online')}</button>{error && <p className="error-message small">{error}</p>}</div>);
}

// --- AnalyticsDashboard (Displays Barber Stats) ---
function AnalyticsDashboard({ barberId, refreshSignal }) {
    const [analytics, setAnalytics] = useState({ totalEarningsToday: 0, totalCutsToday: 0, totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0, totalCutsAllTime: 0 });
    const [error, setError] = useState('');
    const [showEarnings, setShowEarnings] = useState(true);
    const [feedback, setFeedback] = useState([]);

    const fetchAnalytics = useCallback(async () => {
        if (!barberId) return;
        setError('');
        try {
            const response = await axios.get(`${API_URL}/analytics/${barberId}`);
            setAnalytics({ dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, ...response.data });
            setShowEarnings(response.data?.showEarningsAnalytics ?? true);

            const feedbackResponse = await axios.get(`${API_URL}/feedback/${barberId}`);
            setFeedback(feedbackResponse.data || []);

        } catch (err) {
            console.error('Failed fetch analytics/feedback:', err);
            setError('Could not load dashboard data.');
            setAnalytics({ totalEarningsToday: 0, totalCutsToday: 0, totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0 });
        }
    }, [barberId]);

    useEffect(() => {
        fetchAnalytics();
    }, [refreshSignal, barberId, fetchAnalytics]);

    const avgPriceToday = (analytics.totalCutsToday ?? 0) > 0 ? ((analytics.totalEarningsToday ?? 0) / analytics.totalCutsToday).toFixed(2) : '0.00';
    const avgPriceWeek = (analytics.totalCutsWeek ?? 0) > 0 ? ((analytics.totalEarningsWeek ?? 0) / analytics.totalCutsWeek).toFixed(2) : '0.00';
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Earnings per Day (Last 7 Days)' } }, scales: { y: { beginAtZero: true } } };
    const dailyDataSafe = Array.isArray(analytics.dailyData) ? analytics.dailyData : [];
    const chartData = { labels: dailyDataSafe.map(d => { try { return new Date(d.day + 'T00:00:00Z').toLocaleString(undefined, { month: 'numeric', day: 'numeric' }); } catch (e) { return '?'; } }), datasets: [{ label: 'Daily Earnings (₱)', data: dailyDataSafe.map(d => d.daily_earnings ?? 0), backgroundColor: 'rgba(52, 199, 89, 0.6)', borderColor: 'rgba(52, 199, 89, 1)', borderWidth: 1 }] };
    const carbonSavedToday = 5;
    const carbonSavedWeekly = (dailyDataSafe.length) * 5;

    return (<div className="card analytics-card">
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

        <div className="feedback-list-container">
            <h3 className="analytics-subtitle">Recent Feedback</h3>
            <ul className="feedback-list">
                {feedback.length > 0 ? (
                    feedback.map((item, index) => (
                        <li key={index} className="feedback-item">
                            <div className="feedback-header">
                                <span className="feedback-score">
                                    {item.score > 0 ? '😊' : item.score < 0 ? '😠' : '😐'}
                                </span>
                                <span className="feedback-customer">
                                    {item.customer_name || 'Customer'}
                                </span>
                            </div>
                            <p className="feedback-comment">"{item.comments}"</p>
                        </li>
                    ))
                ) : (
                    <p className="empty-text">No feedback yet.</p>
                )}
            </ul>
        </div>
    </div>);
}

// --- BarberDashboard (Handles Barber's Queue Management) ---
function BarberDashboard({ barberId, barberName, onCutComplete, session }) {
    const [queueDetails, setQueueDetails] = useState({ waiting: [], inProgress: null, upNext: null });
    const [error, setError] = useState('');
    const [fetchError, setFetchError] = useState('');
    const socketRef = useRef(null);
    const [chatMessages, setChatMessages] = useState({});
    const [openChatCustomerId, setOpenChatCustomerId] = useState(null);
    const [openChatQueueId, setOpenChatQueueId] = useState(null);
    const [unreadMessages, setUnreadMessages] = useState({});

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
    }, [barberId]);

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
                playSound(messageNotificationSound);

                const customerId = incomingMessage.senderId;

                // 1. ALWAYS append the message to the state object for persistence
                setChatMessages(prev => {
                    const msgs = prev[customerId] || [];
                    return { ...prev, [customerId]: [...msgs, incomingMessage] };
                });

                // 2. Handle unread status (Only if the chat is NOT open)
                setOpenChatCustomerId(currentOpenChatId => {
                    if (customerId !== currentOpenChatId) {
                        setUnreadMessages(prevUnread => ({ ...prevUnread, [customerId]: true }));
                    }
                    return currentOpenChatId;
                });
            };
            socket.on('chat message', messageListener);
            socket.on('connect_error', (err) => { console.error("[Barber] WebSocket Connection Error:", err); });
            socket.on('disconnect', (reason) => { console.log("[Barber] WebSocket disconnected:", reason); socketRef.current = null; });
        }
        return () => { if (socketRef.current) { console.log("[Barber] Cleaning up WebSocket connection."); socketRef.current.disconnect(); socketRef.current = null; } };
    }, [session]);

    // UseEffect for initial load and realtime subscription
    useEffect(() => {
        if (!barberId || !supabase?.channel) return;
        let dashboardRefreshInterval = null;
        fetchQueueDetails();
        const channel = supabase.channel(`barber_queue_${barberId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${barberId}` }, (payload) => {
                console.log('Barber dashboard received queue update (via Realtime):', payload);
                fetchQueueDetails();
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
    }, [barberId, fetchQueueDetails]);

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

        const queueId = queueDetails.inProgress.id;

        // --- Step 1: Retrieve necessary data from state ---
        const serviceName = queueDetails.inProgress.services?.name || 'Service';
        const servicePrice = parseFloat(queueDetails.inProgress.services?.price_php) || 0; // 1000.00
        const isVIP = queueDetails.inProgress.is_vip === true;

        // --- Step 2: Calculate VIP fee and total amount due (before tip) ---
        const vipCharge = isVIP ? 149 : 0; // 100
        const subtotalDue = servicePrice + vipCharge; // 1000 + 100 = 1100

        // --- Step 3: Prompt the barber for tip amount ---
        const tipAmountInput = window.prompt(
            // The prompt confirms the subtotal (1100.00)
            `Service: ${serviceName} (₱${servicePrice.toFixed(2)})${isVIP ? ' + VIP Fee (₱149.00)' : ''}. \n\nTotal Due: ₱${subtotalDue.toFixed(2)}.\n\nPlease enter TIP amount (e.g., 50):`
        );

        if (tipAmountInput === null) return;
        const parsedTip = parseInt(tipAmountInput); // 0 (if no input)

        if (isNaN(parsedTip) || parsedTip < 0) {
            window.alert('Invalid tip. Please enter 0 or more.');
            return;
        }

        // --- Step 4: Calculate the final profit for the alert ---
        const finalLoggedProfit = subtotalDue + parsedTip; // 1100 + 0 = 1100

        setError('');
        try {
            // --- Step 5: Send ALL charges to the server ---
            // The server will calculate: 1000 + 0 + 100 = 1100 (Correct)
            await axios.post(`${API_URL}/queue/complete`, {
                queue_id: queueId,
                barber_id: barberId,
                tip_amount: parsedTip,
                vip_charge: vipCharge,
            });

            onCutComplete();

            // --- Step 6: Display the correct final logged profit (1100.00) ---
            window.alert(`Cut completed! Total logged profit: ₱${finalLoggedProfit.toFixed(2)}`);
        } catch (err) {
            console.error('Failed complete cut:', err);
            setError(err.response?.data?.error || 'Failed to complete cut.');
        }
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

    // --- Message Sender (Sends queueId for persistence) ---
    const sendBarberMessage = (recipientId, messageText) => {
        const queueId = openChatQueueId;
        if (messageText.trim() && socketRef.current?.connected && session?.user?.id && queueId) {
            const messageData = { senderId: session.user.id, recipientId, message: messageText, queueId };
            socketRef.current.emit('chat message', messageData);
            setChatMessages(prev => {
                const customerId = recipientId;
                const existingMessages = prev[customerId] || [];
                return { ...prev, [customerId]: [...existingMessages, { senderId: session.user.id, message: messageText }] };
            });
        } else { console.warn("Cannot send barber msg, socket disconnected or queueId missing."); }
    };

    // --- Chat Opener (Fetches history and sets queueId) ---
    const openChat = (customer) => {
        const customerUserId = customer?.profiles?.id;
        const queueId = customer?.id;

        if (customerUserId && queueId) {
            console.log(`[openChat] Opening chat for ${customerUserId} on queue ${queueId}`);
            setOpenChatCustomerId(customerUserId);
            setOpenChatQueueId(queueId);

            setUnreadMessages(prev => {
                const updated = { ...prev };
                delete updated[customerUserId];
                return updated;
            });

            // Fetch history when chat opens
            const fetchHistory = async () => {
                try {
                    const { data } = await supabase.from('chat_messages').select('sender_id, message').eq('queue_entry_id', queueId).order('created_at', { ascending: true });
                    const formattedHistory = data.map(msg => ({ senderId: msg.sender_id, message: msg.message }));
                    setChatMessages(prev => ({ ...prev, [customerUserId]: formattedHistory }));
                } catch (err) { console.error("Barber failed to fetch history:", err); }
            };
            fetchHistory();

        } else { console.error("Cannot open chat: Customer user ID or Queue ID missing.", customer); setError("Could not get customer details."); }
    };

    const closeChat = () => { setOpenChatCustomerId(null); setOpenChatQueueId(null); };

    // --- Helper to render photo if available ---
    const PhotoDisplay = ({ entry, label }) => {
        if (!entry?.reference_image_url) return null;
        return (
            <div className="barber-photo-display">
                <a href={entry.reference_image_url} target="_blank" rel="noopener noreferrer">
                    {label} Photo Available 📸
                </a>
            </div>
        );
    };

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
                        ) : (<button className="next-button disabled" disabled>Queue Empty</button>)}
                    </div>

                    <h3 className="queue-subtitle">In Chair</h3>
                    {queueDetails.inProgress ? (
                        <ul className="queue-list">
                            <li className="in-progress">
                                <div><strong>#{queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}</strong></div>
                                <button onClick={() => openChat(queueDetails.inProgress)} className="chat-icon-button" title={queueDetails.inProgress.profiles?.id ? "Chat" : "Guest"} disabled={!queueDetails.inProgress.profiles?.id}>💬{queueDetails.inProgress.profiles?.id && unreadMessages[queueDetails.inProgress.profiles.id] && (<span className="notification-badge">1</span>)}</button>
                                <PhotoDisplay entry={queueDetails.inProgress} label="In Chair" />
                            </li>
                        </ul>
                    ) : (<p className="empty-text">Chair empty</p>)}

                    <h3 className="queue-subtitle">Up Next</h3>
                    {queueDetails.upNext ? (
                        <ul className="queue-list">
                            <li className="up-next">
                                <div><strong>#{queueDetails.upNext.id} - {queueDetails.upNext.customer_name}</strong></div>
                                <button onClick={() => openChat(queueDetails.upNext)} className="chat-icon-button" title={queueDetails.upNext.profiles?.id ? "Chat" : "Guest"} disabled={!queueDetails.upNext.profiles?.id}>💬{queueDetails.upNext.profiles?.id && unreadMessages[queueDetails.upNext.profiles.id] && (<span className="notification-badge">1</span>)}</button>
                                <PhotoDisplay entry={queueDetails.upNext} label="Up Next" />
                            </li>
                        </ul>
                    ) : (<p className="empty-text">Nobody Up Next</p>)}

                    <h3 className="queue-subtitle">Waiting</h3>
                    <ul className="queue-list">{queueDetails.waiting.length === 0 ? (<li className="empty-text">Waiting queue empty.</li>) : (queueDetails.waiting.map(c => (
                        <li key={c.id}>
                            <div>#{c.id} - {c.customer_name}</div>
                            <button onClick={() => openChat(c)} className="chat-icon-button" title={c.profiles?.id ? "Chat" : "Guest"} disabled={!c.profiles?.id}>💬{c.profiles?.id && unreadMessages[c.profiles.id] && (<span className="notification-badge">1</span>)}</button>
                            {c.reference_image_url && <PhotoDisplay entry={c} label="Waiting" />}
                        </li>
                    )))}</ul>

                    {openChatCustomerId && (
                        <div className="barber-chat-container">
                            <h4>Chat with Customer(Hey there! Just a friendly nudge to keep the chat open even when your phone’s screen is off. It seems like the notification badge isn’t working when that happens!)</h4>
                            <ChatWindow
                                currentUser_id={session.user.id}
                                otherUser_id={openChatCustomerId}
                                messages={chatMessages[openChatCustomerId] || []}
                                onSendMessage={sendBarberMessage}
                                isVisible={!!openChatCustomerId}
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
const handleLogout = async (userId) => {
    // 1. Send API call to mark UNAVAILABLE and clear session flag on the server
    try {
        await axios.put(`${API_URL}/logout/flag`, { userId });
        console.log("Server status updated successfully.");
    } catch (error) {
        console.error("Warning: Failed to clear barber availability status on server.", error.message);
    }

    // 2. Local Logout (Guaranteed Reset)
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
        console.warn("Standard Supabase signout failed (403 Forbidden). Forcing local session clear.");
        await supabase.auth.setSession({ access_token: 'expired', refresh_token: 'expired' });
    }
};
// ##############################################
// ##    CUSTOMER-SPECIFIC COMPONENTS        ##
// ##############################################

// --- CustomerView (Handles Joining Queue & Live View for Customers) ---
function CustomerView({ session }) {
    // --- State ---
    const [barbers, setBarbers] = useState([]);
    const [selectedBarberId, setSelectedBarberId] = useState('');
    const [customerName] = useState(() => session.user?.user_metadata?.full_name || '');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail] = useState(() => session.user?.email || '');
    const [message, setMessage] = useState('');
    const [player_id, setPlayerId] = useState(null);
    const [myQueueEntryId, setMyQueueEntryId] = useState(() => localStorage.getItem('myQueueEntryId') || null);
    const [joinedBarberId, setJoinedBarberId] = useState(() => localStorage.getItem('joinedBarberId') || null);
    const [liveQueue, setLiveQueue] = useState([]);
    const [queueMessage, setQueueMessage] = useState('');
    const [estimatedWait, setEstimatedWait] = useState(0);
    const [peopleWaiting, setPeopleWaiting] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isQueueLoading, setIsQueueLoading] = useState(true);
    const [services, setServices] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isYourTurnModalOpen, setIsYourTurnModalOpen] = useState(false);
    const [modalAlert, setModalAlert] = useState({ title: "You're up next!", text: "Please take a seat and stay put." });
    const [isModalButtonDisabled, setIsModalButtonDisabled] = useState(false);
    const [modalCountdown, setModalCountdown] = useState(10);
    const [isServiceCompleteModalOpen, setIsServiceCompleteModalOpen] = useState(false);
    const [isCancelledModalOpen, setIsCancelledModalOpen] = useState(false);
    const [hasUnreadFromBarber, setHasUnreadFromBarber] = useState(false);
    const [chatMessagesFromBarber, setChatMessagesFromBarber] = useState([]);
    const [displayWait, setDisplayWait] = useState(0);
    const [isTooFarModalOpen, setIsTooFarModalOpen] = useState(false);
    const [isOnCooldown, setIsOnCooldown] = useState(false);
    const locationWatchId = useRef(null);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const socketRef = useRef(null);
    const liveQueueRef = useRef([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [referenceImageUrl, setReferenceImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isVIPToggled, setIsVIPToggled] = useState(false); // Tracks the toggle state
    const [isVIPModalOpen, setIsVIPModalOpen] = useState(false); // Controls the confirmation modal

    // --- AI Feedback & UI State ---
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [barberFeedback, setBarberFeedback] = useState([]);

    // --- Calculated Vars ---
    const nowServing = liveQueue.find(entry => entry.status === 'In Progress');
    const upNext = liveQueue.find(entry => entry.status === 'Up Next');
    const targetBarber = barbers.find(b => b.id === parseInt(joinedBarberId));
    const currentBarberName = targetBarber?.full_name || `Barber #${joinedBarberId}`;
    const currentChatTargetBarberUserId = targetBarber?.user_id;

    // FIX for no-undef errors: Define calculated state variables at the top of the component
    const myQueueEntry = liveQueue.find(e => e.id.toString() === myQueueEntryId);
    const isQueueUpdateAllowed = myQueueEntry && (myQueueEntry.status === 'Waiting' || myQueueEntry.status === 'Up Next');

    // --- Utilities ---
    const fetchChatHistory = useCallback(async (queueId) => {
        if (!queueId) return;
        try {
            const { data, error } = await supabase.from('chat_messages').select('sender_id, message').eq('queue_entry_id', queueId).order('created_at', { ascending: true });
            if (error) throw error;
            const formattedHistory = data.map(msg => ({
                senderId: msg.sender_id,
                message: msg.message
            }));
            setChatMessagesFromBarber(formattedHistory);
        } catch (err) { console.error("Error fetching customer chat history:", err); }
    }, []);

    // --- Handlers ---
    const handleCloseInstructions = () => {
        localStorage.setItem('hasSeenInstructions_v1', 'true');
        setIsInstructionsModalOpen(false);
    };
    const sendCustomerMessage = (recipientId, messageText) => {
        const queueId = myQueueEntryId;

        if (messageText.trim() && socketRef.current?.connected && session?.user?.id && queueId) {
            const messageData = { senderId: session.user.id, recipientId, message: messageText, queueId };

            // 1. Send live message to server (server logs and pushes notification)
            socketRef.current.emit('chat message', messageData);


            // 2. Immediately update local state to show message
            setChatMessagesFromBarber(prev => [...prev, { senderId: session.user.id, message: messageText }]);
        } else { console.warn("[Customer] Cannot send message (socket disconnected or missing IDs)."); setMessage("Chat disconnected."); }
    };
    const fetchPublicQueue = useCallback(async (barberId) => {
        if (!barberId) {
            setLiveQueue(() => []);
            liveQueueRef.current = [];
            setIsQueueLoading(() => false);
            return;
        }
        setIsQueueLoading(() => true);
        let queueData = [];
        try {
            const response = await axios.get(`${API_URL}/queue/public/${barberId}`);
            queueData = response.data || [];
            setLiveQueue(() => queueData);
            liveQueueRef.current = queueData;

            // <<< --- NEW "MISSED EVENT" CATCHER for In Progress/Up Next --- >>>
            const currentQueueId = localStorage.getItem('myQueueEntryId');
            if (currentQueueId) {
                const myEntry = queueData.find(e => e.id.toString() === currentQueueId);

                if (myEntry && (myEntry.status === 'In Progress' || myEntry.status === 'Up Next')) {
                    // We are in the queue and our turn is now, but we might have missed the modal.
                    // Check if the sticky flag is already set. If not, set it and show the modal.
                    const modalFlag = localStorage.getItem('stickyModal');

                    if (modalFlag !== 'yourTurn') {
                        console.log(`[Catcher] Missed event! My status is ${myEntry.status}. Triggering modal.`);

                        if (myEntry.status === 'In Progress') {
                            setModalAlert({ title: "It's your turn!", text: "The barber is calling you now." });
                        } else {
                            setModalAlert({ title: "You're up next!", text: "Please take a seat and stay put." });
                        }

                        playSound(queueNotificationSound);
                        startBlinking();
                        setIsYourTurnModalOpen(true);
                        localStorage.setItem('stickyModal', 'yourTurn');
                        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                    }
                }
            }
            // <<< --- END OF NEW CATCHER --- >>>

        } catch (error) {
            console.error("Failed fetch public queue:", error);
            setLiveQueue(() => []);
            liveQueueRef.current = [];
            setQueueMessage(() => "Could not load queue data.");
        } finally {
            setIsQueueLoading(() => false);

            // --- THIS IS THE "MISSED EVENT" LOGIC (For Done/Cancelled) ---
            const currentQueueId = localStorage.getItem('myQueueEntryId');

            if (currentQueueId) {
                const amIInActiveQueue = queueData.some(entry => entry.id.toString() === currentQueueId);

                setIsServiceCompleteModalOpen(isDoneOpen => {
                    setIsCancelledModalOpen(isCancelledOpen => {

                        if (!amIInActiveQueue && !isDoneOpen && !isCancelledOpen) {

                            const checkServerForMissedEvent = async () => {
                                const userId = session?.user?.id;
                                if (!userId) return;

                                console.log("[Catcher] My entry is no longer active. Checking server for missed event...");
                                try {
                                    const response = await axios.get(`${API_URL}/missed-event/${userId}`);
                                    const eventType = response.data.event;

                                    if (eventType === 'Done') {
                                        console.log("[Catcher] Server confirmed 'Done'. Showing Feedback modal.");
                                        setIsServiceCompleteModalOpen(true);
                                        localStorage.removeItem('myQueueEntryId');
                                        localStorage.removeItem('joinedBarberId');
                                        localStorage.removeItem('stickyModal');
                                    } else if (eventType === 'Cancelled') {
                                        console.log("[Catcher] Server confirmed 'Cancelled'. Showing Cancelled modal.");
                                        setIsCancelledModalOpen(true);
                                        localStorage.removeItem('myQueueEntryId');
                                        localStorage.removeItem('joinedBarberId');
                                        localStorage.removeItem('stickyModal');
                                    } else {
                                        if (currentQueueId) {
                                            console.warn("[Catcher] Server returned null, but entry is gone. Assuming 'Done' for safe cleanup.");
                                            setIsServiceCompleteModalOpen(true);
                                            localStorage.removeItem('myQueueEntryId');
                                            localStorage.removeItem('joinedBarberId');
                                            localStorage.removeItem('stickyModal');
                                        }
                                    }
                                } catch (error) {
                                    console.error("[Catcher] Error fetching missed event from server:", error.message);
                                }
                            };
                            checkServerForMissedEvent();
                        }
                        return isCancelledOpen;
                    });
                    return isDoneOpen;
                });
            }
            // --- END "DONE/CANCELLED" LOGIC ---
        }
    }, [session, setIsQueueLoading, setLiveQueue, setQueueMessage, setIsServiceCompleteModalOpen, setIsCancelledModalOpen]); // <-- Dependencies are correct

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setSelectedFile(file);
        setReferenceImageUrl('');
    };

    const handleUploadPhoto = async (targetQueueId = myQueueEntryId) => {
        if (!selectedFile) { setMessage("Please select a file first."); return; }
        if (!targetQueueId && myQueueEntryId) { targetQueueId = myQueueEntryId; }

        setIsUploading(true);
        setMessage('Uploading photo...');

        try {
            const fileExtension = selectedFile.name.split('.').pop();
            const filePath = `${session.user.id}/${targetQueueId || 'new'}-${Date.now()}.${fileExtension}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('haircut_references')
                .upload(filePath, selectedFile, {
                    cacheControl: '3600',
                    upsert: true
                });
            if (uploadError) throw uploadError;

            // 2. Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('haircut_references')
                .getPublicUrl(filePath);

            if (!publicUrlData.publicUrl) throw new Error("Failed to get public URL.");

            const imageUrl = publicUrlData.publicUrl;

            // 3. Update the queue entry with the new URL (Applies to Join or Update)
            if (!myQueueEntryId) {
                // Only set state for initial join form
                setReferenceImageUrl(imageUrl);
                setMessage('Photo uploaded. Ready to join queue.');
            } else {
                // Update existing queue entry
                const updateResponse = await axios.put(`${API_URL}/queue/photo`, {
                    queueId: targetQueueId,
                    barberId: joinedBarberId,
                    referenceImageUrl: imageUrl
                });

                if (updateResponse.status !== 200) throw new Error("Failed to update queue entry.");
                setReferenceImageUrl(imageUrl);
                setMessage('Photo successfully updated!');
                // Force a queue refresh to get the updated URL in the liveQueue
                fetchPublicQueue(joinedBarberId);
            }

            setSelectedFile(null);

        } catch (error) {
            console.error('Photo upload failed:', error);
            setMessage(`Photo upload failed: ${error.message || 'Server error.'}`);
            setReferenceImageUrl('');
        } finally {
            setIsUploading(false);
        }
    };

    // --- NEW VIP HANDLER: Opens the confirmation modal ---
    const handleVIPToggle = (e) => {
        // Check for both native checkbox event (e.target.checked) 
        // and our simulated button click event (e.target.checked)
        const isChecked = e.target.checked;

        if (isChecked) {
            // If turning ON, open modal for confirmation
            setIsVIPModalOpen(true);
        } else {
            // If turning OFF, just update the state
            setIsVIPToggled(false);
        }
    };

    // --- NEW VIP MODAL HANDLER: Confirms VIP status ---
    const confirmVIP = () => {
        setIsVIPToggled(true);
        setIsVIPModalOpen(false);
    };

    const cancelVIP = () => {
        setIsVIPToggled(false); // Ensure the toggle is visually unchecked
        setIsVIPModalOpen(false);
    };

    const handleJoinQueue = async (e) => {
        e.preventDefault();
        if (!customerName || !selectedBarberId || !selectedServiceId) { setMessage('Name, Barber, AND Service required.'); return; }
        if (myQueueEntryId) { setMessage('You are already checked in!'); return; }

        setIsLoading(true); setMessage('Joining queue...');
        try {
            const response = await axios.post(`${API_URL}/queue`, {
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_email: customerEmail,
                barber_id: selectedBarberId,
                reference_image_url: referenceImageUrl || null,
                service_id: selectedServiceId,
                player_id: player_id,
                user_id: session.user.id,
                is_vip: isVIPToggled,
            });
            const newEntry = response.data;
            if (newEntry && newEntry.id) {
                setMessage(`Success! You are #${newEntry.id} in the queue.`);
                localStorage.setItem('myQueueEntryId', newEntry.id.toString());
                localStorage.setItem('joinedBarberId', newEntry.barber_id.toString());
                setMyQueueEntryId(newEntry.id.toString());
                setJoinedBarberId(newEntry.barber_id.toString());
                setSelectedBarberId(''); setSelectedServiceId('');
                setReferenceImageUrl(newEntry.reference_image_url || '');
                fetchPublicQueue(newEntry.barber_id.toString());
                setIsVIPToggled(false); // Reset VIP flag after join
            } else { throw new Error("Invalid response from server."); }
        } catch (error) {
            console.error('Failed to join queue:', error);
            const errorMessage = error.response?.data?.error || error.message;
            setMessage(errorMessage.includes('unavailable') ? errorMessage : 'Failed to join. Try again.');
        } finally { setIsLoading(false); }
    };

    const handleReturnToJoin = async (userInitiated = false) => {
        console.log("[handleReturnToJoin] Function called.");
        if (userInitiated && myQueueEntryId) {
            setIsLoading(true);
            try {
                // --- THIS IS THE CHANGE ---
                // We must send our user ID to prove who we are
                await axios.delete(`${API_URL}/queue/${myQueueEntryId}`, {
                    data: { userId: session.user.id }
                });
                // --- END CHANGE ---
                setMessage("You left the queue.");
            }
            catch (error) { console.error("Failed to leave queue:", error); setMessage("Error leaving queue."); }
            finally { setIsLoading(false); }
        }
        setIsServiceCompleteModalOpen(false); setIsCancelledModalOpen(false); setIsYourTurnModalOpen(false);
        stopBlinking();
        localStorage.removeItem('myQueueEntryId'); localStorage.removeItem('joinedBarberId');
        setMyQueueEntryId(null); setJoinedBarberId(null);
        setLiveQueue([]); setQueueMessage(''); setSelectedBarberId('');
        setSelectedServiceId(''); setMessage('');
        setIsChatOpen(false);
        setChatMessagesFromBarber([]); setDisplayWait(0); setEstimatedWait(0);
        setReferenceImageUrl('');
        setSelectedFile(null);
        setIsUploading(false);

        setFeedbackText('');
        setFeedbackSubmitted(false);
        setBarberFeedback([]);

        console.log("[handleReturnToJoin] State reset complete.");
    };

    const handleModalClose = () => {
        setIsYourTurnModalOpen(false); // <<< --- ADD THIS
        stopBlinking();
    };

    // --- Effects ---
    useEffect(() => { // Geolocation Watcher 
        const BARBERSHOP_LAT = 16.414830431367967;
        const BARBERSHOP_LON = 120.59712292628716;
        const DISTANCE_THRESHOLD_METERS = 200;
        if (!('geolocation' in navigator)) { console.warn('Geolocation not available.'); return; }
        if (myQueueEntryId) {
            console.log('User is in queue, starting location watch...');
            const onPositionUpdate = (position) => {
                const { latitude, longitude } = position.coords;
                const distance = getDistanceInMeters(latitude, longitude, BARBERSHOP_LAT, BARBERSHOP_LON);
                console.log(`Current distance: ${Math.round(distance)}m. Cooldown: ${isOnCooldown}`);
                if (distance > DISTANCE_THRESHOLD_METERS) {
                    if (!isTooFarModalOpen && !isOnCooldown) {
                        console.log('Customer is too far! Triggering modal.');
                        localStorage.setItem('stickyModal', 'tooFar'); // <<< --- ADD THIS
                        setIsTooFarModalOpen(true);
                        setIsOnCooldown(true);
                    }
                } else {
                    if (isOnCooldown) { console.log('Customer is back in range. Resetting cooldown.'); setIsOnCooldown(false); }
                }
            };
            const onPositionError = (err) => { console.warn(`Geolocation error (Code ${err.code}): ${err.message}`); };
            locationWatchId.current = navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        }
        return () => { if (locationWatchId.current) { navigator.geolocation.clearWatch(locationWatchId.current); console.log('Stopping geolocation watch.'); } };
    }, [myQueueEntryId, isTooFarModalOpen, isOnCooldown]);

    useEffect(() => { // First Time Instructions
        const hasSeen = localStorage.getItem('hasSeenInstructions_v1');
        if (!hasSeen) { setIsInstructionsModalOpen(true); }
    }, []);

    useEffect(() => {
        const modalFlag = localStorage.getItem('stickyModal');
        if (modalFlag === 'yourTurn') {
            setIsYourTurnModalOpen(true);
        } else if (modalFlag === 'tooFar') {
            setIsTooFarModalOpen(true);
        }
    }, []);

    useEffect(() => { // Fetch Services
        const fetchServices = async () => {
            try { const response = await axios.get(`${API_URL}/services`); setServices(response.data || []); }
            catch (error) { console.error('Failed to fetch services:', error); }
        };
        fetchServices();
    }, []);

    useEffect(() => { // OneSignal Setup
        if (window.OneSignal) {
            window.OneSignal.push(function () { window.OneSignal.showSlidedownPrompt(); });
            window.OneSignal.push(function () { window.OneSignal.getUserId(function (userId) { console.log("OneSignal Player ID:", userId); setPlayerId(userId); }); });
        }
    }, []);

    useEffect(() => { // Fetch Available Barbers
        const loadBarbers = async () => {
            try { const response = await axios.get(`${API_URL}/barbers`); setBarbers(response.data || []); }
            catch (error) { console.error('Failed fetch available barbers:', error); setMessage('Could not load barbers.'); setBarbers([]); }
        };
        loadBarbers();
        const intervalId = setInterval(loadBarbers, 15000);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => { // Blinking Tab Listeners
        const handleFocus = () => stopBlinking();
        const handleVisibility = () => { if (document.visibilityState === 'visible') stopBlinking(); };
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => { window.removeEventListener("focus", handleFocus); document.removeEventListener("visibilitychange", handleVisibility); stopBlinking(); };
    }, []);

    useEffect(() => { // Realtime Subscription & Notifications
        if (joinedBarberId) { fetchPublicQueue(joinedBarberId); } else { setLiveQueue([]); setIsQueueLoading(false); }
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); }
        let queueChannel = null; let refreshInterval = null;
        if (joinedBarberId && myQueueEntryId && supabase?.channel) {
            console.log(`Subscribing queue changes: barber ${joinedBarberId}`);
            queueChannel = supabase.channel(`public_queue_${joinedBarberId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${joinedBarberId}` }, (payload) => {
                    console.log("Realtime Update Received:", payload);
                    if (payload.eventType === 'UPDATE' && payload.new.id.toString() === myQueueEntryId) {
                        const newStatus = payload.new.status;
                        console.log(`My status updated to: ${newStatus}`);
                        if (newStatus === 'Up Next') {
                            setModalAlert({ title: "You're up next!", text: "Please take a seat and stay put." });
                            playSound(queueNotificationSound);
                            startBlinking();
                            setIsYourTurnModalOpen(true);
                            localStorage.setItem('stickyModal', 'yourTurn'); // <<< --- ADD THIS
                            if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                        }
                        else if (newStatus === 'In Progress') {
                            setModalAlert({ title: "It's your turn!", text: "The barber is calling you now." });
                            playSound(queueNotificationSound);
                            startBlinking();
                            setIsYourTurnModalOpen(true);
                            localStorage.setItem('stickyModal', 'yourTurn'); // <<< --- ADD THIS
                            if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                        }
                        else if (newStatus === 'Done') { setIsServiceCompleteModalOpen(true); stopBlinking(); }
                        else if (newStatus === 'Cancelled') { setIsCancelledModalOpen(true); stopBlinking(); }
                    }
                    fetchPublicQueue(joinedBarberId);
                })
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') { console.log('Subscribed to Realtime queue!'); setQueueMessage(''); fetchPublicQueue(joinedBarberId); }
                    else { console.error('Supabase Realtime error:', status, err); setQueueMessage('Live updates unavailable.'); }
                });
            refreshInterval = setInterval(() => { console.log("Periodic refresh..."); fetchPublicQueue(joinedBarberId); }, 15000);
        }
        return () => {
            console.log("Cleaning up queue subscription for barber:", joinedBarberId);
            if (queueChannel && supabase?.removeChannel) { supabase.removeChannel(queueChannel).catch(err => console.error("Error removing channel:", err)); }
            if (refreshInterval) { clearInterval(refreshInterval); }
        };
    }, [joinedBarberId, myQueueEntryId, fetchPublicQueue]);

    // --- NEW useEffect: Fetch feedback when barber is selected ---
    useEffect(() => {
        if (selectedBarberId) {
            console.log(`Fetching feedback for barber ${selectedBarberId}`);
            setBarberFeedback([]);
            const fetchFeedback = async () => {
                try {
                    const response = await axios.get(`${API_URL}/feedback/${selectedBarberId}`);
                    setBarberFeedback(response.data || []);
                } catch (err) {
                    console.error("Failed to fetch barber feedback:", err);
                }
            };
            fetchFeedback();
        } else {
            setBarberFeedback([]);
        }
    }, [selectedBarberId]);

    // --- UseEffect for WebSocket Connection and History Fetch ---
    useEffect(() => {
        if (session?.user?.id && joinedBarberId && currentChatTargetBarberUserId && myQueueEntryId) {

            fetchChatHistory(myQueueEntryId);

            if (!socketRef.current) {
                console.log("[Customer] Connecting WebSocket...");
                socketRef.current = io(SOCKET_URL);
                const socket = socketRef.current;
                const customerUserId = session.user.id;

                socket.on('connect', () => {
                    console.log(`[Customer] WebSocket connected.`);
                    socket.emit('register', customerUserId);
                    socket.emit('registerQueueEntry', myQueueEntryId);
                });

                const messageListener = (incomingMessage) => {
                    if (incomingMessage.senderId === currentChatTargetBarberUserId) {
                        playSound(messageNotificationSound);

                        setChatMessagesFromBarber(prev => [...prev, incomingMessage]);
                        setIsChatOpen(currentIsOpen => {
                            if (!currentIsOpen) { setHasUnreadFromBarber(true); }
                            return currentIsOpen;
                        });
                    }
                };
                socket.on('chat message', messageListener);
                socket.on('connect_error', (err) => { console.error("[Customer] WebSocket Connection Error:", err); });
                socket.on('disconnect', (reason) => { console.log("[Customer] WebSocket disconnected:", reason); socketRef.current = null; });
            }
        } else {
            if (socketRef.current) {
                console.log("[Customer] Disconnecting WebSocket due to state change.");
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [session, joinedBarberId, myQueueEntryId, currentChatTargetBarberUserId, fetchChatHistory]);

    useEffect(() => {
        if (selectedBarberId) {
            // A barber is selected, fetch their queue for EWT
            console.log(`[EWT Preview] Fetching queue for barber ${selectedBarberId}`);
            fetchPublicQueue(selectedBarberId);
        } else {
            // No barber selected, clear the live queue
            setLiveQueue([]);
            liveQueueRef.current = [];
        }
    }, [selectedBarberId, fetchPublicQueue]); // <-- Dependencies

    useEffect(() => { // Smart EWT Calculation
        const calculateWaitTime = () => {
            const oldQueue = liveQueueRef.current || [];
            const newQueue = liveQueue;
            const relevantEntries = newQueue.filter(e => e.status === 'Waiting' || e.status === 'Up Next');
            setPeopleWaiting(relevantEntries.length);
            const myIndexNew = newQueue.findIndex(e => e.id.toString() === myQueueEntryId);
            const peopleAheadNew = myIndexNew !== -1 ? newQueue.slice(0, myIndexNew) : newQueue;
            const newTotalWait = peopleAheadNew.reduce((sum, entry) => {
                if (['Waiting', 'Up Next', 'In Progress'].includes(entry.status)) { return sum + (entry.services?.duration_minutes || 30); }
                return sum;
            }, 0);
            setEstimatedWait(newTotalWait);
            setDisplayWait(currentDisplayWait => {
                const leaver = oldQueue.find(oldEntry => !newQueue.some(newEntry => newEntry.id === oldEntry.id));
                const myIndexOld = oldQueue.findIndex(e => e.id.toString() === myQueueEntryId);
                const leaverIndexOld = leaver ? oldQueue.findIndex(e => e.id === leaver.id) : -1;
                if (leaver && myIndexOld !== -1 && leaverIndexOld !== -1 && leaverIndexOld < myIndexOld) {
                    const leaverDuration = leaver.services?.duration_minutes || 30;
                    console.log(`Leaver detected in front: ${leaver.id}, duration: ${leaverDuration}`);
                    const newCountdown = currentDisplayWait - leaverDuration;
                    return newCountdown > 0 ? newCountdown : 0;
                }
                if (currentDisplayWait === 0 || newTotalWait < currentDisplayWait) {
                    return newTotalWait;
                }
                return currentDisplayWait;
            });
        };
        calculateWaitTime();
    }, [liveQueue, myQueueEntryId, estimatedWait]);

    useEffect(() => { // 1-Minute Countdown Timer
        if (!myQueueEntryId) return;
        const timerId = setInterval(() => { setDisplayWait(prevTime => (prevTime > 0 ? prevTime - 1 : 0)); }, 60000);
        return () => clearInterval(timerId);
    }, [myQueueEntryId]);

    useEffect(() => {
        let timerId = null;
        let countdownInterval = null;

        // This now checks if ANY of the 4 modals are open
        if (isYourTurnModalOpen || isServiceCompleteModalOpen || isCancelledModalOpen || isTooFarModalOpen) {

            // 1. Disable the button and reset the countdown
            setIsModalButtonDisabled(true);
            setModalCountdown(10); // <-- Changed to 10

            // 2. Start the 10-second timer to re-enable the button
            timerId = setTimeout(() => {
                setIsModalButtonDisabled(false);
            }, 10000); // <-- Changed to 10000 (10 seconds)

            // 3. Start a 1-second interval to update the countdown text
            countdownInterval = setInterval(() => {
                setModalCountdown(prevCount => {
                    if (prevCount <= 1) {
                        clearInterval(countdownInterval); // Stop the interval
                        return 0;
                    }
                    return prevCount - 1; // Decrement
                });
            }, 1000); // 1 second
        }

        // This is a cleanup function to prevent memory leaks
        return () => {
            if (timerId) clearTimeout(timerId);
            if (countdownInterval) clearInterval(countdownInterval);
        };
    }, [isYourTurnModalOpen, isServiceCompleteModalOpen, isCancelledModalOpen, isTooFarModalOpen]); // <-- All 4 modals are now in the array
    // <<< --- END MODIFIED BLOCK --- >>>

    console.log("RENDERING CustomerView:", { myQueueEntryId, joinedBarberId, liveQueue_length: liveQueue.length, nowServing: nowServing?.id, upNext: upNext?.id, peopleWaiting, estimatedWait, displayWait, isQueueLoading, queueMessage });

    // --- Render Customer View ---
    return (
        <div className="card">
            <div className="modal-overlay" style={{ display: isInstructionsModalOpen ? 'flex' : 'none' }}><div className="modal-content instructions-modal"><h2>How to Join</h2><ol className="instructions-list"><li>Select your <strong>Service</strong>.</li><li>Choose an <strong>Available Barber</strong>.</li><li>Click <strong>"Join Queue"</strong> and wait!</li></ol><button onClick={handleCloseInstructions}>Got It!</button></div></div>
            <div id="your-turn-modal-overlay" className="modal-overlay" style={{ display: isYourTurnModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <h2>{modalAlert.title}</h2>
                    <p>{modalAlert.text}</p>

                    {/* <<< --- THIS BUTTON IS NOW MODIFIED --- >>> */}
                    <button
                        id="close-modal-btn"
                        onClick={handleModalClose}
                        disabled={isModalButtonDisabled}
                    >
                        {isModalButtonDisabled ? `Please wait (${modalCountdown})...` : 'Okay!'}
                    </button>

                </div>
            </div>
            <div className="modal-overlay" style={{ display: isServiceCompleteModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">

                    {!feedbackSubmitted ? (
                        <>
                            <h2>Service Complete!</h2>
                            <p>Thank you! How was your experience with {currentBarberName}?</p>

                            <form className="feedback-form" onSubmit={async (e) => {
                                e.preventDefault();
                                if (!feedbackText.trim()) {
                                    setFeedbackSubmitted(true);
                                    return;
                                }
                                try {
                                    await axios.post(`${API_URL}/feedback`, {
                                        barber_id: joinedBarberId,
                                        customer_name: customerName,
                                        comments: feedbackText
                                    });
                                } catch (err) {
                                    console.error("Failed to submit feedback", err);
                                }
                                setFeedbackSubmitted(true);
                            }}>
                                <textarea
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    placeholder="Leave optional feedback..."
                                />
                                <button type="submit">Submit Feedback</button>
                            </form>
                            <button
                                className="skip-button"
                                onClick={() => setFeedbackSubmitted(true)}
                            >
                                Skip
                            </button>
                        </>
                    ) : (
                        <>
                            <h2>Feedback Sent!</h2>
                            <p>Thank you for visiting!</p>
                            <button
                                id="close-complete-modal-btn"
                                onClick={() => {
                                    handleReturnToJoin(false);
                                }}
                                disabled={isModalButtonDisabled} // <-- Add This
                            >
                                {/* vvv Change This vvv */}
                                {isModalButtonDisabled ? `Please wait (${modalCountdown})...` : 'Okay'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="modal-overlay" style={{ display: isCancelledModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <h2>Appointment Cancelled</h2>
                    <p>Your queue entry was cancelled.</p>
                    <button
                        id="close-cancel-modal-btn"
                        onClick={() => handleReturnToJoin(false)}
                        disabled={isModalButtonDisabled} // <-- Add This
                    >
                        {/* vvv Change This vvv */}
                        {isModalButtonDisabled ? `Please wait (${modalCountdown})...` : 'Okay'}
                    </button>
                </div>
            </div>
            <div className="modal-overlay" style={{ display: isTooFarModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <h2>A Friendly Reminder!</h2>
                    <p>Hey, please don’t wander off too far...</p>
                    <button id="close-too-far-modal-btn" onClick={() => {
                        setIsTooFarModalOpen(false);
                        localStorage.removeItem('stickyModal'); // <<< --- ADD THIS
                        console.log("Cooldown started.");
                        setTimeout(() => { console.log("Cooldown finished."); setIsOnCooldown(false); }, 300000);
                    }}
                    >
                        {/* vvv Change This vvv */}
                        {isModalButtonDisabled ? `Please wait (${modalCountdown})...` : "Okay, I'll stay close"}
                    </button>
                </div>
            </div>

            {!myQueueEntryId ? (
                <>
                    <h2>Join the Queue</h2>
                    <form onSubmit={handleJoinQueue}>
                        <div className="form-group"><label>Your Name:</label><input type="text" value={customerName} required readOnly className="prefilled-input" /></div>
                        <div className="form-group"><label>Your Phone (Optional):</label><input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g., 09171234567" /></div>
                        <div className="form-group"><label>Your Email:</label><input type="email" value={customerEmail} readOnly className="prefilled-input" /></div>
                        <div className="form-group"><label>Select Service:</label><select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} required><option value="">-- Choose service --</option>{services.map((service) => (<option key={service.id} value={service.id}>{service.name} ({service.duration_minutes} min / ₱{service.price_php})</option>))}</select></div>
                        {/* --- NEW VIP TOGGLE --- */}
                        {selectedServiceId && (
                            <div className="form-group vip-toggle-group">
                                <label>Service Priority:</label>
                                <div className="priority-toggle-control">

                                    {/* NO PRIORITY Button */}
                                    <button
                                        type="button"
                                        className={`priority-option ${!isVIPToggled ? 'active' : ''}`}
                                        onClick={() => setIsVIPToggled(false)}
                                    >
                                        No Priority
                                    </button>

                                    {/* VIP PRIORITY Button - Triggers the modal if clicked */}
                                    <button
                                        type="button"
                                        className={`priority-option ${isVIPToggled ? 'active vip' : ''}`}
                                        onClick={() => handleVIPToggle({ target: { checked: true } })} // Simulate check event
                                        disabled={isVIPToggled} // Disable if already toggled on (to prevent multiple modal opens)
                                    >
                                        VIP Priority (+₱149)
                                    </button>

                                </div>
                                {isVIPToggled && (
                                    <p className="success-message small">
                                        VIP Priority is active. You will be placed Up Next.
                                    </p>
                                )}
                            </div>
                        )}
                        {/* --- END NEW VIP TOGGLE --- */}
                        <div className="form-group photo-upload-group">
                            <label>Desired Haircut Photo (Optional):</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
                            <button type="button" onClick={() => handleUploadPhoto(null)} disabled={!selectedFile || isUploading || referenceImageUrl} className="upload-button">
                                {isUploading ? 'Uploading...' : (referenceImageUrl ? 'Photo Attached' : 'Upload Photo')}
                            </button>
                            {referenceImageUrl && <p className="success-message small">Photo ready. <a href={referenceImageUrl} target="_blank" rel="noopener noreferrer">View Photo</a></p>}
                        </div>

                        <div className="form-group"><label>Select Available Barber:</label><select value={selectedBarberId} onChange={(e) => setSelectedBarberId(e.target.value)} required><option value="">-- Choose --</option>{barbers.map((b) => (<option key={b.id} value={b.id}>{b.full_name}</option>))}</select></div>

                        {selectedBarberId && (
                            <div className="feedback-list-container customer-feedback">
                                <h3 className="feedback-subtitle">Recent Feedback</h3>
                                <ul className="feedback-list">
                                    {barberFeedback.length > 0 ? (
                                        barberFeedback.map((item, index) => (
                                            <li key={index} className="feedback-item">
                                                <div className="feedback-header">
                                                    <span className="feedback-score">
                                                        {item.score > 0 ? '😊' : item.score < 0 ? '😠' : '😐'}
                                                    </span>
                                                    <span className="feedback-customer">
                                                        {item.customer_name || 'Customer'}
                                                    </span>
                                                </div>
                                                <p className="feedback-comment">"{item.comments}"</p>
                                            </li>
                                        ))
                                    ) : (
                                        <p className="empty-text">No feedback yet for this barber.</p>
                                    )}
                                </ul>
                            </div>
                        )}

                        {selectedBarberId && (<div className="ewt-container"><div className="ewt-item"><span>Currently waiting</span><strong>{peopleWaiting} {peopleWaiting === 1 ? 'person' : 'people'}</strong></div><div className="ewt-item"><span>Estimated wait</span><strong>~ {displayWait} min</strong></div></div>)}

                        {isIOsDevice() && (
                            <p className="message warning small">
                                <b>iPhone Users:</b> Push alerts and sounds are not supported.
                                Please keep this tab open and watch your email for notifications!
                            </p>
                        )}

                        <button type="submit" disabled={isLoading || !selectedBarberId || barbers.length === 0 || isUploading} className="join-queue-button">{isLoading ? 'Joining...' : 'Join Queue'}</button>
                    </form>
                    {message && <p className={`message ${message.toLowerCase().includes('failed') || message.toLowerCase().includes('error') ? 'error' : ''}`}>{message}</p>}
                </>
            ) : (
                <div className="live-queue-view">
                    <h2>Live Queue for {joinedBarberId ? currentBarberName : '...'}</h2>
                    <div className="queue-number-display">Your Queue Number is: <strong>#{myQueueEntryId}</strong></div>
                    <div className="current-serving-display"><div className="serving-item now-serving"><span>Now Serving</span><strong>{nowServing ? `Customer #${nowServing.id}` : '---'}</strong></div><div className="serving-item up-next"><span>Up Next</span><strong>{upNext ? `Customer #${upNext.id}` : '---'}</strong></div></div>
                    {queueMessage && <p className="message error">{queueMessage}</p>}
                    {isQueueLoading && !queueMessage && <p className="loading-text">Loading queue...</p>}
                    <div className="ewt-container"><div className="ewt-item"><span>Currently waiting</span><strong>{peopleWaiting} {peopleWaiting === 1 ? 'person' : 'people'}</strong></div><div className="ewt-item"><span>Estimated wait</span><strong>~ {displayWait} min</strong></div></div>
                    <ul className="queue-list live">{!isQueueLoading && liveQueue.length === 0 && !queueMessage ? (<li className="empty-text">Queue is empty.</li>) : (liveQueue.map((entry, index) => (<li key={entry.id} className={`${entry.id.toString() === myQueueEntryId ? 'my-position' : ''} ${entry.status === 'Up Next' ? 'up-next-public' : ''} ${entry.status === 'In Progress' ? 'in-progress-public' : ''}`}><span>{index + 1}. {entry.id.toString() === myQueueEntryId ? `You (${entry.customer_name})` : `Customer #${entry.id}`}</span><span className="queue-status">{entry.status}</span></li>)))}</ul>

                    {isQueueUpdateAllowed && (
                        <div className="form-group photo-upload-group live-update-group">
                            <label>Update Haircut Photo:</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
                            <button type="button" onClick={() => handleUploadPhoto(myQueueEntryId)} disabled={!selectedFile || isUploading} className="upload-button">
                                {isUploading ? 'Uploading...' : 'Replace Photo'}
                            </button>
                            {myQueueEntry?.reference_image_url && <p className="success-message small">Current Photo: <a href={myQueueEntry.reference_image_url} target="_blank" rel="noopener noreferrer">View</a></p>}
                            {referenceImageUrl && referenceImageUrl !== myQueueEntry?.reference_image_url && <p className="success-message small">New photo uploaded. Refresh queue to confirm.</p>}
                        </div>
                    )}

                    {!isChatOpen && myQueueEntryId && (
                        <button onClick={() => {
                            if (currentChatTargetBarberUserId) {

                                setIsChatOpen(true);
                                setHasUnreadFromBarber(false);
                            } else { console.error("Barber user ID missing."); setMessage("Cannot initiate chat."); }
                        }}
                            className="chat-toggle-button"
                        >
                            Chat with Barber
                            {hasUnreadFromBarber && (<span className="notification-badge">1</span>)}
                        </button>
                    )}
                    {isChatOpen && (<button onClick={() => setIsChatOpen(false)} className="chat-toggle-button close">Close Chat</button>)}

                    {isChatOpen && currentChatTargetBarberUserId && (
                        <ChatWindow
                            currentUser_id={session.user.id}
                            otherUser_id={currentChatTargetBarberUserId}
                            messages={chatMessagesFromBarber}
                            onSendMessage={sendCustomerMessage}
                            isVisible={isChatOpen}
                        />
                    )}
                    <button onClick={() => handleReturnToJoin(true)} disabled={isLoading} className='leave-queue-button'>{isLoading ? 'Leaving...' : 'Leave Queue / Join Another'}</button>
                </div>
            )}

            <div className="modal-overlay" style={{ display: isVIPModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <h2>Priority Service Confirmation</h2>
                    {selectedServiceId && services.find(s => s.id.toString() === selectedServiceId) ? (
                        <p>You have selected **{services.find(s => s.id.toString() === selectedServiceId).name}**. This VIP priority service incurs an **additional ₱149** fee, guaranteeing you the next "Up Next" slot.</p>
                    ) : (
                        <p>VIP priority service incurs an **additional ₱100** fee, guaranteeing you the next "Up Next" slot. Please ensure you have selected a service.</p>
                    )}

                    <div className="modal-actions">
                        <button
                            onClick={confirmVIP}
                            disabled={!selectedServiceId}
                            className="join-queue-button"
                        >
                            Confirm (+₱149)
                        </button>
                        <button
                            onClick={cancelVIP}
                            className="cancel-button"
                        >
                            Cancel VIP
                        </button>
                    </div>
                    {!selectedServiceId && <p className="error-message small">Please select a service first.</p>}
                </div>
            </div>
        </div>

    );
}

// ##############################################
// ##           BARBER APP LAYOUT            ##
// ##############################################
function BarberAppLayout({ session, barberProfile, setBarberProfile }) {
    const [refreshAnalyticsSignal, setRefreshAnalyticsSignal] = useState(0);

    const handleCutComplete = useCallback(() => {
        setRefreshAnalyticsSignal(prev => prev + 1);
    }, []);

    return (
        <div className="barber-app-layout">
            <header className="App-header">
                <h1>Welcome, {barberProfile.full_name}!</h1>
                <div className="header-actions">
                    <AvailabilityToggle
                        barberProfile={barberProfile}
                        session={session}
                        onAvailabilityChange={(newStatus) => setBarberProfile(prev => ({ ...prev, is_available: newStatus }))}
                    />
                    <button
                        onClick={() => handleLogout(session.user.id)}
                        className="logout-button"
                    >
                        Logout
                    </button>
                </div>
            </header>
            <div className="container">
                <BarberDashboard
                    barberId={barberProfile.id}
                    barberName={barberProfile.full_name}
                    onCutComplete={handleCutComplete}
                    session={session}
                />
                <AnalyticsDashboard
                    barberId={barberProfile.id}
                    refreshSignal={refreshAnalyticsSignal}
                />
            </div>
        </div>
    );
}

// ##############################################
// ##         CUSTOMER APP LAYOUT            ##
// ##############################################
function CustomerAppLayout({ session }) {
    return (
        <div className="customer-app-layout">
            <header className="App-header">
                <h1>Welcome, {session.user?.user_metadata?.full_name || 'Customer'}!</h1>
                <button onClick={() => handleLogout(session.user.id)} className="logout-button">Logout</button>
            </header>
            <div className="container">
                <CustomerView session={session} />
            </div>
        </div>
    );
}

// ##############################################
// ##           MAIN APP COMPONENT           ##
// ##############################################
function App() {
    const [session, setSession] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [barberProfile, setBarberProfile] = useState(null);
    const [loadingRole, setLoadingRole] = useState(true);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false); // <<< --- 1. ADD NEW STATE

    // --- OneSignal Setup ---
    useEffect(() => {
        if (!window.OneSignal) {
            window.OneSignal = window.OneSignal || [];
            window.OneSignal.push(function () {
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

    // --- Helper to Check Role (FIXED TO PREVENT RACE CONDITION) ---
    const checkUserRole = useCallback(async (user) => {
        if (!user || !user.id) {
            console.warn("checkUserRole called with incomplete user, defaulting to customer.");
            setUserRole('customer');
            setBarberProfile(null);
            setLoadingRole(false);
            return;
        }

        console.log(`Checking role for user: ${user.id}`);
        setLoadingRole(true);
        try {
            const response = await axios.get(`${API_URL}/barber/profile/${user.id}`);
            // If this succeeds, they are a barber
            console.log("Role check successful: This is a BARBER.");
            setUserRole('barber');
            setBarberProfile(response.data);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // 404 is a clean "Not Found," meaning they are a customer
                console.log("Role check: Not a barber (404), setting role to CUSTOMER.");
                setUserRole('customer');
            } else {
                // Any other error (500, etc.)
                console.error("Error checking/fetching barber profile:", error);
                setUserRole('customer'); // Default to customer on other errors
            }
            setBarberProfile(null);
        } finally {
            setLoadingRole(false);
        }
    }, []);

    // --- Auth State Change Listener (FIXED TO PREVENT RACE CONDITION) ---
    useEffect(() => {
        if (!supabase?.auth) {
            console.error("Supabase auth not initialized.");
            setLoadingRole(false);
            return;
        }

        // This ONE listener handles everything: page load, login, and logout.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            console.log("Auth State Change Detected:", _event, currentSession);

            // <<< --- 2. ADD THIS LOGIC --- >>>
            if (_event === 'PASSWORD_RECOVERY') {
                console.log("Password recovery event detected!");
                setIsUpdatingPassword(true); // Show the update password form
            }
            // <<< --- END NEW LOGIC --- >>>

            setSession(currentSession);

            if (currentSession?.user) {
                // We have a user. Check their role.
                console.log("Valid user session found, checking role...");
                checkUserRole(currentSession.user);
            } else {
                // We have no user. They are logged out.
                console.log("No user session. Setting role to customer.");
                setUserRole('customer');
                setBarberProfile(null);
                setLoadingRole(false);
                // <<< --- 3. ADD THIS LINE --- >>>
                setIsUpdatingPassword(false); // Hide update form if user logs out
            }

        });

        return () => subscription?.unsubscribe();
    }, [checkUserRole]);

    // --- Render Logic ---
    if (loadingRole) { return <div className="loading-fullscreen">Loading Application...</div>; }

    // <<< --- 4. ADD THIS RENDER BLOCK --- >>>
    if (isUpdatingPassword) {
        return (
            <UpdatePasswordForm
                onPasswordUpdated={() => setIsUpdatingPassword(false)}
            />
        );
    }
    // <<< --- END NEW RENDER BLOCK --- >>>

    if (!session) { return <AuthForm />; }
    else if (userRole === null) { return <div className="loading-fullscreen">Verifying User Role...</div>; }
    else if (userRole === 'barber' && barberProfile) { return <BarberAppLayout session={session} barberProfile={barberProfile} setBarberProfile={setBarberProfile} />; }
    else { return <CustomerAppLayout session={session} />; }
}

export default App;
