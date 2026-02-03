// Master Settings Page - Admin management and club settings
// Only accessible by master admin

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { MASTER_ADMIN_EMAIL } from '../../firebase/firebase';

const MasterSettings = () => {
    const { user, isMasterAdmin } = useAuth();
    const { clubName, logoUrl, adminEmails, loading, updateClubName, updateLogoUrl, addAdmin, removeAdmin } = useSettings();
    const navigate = useNavigate();

    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newClubName, setNewClubName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Redirect non-master admins
    if (!isMasterAdmin) {
        return (
            <div className="error-page">
                <Header />
                <main className="error-content">
                    <h1>🔒 Access Denied</h1>
                    <p>Only the master admin can access this page.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/admin')}>
                        Back to Dashboard
                    </button>
                </main>
            </div>
        );
    }

    if (loading) {
        return <LoadingSpinner message="Loading settings..." />;
    }

    const handleAddAdmin = async () => {
        if (!newAdminEmail.trim()) return;
        setError('');
        setSuccess('');
        setSaving(true);
        try {
            await addAdmin(newAdminEmail);
            setSuccess(`Successfully added ${newAdminEmail} as admin!`);
            setNewAdminEmail('');
        } catch (err) {
            console.error('Add admin error:', err);
            setError(err.message || 'Failed to add admin');
        }
        setSaving(false);
    };

    const handleRemoveAdmin = async (email) => {
        if (!window.confirm(`Remove ${email} from admins?`)) return;
        setError('');
        setSaving(true);
        try {
            await removeAdmin(email);
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    const handleUpdateClubName = async () => {
        if (!newClubName.trim()) return;
        setError('');
        setSaving(true);
        try {
            await updateClubName(newClubName);
            setNewClubName('');
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    const handleUpdateLogoUrl = async (url) => {
        setError('');
        setSaving(true);
        try {
            await updateLogoUrl(url);
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    return (
        <div className="master-settings-page">
            <Header />

            <main className="settings-content">
                <div className="page-header">
                    <button className="btn btn-ghost" onClick={() => navigate('/admin')}>
                        ← Back to Dashboard
                    </button>
                    <h1>⚙️ Master Settings</h1>
                    <p>Manage admins and club settings</p>
                </div>

                {error && (
                    <div className="error-box">
                        <p>⚠️ {error}</p>
                    </div>
                )}

                {success && (
                    <div className="success-box">
                        <p>✅ {success}</p>
                    </div>
                )}

                {/* Club Name Section */}
                <div className="settings-card">
                    <h2>🏷️ Club Name</h2>
                    <p className="card-hint">Current name: <strong>{clubName}</strong></p>
                    <div className="setting-input-row">
                        <input
                            type="text"
                            placeholder="New club name"
                            value={newClubName}
                            onChange={(e) => setNewClubName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateClubName()}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleUpdateClubName}
                            disabled={saving || !newClubName.trim()}
                        >
                            {saving ? 'Saving...' : 'Update'}
                        </button>
                    </div>
                </div>

                {/* Logo Section */}
                <div className="settings-card">
                    <h2>🖼️ Logo</h2>
                    <div className="logo-preview">
                        <img src={logoUrl} alt="Current Logo" className="preview-img" />
                    </div>
                    <p className="card-hint">Select a logo from the available options</p>
                    <div className="setting-input-row">
                        <select
                            className="logo-select"
                            value={logoUrl}
                            onChange={(e) => handleUpdateLogoUrl(e.target.value)}
                            disabled={saving}
                        >
                            <option value="/logo.png">Matrix Logo</option>
                            <option value="/image.png">Quiz Logo</option>
                            <option value="/SW Office Logo Light.png">Student Council Logo</option>
                        </select>
                    </div>
                </div>

                {/* Admin Management Section */}
                <div className="settings-card">
                    <h2>👥 Admin Management</h2>
                    <p className="card-hint">Add or remove admins who can create and manage quizzes</p>

                    <div className="setting-input-row">
                        <input
                            type="email"
                            placeholder="Admin email address"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin()}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleAddAdmin}
                            disabled={saving || !newAdminEmail.trim()}
                        >
                            {saving ? 'Adding...' : '+ Add Admin'}
                        </button>
                    </div>

                    <div className="admin-list">
                        {adminEmails.map((email) => (
                            <div key={email} className="admin-item">
                                <div className="admin-info">
                                    <span className="admin-email">{email}</span>
                                    {email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() && (
                                        <span className="master-badge">👑 Master</span>
                                    )}
                                </div>
                                {email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase() && (
                                    <button
                                        className="btn btn-ghost btn-danger-text"
                                        onClick={() => handleRemoveAdmin(email)}
                                        disabled={saving}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MasterSettings;
