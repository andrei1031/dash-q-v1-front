import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
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
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
const API_URL = 'https://dash-q-backend.onrender.com/api' || 'http://localhost:3000';

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
// --- iOS Install Modal Component ---
// Apple requires users to "Add to Home Screen" to receive notifications.
function IOSInstallPrompt({ onClose }) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    // Only show if on iOS AND NOT yet installed (in browser mode)
    if (!isIOS || isStandalone) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-body">
                    <h2 style={{color: 'var(--primary-orange)'}}>📲 Enable Notifications</h2>
                    <p>To get notified when it's your turn, you <strong>must</strong> add this app to your Home Screen.</p>
                    <ol style={{textAlign:'left', margin:'20px 0', lineHeight:'1.8'}}>
                        <li>Tap the <strong>Share</strong> button <span style={{fontSize:'1.2rem'}}>⎋</span> below.</li>
                        <li>Scroll down and select <strong>"Add to Home Screen"</strong> <span style={{fontSize:'1.2rem'}}>⊞</span>.</li>
                    </ol>
                </div>
                <div className="modal-footer single-action">
                    <button onClick={onClose} className="btn btn-secondary">I'll do it later</button>
                </div>
            </div>
        </div>
    );
}

// ##############################################
// ##              SVG ICONS                   ##
// ##############################################
// Reusable Icon components to replace emojis

const IconWrapper = ({ children }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="icon"
    >
        {children}
    </svg>
);

const IconSun = () => <IconWrapper><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></IconWrapper>;
const IconMoon = () => <IconWrapper><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></IconWrapper>;
const IconChat = () => <IconWrapper><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></IconWrapper>;
const IconCamera = () => <IconWrapper><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></IconWrapper>;
const IconEye = () => <IconWrapper><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></IconWrapper>;
const IconEyeOff = () => <IconWrapper><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></IconWrapper>;
const IconSend = () => <IconWrapper><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></IconWrapper>;
const IconLogout = () => <IconWrapper><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></IconWrapper>;
const IconRefresh = () => <IconWrapper><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></IconWrapper>;
const IconCheck = () => <IconWrapper><polyline points="20 6 9 17 4 12"></polyline></IconWrapper>;
const IconX = () => <IconWrapper><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></IconWrapper>;
const IconNext = () => <IconWrapper><polyline points="9 18 15 12 9 6"></polyline></IconWrapper>;
const IconUpload = () => <IconWrapper><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></IconWrapper>;

const DistanceBadge = ({ meters }) => {
    if (meters === null || meters === undefined) return null;
    
    let colorClass = 'dist-green';
    let text = `${meters}m`;

    if (meters > 1000) {
        colorClass = 'dist-red';
        text = `${(meters / 1000).toFixed(1)}km`;
    } else if (meters > 200) {
        colorClass = 'dist-orange';
    }

    return (
        <span className={`distance-badge ${colorClass}`}>
            📍 {text} away
        </span>
    );
};


