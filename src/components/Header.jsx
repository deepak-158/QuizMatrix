// Header - Top navigation bar with Matrix Club branding
// Shows user info and logout button when authenticated

import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Header = () => {
    const { user, isAdmin, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <header className="header">
            <div className="header-content">
                {/* Logo and Brand */}
                <Link to={isAdmin ? '/admin' : '/join'} className="brand">
                    <div className="logo">
                        <img src="/favicon.ico" alt="Matrix Club Logo" className="logo-image" />
                    </div>
                    <div className="brand-text">
                        <h1>Matrix Club</h1>
                        <span className="tagline">Live Quiz Platform</span>
                    </div>
                </Link>

                {/* User Info and Actions */}
                {user && (
                    <div className="user-section">
                        <div className="user-info">
                            {user.photoURL && (
                                <img
                                    src={user.photoURL}
                                    alt="Profile"
                                    className="user-avatar"
                                    referrerPolicy="no-referrer"
                                />
                            )}
                            <div className="user-details">
                                <span className="user-name">{user.displayName}</span>
                                <span className={`user-role ${isAdmin ? 'admin' : 'participant'}`}>
                                    {isAdmin ? '🛡️ Admin' : '👤 Participant'}
                                </span>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="btn btn-outline logout-btn">
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;