// ##############################################
// ##          THEME CONTEXT & PROVIDER        ##
// ##############################################

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });

    useEffect(() => {
        if (theme === 'light') {
            document.documentElement.classList.add('light-mode');
            document.body.classList.remove('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
            document.body.classList.remove('light-mode');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);

const ThemeToggleButton = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button 
            onClick={toggleTheme} 
            className="btn btn-icon" 
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
        </button>
    );
};


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
const NEXT_UP_TITLE = "!! YOU'RE UP NEXT !!"; 
const TURN_TITLE = "!! IT'S YOUR TURN !!";

function startBlinking(newTitle) { // <-- NOW ACCEPTS A TITLE
    if (blinkInterval) return;
    originalTitle = document.title;
    let isOriginalTitle = true;
    blinkInterval = setInterval(() => {
        document.title = isOriginalTitle ? newTitle : originalTitle; // <-- Uses newTitle
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
// ##           MODERN UI COMPONENTS           ##
// ##############################################

const Spinner = () => <div className="spinner"></div>;

function SkeletonLoader({ height, width, className = '' }) {
    const style = {
        height: height || '1em',
        width: width || '100%',
    };
    return (
        <div className={`skeleton-loader ${className}`} style={style}>
            <span style={{ visibility: 'hidden' }}>Loading...</span>
        </div>
    );
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
                    <div key={index} className={`message-bubble ${msg.senderId === currentUser_id ? 'my-message' : 'other-message'}`}>
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
                <button type="submit" disabled={!onSendMessage || !newMessage.trim()} className="btn btn-icon btn-send">
                    <IconSend />
                </button>
            </form>
        </div>
    );
}

function ReportModal({ isOpen, onClose, reporterId, reportedId, userRole, onSubmit }) {
    const [reason, setReason] = useState('Rude Behavior');
    const [description, setDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        let proofImageUrl = null;

        try {
            // 1. Upload Proof if selected
            if (selectedFile) {
                setIsUploading(true);
                const fileExt = selectedFile.name.split('.').pop();
                const filePath = `proofs/${reporterId}-${Date.now()}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('report_proofs') // Make sure this bucket exists!
                    .upload(filePath, selectedFile);
                
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('report_proofs').getPublicUrl(filePath);
                proofImageUrl = data.publicUrl;
                setIsUploading(false);
            }

            // 2. Submit Report
            await axios.post(`${API_URL}/reports`, {
                reporterId,
                reportedId,
                role: userRole,
                reason,
                description,
                proofImageUrl
            });

            alert("Report submitted successfully.");
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to submit report. " + (err.message || ''));
        } finally {
            setLoading(false);
            setIsUploading(false);
            setSelectedFile(null);
            setDescription('');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-body">
                    <h2 style={{color: 'var(--error-color)'}}>⚠️ Report User</h2>
                    <p>Submit a report to the Admin.</p>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Reason:</label>
                            <select value={reason} onChange={e => setReason(e.target.value)}>
                                <option>Rude Behavior</option>
                                <option>No-Show / Late</option>
                                <option>Inappropriate Language</option>
                                <option>Scam / Spam</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Details:</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} required placeholder="Describe what happened..." />
                        </div>
                        
                        {/* --- NEW: Screenshot Upload --- */}
                        <div className="form-group photo-upload-group">
                            <label>Attach Screenshot (Optional):</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} id="report-proof-upload" className="file-upload-input" />
                            <label htmlFor="report-proof-upload" className="btn btn-secondary btn-icon-label file-upload-label">
                                <IconCamera /> {selectedFile ? selectedFile.name : 'Choose Image...'}
                            </label>
                        </div>
                        {/* ----------------------------- */}

                        <div className="modal-footer">
                            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                            <button type="submit" disabled={loading || isUploading} className="btn btn-danger">
                                {loading || isUploading ? <Spinner /> : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// ##############################################
// ##         MY REPORTS MODAL (SHARED)        ##
// ##############################################
function MyReportsModal({ isOpen, onClose, userId }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            axios.get(`${API_URL}/reports/my/${userId}`)
                .then(res => setReports(res.data))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, userId]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header" style={{padding: '20px 25px 0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <h2 style={{margin:0, color: 'var(--primary-orange)'}}>My Reports</h2>
                    <button onClick={onClose} className="btn btn-icon"><IconX /></button>
                </div>
                <div className="modal-body" style={{textAlign:'left', maxHeight: '60vh', overflowY: 'auto'}}>
                    {loading ? <Spinner /> : reports.length === 0 ? (
                        <p className="empty-text">You haven't submitted any reports.</p>
                    ) : (
                        <ul className="queue-list">
                            {reports.map(r => (
                                <li key={r.id} style={{display:'block', marginBottom:'10px', padding:'15px'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                                        <strong>{r.reason}</strong>
                                        <span className="status-badge" style={{
                                            backgroundColor: r.status === 'Pending' ? 'rgba(255, 149, 0, 0.2)' : 
                                                           r.status === 'Resolved' ? 'rgba(52, 199, 89, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                                            color: r.status === 'Pending' ? 'var(--primary-orange)' : 
                                                   r.status === 'Resolved' ? 'var(--success-color)' : 'var(--text-secondary)'
                                        }}>
                                            {r.status}
                                        </span>
                                    </div>
                                    <p style={{fontSize:'0.85rem', color:'var(--text-secondary)', margin:'0 0 5px'}}>
                                        Reported: <strong>{r.reported?.full_name || 'Unknown User'}</strong>
                                    </p>
                                    <p style={{fontSize:'0.9rem', marginBottom:'10px'}}>"{r.description}"</p>
                                    
                                    {r.admin_notes && (
                                        <div style={{background:'var(--bg-dark)', padding:'10px', borderRadius:'6px', borderLeft:'3px solid var(--link-color)'}}>
                                            <strong style={{fontSize:'0.8rem', color:'var(--link-color)'}}>Admin Response:</strong>
                                            <p style={{margin:'5px 0 0', fontSize:'0.9rem'}}>{r.admin_notes}</p>
                                        </div>
                                    )}
                                    <div style={{textAlign:'right', marginTop:'10px', fontSize:'0.75rem', color:'var(--text-secondary)'}}>
                                        {new Date(r.created_at).toLocaleDateString()}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="modal-footer single-action">
                    <button onClick={onClose} className="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    );
}


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

    const [authView, setAuthView] = useState('login'); // 'login', 'signup', or 'forgotPassword'

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedRole, setSelectedRole] = useState('customer');
    const [showPassword, setShowPassword] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true); setMessage('');
        try {
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
                setAuthView('login');
                setUsername(''); setEmail(''); setPassword(''); setFullName(''); setBarberCode(''); setPin(''); setSelectedRole('customer');
            }
        } catch (error) { console.error('Auth error:', error); setMessage(`Authentication failed: ${error.response?.data?.error || error.message || 'Unexpected error.'}`); }
        finally { setLoading(false); }
    };

    // App.js (Inside function AuthForm, around line 430)

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (!email) throw new Error("Email is required.");
            const trimmedEmail = email.trim();

            console.log(`Checking if email ${trimmedEmail} exists...`);
            
            // 1. SECURELY CHECK IF EMAIL EXISTS
            const checkResponse = await axios.post(`${API_URL}/check-email`, { email: trimmedEmail });
            
            // 2. LOGIC SPLIT: If email is NOT found, throw a clean, display-ready error.
            if (!checkResponse.data.found) {
                console.log("Email not found, throwing specific display error.");
                // Throw an error that we can catch below
                throw new Error(`The email address "${trimmedEmail}" is not registered.`); 
            }

            // 3. If found, proceed with the actual password reset link generation via Supabase.
            console.log("Email found. Sending reset link via Supabase...");
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
                redirectTo: window.location.origin,
            });
            
            if (resetError) {
                if (resetError.message.includes('rate limit')) {
                    throw new Error('Email rate limit exceeded. Please wait a moment.');
                }
                throw resetError; 
            }

            // 4. Show SUCCESS message 
            // NOTE: The word 'sent' here triggers the success class in the JSX below.
            setMessage('Success! Check your email. The password reset link has been sent.');
            
            setTimeout(() => {
                setAuthView('login');
                setEmail('');
                setMessage('');
            }, 3000);

        } catch (error) {
            console.error('Forgot password exception:', error);
            
            // NEW LOGIC: Extract and display a clean message.
            let clientMessage = '';
            
            if (error.message.includes('not registered')) {
                 // Custom user error: Display the clean message only
                 clientMessage = `Error: ${error.message}`;
            } else {
                 // Generic failure: Prefix with Authentication failed
                 clientMessage = `Authentication failed: ${error.message}`;
            }

            setMessage(clientMessage);
            
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card auth-card">
            {/* --- Welcome Modal (Only shows on Sign Up) --- */}
            <div
                className="modal-overlay"
                style={{ display: (isWelcomeModalOpen && authView === 'signup') ? 'flex' : 'none' }}
            >
                <div className="modal-content">
                    <div className="modal-body">
                        <h2>Welcome to Dash-Q!</h2>
                        <p>This application was proudly developed by:<br />
                            <strong>Aquino, Zaldy Castro Jr.</strong><br />
                            <strong>Galima, Denmark Perpose</strong><br />
                            <strong>Saldivar, Reuben Andrei Santos</strong>
                            <br /><br />from<br /><br />
                            <strong>University of the Cordilleras</strong>
                        </p>
                    </div>
                    <div className="modal-footer">
                        <button 
                            id="close-welcome-modal-btn" 
                            onClick={() => setIsWelcomeModalOpen(false)}
                            className="btn btn-primary"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </div>

            {authView === 'forgotPassword' ? (
                <>
                    <div className="card-header">
                        <h2>Reset Password</h2>
                        <ThemeToggleButton />
                    </div>
                    <form onSubmit={handleForgotPassword} className="card-body">
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
                        <button type="submit" disabled={loading} className="btn btn-primary btn-full-width">
                            {loading ? <Spinner /> : 'Send Reset Link'}
                        </button>
                    </form>
                    <div className="card-footer">
                        <button type="button" onClick={() => { setAuthView('login'); setMessage(''); }} className="btn btn-link">
                            Back to Login
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="card-header">
                        <h2>{authView === 'login' ? 'Login' : 'Sign Up'}</h2>
                        <ThemeToggleButton />
                    </div>
                    <form onSubmit={handleAuth} className="card-body">
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
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <IconEyeOff /> : <IconEye />}
                            </button>
                        </div>

                        {authView === 'login' && (
                            <>
                                <div className="form-group">
                                    <label>Login As:</label>
                                    <div className="role-toggle">
                                        <button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button>
                                        <button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button>
                                    </div>
                                </div>
                                
                                {selectedRole === 'barber' && (
                                    <div className="form-group pin-input">
                                        <label>Barber PIN:</label>
                                        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} required={selectedRole === 'barber'} autoComplete="off" />
                                    </div>
                                )}

                                <div className="forgot-password-link">
                                    <button type="button" onClick={() => { setAuthView('forgotPassword'); setMessage(''); setEmail(''); }}>
                                        Forgot Password?
                                    </button>
                                </div>
                            </>
                        )}

                        {authView === 'signup' && (
                            <>
                                <div className="form-group">
                                    <label>Sign Up As:</label>
                                    <div className="role-toggle">
                                        <button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button>
                                        <button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button>
                                    </div>
                                </div>
                                <div className="form-group"><label>Email:</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /><small>Needed for account functions.</small></div>
                                <div className="form-group"><label>Full Name:</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" /></div>
                                {selectedRole === 'barber' && (<div className="form-group"><label>Barber Code:</label><input type="text" value={barberCode} placeholder="Secret code" onChange={(e) => setBarberCode(e.target.value)} required={selectedRole === 'barber'} /><small>Required.</small></div>)}
                            </>
                        )}
                        
                        <button type="submit" disabled={loading} className="btn btn-primary btn-full-width">
                            {loading ? <Spinner /> : (authView === 'login' ? 'Login' : 'Sign Up')}
                        </button>
                    </form>
                    <div className="card-footer">
                        {/* FIX: improved message coloring logic */}
                        {message && (
                            <p className={`message ${/failed|error|taken|registered|required|invalid/i.test(message) ? 'error' : 'success'}`}>
                                {message}
                            </p>
                        )}
                        
                        <button type="button" onClick={() => { setAuthView(authView === 'login' ? 'signup' : 'login'); setMessage(''); setSelectedRole('customer'); setPin(''); setBarberCode(''); }} className="btn btn-link">
                            {authView === 'login' ? 'Need account? Sign Up' : 'Have account? Login'}
                        </button>
                    </div>
                </>
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
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;

            setMessage('Password updated successfully! You can now log in.');
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
            <div className="card-header">
                <h2>Set Your New Password</h2>
                <ThemeToggleButton />
            </div>
            <form onSubmit={handlePasswordReset} className="card-body">
                <p>You have been verified. Please enter a new password.</p>
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
                <button type="submit" disabled={loading} className="btn btn-primary btn-full-width">
                    {loading ? <Spinner /> : 'Set New Password'}
                </button>
            </form>
            <div className="card-footer">
                {message && (
                    <p className={`message ${/error|failed|must be/i.test(message) ? 'error' : 'success'}`}>
                        {message}
                    </p>
                )}
            </div>
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
    return (
        <div className="availability-toggle">
            <p>Status: 
                <span className={`status-dot ${isAvailable ? 'online' : 'offline'}`}></span>
                <strong>{isAvailable ? 'Available' : 'Offline'}</strong>
            </p>
            <button 
                onClick={handleToggle} 
                disabled={loading} 
                className={`btn ${isAvailable ? 'btn-danger' : 'btn-success'}`}
            >
                {loading ? <Spinner /> : (isAvailable ? 'Go Offline' : 'Go Online')}
            </button>
            {error && <p className="error-message small">{error}</p>}
        </div>
    );
}

// --- AnalyticsDashboard (Displays Barber Stats) ---
function AnalyticsDashboard({ barberId, refreshSignal }) {
    const [analytics, setAnalytics] = useState({ totalEarningsToday: 0, totalCutsToday: 0, totalEarningsWeek: 0, totalCutsWeek: 0, dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, currentQueueSize: 0, totalCutsAllTime: 0, carbonSavedTotal: 0 });
    const [error, setError] = useState('');
    const [showEarnings, setShowEarnings] = useState(true);
    const [feedback, setFeedback] = useState([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { theme } = useTheme();

    const fetchAnalytics = useCallback(async (isRefreshClick = false) => {
        if (!barberId) return;
        setError('');

        if (isRefreshClick) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

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
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [barberId]);

    useEffect(() => {
        fetchAnalytics(false); // Initial load
    }, [refreshSignal, barberId, fetchAnalytics]);

    const avgPriceToday = (analytics.totalCutsToday ?? 0) > 0 ? ((analytics.totalEarningsToday ?? 0) / analytics.totalCutsToday).toFixed(2) : '0.00';
    const avgPriceWeek = (analytics.totalCutsWeek ?? 0) > 0 ? ((analytics.totalEarningsWeek ?? 0) / analytics.totalCutsWeek).toFixed(2) : '0.00';
    
    const chartTextColor = theme === 'light' ? '#18181B' : '#FFFFFF';
    const chartGridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

    const chartOptions = { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { 
            legend: { position: 'top', labels: { color: chartTextColor } }, 
            title: { display: true, text: 'Earnings per Day (Last 7 Days)', color: chartTextColor } 
        }, 
        scales: { 
            y: { 
                beginAtZero: true,
                ticks: { color: chartTextColor },
                grid: { color: chartGridColor }
            },
            x: {
                ticks: { color: chartTextColor },
                grid: { color: chartGridColor }
            }
        } 
    };
    
    const dailyDataSafe = Array.isArray(analytics.dailyData) ? analytics.dailyData : [];
    const chartData = { labels: dailyDataSafe.map(d => { try { return new Date(d.day + 'T00:00:00Z').toLocaleString(undefined, { month: 'numeric', day: 'numeric' }); } catch (e) { return '?'; } }), datasets: [{ label: 'Daily Earnings (₱)', data: dailyDataSafe.map(d => d.daily_earnings ?? 0), backgroundColor: 'rgba(52, 199, 89, 0.6)', borderColor: 'rgba(52, 199, 89, 1)', borderWidth: 1 }] };
    const carbonSavedTotal = analytics.carbonSavedTotal || 0;
    const carbonSavedToday = analytics.carbonSavedToday || 0;

    // Logic: If today is 5, it means SOMEONE (maybe you, maybe another barber) did a cut.
    const carbonStatusMessage = carbonSavedToday > 0 
        ? "✅ Daily Goal Reached!" 
        : "⏳ Waiting for first cut...";

    const renderSkeletons = () => (
        <>
            <div className="analytics-grid">
                <SkeletonLoader height="75px" />
                <SkeletonLoader height="75px" />
                <SkeletonLoader height="75px" />
                <SkeletonLoader height="75px" />
            </div>
            <h3 className="analytics-subtitle">Last 7 Days</h3>
            <div className="analytics-grid">
                <SkeletonLoader height="75px" />
                <SkeletonLoader height="75px" />
                <SkeletonLoader height="75px" />
                <SkeletonLoader height="75px" />
            </div>
        </>
    );

    return (
    <div className="card">
        <div className="card-header">
            <h2>Dashboard</h2>
            <button 
                onClick={() => setShowEarnings(!showEarnings)} 
                className="btn btn-secondary btn-icon-label"
            >
                {showEarnings ? <IconEyeOff /> : <IconEye />}
                {showEarnings ? 'Hide' : 'Show'}
            </button>
        </div>
        
        <div className="card-body">
            {error && <p className="error-message">{error}</p>}
            <h3 className="analytics-subtitle">Today</h3>
            
            {isLoading ? renderSkeletons() : (
                <>
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
                </>
            )}
            
            <div className="carbon-footprint-section">
                <h3 className="analytics-subtitle">🌱 Shop Carbon Savings</h3>
                <div className="analytics-grid carbon-grid">
                    <div className="analytics-item">
                        <span className="analytics-label">Today's Impact</span>
                        <span className="analytics-value carbon">
                            +{carbonSavedToday}g
                        </span>
                        <small style={{color: 'var(--text-secondary)', fontSize: '0.8rem'}}>
                            {carbonStatusMessage}
                        </small>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">All-Time Reduced</span>
                        <span className="analytics-value carbon">
                            {carbonSavedTotal}g
                        </span>
                        <small style={{color: 'var(--text-secondary)', fontSize: '0.8rem'}}>
                            Dynamic Shop Total
                        </small>
                    </div>
                </div>
            </div>
            {showEarnings && (
                <div className="chart-container">
                    {dailyDataSafe.length > 0 ? (<div style={{ height: '250px' }}><Bar options={chartOptions} data={chartData} /></div>) : (<p className='empty-text'>No chart data yet.</p>)}
                </div>
            )}
            
            <div className="feedback-list-container">
                <h3 className="analytics-subtitle">Recent Feedback</h3>
                <ul className="feedback-list">
                    {feedback.length > 0 ? (
                        feedback.map((item, index) => (
                            <li key={index} className="feedback-item">
                                <div className="feedback-header">
                                    {/* FIX: Sanitize score to be between 0 and 5 and apply style */}
                                    <span className="feedback-score" style={{fontSize: '1.2rem', lineHeight: '1'}}>
                                        <span style={{color: '#FFD700'}}>
                                            {'★'.repeat(Math.round(Math.max(0, Math.min(5, item.score || 0))))} 
                                        </span>
                                        <span style={{color: 'var(--text-secondary)'}}>
                                            {'☆'.repeat(5 - Math.round(Math.max(0, Math.min(5, item.score || 0))))} 
                                        </span>
                                    </span>
                                    {/* END FIX */}
                                    <span className="feedback-customer">
                                        {item.customer_name || 'Customer'}
                                    </span>
                                </div>
                                {/* FIX: Ensure it handles null/empty comments */}
                                {item.comments && item.comments.trim().length > 0 && 
                                    <p className="feedback-comment">"{item.comments}"</p>
                                }
                            </li>
                        ))
                    ) : (
                        <p className="empty-text">No feedback yet.</p>
                    )}
                </ul>
            </div>
        </div>
        
        <div className="card-footer">
            <button onClick={() => fetchAnalytics(true)} className="btn btn-secondary btn-full-width btn-icon-label" disabled={isRefreshing}>
                {isRefreshing ? <Spinner /> : <IconRefresh />}
                {isRefreshing ? 'Refreshing...' : 'Refresh Stats'}
            </button>
        </div>
    </div>);
}

// --- BarberDashboard (Handles Barber's Queue Management) ---
function BarberDashboard({ barberId, barberName, onCutComplete, session }) {
    const [queueDetails, setQueueDetails] = useState({ waiting: [], inProgress: null, upNext: null });
    const [error, setError] = useState('');
    const [fetchError, setFetchError] = useState('');
    const [chatMessages, setChatMessages] = useState({});
    const [openChatCustomerId, setOpenChatCustomerId] = useState(null);
    const [openChatQueueId, setOpenChatQueueId] = useState(null);
    const [unreadMessages, setUnreadMessages] = useState(() => {
        const saved = localStorage.getItem('barberUnreadMessages');
        return saved ? JSON.parse(saved) : {};
    });

    const [modalState, setModalState] = useState({ type: null, data: null });
    const [viewImageModalUrl, setViewImageModalUrl] = useState(null);
    const [tipInput, setTipInput] = useState('');
    const [modalError, setModalError] = useState('');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportTargetId, setReportTargetId] = useState(null);

    const handleLoyaltyCheck = async (customer) => {
        if (!customer.customer_email) {
            setModalState({ 
                type: 'alert', 
                data: { title: 'Loyalty Check Failed', message: `Customer ${customer.customer_name} joined as a guest (no email recorded).` } 
            });
            return;
        }

        setModalState({ type: 'loyaltyLoading', data: { name: customer.customer_name } });

        try {
            const response = await axios.get(`${API_URL}/barber/customer-loyalty/${customer.customer_email}`);

            setModalState({ 
                type: 'loyaltyResult', 
                data: { 
                    name: customer.customer_name,
                    email: customer.customer_email,
                    count: response.data.count,
                    history: response.data.history
                } 
            });

        } catch (err) {
            console.error('Failed loyalty check:', err);
            setModalState({ 
                type: 'alert', 
                data: { title: 'Loyalty Check Error', message: err.response?.data?.error || 'Failed to retrieve history from server.' } 
            });
        }
    };

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

    // --- REPLACED SOCKET.IO WITH SUPABASE REALTIME ---
    useEffect(() => {
        if (!openChatQueueId) return;

        console.log(`[Barber] Subscribing to chat for Queue #${openChatQueueId}`);
        
        const chatChannel = supabase.channel(`barber_chat_${openChatQueueId}`)
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'chat_messages', 
                    filter: `queue_entry_id=eq.${openChatQueueId}` 
                }, 
                (payload) => {
                    const newMsg = payload.new;
                    
                    // --- THE FIX IS HERE ---
                    // Only update state if the message is NOT from me (the Barber).
                    // This prevents the "Double Bubble" because sendBarberMessage already added it.
                    if (newMsg.sender_id !== session.user.id) {
                        setChatMessages(prev => {
                            const customerId = openChatCustomerId; 
                            const msgs = prev[customerId] || [];
                            return { ...prev, [customerId]: [...msgs, { senderId: newMsg.sender_id, message: newMsg.message }] };
                        });

                        playSound(messageNotificationSound);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
        };
    }, [openChatQueueId, openChatCustomerId, session]);

    // --- UPDATE SEND FUNCTION ---
    const sendBarberMessage = async (recipientId, messageText) => {
        if (!messageText.trim() || !openChatQueueId) return;

        // Optimistic UI Update
        setChatMessages(prev => {
            const msgs = prev[recipientId] || [];
            return { ...prev, [recipientId]: [...msgs, { senderId: session.user.id, message: messageText }] };
        });

        try {
            await axios.post(`${API_URL}/chat/send`, {
                senderId: session.user.id,
                queueId: openChatQueueId,
                message: messageText
            });
        } catch (error) {
            console.error("Failed to send:", error);
            // Handle error (toast notification?)
        }
    };
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
                if (status === 'SUBSCRIBED') {
                    console.log(`Barber dashboard subscribed to queue ${barberId}`);
                } else if (status === 'CLOSED') {
                    // This is normal cleanup, just log it as info
                    console.log(`Barber dashboard subscription disconnected cleanly.`);
                } else {
                    // Only log actual errors (like CHANNEL_ERROR or TIMED_OUT)
                    console.error(`Barber dashboard subscription error: ${status}`, err);
                }
            });

        // --- START OF FIX ---
        dashboardRefreshInterval = setInterval(() => { 
            console.log('Dashboard periodic refresh...'); 
            fetchQueueDetails(); 

            // --- ADD THIS FALLBACK ---
            console.log('Periodic re-sync of unread messages...');
            const saved = localStorage.getItem('barberUnreadMessages');
            const unread = saved ? JSON.parse(saved) : {};
            setUnreadMessages(unread);
            // --- END FALLBACK ---

        }, 15000);
        // --- END OF FIX ---

        return () => {
            if (channel && supabase?.removeChannel) { supabase.removeChannel(channel).then(() => console.log('Barber unsubscribed.')); }
            if (dashboardRefreshInterval) { clearInterval(dashboardRefreshInterval); }
        };
    }, [barberId, fetchQueueDetails, setUnreadMessages]); // <-- Add setUnreadMessages here

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                console.log("Barber tab is visible, re-syncing unread messages...");
                const saved = localStorage.getItem('barberUnreadMessages');
                const unread = saved ? JSON.parse(saved) : {};
                setUnreadMessages(unread);
            }
        };

        const handleFocus = () => {
            console.log("Barber tab is focused, re-syncing unread messages...");
            const saved = localStorage.getItem('barberUnreadMessages');
            const unread = saved ? JSON.parse(saved) : {};
            setUnreadMessages(unread);
        };

        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("focus", handleFocus);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("focus", handleFocus);
        };
    }, [setUnreadMessages]); // <-- Make sure to add setUnreadMessages here

    // --- Handlers ---
    const closeModal = () => {
        setModalState({ type: null, data: null });
        setTipInput('');
        setModalError('');
    };

    const handleNextCustomer = async () => {
        // --- 1. NEW SAFETY GAP CHECK ---
        const nextAppt = queueDetails.nextAppointment; 
        if (nextAppt) {
            const apptTime = new Date(nextAppt.scheduled_time);
            const now = new Date();
            const diffInMinutes = Math.floor((apptTime - now) / 60000);

            // Warn if appointment is within 30 minutes
            if (diffInMinutes <= 30 && diffInMinutes >= -10) {
                const confirmMsg = `⚠️ SAFETY WARNING ⚠️\n\nYou have an appointment with ${nextAppt.customer_name} at ${apptTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} (in ${diffInMinutes} mins).\n\nTaking a walk-in now might make you late. Are you sure?`;
                if (!window.confirm(confirmMsg)) return; 
            }
        }
        // -------------------------------

        const next = queueDetails.upNext || (queueDetails.waiting.length > 0 ? queueDetails.waiting[0] : null);
        if (!next) {
            setModalState({ type: 'alert', data: { title: 'Queue Empty', message: 'There are no customers waiting to be called.' } });
            return;
        }
        if (queueDetails.inProgress) {
            setModalState({ type: 'alert', data: { title: 'Action Required', message: `Please complete ${queueDetails.inProgress.customer_name} first before calling the next customer.` } });
            return;
        }
        setError('');
        try { await axios.put(`${API_URL}/queue/next`, { queue_id: next.id, barber_id: barberId }); }
        catch (err) { console.error('Failed next customer:', err); setError(err.response?.data?.error || 'Failed call next.'); }
    };

    const handleCompleteCut = async () => {
        if (!queueDetails.inProgress) return;
        setModalState({ type: 'tipPrompt', data: queueDetails.inProgress });
        setModalError('');
        setTipInput('');
    };
    
    const handleSubmitTipForm = async (e) => {
        e.preventDefault();
        const entry = modalState.data;
        if (!entry) return;

        // --- NEW GROUP LOGIC ---
        const queueId = entry.id;
        const heads = entry.head_count || 1; // Default to 1 if missing
        const servicePrice = parseFloat(entry.services?.price_php) || 0;
        
        // Calculate Base: Price x Heads
        const baseTotal = servicePrice * heads;
        
        const isVIP = entry.is_vip === true;
        const vipCharge = isVIP ? 100 : 0;
        
        // Total before tip
        const subtotalDue = baseTotal + vipCharge;
        
        const parsedTip = parseInt(tipInput || '0');

        if (isNaN(parsedTip) || parsedTip < 0) {
            setModalError('Invalid tip. Please enter 0 or more.');
            return;
        }

        const finalLoggedProfit = subtotalDue + parsedTip;
        setError('');
        
        try {
            await axios.post(`${API_URL}/queue/complete`, {
                queue_id: queueId,
                barber_id: barberId,
                tip_amount: parsedTip,
                vip_charge: vipCharge,
                // The backend server.js will handle the (Price * Heads) math 
                // using the head_count stored in the DB, as we discussed.
            });
            onCutComplete();
            setModalState({ 
                type: 'alert', 
                data: { 
                    title: 'Cut Completed!', 
                    message: `Total logged profit: ₱${finalLoggedProfit.toFixed(2)} (Group of ${heads})` 
                } 
            });
        } catch (err) {
            console.error('Failed complete cut:', err);
            setError(err.response?.data?.error || 'Failed to complete cut.');
            closeModal();
        }
    };

    const handleCancel = async (customerToCancel) => {
        if (!customerToCancel) return;
        setModalState({ type: 'confirmCancel', data: customerToCancel });
    };

    const handleConfirmCancel = async () => {
        const customerToCancel = modalState.data;
        if (!customerToCancel) return;
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
        } finally {
            closeModal();
        }
    };


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
                localStorage.setItem('barberUnreadMessages', JSON.stringify(updated));
                return updated;
            });

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

    // REPLACE the old PhotoDisplay component with this:
    const PhotoDisplay = ({ entry, label }) => {
        if (!entry?.reference_image_url) return null;
        return (
            <div className="barber-photo-display">
                <button 
                    type="button" 
                    onClick={() => setViewImageModalUrl(entry.reference_image_url)}
                    className="btn-link-style"
                >
                    <IconCamera /> {label} Photo
                </button>
            </div>
        );
    };

    // --- Render Barber Dashboard ---
    return (
        <div className="card">
            <div className="card-header">
                <h2>My Queue ({barberName || '...'})</h2>
            </div>
            <div className="card-body">
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
                                    <button onClick={handleCompleteCut} className="btn btn-success btn-full-width btn-icon-label">
                                        <IconCheck /> Complete: #{queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}
                                    </button>
                                    <button onClick={() => handleCancel(queueDetails.inProgress)} className="btn btn-danger btn-full-width btn-icon-label">
                                        <IconX /> Cancel / No-Show
                                    </button>
                                </>
                            ) : queueDetails.upNext ? (
                                <button onClick={handleNextCustomer} className="btn btn-primary btn-full-width btn-icon-label">
                                    <IconNext /> Call: #{queueDetails.upNext.id} - {queueDetails.upNext.customer_name}
                                </button>
                            ) : queueDetails.waiting.length > 0 ? (
                                <button onClick={handleNextCustomer} className="btn btn-primary btn-full-width btn-icon-label">
                                    <IconNext /> Call: #{queueDetails.waiting[0].id} - {queueDetails.waiting[0].customer_name}
                                </button>
                            ) : (<button onClick={handleNextCustomer} className="btn btn-primary btn-full-width btn-icon-label">
                                <IconNext /> Call Next Customer
                                </button>
                            )}
                        </div>

                        <h3 className="queue-subtitle">In Chair</h3>
                        {queueDetails.inProgress ? (
                            <ul className="queue-list">
                                <li className={`in-progress ${queueDetails.inProgress.is_vip ? 'vip-entry' : ''}`}>
                                    <div className="queue-item-info">
                                        <strong>#{queueDetails.inProgress.daily_number || queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}</strong>

                                        <DistanceBadge meters={queueDetails.inProgress.current_distance_meters} />
                                        <PhotoDisplay entry={queueDetails.inProgress} label="In Chair" />
                                        <button 
                                            onClick={() => handleLoyaltyCheck(queueDetails.inProgress)} 
                                            className="btn btn-link-style" 
                                            title="Check Customer Loyalty History"
                                            style={{padding: '5px 0'}}
                                        >
                                            ⭐ Check Loyalty
                                        </button>
                                    </div>
                                    <button onClick={() => openChat(queueDetails.inProgress)} className="btn btn-icon" title={queueDetails.inProgress.profiles?.id ? "Chat" : "Guest"} disabled={!queueDetails.inProgress.profiles?.id}>
                                        <IconChat />
                                        {queueDetails.inProgress.profiles?.id && unreadMessages[queueDetails.inProgress.profiles.id] && (<span className="notification-badge"></span>)}
                                    </button>
                                </li>
                            </ul>
                        ) : (<p className="empty-text">Chair empty</p>)}

                        <h3 className="queue-subtitle">Up Next</h3>
                        {queueDetails.upNext ? (
                            <ul className="queue-list">
                                <li className={`up-next ${queueDetails.upNext.is_vip ? 'vip-entry' : ''}`}>
                                    <div className="queue-item-info">
                                        <strong>#{queueDetails.upNext.id} - {queueDetails.upNext.customer_name}</strong>
                                        <DistanceBadge meters={queueDetails.upNext.current_distance_meters} />
                                        {queueDetails.upNext.is_confirmed ? (
                                            <span className="badge-confirmed">✅ CONFIRMED</span>
                                        ) : (
                                            <span className="badge-waiting">⏳ Waiting for confirm...</span>
                                        )}
                                        <PhotoDisplay entry={queueDetails.upNext} label="Up Next" />
                                    </div>
                                    <button onClick={() => openChat(queueDetails.upNext)} className="btn btn-icon" title={queueDetails.upNext.profiles?.id ? "Chat" : "Guest"} disabled={!queueDetails.upNext.profiles?.id}>
                                        <IconChat />
                                        {queueDetails.upNext.profiles?.id && unreadMessages[queueDetails.upNext.profiles.id] && (<span className="notification-badge"></span>)}
                                    </button>
                                </li>
                            </ul>
                        ) : (<p className="empty-text">Nobody Up Next</p>)}

                        <h3 className="queue-subtitle">Waiting</h3>
                        <ul className="queue-list">{queueDetails.waiting.length === 0 ? (<li className="empty-text">Waiting queue empty.</li>) : (queueDetails.waiting.map(c => (
                            <li key={c.id} className={c.is_vip ? 'vip-entry' : ''}>
                                <div className="queue-item-info">
                                    <span>#{c.id} - {c.customer_name}</span>
                                    {(c.head_count && c.head_count > 1) && (
                                    <span className="badge-confirmed" style={{background: '#7c4dff', color: 'white', border: 'none'}}>
                                        👥 Group of {c.head_count}
                                    </span>
    )}
                                    <DistanceBadge meters={c.current_distance_meters} />
                                    {c.reference_image_url && <PhotoDisplay entry={c} label="Waiting" />}
                                </div>
                                <button onClick={() => openChat(c)} className="btn btn-icon" title={c.profiles?.id ? "Chat" : "Guest"} disabled={!c.profiles?.id}>
                                    <IconChat />
                                    {c.profiles?.id && unreadMessages[c.profiles.id] && (<span className="notification-badge"></span>)}
                                </button>
                            </li>
                        )))}</ul>

                        {/* REPLACEMENT FOR CHAT SECTION */}
                        {openChatCustomerId && (
                            <div className="barber-chat-container">
                                {/* Header with Report Button */}
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px', borderBottom:'1px solid var(--border-color)', background:'var(--surface-color)'}}>
                                     <h4 style={{margin:0}}>Chat with Customer</h4>
                                     <button 
                                        onClick={() => {
                                            setReportTargetId(openChatCustomerId); // <--- Uses reportTargetId
                                            setIsReportModalOpen(true);            // <--- Uses isReportModalOpen
                                        }}
                                        className="btn btn-danger btn-icon" 
                                        title="Report Customer"
                                        style={{padding: '4px', height:'30px', width:'30px'}}
                                    >
                                        ⚠️
                                    </button>
                                </div>

                                <p className="chat-warning">Hey there! Just a friendly nudge to keep the chat open even when your phone’s screen is off.</p>
                                <ChatWindow
                                    currentUser_id={session.user.id}
                                    otherUser_id={openChatCustomerId}
                                    messages={chatMessages[openChatCustomerId] || []}
                                    onSendMessage={sendBarberMessage}
                                    isVisible={!!openChatCustomerId}
                                />
                                <button onClick={closeChat} className="btn btn-secondary btn-full-width">Close Chat</button>
                            </div>
                        )}
                    </>
                )}
            </div>
            <div className="card-footer">
                 <button onClick={fetchQueueDetails} className="btn btn-secondary btn-full-width btn-icon-label">
                    <IconRefresh /> Refresh Queue
                </button>
            </div>

            {/* --- MODALS --- */}
            {modalState.type === 'alert' && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-body">
                            <h2>{modalState.data?.title || 'Alert'}</h2>
                            <p>{modalState.data?.message || 'An error occurred.'}</p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={closeModal} className="btn btn-primary">
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalState.type === 'confirmCancel' && modalState.data && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-body">
                            <h2>Confirm Cancellation</h2>
                            <p>Are you sure you want to mark Customer #{modalState.data.id} ({modalState.data.customer_name}) as Cancelled/No-Show? This will not log earnings.</p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={closeModal} className="btn btn-secondary">
                                Back
                            </button>
                            <button onClick={handleConfirmCancel} className="btn btn-danger">
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalState.type === 'tipPrompt' && modalState.data && (
                <div className="modal-overlay">
                    <div className="modal-content modal-form">
                        <form onSubmit={handleSubmitTipForm}>
                            <div className="modal-body">
                                <h2>Complete Cut</h2>
                                <p className="modal-form-details">
                                    <strong>Customer:</strong> {modalState.data.customer_name} (#{modalState.data.id})<br/>
                                    
                                    {/* --- NEW: GROUP DISPLAY --- */}
                                    <strong>Heads:</strong> {modalState.data.head_count || 1}<br/> 
                                    
                                    <strong>Service:</strong> {modalState.data.services?.name || 'Service'} 
                                    {' '}(₱{parseFloat(modalState.data.services?.price_php || 0).toFixed(2)} x {modalState.data.head_count || 1})<br/>

                                    {modalState.data.is_vip && (
                                        <>
                                            <strong>VIP Fee:</strong> ₱100.00<br/>
                                        </>
                                    )}
                                    
                                    {/* --- NEW: TOTAL DUE CALCULATION --- */}
                                    <strong style={{fontSize: '1.2rem', color: 'var(--success-color)'}}>
                                        Total Due: ₱{(
                                            ((parseFloat(modalState.data.services?.price_php || 0)) * (modalState.data.head_count || 1)) + 
                                            (modalState.data.is_vip ? 100 : 0)
                                        ).toFixed(2)}
                                    </strong>
                                </p>
                                
                                <div className="form-group">
                                    <label htmlFor="tipAmount">Enter TIP Amount (Optional):</label>
                                    <input
                                        type="number"
                                        id="tipAmount"
                                        value={tipInput}
                                        onChange={(e) => setTipInput(e.target.value)}
                                        placeholder="e.g., 50"
                                        autoFocus
                                    />
                                </div>
                                {modalError && <p className="message error">{modalError}</p>}
                            </div>
                            
                            <div className="modal-footer">
                                <button onClick={closeModal} type="button" className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Complete & Log Profit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {viewImageModalUrl && (
            <div className="modal-overlay" onClick={() => setViewImageModalUrl(null)}>
                <div 
                    className="modal-content image-modal-content" 
                    onClick={(e) => e.stopPropagation()} /* Prevents modal from closing when clicking the image */
                >
                    <img 
                        src={viewImageModalUrl} 
                        alt="Reference" 
                        className="image-modal-img" 
                    />
                    <div className="modal-footer single-action">
                        <button 
                            onClick={() => setViewImageModalUrl(null)} 
                            className="btn btn-secondary"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Loyalty Loading Modal --- */}
        {modalState.type === 'loyaltyLoading' && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-body">
                        <h2>Loyalty Check</h2>
                        <p>Fetching history for {modalState.data?.name || 'Customer'}...</p>
                        <Spinner />
                    </div>
                    <div className="modal-footer single-action">
                        <button onClick={closeModal} className="btn btn-secondary">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Loyalty Result Modal --- */}
        {modalState.type === 'loyaltyResult' && modalState.data && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-body" style={{textAlign: 'left'}}>
                        <h2>⭐ Loyalty Status</h2>
                        <p>
                            Customer: {modalState.data.name}<br/>
                            Email: {modalState.data.email}
                        </p>

                        <h3 style={{color: modalState.data.count >= 10 ? 'var(--success-color)' : 'var(--primary-orange)', marginTop: '15px'}}>
                            Completed Cuts: {modalState.data.count}
                        </h3>

                        {modalState.data.count >= 10 && (
                            <p className="success-message">
                                Loyalty Achieved! This customer qualifies for a discount.
                            </p>
                        )}

                        <h4 className="queue-subtitle">Past Services:</h4>
                        <ul className="history-list" style={{maxHeight: '200px', overflowY: 'auto'}}>
                            {modalState.data.history.length > 0 ? (
                                modalState.data.history.map((entry, index) => (
                                    <li key={index} className={`history-item ${entry.status === 'Done' ? 'done' : 'cancelled'}`} style={{padding: '10px', marginBottom: '8px'}}>
                                        <span className="service">
                                            {entry.services?.name || 'Unknown Service'}
                                        </span>
                                        {entry.is_vip && (
                                            <span className="status-badge" style={{ 
                                                backgroundColor: 'rgba(255, 149, 0, 0.3)', 
                                                color: 'var(--primary-orange)', 
                                                border: '1px solid var(--primary-orange)',
                                                marginLeft: '8px'
                                            }}>
                                                VIP
                                            </span>
                                        )}
                                        <span 
                                            className="status-badge" 
                                            style={{ margin: '0 10px' }} // Add some spacing
                                        >
                                            {entry.status}
                                        </span>
                                        <span className="date" style={{marginLeft: 'auto'}}>
                                            {new Date(entry.created_at).toLocaleDateString()}
                                        </span>
                                    </li>
                                ))
                            ) : (
                                <p className="empty-text">No service history found.</p>
                            )}
                        </ul>
                    </div>
                    <div className="modal-footer single-action">
                        <button onClick={closeModal} className="btn btn-primary">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}
            <ReportModal 
                    isOpen={isReportModalOpen}          // <--- Uses isReportModalOpen
                    onClose={() => setIsReportModalOpen(false)}
                    reporterId={session.user.id}
                    reportedId={reportTargetId}         // <--- Uses reportTargetId
                    userRole="barber"
                />
        </div>
    );
}
const handleLogout = async (userId) => {
    try {
        await axios.put(`${API_URL}/logout/flag`, { userId });
        console.log("Server status updated successfully.");
    } catch (error) {
        console.error("Warning: Failed to clear barber availability status on server.", error.message);
    }

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
        console.warn("Standard Supabase signout failed (403 Forbidden). Forcing local session clear.");
        await supabase.auth.setSession({ access_token: 'expired', refresh_token: 'expired' });
    }
};
// ##############################################
// ##    CUSTOMER-SPECIFIC COMPONENTS        ##
// ##############################################

function CustomerView({ session }) {
    const [barbers, setBarbers] = useState([]);
    const [selectedBarberId, setSelectedBarberId] = useState('');
    const [customerName] = useState(() => session.user?.user_metadata?.full_name || '');
    const [customerEmail] = useState(() => session.user?.email || '');
    const [message, setMessage] = useState('');
    const [player_id, setPlayerId] = useState(null);
    const [myQueueEntryId, setMyQueueEntryId] = useState(() => localStorage.getItem('myQueueEntryId') || null);
    const [joinedBarberId, setJoinedBarberId] = useState(() => localStorage.getItem('joinedBarberId') || null);
    const [liveQueue, setLiveQueue] = useState([]);
    const [queueMessage, setQueueMessage] = useState('');
    const [peopleWaiting, setPeopleWaiting] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalButtonDisabled, setIsModalButtonDisabled] = useState(false);
    const [modalCountdown, setModalCountdown] = useState(10);
    const [isQueueLoading, setIsQueueLoading] = useState(true);
    const [services, setServices] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(() => {
        return localStorage.getItem('myQueueEntryId') ? true : false;
    });
    const [isServiceCompleteModalOpen, setIsServiceCompleteModalOpen] = useState(false);
    const [isCancelledModalOpen, setIsCancelledModalOpen] = useState(false);
    const [hasUnreadFromBarber, setHasUnreadFromBarber] = useState(() => localStorage.getItem('hasUnreadFromBarber') === 'true');
    const [chatMessagesFromBarber, setChatMessagesFromBarber] = useState([]);
    const [optimisticMessage, setOptimisticMessage] = useState(null);
    const [displayWait, setDisplayWait] = useState(0);
    const [finishTime, setFinishTime] = useState(() => {
        const saved = localStorage.getItem('targetFinishTime');
        return saved ? parseInt(saved, 10) : 0;
    });
    const [isTooFarModalOpen, setIsTooFarModalOpen] = useState(false);
    const [isOnCooldown, setIsOnCooldown] = useState(false);
    const locationWatchId = useRef(null);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const liveQueueRef = useRef([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [referenceImageUrl, setReferenceImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isVIPToggled, setIsVIPToggled] = useState(false);
    const [isVIPModalOpen, setIsVIPModalOpen] = useState(false);
    const lastUploadTime = useRef(0);

    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [barberFeedback, setBarberFeedback] = useState([]);
    const [viewMode, setViewMode] = useState('join'); // 'join' or 'history'
    const [loyaltyHistory, setLoyaltyHistory] = useState([]);

    const nowServing = liveQueue.find(entry => entry.status === 'In Progress');
    const upNext = liveQueue.find(entry => entry.status === 'Up Next');
    const targetBarber = barbers.find(b => b.id === parseInt(joinedBarberId));
    const currentBarberName = targetBarber?.full_name || `Barber #${joinedBarberId}`;
    const currentChatTargetBarberUserId = targetBarber?.user_id;

    const myQueueEntry = liveQueue.find(e => e.id.toString() === myQueueEntryId);
    const isQueueUpdateAllowed = myQueueEntry && (myQueueEntry.status === 'Waiting' || myQueueEntry.status === 'Up Next');
    const [customerRating, setCustomerRating] = useState(0);
    const [joinMode, setJoinMode] = useState('now'); // 'now' or 'later'
    const getTomorrowDate = () => {
        const date = new Date();
        date.setDate(date.getDate() + 1); // Move to tomorrow
        return date.toISOString().split('T')[0];
    };

    // Initialize with Tomorrow's date
    const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [freeBarber, setFreeBarber] = useState(null);
    const [myAppointments, setMyAppointments] = useState([]);
    const [headCount, setHeadCount] = useState(1);
    const [showIOSPrompt, setShowIOSPrompt] = useState(true);
    const [isMyReportsOpen, setIsMyReportsOpen] = useState(false);

    const fetchMyAppointments = useCallback(async () => {
        if (!session?.user?.id) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/appointments/my/${session.user.id}`);
            setMyAppointments(response.data || []);
        } catch (err) {
            console.error("Failed to load appointments", err);
        } finally {
            setIsLoading(false);
        }
    }, [session]);

    const fetchLoyaltyHistory = useCallback(async (userId) => {
        if (!userId) return;
        try {
            const response = await axios.get(`${API_URL}/customer/history/${userId}`);
            setLoyaltyHistory(response.data || []);
        } catch (error) {
            console.error('Failed to fetch loyalty history:', error);
        }
    }, []);

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

    const handleCloseInstructions = () => {
        localStorage.setItem('hasSeenInstructions_v1', 'true');
        setIsInstructionsModalOpen(false);
    };

    const handleReturnToJoin = useCallback(async (userInitiated = false) => {
        console.log("[handleReturnToJoin] Function called.");
        if (userInitiated && myQueueEntryId) {
            setIsLoading(true);
            try {
                await axios.delete(`${API_URL}/queue/${myQueueEntryId}`, {
                    data: { userId: session.user.id }
                });
                setMessage("You left the queue.");
            }
            catch (error) { console.error("Failed to leave queue:", error); setMessage("Error leaving queue."); }
            finally { setIsLoading(false); }
        }
        setIsServiceCompleteModalOpen(false); setIsCancelledModalOpen(false);
        stopBlinking();
        localStorage.removeItem('myQueueEntryId'); 
        localStorage.removeItem('joinedBarberId');
        localStorage.removeItem('displayWait');
        localStorage.removeItem('targetFinishTime'); 
        localStorage.removeItem('pendingFeedback');// <-- ADD THIS
        setMyQueueEntryId(null); setJoinedBarberId(null);
        setLiveQueue([]); setQueueMessage(''); setSelectedBarberId('');
        setSelectedServiceId(''); setMessage('');
        setIsChatOpen(false);
        setChatMessagesFromBarber([]); setDisplayWait(0);
        setReferenceImageUrl('');
        setSelectedFile(null);
        setIsUploading(false);

        setFeedbackText('');
        setFeedbackSubmitted(false);
        setBarberFeedback([]);

        console.log("[handleReturnToJoin] State reset complete.");
    }, [myQueueEntryId, session]);

    const fetchPublicQueue = useCallback(async (barberId) => {
        if (!barberId) {
            setLiveQueue([]);
            liveQueueRef.current = [];
            setIsQueueLoading(false);
            return;
        }
        setIsQueueLoading(true);
        
        try {
            const response = await axios.get(`${API_URL}/queue/public/${barberId}`);
            const queueData = response.data || [];
            setLiveQueue(queueData);
            liveQueueRef.current = queueData;

            const currentQueueId = localStorage.getItem('myQueueEntryId');
            
            // --- NOTIFICATION LOGIC (Your Turn / Up Next) ---
            if (currentQueueId) {
                const myEntry = queueData.find(e => e.id.toString() === currentQueueId);

                if (myEntry && (myEntry.status === 'In Progress' || myEntry.status === 'Up Next')) {
                    const modalFlag = localStorage.getItem('stickyModal');
                    if (modalFlag !== 'yourTurn') {
                        console.log(`[Catcher] Status Update: ${myEntry.status}`);
                        playSound(queueNotificationSound);
                        if (myEntry.status === 'In Progress') startBlinking(TURN_TITLE);
                        else if (myEntry.status === 'Up Next') startBlinking(NEXT_UP_TITLE);
                        localStorage.setItem('stickyModal', 'yourTurn');
                        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                    }
                } else if (myEntry && myEntry.status === 'Waiting') {
                    stopBlinking();
                    if (localStorage.getItem('stickyModal') === 'yourTurn') {
                         localStorage.removeItem('stickyModal');
                    }
                }
            }

            // --- FIX: TRANSFER & MISSED EVENT DETECTION ---
            if (currentQueueId) {
                // 1. Are we in the CURRENT barber's list?
                const amIInActiveQueue = queueData.some(entry => entry.id.toString() === currentQueueId);

                // 2. If NOT in list, and no modals are open... check why.
                if (!amIInActiveQueue && !isServiceCompleteModalOpen && !isCancelledModalOpen) {
    
                    const investigateDisappearance = async () => {
                        console.log("[Catcher] Entry missing from public list. Verifying with server...");

                        // 1. SAFETY NET: Ask Supabase specifically for MY entry ID
                        // This bypasses the public list "replication lag"
                        const { data: myEntry, error } = await supabase
                            .from('queue_entries')
                            .select('status, barber_id')
                            .eq('id', myQueueEntryId)
                            .maybeSingle();

                        if (error) {
                            console.warn("Network error checking status. Assuming safe.", error);
                            return; // If internet is flaky, DO NOT kick the user out.
                        }

                        // 2. IF ENTRY EXISTS & ACTIVE: It was just lag. Do nothing.
                        if (myEntry && ['Waiting', 'Up Next', 'In Progress'].includes(myEntry.status)) {
                            console.log("Entry still exists in DB. Ignoring public list lag.");
                            
                            // Optional: If the barber ID changed on the server but not locally, update it now
                            const currentStoredBarber = localStorage.getItem('joinedBarberId');
                            if (myEntry.barber_id.toString() !== currentStoredBarber) {
                                console.log(`[Transfer] Detected move to Barber ${myEntry.barber_id}. Updating local state.`);
                                localStorage.setItem('joinedBarberId', myEntry.barber_id.toString());
                                setJoinedBarberId(myEntry.barber_id.toString());
                                setMessage("🔄 You have been transferred to another barber.");
                            }
                            return; 
                        }

                        // 3. IF WE ARE HERE: The entry is genuinely gone (Deleted) or Finished.
                        // Check if it was a "Done" or "Cancelled" event we missed.
                        const userId = session?.user?.id;
                        if (!userId) return;

                        try {
                            const response = await axios.get(`${API_URL}/missed-event/${userId}`);
                            const eventType = response.data.event;

                            if (eventType === 'Done') {
                                console.log("[Catcher] Confirmed 'Done'.");
                                localStorage.setItem('pendingFeedback', JSON.stringify({
                                    barberId: joinedBarberId, // Use the current state ID
                                    timestamp: Date.now()
                                }));
                                setIsServiceCompleteModalOpen(true);
                                localStorage.removeItem('myQueueEntryId');
                                localStorage.removeItem('joinedBarberId');
                                localStorage.removeItem('stickyModal');
                            } else if (eventType === 'Cancelled') {
                                console.log("[Catcher] Confirmed 'Cancelled'.");
                                setIsCancelledModalOpen(true);
                                localStorage.removeItem('myQueueEntryId');
                                localStorage.removeItem('joinedBarberId');
                                localStorage.removeItem('stickyModal');
                            } else {
                                // 4. FALLBACK: It was deleted manually (e.g. by Admin/Barber) without a status change
                                console.warn("[Catcher] Entry disappeared completely.");
                                setQueueMessage("Your queue entry was removed.");
                                handleReturnToJoin(false); // Clean up local state
                            }
                        } catch (error) {
                            console.error("[Catcher] Error checking event:", error.message);
                        }
                    };
                    investigateDisappearance();
                }
            }

        } catch (error) {
            console.error("Failed fetch public queue:", error);
            setLiveQueue([]);
            liveQueueRef.current = [];
            setQueueMessage("Could not load queue data.");
        } finally {
            setIsQueueLoading(false);
        }
    }, [
    session, 
    isServiceCompleteModalOpen, 
    isCancelledModalOpen, 
    setLiveQueue, 
    setQueueMessage, 
    setIsServiceCompleteModalOpen, 
    setIsCancelledModalOpen, 
    setJoinedBarberId,
    handleReturnToJoin,
    myQueueEntryId,
    joinedBarberId
    ]);

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

            const { error: uploadError } = await supabase.storage
                .from('haircut_references')
                .upload(filePath, selectedFile, {
                    cacheControl: '3600',
                    upsert: true
                });
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('haircut_references')
                .getPublicUrl(filePath);

            if (!publicUrlData.publicUrl) throw new Error("Failed to get public URL.");

            const imageUrl = publicUrlData.publicUrl;

            if (!myQueueEntryId) {
                setReferenceImageUrl(imageUrl);
                setMessage('Photo uploaded. Ready to join queue.');
            } else {
                const updateResponse = await axios.put(`${API_URL}/queue/photo`, {
                    queueId: targetQueueId,
                    barberId: joinedBarberId,
                    referenceImageUrl: imageUrl
                });

                if (updateResponse.status !== 200) throw new Error("Failed to update queue entry.");
                setReferenceImageUrl(imageUrl);
                setMessage('Photo successfully updated!');
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

    const handleVIPToggle = (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            setIsVIPModalOpen(true);
        } else {
            setIsVIPToggled(false);
        }
    };

    const confirmVIP = () => {
        setIsVIPToggled(true);
        setIsVIPModalOpen(false);
    };

    const cancelVIP = () => {
        setIsVIPToggled(false);
        setIsVIPModalOpen(false);
    };

    const handleJoinQueue = async (e) => {
        e.preventDefault();
        if (!customerName || !selectedBarberId || !selectedServiceId) { setMessage('Name, Barber, AND Service required.'); return; }
        if (myQueueEntryId) { setMessage('You are already checked in!'); return; }
        if (selectedFile && !referenceImageUrl) { setMessage('Please click "Upload Photo" first!'); return; }

        setIsLoading(true); setMessage('Joining queue...');
        try {
            const response = await axios.post(`${API_URL}/queue`, {
                customer_name: customerName,
                customer_email: customerEmail,
                barber_id: selectedBarberId,
                reference_image_url: referenceImageUrl || null,
                service_id: selectedServiceId,
                player_id: player_id,
                user_id: session.user.id,
                is_vip: isVIPToggled,
                head_count: headCount,
            });
            const newEntry = response.data;
            if (newEntry && newEntry.id) {
                setMessage(`Success! You are #${newEntry.id} in the queue.`);
                localStorage.setItem('myQueueEntryId', newEntry.id.toString());
                localStorage.setItem('joinedBarberId', newEntry.barber_id.toString());
                setMyQueueEntryId(newEntry.id.toString());
                setJoinedBarberId(newEntry.barber_id.toString());
                setIsChatOpen(true);
                setSelectedBarberId(''); setSelectedServiceId('');
                setReferenceImageUrl(newEntry.reference_image_url || '');
                fetchPublicQueue(newEntry.barber_id.toString());
                setIsVIPToggled(false);
            } else { throw new Error("Invalid response from server."); }
       } catch (error) {
        console.error('Failed to join queue:', error);
        
        // --- START: HANDLE 409 CONFLICT (AUTO-RECOVER) ---
        if (error.response && error.response.status === 409) {
            // Check if 'details' actually exists before trying to read it
            const existing = error.response.data.details;
            
            if (existing && existing.id) {
                // Scenario A: User is already in queue (Recovery)
                setMessage(`⚠️ Found active booking! Recovering your spot (ID: #${existing.id})...`);
                
                localStorage.setItem('myQueueEntryId', existing.id.toString());
                localStorage.setItem('joinedBarberId', existing.barber_id.toString());

                setMyQueueEntryId(existing.id.toString());
                setJoinedBarberId(existing.barber_id.toString());
                setIsChatOpen(true);
                
                setSelectedBarberId('');
                setSelectedServiceId('');
                setReferenceImageUrl(existing.reference_image_url || '');

                fetchPublicQueue(existing.barber_id.toString());
            } else {
                // Scenario B: Database Error or Generic Conflict (Prevent Crash)
                const errorMsg = error.response.data.error || "A conflict occurred.";
                console.error("409 Error without details:", errorMsg);
                setMessage(`Error: ${errorMsg}`);
            }
        }
        // --- END: HANDLE 409 CONFLICT ---
        else {
            const errorMessage = error.response?.data?.error || error.message;
            setMessage(errorMessage.includes('unavailable') ? errorMessage : 'Failed to join. Try again.');
        }
    } finally { 
        setIsLoading(false); 
    }
    };

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!customerName || !selectedBarberId || !selectedServiceId || !selectedSlot) { 
            setMessage('All fields including a Time Slot are required.'); 
            return; 
        }

        setIsLoading(true);
        setMessage('Booking appointment...');

        try {
            await axios.post(`${API_URL}/appointments/book`, {
                customer_name: customerName,
                customer_email: customerEmail,
                user_id: session.user.id,
                barber_id: selectedBarberId,
                service_id: selectedServiceId,
                scheduled_time: selectedSlot
            });

            setMessage(`Success! Appointment confirmed for ${new Date(selectedSlot).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`);
            
            // Optional: Reset form or switch to history view
            setSelectedSlot(null);
            setAvailableSlots([]);
            setTimeout(() => {
                setMessage('');
                setViewMode('history'); // Switch to history so they can see the booking? (Requires history update)
            }, 3000);

        } catch (error) {
            console.error('Booking failed:', error);
            setMessage(error.response?.data?.error || 'Booking failed.');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Effects ---

    useEffect(() => {
    // Only run if we are already in a queue and waiting
    if (!myQueueEntryId || !joinedBarberId) return;

        const checkOpportunities = async () => {
            try {
                // 1. Fetch all public barber statuses
                const res = await axios.get(`${API_URL}/barbers`); //
                const allBarbers = res.data;

                // 2. Find a barber who is Active, Available, AND has a Rating > 4.0 (optional quality filter)
                // Note: You might need to fetch their specific queue length if your /api/barbers doesn't return it.
                // For now, let's assume you add a small check or rely on 'is_available'
                
                const currentBarberIdStr = joinedBarberId.toString();
                
                // Find someone else who is available
                const opportunity = allBarbers.find(b => 
                    b.id.toString() !== currentBarberIdStr && // Not my current barber
                    b.is_active && 
                    b.is_available // They are marked Online
                );

                // If found, set them as an opportunity
                if (opportunity) {
                    setFreeBarber(opportunity);
                } else {
                    setFreeBarber(null);
                }
            } catch (e) {
                console.error("Opportunity check failed", e);
            }
        };

        const interval = setInterval(checkOpportunities, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, [myQueueEntryId, joinedBarberId]);

    // FUNCTION: Handle the switch
    const handleSelfTransfer = async () => {
        if (!freeBarber) return;
        if (!window.confirm(`Switch to ${freeBarber.full_name}? You will lose your spot with your current barber.`)) return;

        setIsLoading(true);
        try {
            // OPTION A: The Clean Way (Requires new endpoint in server.js)
            // await axios.post(`${API_URL}/queue/self-transfer`, { queueId: myQueueEntryId, targetBarberId: freeBarber.id });
            
            // OPTION B: The "Hack" Way (Leave & Rejoin using existing endpoints)
            // 1. Leave current queue
            await axios.delete(`${API_URL}/queue/${myQueueEntryId}`, { data: { userId: session.user.id } }); //
            
            // 2. Join new barber (Re-using your join logic)
            // Note: You'd need to refactor handleJoinQueue to accept params, or just manually call axios.post('/api/queue'...) here
            await axios.post(`${API_URL}/queue`, {
                customer_name: customerName,
                customer_email: customerEmail,
                barber_id: freeBarber.id,
                service_id: selectedServiceId || 1, // You might need to save their service ID in localstorage to preserve it
                user_id: session.user.id,
                is_vip: false // Reset VIP on transfer?
            });

            // 3. Force Reload / Reset State
            alert(`Switched to ${freeBarber.full_name}!`);
            window.location.reload(); // Simplest way to reset state for now
            
        } catch (e) {
            alert("Failed to switch.");
        } finally {
            setIsLoading(false);
        }
    };
    // RECOVERY SYSTEM: Restore session if LocalStorage was wiped but DB entry exists
    useEffect(() => {
        if (viewMode === 'appointments') {
            fetchMyAppointments();
        }
    }, [viewMode, fetchMyAppointments]);

    useEffect(() => {
        const restoreSession = async () => {
            // Only run if we don't have a local ID but we DO have a logged-in user
            if (!myQueueEntryId && session?.user?.id) {
                console.log("[Recovery] Checking for lost tickets...");
                try {
                    const { data: activeEntry, error } = await supabase
                        .from('queue_entries')
                        .select('id, barber_id, reference_image_url')
                        .eq('user_id', session.user.id)
                        .in('status', ['Waiting', 'Up Next', 'In Progress'])
                        .maybeSingle();

                    if (!error && activeEntry) {
                        console.log(`[Recovery] Found active ticket #${activeEntry.id}. Restoring...`);
                        // RESTORE STATE
                        localStorage.setItem('myQueueEntryId', activeEntry.id.toString());
                        localStorage.setItem('joinedBarberId', activeEntry.barber_id.toString());
                        setMyQueueEntryId(activeEntry.id.toString());
                        setJoinedBarberId(activeEntry.barber_id.toString());
                        setReferenceImageUrl(activeEntry.reference_image_url || '');
                        setIsChatOpen(true);
                        fetchPublicQueue(activeEntry.barber_id.toString());
                    }
                } catch (err) {
                    console.error("[Recovery] Failed to restore session:", err);
                }
            }
        };
        restoreSession();
    }, [session, myQueueEntryId, fetchPublicQueue]);

    useEffect(() => {
        if (joinMode === 'later' && selectedBarberId && selectedServiceId && selectedDate) {
            setAvailableSlots([]); // Clear old slots while loading
            axios.get(`${API_URL}/appointments/slots`, {
                params: { barberId: selectedBarberId, serviceId: selectedServiceId, date: selectedDate }
            })
            .then(res => setAvailableSlots(res.data))
            .catch(err => console.error(err));
        }
    }, [joinMode, selectedBarberId, selectedServiceId, selectedDate]);

    useEffect(() => {
        if (viewMode === 'history' && session?.user?.id) {
            fetchLoyaltyHistory(session.user.id);
        }
    }, [viewMode, session?.user?.id, fetchLoyaltyHistory]);
    useEffect(() => { // Geolocation Watcher + Uploader
        const BARBERSHOP_LAT = 16.414830431367967;
        const BARBERSHOP_LON = 120.59712292628716;
        const DISTANCE_THRESHOLD_METERS = 200;

        if (!('geolocation' in navigator)) { console.warn('Geolocation not available.'); return; }

        if (myQueueEntryId) {
            const onPositionUpdate = (position) => {
                const { latitude, longitude } = position.coords;
                const distance = getDistanceInMeters(latitude, longitude, BARBERSHOP_LAT, BARBERSHOP_LON);
                
                // 1. LOCAL ALERT LOGIC (Existing)
                if (distance > DISTANCE_THRESHOLD_METERS && displayWait < 15) {
                    if (!isTooFarModalOpen && !isOnCooldown) {
                        localStorage.setItem('stickyModal', 'tooFar');
                        setIsTooFarModalOpen(true);
                        setIsOnCooldown(true);
                    }
                } else {
                    if (isOnCooldown) { setIsOnCooldown(false); }
                }

                // 2. SERVER UPLOAD LOGIC (New)
                // We limit uploads to once every 60 seconds to save battery/data
                const now = Date.now();
                if (now - lastUploadTime.current > 60000) { 
                    console.log(`[X-Ray] Uploading distance: ${Math.round(distance)}m`);
                    axios.put(`${API_URL}/queue/location`, {
                        queueId: myQueueEntryId,
                        distance: distance
                    }).catch(err => console.error("Loc upload failed", err));
                    
                    lastUploadTime.current = now;
                }
            };
            
            const onPositionError = (err) => { console.warn(`GPS Error: ${err.message}`); };
            
            locationWatchId.current = navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        }
        
        return () => { if (locationWatchId.current) { navigator.geolocation.clearWatch(locationWatchId.current); } };
    
    }, [myQueueEntryId, isTooFarModalOpen, isOnCooldown, displayWait]);

    useEffect(() => { // First Time Instructions
        const hasSeen = localStorage.getItem('hasSeenInstructions_v1');
        if (!hasSeen) { setIsInstructionsModalOpen(true); }
        const pendingFeedback = localStorage.getItem('pendingFeedback');
        if (pendingFeedback) {
            const data = JSON.parse(pendingFeedback);
            // Restore necessary state to submit the feedback
            setJoinedBarberId(data.barberId); 
            // We don't set myQueueEntryId because the queue is technically done
            setIsServiceCompleteModalOpen(true);
        }
    }, []);

    useEffect(() => {
        const modalFlag = localStorage.getItem('stickyModal');
        if (modalFlag === 'tooFar') {
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

    useEffect(() => { // ROBUST OneSignal Setup
        window.OneSignal = window.OneSignal || [];
        
        // 1. Initialize
        window.OneSignal.push(function() {
            window.OneSignal.init({
                appId: process.env.REACT_APP_ONESIGNAL_APP_ID, 
                allowLocalhostAsSecureOrigin: true,
                notifyButton: { enable: false },
            });
            // Try to prompt immediately (Works on Android/Desktop)
            window.OneSignal.showSlidedownPrompt();
        });

        // 2. Helper to capture ID securely
        const updatePlayerId = () => {
            window.OneSignal.push(function() {
                window.OneSignal.getUserId(function(userId) {
                    if (userId) {
                        console.log("✅ OneSignal Player ID captured:", userId);
                        setPlayerId(userId); // Saves to state, which is sent when Joining Queue
                    }
                });
            });
        };

        // 3. Check immediately
        updatePlayerId();

        // 4. LISTEN for "Allow" click (This fixes the timing bug!)
        window.OneSignal.push(function() {
            window.OneSignal.on('subscriptionChange', function (isSubscribed) {
                console.log("🔔 Notification Permission Changed:", isSubscribed);
                if (isSubscribed) {
                    updatePlayerId();
                }
            });
        });
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

    // Find this useEffect (around line 1073)
    useEffect(() => { // Blinking Tab Listeners
        const handleFocus = () => stopBlinking();
        
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                stopBlinking();
                
                // Re-sync unread messages
                const hasUnread = localStorage.getItem('hasUnreadFromBarber') === 'true';
                setHasUnreadFromBarber(hasUnread);

                // --- THIS IS THE FIX ---
                // Immediately check queue status when user returns to the tab
                const currentBarber = localStorage.getItem('joinedBarberId');
                if (currentBarber) {
                    console.log("Tab is visible, re-fetching queue status...");
                    fetchPublicQueue(currentBarber);
                }
                // --- END FIX ---
            }
        };
        
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);
        
        return () => { 
            window.removeEventListener("focus", handleFocus); 
            document.removeEventListener("visibilitychange", handleVisibility); 
            stopBlinking(); 
        };
    }, [fetchPublicQueue]); // <-- IMPORTANT: Add fetchPublicQueue as a dependency

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
                            playSound(queueNotificationSound);
                            startBlinking(NEXT_UP_TITLE);
                            localStorage.setItem('stickyModal', 'yourTurn');
                            if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                        }
                        else if (newStatus === 'In Progress') { 
                            playSound(queueNotificationSound);
                            startBlinking(TURN_TITLE);
                            localStorage.setItem('stickyModal', 'yourTurn');
                            if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                        }
                        else if (newStatus === 'Done') { 
                            localStorage.setItem('pendingFeedback', JSON.stringify({
                            barberId: joinedBarberId,
                            timestamp: Date.now()
                        }));
                        // --- FIX END ---
                        setIsServiceCompleteModalOpen(true); 
                        stopBlinking();
                        }
                        else if (newStatus === 'Cancelled') { 
                            setIsCancelledModalOpen(true); 
                            stopBlinking(); 
                        }
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

    useEffect(() => { // Fetch feedback when barber is selected
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

    // --- REPLACED SOCKET.IO WITH SUPABASE REALTIME ---
    useEffect(() => { 
        if (!session?.user?.id || !joinedBarberId || !myQueueEntryId) return;

        // 1. Initial Load
        fetchChatHistory(myQueueEntryId);

        // 2. Subscribe to NEW messages in the database
        console.log("[Customer] Subscribing to Chat via Supabase...");
        const chatChannel = supabase.channel(`chat_${myQueueEntryId}`)
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'chat_messages', 
                    filter: `queue_entry_id=eq.${myQueueEntryId}` 
                }, 
                (payload) => {
                    const newMsg = payload.new;
                    console.log("[Customer] New message received:", newMsg);
                    
                    // --- THE FIX IS HERE ---
                    // Only add the message if it is NOT from me.
                    // (I already added my own message optimistically in sendCustomerMessage)
                    if (newMsg.sender_id !== session.user.id) {
                        setChatMessagesFromBarber(prev => [...prev, { 
                        senderId: newMsg.sender_id, 
                        message: newMsg.message 
                    }]);
                        
                        // Play sound for incoming messages
                        playSound(messageNotificationSound);
                        setIsChatOpen(current => {
                            if (!current) {
                                setHasUnreadFromBarber(true);
                                localStorage.setItem('hasUnreadFromBarber', 'true');
                            }
                            return current;
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
        };
    }, [session, joinedBarberId, myQueueEntryId, fetchChatHistory]);

    // --- UPDATE SEND FUNCTION ---
    const sendCustomerMessage = async (recipientId, messageText) => {
        if (!messageText.trim()) return;
        
        // Optimistic UI Update (Show immediately)
        const tempMsg = { senderId: session.user.id, message: messageText };
        setChatMessagesFromBarber(prev => [...prev, tempMsg]);

        try {
            await axios.post(`${API_URL}/chat/send`, {
                senderId: session.user.id,
                queueId: myQueueEntryId,
                message: messageText
            });
        } catch (error) {
            console.error("Failed to send message:", error);
            setMessage("Failed to send message. Profanity?");
            // Rollback UI if needed, or just show error
        }
    };
    
    useEffect(() => { // EWT Preview
        if (selectedBarberId) {
            console.log(`[EWT Preview] Fetching queue for barber ${selectedBarberId}`);
            fetchPublicQueue(selectedBarberId);
        } else {
            setLiveQueue([]);
            liveQueueRef.current = [];
            setIsQueueLoading(false); // Stop loading if no barber is selected
        }
    }, [selectedBarberId, fetchPublicQueue]);

    useEffect(() => { // Smart EWT Calculation (Time-Adjusted)
        const calculateWaitTime = () => {
            const newQueue = liveQueue;
            const myIndexNew = newQueue.findIndex(e => e.id.toString() === myQueueEntryId);
            
            // Determine who is ahead of us
            const peopleAheadNew = myIndexNew !== -1 ? newQueue.slice(0, myIndexNew) : newQueue;
            
            const relevantEntries = newQueue.filter(e => e.status === 'Waiting' || e.status === 'Up Next');
            setPeopleWaiting(relevantEntries.length);

            const now = Date.now();

            // --- THE NEW LOGIC ---
            const dbWaitMinutes = peopleAheadNew.reduce((sum, entry) => {
            const duration = entry.services?.duration_minutes || 30;
            const heads = entry.head_count || 1; // <--- Get group size
            const totalDuration = duration * heads; // <--- Multiply!

            // If In Progress, we assume (Total Duration - Time Elapsed)
            if (entry.status === 'In Progress' && entry.updated_at) {
                const startTime = new Date(entry.updated_at).getTime();
                const minutesElapsed = (now - startTime) / 60000;
                const minutesRemaining = Math.max(5, totalDuration - minutesElapsed);
                return sum + minutesRemaining;
            }

            // If waiting, add full duration
            return sum + totalDuration;
        }, 0);
            // ---------------------

            const calculatedTarget = now + (dbWaitMinutes * 60000);

            // Logic Split: Browsing vs Joined
            if (!myQueueEntryId) {
                // Browsing: Update strictly based on the new "Time-Adjusted" math
                setFinishTime(calculatedTarget);
            } 
            else {
                // Joined: Apply "Stickiness" to prevent minor jitters
                const storedTarget = localStorage.getItem('targetFinishTime');
                let currentTarget = storedTarget ? parseInt(storedTarget, 10) : 0;

                // Update if: No target, Old target passed, or New calculation is FASTER
                if (!currentTarget || currentTarget < now || calculatedTarget < currentTarget) {
                    currentTarget = calculatedTarget;
                    localStorage.setItem('targetFinishTime', currentTarget.toString());
                    setFinishTime(currentTarget);
                }
            }
            
            // Update UI Minutes
            const targetToUse = myQueueEntryId ? parseInt(localStorage.getItem('targetFinishTime') || calculatedTarget) : calculatedTarget;
            const remainingMins = Math.max(0, Math.ceil((targetToUse - now) / 60000));
            setDisplayWait(remainingMins);
        };
        
        if (liveQueue.length > 0 || myQueueEntryId) {
            calculateWaitTime();
        }
       
    }, [liveQueue, myQueueEntryId]);
    // ADD THIS ENTIRE BLOCK BACK
    useEffect(() => { // Modal Button Countdown
        let timerId = null;
        let countdownInterval = null;

        // We only check the modals that still exist
        if (isServiceCompleteModalOpen || isCancelledModalOpen || isTooFarModalOpen) {
            setIsModalButtonDisabled(true);
            setModalCountdown(5); // Set to 5 seconds

            timerId = setTimeout(() => {
                setIsModalButtonDisabled(false);
            }, 5000); // 5 seconds

            countdownInterval = setInterval(() => {
                setModalCountdown(prevCount => {
                    if (prevCount <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return prevCount - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerId) clearTimeout(timerId);
            if (countdownInterval) clearInterval(countdownInterval);
        };
    }, [isServiceCompleteModalOpen, isCancelledModalOpen, isTooFarModalOpen]); // Dependencies are only for the remaining modals

    // --- ADD THIS NEW BLOCK ---
    useEffect(() => { // UI Re-render Timer (Checks Timestamp)
        if (!myQueueEntryId) return;

        // Update the UI every 5 seconds to keep the minute accurate
        const timerId = setInterval(() => { 
            const storedTarget = localStorage.getItem('targetFinishTime');
            if (storedTarget) {
                const target = parseInt(storedTarget, 10);
                const now = Date.now();
                // Calculate remaining minutes based on Real Time
                const remaining = Math.max(0, Math.ceil((target - now) / 60000));
                setDisplayWait(remaining);
            }
        }, 5000); 

        return () => clearInterval(timerId);
    }, [myQueueEntryId]);
    // --- Render Customer View ---
// App.js (Inside function CustomerView({ session }) { ... })

return (
    <div className="card">
        {showIOSPrompt && <IOSInstallPrompt onClose={() => setShowIOSPrompt(false)} />}
        
        {/* Instructions Modal */}
        <div className="modal-overlay" style={{ display: isInstructionsModalOpen ? 'flex' : 'none' }}>
            <div className="modal-content instructions-modal">
                <div className="modal-body">
                    <h2>How to Join</h2>
                    <ol className="instructions-list">
                        <li>Select your <strong>Service</strong>.</li>
                        <li>Choose an <strong>Available Barber</strong>.</li>
                        <li>Click <strong>"Join Queue"</strong> and wait!</li>
                    </ol>
                </div>
                <div className="modal-footer">
                    <button onClick={handleCloseInstructions} className="btn btn-primary">Got It!</button>
                </div>
            </div>
        </div>
        
        {/* Service Complete Modal */}
        <div className="modal-overlay" style={{ display: isServiceCompleteModalOpen ? 'flex' : 'none' }}>
            <div className="modal-content">
                {!feedbackSubmitted ? (
                    <form className="feedback-form" onSubmit={async (e) => {
                        e.preventDefault();
                        if (customerRating === 0) { 
                            setMessage('Please select a star rating.'); 
                            return; 
                        }
                        if (feedbackText.trim().length < 1) { // Changed minLength to 1
                            setMessage('Please leave a short comment.'); 
                            return; 
                        }
                        
                        try { 
                            // API CALL: Sending both the required rating and required comment.
                            // The server will now use 'rating' directly for the score.
                            await axios.post(`${API_URL}/feedback`, { 
                                barber_id: joinedBarberId, 
                                customer_name: customerName, 
                                comments: feedbackText.trim(), // Required comment
                                rating: customerRating // Required star rating (1-5)
                            }); 
                        } catch (err) { 
                            console.error("Failed to submit feedback", err); 
                            setMessage('Failed to submit feedback.');
                        }
                        setFeedbackSubmitted(true);
                        setMessage(''); 
                    }}>
                        <div className="modal-body">
                            <h2>Service Complete!</h2>
                            <p>Thank you! Please rate your experience with **{currentBarberName}**:</p>
                            
                            {/* NEW: Star Rating Input */}
                            <div className="star-rating-input" style={{fontSize: '2rem', marginBottom: '15px'}}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <span 
                                        key={star}
                                        style={{cursor: 'pointer', color: star <= customerRating ? '#FFD700' : 'var(--text-secondary)'}}
                                        onClick={() => setCustomerRating(star)}
                                    >
                                        ★
                                    </span>
                                ))}
                            </div>
                            {/* END NEW STAR RATING INPUT */}

                            <textarea 
                                value={feedbackText} 
                                onChange={(e) => setFeedbackText(e.target.value)} 
                                placeholder="Leave optional comments... (e.g., great service!)"
                            />
                            {message && <p className="message error small">{message}</p>}
                        </div>
                        <div className="modal-footer">
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => { setFeedbackSubmitted(true); setCustomerRating(0); }} // Skip button action
                            >
                                Skip
                            </button>
                            <button type="submit" 
                                className="btn btn-primary" 
                                disabled={customerRating === 0 || feedbackText.trim().length < 5}>
                                Submit Rating
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <div className="modal-body"><h2>Feedback Sent!</h2><p>Thank you for visiting!</p></div>
                        <div className="modal-footer">
                            <button id="close-complete-modal-btn" onClick={() => handleReturnToJoin(false)} disabled={isModalButtonDisabled} className="btn btn-primary">
                                {isModalButtonDisabled ? `Please wait (${modalCountdown})...` : 'Okay'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>

        {/* Cancelled Modal */}
        <div className="modal-overlay" style={{ display: isCancelledModalOpen ? 'flex' : 'none' }}>
            <div className="modal-content">
                <div className="modal-body"><h2>Appointment Cancelled</h2><p>Your queue entry was cancelled.</p></div>
                <div className="modal-footer">
                    <button id="close-cancel-modal-btn" onClick={() => handleReturnToJoin(false)} disabled={isModalButtonDisabled} className="btn btn-primary">
                        {isModalButtonDisabled ? `Please wait (${modalCountdown})...` : 'Okay'}
                    </button>
                </div>
            </div>
        </div>
        
        {/* Too Far Modal */}
        <div className="modal-overlay" style={{ display: isTooFarModalOpen ? 'flex' : 'none' }}>
            <div className="modal-content">
                <div className="modal-body"><h2>A Friendly Reminder!</h2><p>Hey, please don’t wander off too far...</p></div>
                <div className="modal-footer">
                    <button id="close-too-far-modal-btn" onClick={() => {
                        setIsTooFarModalOpen(false);
                        localStorage.removeItem('stickyModal');
                        console.log("Cooldown started.");
                        setTimeout(() => { console.log("Cooldown finished."); setIsOnCooldown(false); }, 300000);
                    }}
                    className="btn btn-primary"
                    >
                        {isModalButtonDisabled ? `Please wait (${modalCountdown})...` : "Okay, I'll stay close"}
                    </button>
                </div>
            </div>
        </div>

        {/* VIP Modal */}
        <div className="modal-overlay" style={{ display: isVIPModalOpen ? 'flex' : 'none' }}>
            <div className="modal-content">
                <div className="modal-body">
                    <h2>Priority Service Confirmation</h2>
                    {selectedServiceId && services.find(s => s.id.toString() === selectedServiceId) ? (
                        <p>You have selected <strong>{services.find(s => s.id.toString() === selectedServiceId).name}</strong>. This VIP priority service incurs an <strong>additional ₱100</strong> fee, guaranteeing you the next "Up Next" slot.</p>
                    ) : (
                        <p>VIP priority service incurs an <strong>additional ₱100</strong> fee, guaranteeing you the next "Up Next" slot. Please ensure you have selected a service.</p>
                    )}
                    {!selectedServiceId && <p className="error-message small">Please select a service first.</p>}
                </div>
                <div className="modal-footer">
                     <button onClick={cancelVIP} className="btn btn-secondary">Cancel VIP</button>
                    <button onClick={confirmVIP} disabled={!selectedServiceId} className="btn btn-primary">Confirm (+₱100)</button>
                </div>
            </div>
        </div>
        
        {/* --- MAIN CONTENT START --- */}
        
        {/* 1. View Toggle Tabs */}
        <div className="card-header customer-view-tabs">
            <button className={viewMode === 'join' ? 'active' : ''} onClick={() => setViewMode('join')}>
                Join Queue
            </button>
            <button className={viewMode === 'appointments' ? 'active' : ''} onClick={() => setViewMode('appointments')}>
                Appointments
            </button>
            <button className={viewMode === 'history' ? 'active' : ''} onClick={() => setViewMode('history')}>
                My History
            </button>
        </div>

        {/* A. JOIN / BOOKING SECTION */}
        {viewMode === 'join' && !myQueueEntryId && (
            <div className="card-body">
                {/* 1. SUB-TABS: NOW vs LATER */}
                <div className="customer-view-tabs" style={{marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}>
                    <button 
                        className={joinMode === 'now' ? 'active' : ''} 
                        onClick={() => setJoinMode('now')}
                        style={{flex: 1, textAlign: 'center'}}
                    >
                        ⚡ Join Queue Now
                    </button>
                    <button 
                        className={joinMode === 'later' ? 'active' : ''} 
                        onClick={() => setJoinMode('later')}
                        style={{flex: 1, textAlign: 'center'}}
                    >
                        📅 Book Appointment
                    </button>
                </div>

                {/* 2. SHARED INPUTS (Name, Email) */}
                <div className="form-group"><label>Your Name:</label><input type="text" value={customerName} required readOnly className="prefilled-input" /></div>
                <div className="form-group"><label>Your Email:</label><input type="email" value={customerEmail} readOnly className="prefilled-input" /></div>

                {/* --- OPTION A: JOIN NOW FORM (Full Logic) --- */}
                {joinMode === 'now' && (
                    <form onSubmit={handleJoinQueue}>
                        <div className="form-group"><label>Select Service:</label><select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} required><option value="">-- Choose service --</option>{services.map((service) => (<option key={service.id} value={service.id}>{service.name} ({service.duration_minutes} min / ₱{service.price_php})</option>))}</select></div>
                        <div className="form-group">
                            <label>Group Size (Number of Heads):</label>
                            
                            {/* --- NEW STEPPER UI --- */}
                            <div className="stepper-wrapper">
                                <button 
                                    type="button" 
                                    className="btn-stepper"
                                    onClick={() => setHeadCount(prev => Math.max(1, prev - 1))}
                                >
                                    −
                                </button>
                                <span className="stepper-count">{headCount}</span>
                                <button 
                                    type="button" 
                                    className="btn-stepper"
                                    onClick={() => setHeadCount(prev => prev + 1)}
                                >
                                    +
                                </button>
                            </div>
                            
                            {/* --- DYNAMIC INFO / WARNING --- */}
                            <div style={{marginTop: '10px'}}>
                                {headCount > 1 ? (
                                    <div className="message warning small" style={{textAlign:'left'}}>
                                        <strong style={{display:'block', marginBottom:'4px'}}>👥 Group Booking Details:</strong>
                                        <ul style={{margin:0, paddingLeft:'20px'}}>
                                            <li>This will book <strong>{headCount} slots</strong> back-to-back.</li>
                                            <li>
                                                Total Duration: <strong>
                                                    {services.find(s => s.id.toString() === selectedServiceId)?.duration_minutes * headCount || 0} mins
                                                </strong>.
                                            </li>
                                            <li style={{color: 'var(--error-color)', fontWeight: 'bold', marginTop:'5px'}}>
                                                Note: Everyone must get the same service. 
                                                <span style={{fontWeight:'normal', color:'var(--text-primary)'}}> If guests want different services, please join the queue individually.</span>
                                            </li>
                                        </ul>
                                    </div>
                                ) : (
                                    <p className="message small">Booking for 1 person.</p>
                                )}
                            </div>
                        </div>
                        {/* VIP Toggle */}
                        {selectedServiceId && (
                            <div className="form-group vip-toggle-group">
                                <label>Service Priority:</label>
                                <div className="priority-toggle-control">
                                    <button type="button" className={`priority-option ${!isVIPToggled ? 'active' : ''}`} onClick={() => setIsVIPToggled(false)}>No Priority</button>
                                    <button type="button" className={`priority-option ${isVIPToggled ? 'active vip' : ''}`} onClick={() => handleVIPToggle({ target: { checked: true } })} disabled={isVIPToggled}>VIP Priority (+₱100)</button>
                                </div>
                                {isVIPToggled && (<p className="success-message small">VIP Priority is active. You will be placed Up Next.</p>)}
                            </div>
                        )}
                        
                        {/* Photo Upload */}
                        <div className="form-group photo-upload-group">
                            <label>Desired Haircut Photo (Optional):</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} id="file-upload" className="file-upload-input" />
                            <label htmlFor="file-upload" className="btn btn-secondary btn-icon-label file-upload-label"><IconUpload />{selectedFile ? selectedFile.name : 'Choose a file...'}</label>
                            <button type="button" onClick={() => handleUploadPhoto(null)} disabled={!selectedFile || isUploading || referenceImageUrl} className="btn btn-secondary btn-icon-label">
                                {isUploading ? <Spinner /> : <IconUpload />}
                                {isUploading ? 'Uploading...' : (referenceImageUrl ? 'Photo Attached' : 'Upload Photo')}
                            </button>
                            {referenceImageUrl && <p className="success-message small">Photo ready. <a href={referenceImageUrl} target="_blank" rel="noopener noreferrer">View Photo</a></p>}
                        </div>

                        {/* Barber Selection */}
                        <div className="form-group">
                            <label>Select Available Barber:</label>
                            {barbers.length > 0 ? (
                                <div className="barber-selection-list">
                                    {barbers.map((barber) => (
                                        <button type="button" key={barber.id} className={`barber-card ${selectedBarberId === barber.id.toString() ? 'selected' : ''}`} onClick={() => setSelectedBarberId(barber.id.toString())}>
                                            <span className="barber-name">{barber.full_name}</span>
                                            <div className="barber-rating">
                                                <span className="star-icon">⭐</span>
                                                <span className="score-text">{parseFloat(barber.average_score).toFixed(1)}</span>
                                                <span className="review-count">({barber.review_count})</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (<p className="empty-text">No barbers are available right now.</p>)}
                            <input type="hidden" value={selectedBarberId} required />
                        </div>

                        {/* Feedback List */}
                        {selectedBarberId && (<div className="feedback-list-container customer-feedback">
                            <h3 className="feedback-subtitle">Recent Feedback</h3>
                            <ul className="feedback-list">
                                {barberFeedback.length > 0 ? (barberFeedback.map((item, index) => (
                                    <li key={index} className="feedback-item">
                                        <div className="feedback-header">
                                            <span className="feedback-score" style={{fontSize: '1.2rem', lineHeight: '1'}}>
                                                <span style={{color: '#FFD700'}}>
                                                    {'★'.repeat(Math.round(Math.max(0, Math.min(5, item.score || 0))))}
                                                </span>
                                                <span style={{color: 'var(--text-secondary)'}}>
                                                    {'☆'.repeat(5 - Math.round(Math.max(0, Math.min(5, item.score || 0))))}
                                                </span>
                                            </span>
                                            <span className="feedback-customer">
                                                {item.customer_name || 'Customer'}
                                            </span>
                                        </div>
                                        {item.comments && <p className="feedback-comment">"{item.comments}"</p>}
                                    </li>
                                ))) : (<p className="empty-text">No feedback yet for this barber.</p>)}</ul></div>)}

                        {/* EWT Display */}
                        {isQueueLoading && selectedBarberId ? (<div className="ewt-container skeleton-ewt"><SkeletonLoader height="40px" /></div>) : (selectedBarberId && (<div className="ewt-container">
                            <div className="ewt-item"><span>Currently waiting</span><strong>{peopleWaiting} {peopleWaiting === 1 ? 'person' : 'people'}</strong></div>
                            <div className="ewt-item"><span>Expected Time</span><strong>{finishTime > 0 ? new Date(finishTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Calculating...'}</strong></div>
                        </div>))}

                        {isIOsDevice() && (<p className="message warning small"><b>iPhone Users:</b> Push alerts and sounds are not supported. Please keep this tab open and watch your email for notifications!</p>)}
                        
                        <button type="submit" disabled={isLoading || !selectedBarberId || barbers.length === 0 || isUploading} className="btn btn-primary btn-full-width" style={{marginTop: '20px'}}>
                            {isLoading ? <Spinner /> : 'Join Queue Now'}
                        </button>
                    </form>
                )}

                {/* --- OPTION B: BOOK LATER FORM (New Logic) --- */}
                {joinMode === 'later' && (
                    <form onSubmit={handleBooking}>
                        <div className="form-group"><label>Select Service:</label><select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} required><option value="">-- Choose service --</option>{services.map((service) => (<option key={service.id} value={service.id}>{service.name} ({service.duration_minutes} min / ₱{service.price_php})</option>))}</select></div>

                        <div className="form-group">
                            <label>Select Barber:</label>
                            <select value={selectedBarberId} onChange={(e) => setSelectedBarberId(e.target.value)} required>
                                <option value="">-- Choose Barber --</option>
                                {barbers.map(b => (
                                    <option key={b.id} value={b.id}>{b.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Select Date:</label>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                min={getTomorrowDate()}   // <--- CHANGE THIS PART
                                onChange={e => setSelectedDate(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>Available Time Slots:</label>
                            {!selectedBarberId || !selectedServiceId ? (
                                <p className="message small">Select a Service and Barber to see times.</p>
                            ) : (
                                <div className="slots-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', marginTop: '10px'}}>
                                    {availableSlots.length > 0 ? availableSlots.map(slot => (
                                        <button 
                                            type="button" 
                                            key={slot} 
                                            className={`btn ${selectedSlot === slot ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setSelectedSlot(slot)}
                                            style={{fontSize: '0.8rem', padding: '8px'}}
                                        >
                                            {new Date(slot).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </button>
                                    )) : (
                                        <p className="empty-text" style={{gridColumn: '1/-1'}}>No slots available for this date.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <button type="submit" disabled={isLoading || !selectedSlot} className="btn btn-primary btn-full-width" style={{marginTop: '20px'}}>
                            {isLoading ? <Spinner /> : 'Confirm Booking'}
                        </button>
                    </form>
                )}
                
                {/* FIX: improved message coloring logic */}
                {message && (
                    <p className={`message ${/failed|error|required|taken|invalid|missing|please|cannot/i.test(message) ? 'error' : 'success'}`}>
                        {message}
                    </p>
                )}
            </div>
        )}

        {/* B. LIVE QUEUE VIEW (SHOWS WHEN IN JOIN MODE AND IN QUEUE) */}
        {viewMode === 'join' && myQueueEntryId && (
            <div className="live-queue-view card-body">
                {/* --- YOUR LIVE QUEUE CONTENT GOES HERE --- */}
                {myQueueEntry?.status === 'In Progress' && (<div className="status-banner in-progress-banner"><h2><IconCheck /> It's Your Turn!</h2><p>The barber is calling you now.</p></div>)}
                {myQueueEntry?.status === 'Up Next' && (<div className={`status-banner up-next-banner ${myQueueEntry.is_confirmed ? 'confirmed-pulse' : ''}`}>
                    <h2><IconNext /> You're Up Next!</h2>
                    {optimisticMessage ? (<p className="success-message small" style={{textAlign: 'center'}}>{optimisticMessage}</p>) : (!myQueueEntry.is_confirmed ? (
                        <>
                            <p>Please confirm you are ready to take the chair.</p>
                            <button className="btn btn-primary btn-full-width" style={{ marginTop: '10px' }} onClick={async () => {
                                setOptimisticMessage("Sending confirmation...");
                                try {
                                    await axios.put(`${API_URL}/queue/confirm`, { queueId: myQueueEntryId });
                                    setOptimisticMessage("✅ Confirmation Sent! Head to the shop.");
                                    setTimeout(() => {
                                        fetchPublicQueue(joinedBarberId);
                                        setOptimisticMessage(null);
                                    }, 1500);
                                } catch (err) {
                                    setOptimisticMessage(null);
                                    console.error("Confirm failed", err);
                                    setMessage("Error: Could not confirm attendance. Please try again.");
                                }
                            }}>I'm Coming! 🏃‍♂️</button>
                        </>
                    ) : (<p><strong>✅ Confirmed!</strong> The barber knows you are coming. Please enter the shop now.</p>))}
                </div>)}
                {/* OPPORTUNITY BANNER */}
                {freeBarber && (
                    <div style={{
                        background: 'linear-gradient(45deg, #ff9500, #ffcc00)',
                        color: 'black',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        boxShadow: '0 4px 15px rgba(255, 149, 0, 0.3)',
                        animation: 'pulse-border 2s infinite' // Reuse your existing animation
                    }}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px'}}>
                            <span style={{fontSize: '1.5rem'}}>⚡</span>
                            <h3 style={{margin: 0, fontSize: '1.1rem', fontWeight: '800'}}>Faster Seat Available!</h3>
                        </div>
                        <p style={{margin: '0 0 10px 0', fontSize: '0.9rem'}}>
                            <strong>{freeBarber.full_name}</strong> is free right now.
                        </p>
                        <button 
                            onClick={handleSelfTransfer}
                            className="btn"
                            style={{
                                background: 'black',
                                color: '#ff9500',
                                border: 'none',
                                fontWeight: 'bold',
                                width: '100%'
                            }}
                        >
                            Switch to {freeBarber.full_name}
                        </button>
                    </div>
                )}
                <h2>Live Queue for {joinedBarberId ? currentBarberName : '...'}</h2>
                <div className="queue-number-display">
                    Your Queue Number is: 
                    <strong>#{liveQueue.find(e => e.id.toString() === myQueueEntryId)?.daily_number || myQueueEntryId}</strong>
                </div>
                <div className="current-serving-display">
                    <div className="serving-item now-serving"><span>Now Serving</span><strong>{nowServing ? `Customer #${nowServing.id}` : '---'}</strong></div>
                    <div className="serving-item up-next"><span>Up Next</span><strong>{upNext ? `Customer #${upNext.id}` : '---'}</strong></div>
                </div>
                {queueMessage && <p className="message error">{queueMessage}</p>}
                <div className="ewt-container">
                    <div className="ewt-item"><span>Currently waiting</span><strong>{peopleWaiting} {peopleWaiting === 1 ? 'person' : 'people'}</strong></div>
                    <div className="ewt-item"><span>Expected Time</span><strong>{finishTime > 0 ? new Date(finishTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Calculating...'}</strong></div>
                </div>
                <ul className="queue-list live">
                    {isQueueLoading ? (
                        <>
                            <li className="skeleton-li"><SkeletonLoader height="25px" /></li>
                            <li className="skeleton-li"><SkeletonLoader height="25px" /></li>
                            <li className="skeleton-li"><SkeletonLoader height="25px" /></li>
                        </>
                    ) : (!isQueueLoading && liveQueue.length === 0 && !queueMessage ? (
                        <li className="empty-text">Queue is empty.</li>
                    ) : (
                        liveQueue.map((entry, index) => {
                            // --- GHOST SLOT RENDER ---
                            if (entry.is_ghost) {
                                return (
                                    <li key={entry.id} className="queue-item ghost-slot" style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 10px'}}>
                                        <div className="queue-item-info">
                                            <span style={{color:'var(--text-secondary)', marginRight:'5px'}}>{index + 1}.</span>
                                            <strong style={{color:'var(--text-secondary)'}}>📅 {entry.display_time} - Reserved</strong>
                                        </div>
                                        <span className="status-badge" style={{
                                            background:'rgba(128, 128, 128, 0.1)', 
                                            color:'var(--text-secondary)', 
                                            border:'1px solid var(--border-color)',
                                            fontSize:'0.75rem',
                                            padding:'2px 8px',
                                            borderRadius:'4px'
                                        }}>
                                            Booked
                                        </span>
                                    </li>
                                );
                            }

                            // --- STANDARD ENTRY RENDER ---
                            return (
                                <li key={entry.id} className={`${entry.id.toString() === myQueueEntryId ? 'my-position' : ''} ${entry.status === 'Up Next' ? 'up-next-public' : ''} ${entry.status === 'In Progress' ? 'in-progress-public' : ''} ${entry.is_vip ? 'vip-entry' : ''}`}>
                                    <div className="queue-item-info">
                                        <span>{index + 1}. </span>
                                        {entry.id.toString() === myQueueEntryId ? (
                                            <strong>You ({entry.customer_name})</strong>
                                        ) : (
                                            <span>{entry.customer_name}</span>
                                        )}
                                    </div>
                                    <span className="public-queue-status">{entry.status}</span>
                                </li>
                            );
                        })
                    ))}
                </ul>
                    <div className="live-queue-actions">
                    {isQueueUpdateAllowed && (<div className="form-group photo-upload-group live-update-group">
                        <label>Update Haircut Photo:</label>
                        <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} id="file-upload-update" className="file-upload-input" />
                        <label htmlFor="file-upload-update" className="btn btn-secondary btn-icon-label file-upload-label"><IconUpload />{selectedFile ? selectedFile.name : 'Choose a file...'}</label>
                        <button type="button" onClick={() => handleUploadPhoto(myQueueEntryId)} disabled={!selectedFile || isUploading} className="btn btn-secondary btn-icon-label">
                            {isUploading ? <Spinner /> : <IconUpload />}
                            {isUploading ? 'Uploading...' : 'Replace Photo'}
                        </button>
                        {myQueueEntry?.reference_image_url && <p className="success-message small">Current Photo: <a href={myQueueEntry.reference_image_url} target="_blank" rel="noopener noreferrer">View</a></p>}
                        {referenceImageUrl && referenceImageUrl !== myQueueEntry?.reference_image_url && <p className="success-message small">New photo uploaded.</p>}
                    </div>)}
                    <div className="chat-section">
                        {!isChatOpen && myQueueEntryId && (<button onClick={() => {
                            if (currentChatTargetBarberUserId) {
                                setIsChatOpen(true);
                                setHasUnreadFromBarber(false);
                                localStorage.removeItem('hasUnreadFromBarber');
                            } else { console.error("Barber user ID missing."); setMessage("Cannot initiate chat."); }
                        }} className="btn btn-secondary btn-full-width btn-icon-label chat-toggle-button">
                            <IconChat />Chat with Barber{hasUnreadFromBarber && (<span className="notification-badge"></span>)}</button>)}
                        {isChatOpen && currentChatTargetBarberUserId && (
                            <div className="chat-window-container">
                                <div className="chat-window-header">
                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        <h4>Chat with {currentBarberName}</h4>

                                        {/* --- REPORT BUTTON HERE --- */}
                                        <button 
                                            onClick={() => setReportModalOpen(true)} 
                                            className="btn btn-danger btn-icon" 
                                            title="Report Issue / Help"
                                            style={{padding: '2px', width: '24px', height: '24px'}} // Make it small
                                        >
                                            ❓
                                        </button>
                                    </div>

                                    <button onClick={() => setIsChatOpen(false)} className="btn btn-icon btn-close-chat" title="Close Chat">
                                        <IconX />
                                    </button>
                                </div>

                                <ChatWindow 
                                    currentUser_id={session.user.id} 
                                    otherUser_id={currentChatTargetBarberUserId} 
                                    messages={chatMessagesFromBarber} 
                                    onSendMessage={sendCustomerMessage} 
                                />

                                {/* --- ADD MODAL HERE --- */}
                                <ReportModal 
                                    isOpen={isReportModalOpen} 
                                    onClose={() => setReportModalOpen(false)}
                                    reporterId={session.user.id}
                                    reportedId={currentChatTargetBarberUserId}
                                    userRole="customer" 
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className="danger-zone">
                    <button 
                        onClick={() => {
                            // CONFIRMATION DIALOG ADDED HERE
                            if (window.confirm("Are you sure? You will lose your spot in line and have to start over!")) {
                                handleReturnToJoin(true);
                            }
                        }} 
                        disabled={isLoading} 
                        className='btn btn-danger btn-full-width'
                    >
                        {isLoading ? <Spinner /> : 'Leave Queue / Join Another'}
                    </button>
                </div>
            </div>
        )}

        {/* C. HISTORY VIEW */}
        {viewMode === 'history' && (
            <div className="card-body history-view">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
                    <h2 style={{margin: 0}}>My Past Services</h2>
                    <button 
                        onClick={() => setIsMyReportsOpen(true)} 
                        className="btn btn-secondary" 
                        style={{fontSize:'0.85rem', padding:'6px 12px'}}
                    >
                        ⚠️ My Reports
                    </button>
                </div>
                {loyaltyHistory.length === 0 ? (
                    <p className="empty-text">No past services found. Book your first cut!</p>
                ) : (
                    <ul className="history-list">
                        {loyaltyHistory.map((entry, index) => {
                            const statusClass = entry.status === 'Done' ? 'done' : 'cancelled';
                            const servicePrice = entry.services?.price_php || 'N/A';
                            const barberName = entry.barber_profiles?.full_name || 'Unrecorded Barber';

                            return (
                                <li key={index} className={`history-item ${statusClass}`}>
                                    <div className="history-details">
                                        <span className="date">
                                            {new Date(entry.created_at).toLocaleDateString()}
                                        </span>
                                        <span className="service">
                                            {entry.services?.name || 'Unknown Service'}
                                        </span>
                                        
                                        {/* NEW: Display Sanitized Star Rating for Done entries */}
                                        {entry.status === 'Done' && entry.score !== null && (
                                            <span className="rating-display" style={{ /* ... */ }}>
                                                {/* Line 2452 (or similar): Use entry.score for filled stars */}
                                                <span style={{color: '#FFD700'}}>
                                                    {'★'.repeat(Math.round(Math.max(0, Math.min(5, entry.score || 0))))} 
                                                </span>
                                                
                                                {/* Line 2455 (or similar): Use entry.score for empty stars */}
                                                <span style={{color: 'var(--text-secondary)'}}>
                                                    {'☆'.repeat(5 - Math.round(Math.max(0, Math.min(5, entry.score || 0))))}
                                                </span>
                                            </span>
                                        )}
                                        {/* END NEW SANITIZED STAR RENDERING */}
                                        
                                        {entry.is_vip && (
                                            <span className="status-badge" style={{ 
                                                backgroundColor: 'rgba(255, 149, 0, 0.3)', 
                                                color: 'var(--primary-orange)', 
                                                border: '1px solid var(--primary-orange)', 
                                                marginLeft: '8px'
                                            }}>
                                                VIP
                                            </span>
                                        )}
                                        <span className="status-badge">
                                            {entry.status}
                                        </span>
                                    </div>
                                    {/* FIX: Display Comment if it exists */}
                                    {entry.comments && entry.comments.trim().length > 0 && (
                                        <p className="feedback-comment" style={{paddingLeft: '0', fontStyle: 'normal', marginTop: '5px', color: 'var(--text-primary)'}}>
                                            Comment: "{entry.comments}"
                                        </p>
                                    )}
                                    <div className="history-meta">
                                        <span className="barber-name">
                                            {barberName}
                                        </span>
                                        <span className="amount">
                                            ₱{servicePrice}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        )}
        {/* D. APPOINTMENTS VIEW */}
        {viewMode === 'appointments' && (
            <div className="card-body">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h2 style={{margin:0}}>My Bookings</h2>
                    <button onClick={fetchMyAppointments} className="btn btn-secondary btn-icon" title="Refresh">
                        <IconRefresh />
                    </button>
                </div>

                {myAppointments.length === 0 ? (
                    <p className="empty-text">No upcoming appointments found.</p>
                ) : (
                    <ul className="queue-list">
                        {myAppointments.map((appt) => {
                            const dateObj = new Date(appt.scheduled_time);
                            const isPast = dateObj < new Date();
                            // Determine Badge Color
                            let statusColor = 'var(--text-secondary)';
                            let statusBg = 'rgba(0,0,0,0.05)';
                            
                            if (appt.is_converted_to_queue) {
                                statusColor = '#007aff'; // Blue
                                statusBg = 'rgba(0,122,255,0.1)';
                            } else if (appt.status === 'confirmed') {
                                statusColor = 'var(--success-color)';
                                statusBg = 'rgba(52,199,89,0.1)';
                            } else if (appt.status === 'pending') {
                                statusColor = 'var(--primary-orange)';
                                statusBg = 'rgba(255,149,0,0.1)';
                            } else if (appt.status === 'cancelled') {
                                statusColor = 'var(--error-color)';
                                statusBg = 'rgba(255,59,48,0.1)';
                            }

                            return (
                                <li key={appt.id} style={{
                                    opacity: isPast && !appt.is_converted_to_queue ? 0.6 : 1, 
                                    borderLeft: `4px solid ${statusColor}`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '5px'
                                }}>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <strong style={{fontSize:'1.1rem'}}>
                                            {dateObj.toLocaleDateString([], {weekday: 'short', month:'short', day:'numeric'})}
                                        </strong>
                                        <span style={{
                                            color: statusColor, 
                                            background: statusBg, 
                                            padding: '2px 8px', 
                                            borderRadius: '4px', 
                                            fontSize: '0.8rem', 
                                            fontWeight:'bold',
                                            textTransform: 'uppercase'
                                        }}>
                                            {appt.is_converted_to_queue ? 'Live in Queue' : appt.status}
                                        </span>
                                    </div>
                                    
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.95rem'}}>
                                        <span>🕒 {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        <span>✂️ {appt.services?.name || 'Service'}</span>
                                    </div>
                                    
                                    <div style={{fontSize:'0.9rem', color:'var(--text-secondary)'}}>
                                        Barber: <strong>{appt.barber_profiles?.full_name || 'Any'}</strong>
                                    </div>

                                    {appt.is_converted_to_queue && (
                                        <small style={{color: 'var(--link-color)', marginTop:'5px'}}>
                                            * This booking has been moved to the Live Queue.
                                        </small>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        )}
        <MyReportsModal 
                isOpen={isMyReportsOpen} 
                onClose={() => setIsMyReportsOpen(false)} 
                userId={session.user.id} 
            />
    </div>
);
}


// ##############################################
// ##           BARBER APP LAYOUT            ##
// ##############################################
function BarberAppLayout({ session, barberProfile, setBarberProfile }) {
    const [refreshAnalyticsSignal, setRefreshAnalyticsSignal] = useState(0);
    const [isMyReportsOpen, setIsMyReportsOpen] = useState(false);

    const handleCutComplete = useCallback(() => {
        setRefreshAnalyticsSignal(prev => prev + 1);
    }, []);

    return (
        <div className="app-layout barber-app-layout">
            <header className="app-header">
                <h1>Welcome, {barberProfile.full_name}!</h1>
                <div className="header-actions">
                    <AvailabilityToggle
                        barberProfile={barberProfile}
                        session={session}
                        onAvailabilityChange={(newStatus) => setBarberProfile(prev => ({ ...prev, is_available: newStatus }))}
                    />
                    <ThemeToggleButton />
                    <button
                        onClick={() => handleLogout(session.user.id)}
                        className="btn btn-icon"
                        title="Logout"
                    >
                        <IconLogout />
                    </button>
                </div>
            </header>
            <main className="main-content">
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
            </main>
                <MyReportsModal 
                    isOpen={isMyReportsOpen} 
                    onClose={() => setIsMyReportsOpen(false)} 
                    userId={session.user.id} 
                />
        </div>
    );
}

function AdminAppLayout({ session }) {
    // Added 'staff' to tabs
    const [activeTab, setActiveTab] = useState('live'); // 'live', 'stats', 'users', 'menu', 'staff'
    
    // Data States
    const [allQueues, setAllQueues] = useState([]);
    const [barbers, setBarbers] = useState([]);
    const [transferMode, setTransferMode] = useState(null);
    const [advancedStats, setAdvancedStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [services, setServices] = useState([]);
    const [isEditingService, setIsEditingService] = useState(null);

    // --- FETCHERS ---

    // IN AdminAppLayout -> ReportsView Component
    // IN AdminAppLayout -> ReportsView Component
    const ReportsView = () => {
        const [reports, setReports] = useState([]);
        // NEW: State to track notes for each specific report ID
        const [adminNotes, setAdminNotes] = useState({}); 
        
        const fetchReports = async () => {
            try {
                const res = await axios.get(`${API_URL}/admin/reports`);
                setReports(res.data);
            } catch (error) {
                console.error("Failed to load reports", error);
            }
        };

        useEffect(() => { fetchReports(); }, []);

        const handleAction = async (reportId, targetId, action) => {
            const note = adminNotes[reportId] || ''; // Get the note for this specific report
            
            // Confirm action with the admin
            if(!window.confirm(`Are you sure you want to ${action.toUpperCase()} this user?`)) return;
            
            try {
                // Send the action AND the note to the backend
                await axios.put(`${API_URL}/admin/reports/resolve`, { 
                    reportId, 
                    targetUserId: targetId, 
                    action,
                    adminNotes: note 
                });
                
                alert(`Action taken: ${action}`);
                
                // Clear the note from state and refresh list
                setAdminNotes(prev => {
                    const newState = { ...prev };
                    delete newState[reportId];
                    return newState;
                });
                fetchReports();
            } catch (error) {
                alert("Failed to process report.");
            }
        };

        // Helper to update notes state
        const handleNoteChange = (id, text) => {
            setAdminNotes(prev => ({ ...prev, [id]: text }));
        };

        return (
            <div className="card">
                <div className="card-header"><h2>🚨 Incident Reports</h2></div>
                <div className="card-body">
                    {reports.length === 0 ? <p className="empty-text">No active reports.</p> : (
                        <ul className="queue-list">
                            {reports.map(r => (
                                <li key={r.id} style={{
                                    display:'block', 
                                    border: r.status === 'Pending' ? '1px solid var(--error-color)' : '1px solid var(--border-color)',
                                    marginBottom: '15px',
                                    padding: '15px'
                                }}>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                                        <strong style={{fontSize: '1.1rem'}}>{r.reason}</strong>
                                        <span className={`status-badge`} style={{
                                            background: r.status==='Pending'?'var(--error-color)':'var(--success-color)',
                                            color: '#fff', padding: '4px 8px', borderRadius: '4px'
                                        }}>
                                            {r.status}
                                        </span>
                                    </div>
                                    
                                    <p style={{fontSize:'0.9rem', color:'var(--text-secondary)', marginBottom: '10px'}}>
                                        <strong>{r.reporter?.full_name || 'Unknown'}</strong> reported <strong>{r.reported?.full_name || 'Unknown'}</strong>
                                    </p>
                                    
                                    <div style={{
                                        background:'var(--bg-dark)', 
                                        padding:'12px', 
                                        borderRadius:'6px', 
                                        fontStyle:'italic',
                                        borderLeft: '3px solid var(--primary-orange)',
                                        marginBottom: '15px'
                                    }}>
                                        "{r.description}"
                                    </div>

                                    {/* --- NEW: Display Proof Image --- */}
                                    {r.proof_image_url && (
                                        <div style={{marginBottom: '15px'}}>
                                            <strong style={{fontSize: '0.85rem', color:'var(--text-secondary)'}}>Attached Proof:</strong>
                                            <br />
                                            <a href={r.proof_image_url} target="_blank" rel="noopener noreferrer">
                                                <img 
                                                    src={r.proof_image_url} 
                                                    alt="Report Proof" 
                                                    style={{maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', marginTop: '5px', border:'1px solid var(--border-color)'}} 
                                                />
                                            </a>
                                        </div>
                                    )}
                                    
                                    {/* NEW: Display Admin Notes if resolved */}
                                    {r.status !== 'Pending' && r.admin_notes && (
                                        <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                            <strong>Admin Note:</strong> {r.admin_notes}
                                        </p>
                                    )}

                                    {/* Action Area (Only for Pending Reports) */}
                                    {r.status === 'Pending' && (
                                        <div style={{marginTop:'10px'}}>
                                            {/* NEW: Admin Note Input Area */}
                                            <textarea 
                                                placeholder="Enter resolution notes here (e.g., 'Verified via CCTV', 'First warning')..." 
                                                value={adminNotes[r.id] || ''}
                                                onChange={(e) => handleNoteChange(r.id, e.target.value)}
                                                style={{
                                                    width: '100%', 
                                                    padding: '10px', 
                                                    marginBottom: '10px', 
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--bg-dark)',
                                                    color: 'var(--text-primary)',
                                                    minHeight: '60px'
                                                }}
                                            />
                                            
                                            <div style={{display:'flex', gap:'10px'}}>
                                                <button 
                                                    onClick={() => handleAction(r.id, r.reported_id, 'ban')} 
                                                    className="btn btn-danger btn-full-width"
                                                >
                                                    🔨 Ban User
                                                </button>
                                                <button 
                                                    onClick={() => handleAction(r.id, r.reported_id, 'dismiss')} 
                                                    className="btn btn-secondary btn-full-width"
                                                >
                                                    Dismiss Report
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {r.reported?.is_banned && (
                                        <p className="error-message small" style={{marginTop:'10px'}}>
                                            ⚠️ This user is currently BANNED.
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        );
    };

    const fetchLiveShop = useCallback(async () => {
        try {
            const [qRes, bRes] = await Promise.all([
                supabase.from('queue_entries').select('*, services(name)').in('status', ['Waiting', 'Up Next', 'In Progress']),
                axios.get(`${API_URL}/admin/barbers`) // This returns ALL barbers (active and inactive)
            ]);
            setAllQueues(qRes.data || []);
            setBarbers(bRes.data || []);
        } catch (e) { console.error(e); }
    }, []);

    const fetchAdvancedStats = useCallback(async () => {
        try { const res = await axios.get(`${API_URL}/admin/analytics/advanced`); setAdvancedStats(res.data); } catch (e) {}
    }, []);

    const fetchUsers = useCallback(async () => {
        try { 
            const res = await axios.get(`${API_URL}/admin/users`); 
            setUsers(res.data); 
        } catch (e) { 
            console.error("Failed to fetch users:", e);
            // Optional: Alert the admin so they know it failed
            // alert("Could not load user list. Check console for details.");
        }
    }, []);

    const fetchServices = useCallback(async () => {
        try { 
            // Use the ADMIN endpoint to get active AND archived services
            const res = await axios.get(`${API_URL}/admin/services`); 
            setServices(res.data); 
        } catch (e) { console.error(e); }
    }, []);

    const handleRestoreService = async (id) => {
        try {
            await axios.put(`${API_URL}/admin/services/${id}/restore`, { userId: session.user.id });
            fetchServices();
            alert("Service restored.");
        } catch (e) { alert("Restore failed."); }
    };

    // --- EFFECTS ---
    useEffect(() => {
        // Refresh live data every 5 seconds
        if (activeTab === 'live' || activeTab === 'staff') { 
            fetchLiveShop(); 
            const interval = setInterval(fetchLiveShop, 5000); 
            return () => clearInterval(interval); 
        }
        if (activeTab === 'stats') fetchAdvancedStats();
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'menu') fetchServices();
    }, [activeTab, fetchLiveShop, fetchAdvancedStats, fetchUsers, fetchServices]);

    // --- ACTIONS ---
    
    // 1. Service Management
    const handleSaveService = async (e) => {
        e.preventDefault();
        const form = e.target;
        const name = form.serviceName.value;
        const duration = form.serviceDuration.value;
        const price = form.servicePrice.value;

        // Frontend Validation
        if (duration < 5) return alert("Duration must be at least 5 minutes.");
        if (price < 0) return alert("Price cannot be negative.");

        try {
            const payload = { userId: session.user.id, name, duration_minutes: duration, price_php: price };
            
            if (isEditingService) {
                await axios.put(`${API_URL}/admin/services/${isEditingService.id}`, payload);
                alert("Service updated!");
                setIsEditingService(null);
            } else {
                await axios.post(`${API_URL}/admin/services`, payload);
                alert("Service added!");
            }
            form.reset();
            fetchServices();
        } catch (err) {
            alert("Action failed: " + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteService = async (id) => {
        if (!window.confirm("Are you sure? This will hide the service from the menu.")) return;
        try {
            await axios.delete(`${API_URL}/admin/services/${id}`, { data: { userId: session.user.id } });
            fetchServices(); // Refresh list
        } catch (err) { alert("Delete failed."); }
    };

    // 2. User Management
    const handleDeleteUser = async (targetId) => {
        const confirmText = prompt("WARNING: This action cannot be undone.\nType 'DELETE' to permanently ban/delete this user account.");
        if (confirmText !== 'DELETE') return;
        try {
            await axios.delete(`${API_URL}/admin/users/${targetId}`, { data: { userId: session.user.id } });
            alert("User deleted.");
            fetchUsers();
        } catch (e) { alert("Delete failed: " + (e.response?.data?.error || e.message)); }
    };

    // 3. Staff Management (Toggle Active/Inactive)
    const handleToggleBarberStatus = async (barberId, currentStatus) => {
        const newStatus = !currentStatus;
        const action = newStatus ? "ACTIVATE" : "DEACTIVATE";
        if (!window.confirm(`Are you sure you want to ${action} this barber?`)) return;

        try {
            await axios.put(`${API_URL}/admin/barbers/${barberId}/status`, {
                userId: session.user.id,
                is_active: newStatus
            });
            fetchLiveShop(); // Refresh barber list
        } catch (err) {
            alert("Update failed: " + (err.response?.data?.error || err.message));
        }
    };

    // 4. Transfer Logic
    const handleTransfer = async (targetBarberId) => {
        if (!transferMode) return;
        if (window.confirm(`Transfer this customer to Barber #${targetBarberId}?`)) {
            try {
                await axios.put(`${API_URL}/admin/transfer`, {
                    userId: session.user.id,
                    queueId: transferMode.queueId,
                    targetBarberId: targetBarberId
                });
                setTransferMode(null);
                fetchLiveShop();
            } catch (e) { alert("Transfer failed."); }
        }
    };

    // --- SUB-COMPONENTS ---

    const LiveShopView = () => (
        <div className="live-shop-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px'}}>
            {barbers.filter(b => b.is_active).map(barber => { // Only show active barbers in Live View
                const barberQueue = allQueues.filter(q => q.barber_id === barber.id);
                const inChair = barberQueue.find(q => q.status === 'In Progress');
                const waiting = barberQueue.filter(q => q.status === 'Waiting');
                return (
                    <div key={barber.id} className="card" style={{border: transferMode ? '2px dashed var(--primary-orange)' : '1px solid var(--border-color)'}}>
                        <div className="card-header" style={{padding:'10px', justifyContent: 'space-between'}}>
                            <div>
                                <h3 style={{fontSize:'1rem', margin:0}}>{barber.full_name}</h3>
                                <small style={{color: barber.is_available ? 'var(--success-color)' : 'var(--text-secondary)'}}>
                                    ● {barber.is_available ? 'Online' : 'Offline'}
                                </small>
                            </div>
                            {transferMode && transferMode.currentBarberId !== barber.id && (
                                <button onClick={() => handleTransfer(barber.id)} className="btn btn-primary" style={{fontSize:'0.8rem', padding:'4px 8px'}}>Select</button>
                            )}
                        </div>
                        <div className="card-body" style={{padding:'10px'}}>
                            {inChair ? <div style={{background:'rgba(52,199,89,0.1)', padding:'5px', borderRadius:'4px', marginBottom:'5px', fontSize:'0.9rem'}}>✂️ <strong>{inChair.customer_name}</strong></div> : <div style={{fontStyle:'italic', fontSize:'0.9rem', color:'var(--text-secondary)'}}>Chair Empty</div>}
                            <h4 style={{fontSize:'0.8rem', color:'var(--text-secondary)', margin:'10px 0 5px 0'}}>Waiting ({waiting.length})</h4>
                            <ul className="queue-list" style={{maxHeight:'150px', overflowY:'auto'}}>
                                {waiting.map(q => (
                                    <li key={q.id} className={q.is_vip ? 'vip-entry' : ''} style={{display:'flex', justifyContent:'space-between', padding:'5px', fontSize:'0.85rem'}}>
                                        <span style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                            {q.is_vip && <span style={{fontSize:'0.7rem'}}>👑</span>} 
                                            {q.customer_name}
                                        </span>
                                        <button onClick={() => setTransferMode({ queueId: q.id, currentBarberId: barber.id })} className="btn btn-secondary" style={{padding:'2px 5px', fontSize:'0.7rem'}}>➡ Move</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
            })}
            {barbers.filter(b => b.is_active).length === 0 && <p className="empty-text">No active barbers found.</p>}
        </div>
    );

    const StaffView = () => (
        <div className="card">
            <div className="card-header"><h2>Staff Management</h2></div>
            <div className="card-body">
                <table style={{width:'100%', borderCollapse:'collapse', color:'var(--text-primary)'}}>
                    <thead>
                        <tr style={{textAlign:'left', borderBottom:'1px solid var(--border-color)'}}>
                            <th style={{padding:'10px'}}>Barber Name</th>
                            <th style={{padding:'10px'}}>Status</th>
                            <th style={{padding:'10px'}}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {barbers.map(b => (
                            <tr key={b.id} style={{borderBottom:'1px solid var(--border-color)', opacity: b.is_active ? 1 : 0.5}}>
                                <td style={{padding:'10px'}}>{b.full_name}</td>
                                <td style={{padding:'10px'}}>
                                    {b.is_active ? <span style={{color:'var(--success-color)', fontWeight:'bold'}}>ACTIVE</span> : <span style={{color:'var(--error-color)', fontWeight:'bold'}}>BANNED/INACTIVE</span>}
                                </td>
                                <td style={{padding:'10px'}}>
                                    <button 
                                        onClick={() => handleToggleBarberStatus(b.id, b.is_active)} 
                                        className={b.is_active ? "btn btn-danger" : "btn btn-success"}
                                        style={{fontSize:'0.8rem', padding: '5px 10px'}}
                                    >
                                        {b.is_active ? 'Ban / Deactivate' : 'Unban & Activate'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="message small">Deactivating a barber hides them from the customer "Join Queue" list immediately.</p>
            </div>
        </div>
    );

    const MenuView = () => (
        <div className="card">
            <div className="card-header">
                <h2>{isEditingService ? 'Edit Service' : 'Add New Service'}</h2>
            </div>
            <div className="card-body">
                <form onSubmit={handleSaveService} style={{display:'grid', gap:'10px', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', marginBottom:'20px', paddingBottom:'20px', borderBottom:'1px solid var(--border-color)'}}>
                    <div className="form-group"><label>Service Name</label><input name="serviceName" defaultValue={isEditingService?.name || ''} required placeholder="e.g. Haircut" /></div>
                    <div className="form-group"><label>Duration (mins)</label><input name="serviceDuration" type="number" defaultValue={isEditingService?.duration_minutes || 30} required min="5" /></div>
                    <div className="form-group"><label>Price (₱)</label><input name="servicePrice" type="number" defaultValue={isEditingService?.price_php || 150} required min="0" /></div>
                    <div style={{display:'flex', alignItems:'end', gap:'10px'}}>
                        <button type="submit" className="btn btn-primary btn-full-width">{isEditingService ? 'Update' : 'Add'}</button>
                        {isEditingService && <button type="button" onClick={() => setIsEditingService(null)} className="btn btn-secondary">Cancel</button>}
                    </div>
                </form>
                <h3 style={{marginTop:0}}>Current Menu</h3>
                <ul className="queue-list">
                    {services.map(s => (
                        <li key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', opacity: s.is_active ? 1 : 0.5}}>
                            <div>
                                <strong>{s.name}</strong> 
                                <span style={{color:'var(--text-secondary)'}}> ({s.duration_minutes}m)</span>
                                {!s.is_active && <span style={{marginLeft:'8px', color:'var(--error-color)', fontWeight:'bold', fontSize:'0.7rem'}}>ARCHIVED</span>}
                                <div style={{fontWeight:'bold', color:'var(--primary-orange)'}}>₱{s.price_php}</div>
                            </div>
                            <div style={{display:'flex', gap:'10px'}}>
                                {s.is_active ? (
                                    <>
                                        <button onClick={() => setIsEditingService(s)} className="btn btn-secondary" style={{padding:'5px 10px'}}>Edit</button>
                                        <button onClick={() => handleDeleteService(s.id)} className="btn btn-danger" style={{padding:'5px 10px'}}>Delete</button>
                                    </>
                                ) : (
                                    <button onClick={() => handleRestoreService(s.id)} className="btn btn-success" style={{padding:'5px 10px'}}>Restore</button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );

    // --- SUPER DETAILED ANALYTICS VIEW (RESPONSIVE FIX) ---
    const StatsView = () => {
        if (!advancedStats) return <div className="loading-fullscreen"><Spinner /><span>Crunching numbers...</span></div>;
        
        // --- SAFEGUARDS ---
        const totals = advancedStats.totals || { revenue: 0, cuts: 0 };
        const dailyTrend = advancedStats.dailyTrend || [];
        const barberStats = advancedStats.barberStats || [];

        // 1. Prepare Chart Data
        const trendData = {
            labels: dailyTrend.map(d => d.day),
            datasets: [{
                label: 'Shop Revenue (₱)',
                data: dailyTrend.map(d => d.daily_total),
                borderColor: '#ff9500',
                backgroundColor: 'rgba(255, 149, 0, 0.1)',
                fill: true,
                tension: 0.4
            }]
        };

        const barberComparisonData = {
            labels: barberStats.map(b => b.full_name),
            datasets: [{
                label: 'Total Revenue (₱)',
                data: barberStats.map(b => b.total_revenue),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                ],
                borderWidth: 1
            }]
        };

        const topBarber = barberStats.length > 0 ? barberStats[0] : { full_name: 'No Data', total_revenue: 0 };

        return (
            <div className="stats-container">
                {/* --- ROW 1: KPI CARDS --- */}
                <div className="analytics-grid" style={{marginBottom: '20px'}}>
                    <div className="analytics-item">
                        <span className="analytics-label">Total Shop Revenue</span>
                        <span className="analytics-value" style={{color: 'var(--success-color)'}}>
                            ₱{parseInt(totals.revenue || 0).toLocaleString()}
                        </span>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">Total Haircuts</span>
                        <span className="analytics-value">{totals.cuts || 0}</span>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">Top Performer 🏆</span>
                        <span className="analytics-value" style={{fontSize: '1.4rem'}}>
                            {topBarber.full_name}
                        </span>
                        <small style={{color: 'var(--text-secondary)'}}>
                            Earned ₱{(topBarber.total_revenue || 0).toLocaleString()}
                        </small>
                    </div>
                </div>

                {/* --- ROW 2: CHARTS (Responsive Grid) --- */}
                <div style={{
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', // Decreased min-width for mobile
                    gap: '20px', 
                    marginBottom: '20px'
                }}>
                    <div className="card" style={{padding: '20px'}}>
                        <h3 style={{marginTop: 0, fontSize: '1rem'}}>📈 7-Day Revenue Trend</h3>
                        <div style={{height: '250px'}}>
                            <Bar data={trendData} options={{ 
                                responsive: true, 
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } } 
                            }} />
                        </div>
                    </div>
                    <div className="card" style={{padding: '20px'}}>
                        <h3 style={{marginTop: 0, fontSize: '1rem'}}>💈 Barber Comparison (Revenue)</h3>
                        <div style={{height: '250px'}}>
                            <Bar data={barberComparisonData} options={{ 
                                indexAxis: 'y', 
                                responsive: true, 
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } }
                            }} />
                        </div>
                    </div>
                </div>

                {/* --- ROW 3: DETAILED LEADERBOARD TABLE (Scrollable) --- */}
                <div className="card">
                    <div className="card-header">
                        <h2>Detailed Performance Matrix</h2>
                    </div>
                    {/* FIX: Added overflowX auto here to allow table scrolling on mobile */}
                    <div className="card-body" style={{overflowX: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse', minWidth: '600px'}}>
                            <thead>
                                <tr style={{borderBottom: '2px solid var(--border-color)', textAlign: 'left'}}>
                                    <th style={{padding: '12px'}}>Barber Name</th>
                                    <th style={{padding: '12px'}}>Status</th>
                                    <th style={{padding: '12px', textAlign: 'center'}}>Cuts</th>
                                    <th style={{padding: '12px', textAlign: 'center'}}>Rating</th>
                                    <th style={{padding: '12px', textAlign: 'right'}}>Revenue Generated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {barberStats.length > 0 ? (
                                    barberStats.map((b, i) => (
                                        <tr key={i} style={{borderBottom: '1px solid var(--border-color)'}}>
                                            <td style={{padding: '12px', fontWeight: '600'}}>
                                                {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}
                                                {b.full_name}
                                            </td>
                                            <td style={{padding: '12px'}}>
                                                {b.is_active 
                                                    ? <span style={{color: 'var(--success-color)', background: 'rgba(52,199,89,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'}}>Active</span> 
                                                    : <span style={{color: 'var(--text-secondary)', background: 'rgba(100,100,100,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'}}>Inactive</span>
                                                }
                                            </td>
                                            <td style={{padding: '12px', textAlign: 'center', fontSize: '1.1rem'}}>
                                                {b.cut_count}
                                            </td>
                                            <td style={{padding: '12px', textAlign: 'center'}}>
                                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                                    <span style={{color: '#FFD700'}}>★</span>
                                                    <strong>{b.avg_rating > 0 ? b.avg_rating : '-'}</strong>
                                                    <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
                                                        ({b.review_count})
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{padding: '12px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-orange)', fontSize: '1.1rem'}}>
                                                ₱{(b.total_revenue || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="5" style={{padding: '20px', textAlign: 'center'}}>No performance data available yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const UsersView = () => (
        <div className="card">
            <div className="card-body">
                <table style={{width:'100%', borderCollapse:'collapse', color:'var(--text-primary)'}}>
                    <thead>
                        <tr style={{textAlign:'left', borderBottom:'1px solid var(--border-color)'}}>
                            <th style={{padding:'10px'}}>Name</th><th style={{padding:'10px'}}>Role</th><th style={{padding:'10px'}}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} style={{borderBottom:'1px solid var(--border-color)'}}>
                                <td style={{padding:'10px'}}>{u.full_name}</td><td style={{padding:'10px'}}>{u.role}</td>
                                <td style={{padding:'10px'}}>{u.role !== 'admin' && <button onClick={() => handleDeleteUser(u.id)} className="btn btn-danger" style={{fontSize:'0.8rem'}}>Delete</button>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

   return (
        <div className="app-layout admin-layout">
            <header className="app-header" style={{ borderBottom: '2px solid #7c4dff' }}>
                <h1>Admin Command Center</h1>
                <div className="header-actions">
                    <ThemeToggleButton />
                    <button onClick={() => handleLogout(session.user.id)} className="btn btn-icon"><IconLogout /></button>
                </div>
            </header>

            {transferMode && (
                <div style={{background:'var(--primary-orange)', color:'black', padding:'10px', textAlign:'center', fontWeight:'bold'}}>
                    TRANSFER MODE ACTIVE: Select a barber below to move the customer. 
                    <button onClick={() => setTransferMode(null)} style={{marginLeft:'10px', background:'white', border:'none', padding:'2px 8px', borderRadius:'4px'}}>Cancel</button>
                </div>
            )}

            <div className="customer-view-tabs card-header" style={{ justifyContent: 'center', background: 'var(--surface-color)', marginTop: '10px', flexWrap: 'wrap' }}>
                <button className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>⚡ Live Shop</button>
                <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>📊 Analytics</button>
                <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>💈 Staff</button>
                <button className={activeTab === 'menu' ? 'active' : ''} onClick={() => setActiveTab('menu')}>✂️ Menu</button>
                <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>👥 Users</button>
                {/* --- ADD THIS BUTTON --- */}
                <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}>🚨 Reports</button>
            </div>

            <main className="main-content">
                <div className="container" style={{maxWidth:'1200px'}}>
                    {activeTab === 'live' && <LiveShopView />}
                    {activeTab === 'stats' && <StatsView />}
                    {activeTab === 'staff' && <StaffView />}
                    {activeTab === 'menu' && <MenuView />}
                    {activeTab === 'users' && <UsersView />}
                    
                    {/* --- ADD THIS LINE --- */}
                    {activeTab === 'reports' && <ReportsView />}
                </div>
            </main>
        </div>
    );
}

// ##############################################
// ##         CUSTOMER APP LAYOUT            ##
// ##############################################
function CustomerAppLayout({ session }) {
    return (
        <div className="app-layout customer-app-layout">
            <header className="app-header">
                <h1>Welcome, {session.user?.user_metadata?.full_name || 'Customer'}!</h1>
                <div className="header-actions">
                    <ThemeToggleButton />
                    <button 
                        onClick={() => handleLogout(session.user.id)} 
                        className="btn btn-icon" 
                        title="Logout"
                    >
                        <IconLogout />
                    </button>
                </div>
            </header>
            <main className="main-content">
                <div className="container">
                    <CustomerView session={session} />
                </div>
            </main>
        </div>
    );
}

function LandingPage({ onGetStarted, onLogin, onAdminClick }) {

    return (
        <div className="landing-container">
            <nav className="landing-nav">
                <div className="landing-logo">
                    <span style={{fontSize: '2rem'}}>⚡</span> Dash-Q
                </div>
                <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                    <ThemeToggleButton />
                    <button onClick={onLogin} className="btn btn-link" style={{color: 'var(--text-primary)', fontWeight: 600}}>
                        Login
                    </button>
                </div>
            </nav>

            <header className="hero-section">
                <h1 className="hero-title">
                    Queue Smarter,<br /> <span>Look Sharper.</span>
                </h1>
                <p className="hero-subtitle">
                    Skip the long wait. Join the live queue from anywhere, book appointments, and get notified when it's your turn.
                </p>
                <div className="hero-buttons">
                    <button onClick={onGetStarted} className="btn btn-primary btn-hero">
                        Get Started Now
                    </button>
                    <button onClick={onLogin} className="btn btn-secondary btn-hero">
                        Barber Login
                    </button>
                </div>
            </header>

            <section className="features-section">
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon"><IconNext /></div>
                        <h3>Live Queue Tracking</h3>
                        <p>See exactly how many people are ahead of you and your estimated wait time.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon"><IconChat /></div>
                        <h3>Direct Chat</h3>
                        <p>Message your barber directly to clarify styles or delays without leaving the app.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon"><IconCheck /></div>
                        <h3>Hybrid Booking</h3>
                        <p>Join the queue now for a quick cut or schedule an appointment for later.</p>
                    </div>
                </div>
            </section>

            <footer className="landing-footer">
                <p>&copy; 2025 Dash-Q. University of the Cordilleras.</p>
                <div style={{display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px', fontSize: '0.8rem'}}>
                    <span>Developed by Aquino, Galima & Saldivar</span>
                    <span>|</span>
                    <button 
                        onClick={onAdminClick} 
                        style={{background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, font: 'inherit'}}
                    >
                        Admin
                    </button>
                </div>
            </footer>
        </div>
    );
}

// --- ADMIN LOGIN COMPONENT ---
function AdminLoginForm({ onCancel, onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post(`${API_URL}/login/username`, {
                username: username.trim(),
                password,
                role: 'admin' // <--- Force 'admin' role
            });

            if (response.data.user?.email && supabase) {
                const { error: authError } = await supabase.auth.signInWithPassword({
                    email: response.data.user.email,
                    password
                });
                if (authError) throw authError;
                
                // Success! The main App component listener will detect the session change
                if (onLoginSuccess) onLoginSuccess();
            }
        } catch (err) {
            console.error("Admin login failed:", err);
            setError(err.response?.data?.error || "Login failed. Check credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page-container" style={{backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(124, 77, 255, 0.15), transparent 60%)'}}>
            <nav className="auth-nav">
                <button onClick={onCancel} className="btn btn-link btn-back-home" style={{color: '#ff3b30'}}>
                    ← Exit Admin Portal
                </button>
            </nav>
            
            <div className="auth-content">
                <div className="card auth-card" style={{borderColor: '#ff3b30'}}>
                    <div className="card-header" style={{borderBottom: '2px solid #ff3b30'}}>
                        <h2 style={{color: '#ff3b30'}}>Admin Access</h2>
                        <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal'}}>
                            Authorized Personnel Only
                        </div>
                    </div>
                    
                    <form onSubmit={handleLogin} className="card-body">
                        <div className="form-group">
                            <label>Admin Username:</label>
                            <input 
                                type="text" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                required 
                                autoFocus
                            />
                        </div>
                        
                        <div className="form-group password-group">
                            <label>Password:</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <IconEyeOff /> : <IconEye />}
                            </button>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="btn btn-full-width"
                            style={{backgroundColor: '#ff3b30', color: 'white', marginTop: '10px'}}
                        >
                            {loading ? <Spinner /> : 'Authenticate'}
                        </button>
                    </form>

                    <div className="card-footer" style={{borderTop: '1px solid var(--border-color)'}}>
                        {error && <p className="message error">{error}</p>}
                        <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '10px'}}>
                            System activity is logged.
                        </p>
                    </div>
                </div>
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
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    
    // --- NEW STATE: Controls Landing Page visibility ---
    const [showLanding, setShowLanding] = useState(true); 
    const [showAdminLogin, setShowAdminLogin] = useState(false);

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
    }, []);

    // --- Helper to Check Role ---
    const checkUserRole = useCallback(async (user) => {
        if (!user || !user.id) {
            setUserRole('customer');
            setBarberProfile(null);
            setLoadingRole(false);
            return;
        }

        console.log(`Checking role for user: ${user.id}`);
        setLoadingRole(true);
        try {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            
            if (profileData && profileData.role === 'admin') {
                setUserRole('admin');
                setBarberProfile(null);
                setLoadingRole(false);
                return; 
            }

            const response = await axios.get(`${API_URL}/barber/profile/${user.id}`);
            setUserRole('barber');
            setBarberProfile(response.data);

        } catch (error) {
            setUserRole('customer');
            setBarberProfile(null);
        } finally {
            setLoadingRole(false);
        }
    }, []);

    // --- Auth Listener ---
    useEffect(() => {
        if (!supabase?.auth) {
            setLoadingRole(false);
            return;
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            if (_event === 'PASSWORD_RECOVERY') {
                setIsUpdatingPassword(true);
            }

            setSession(currentSession);

            if (currentSession?.user) {
                // User is logged in, hide landing page immediately
                setShowLanding(false); 
                checkUserRole(currentSession.user);
            } else {
                setUserRole('customer');
                setBarberProfile(null);
                setLoadingRole(false);
                setIsUpdatingPassword(false);
                // Note: We do NOT reset showLanding to true here. 
                // If they logout, we show AuthForm (Login) by default, unless they refresh.
            }
        });

        return () => subscription?.unsubscribe();
    }, [checkUserRole]);
    
    // --- Render Logic ---
    const renderAppContent = () => {
        // 1. Loading State
        if (loadingRole) return <div className="loading-fullscreen"><Spinner /><span>Loading...</span></div>;
        
        // 2. Password Reset
        if (isUpdatingPassword) return <UpdatePasswordForm onPasswordUpdated={() => setIsUpdatingPassword(false)} />;
        
        // 3. Authenticated View
        if (session) {
            if (userRole === 'admin') return <AdminAppLayout session={session} />;
            if (userRole === 'barber' && barberProfile) return <BarberAppLayout session={session} barberProfile={barberProfile} setBarberProfile={setBarberProfile} />;
            return <CustomerAppLayout session={session} />;
        }

        // 4. ADMIN LOGIN (New Section)
        if (showAdminLogin) {
            return <AdminLoginForm onCancel={() => setShowAdminLogin(false)} />;
        }

        // 5. Landing Page
        if (showLanding) {
            return (
                <LandingPage 
                    onGetStarted={() => setShowLanding(false)} 
                    onLogin={() => setShowLanding(false)} 
                    onAdminClick={() => { setShowLanding(false); setShowAdminLogin(true); }} // <--- Pass handler
                />
            );
        }

        // 6. Login/Signup Form (Unified Design)
        return (
            <div className="auth-page-container">
                {/* Navigation Bar (Top Left) */}
                <nav className="auth-nav">
                    <button 
                        onClick={() => setShowLanding(true)} 
                        className="btn btn-link btn-back-home"
                    >
                        ← Back to Home
                    </button>
                </nav>
                
                {/* Centered Content */}
                <div className="auth-content">
                    <AuthForm />
                    {/* Discrete Admin Link at the bottom */}
                    <div style={{marginTop: '30px', textAlign: 'center'}}>
                        <button 
                            onClick={() => setShowAdminLogin(true)} 
                            className="btn btn-link" 
                            style={{fontSize: '0.8rem', color: 'var(--text-secondary)', opacity: 0.5}}
                        >
                            Admin Access
                        </button>
                    </div>
                    {/* Optional: Small branding footer under the card */}
                    <p style={{
                        marginTop: '20px', 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.85rem', 
                        opacity: 0.7
                    }}>
                        Dash-Q &copy; 2025
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ThemeProvider>
            {renderAppContent()}
        </ThemeProvider>
    );
}

export default App;