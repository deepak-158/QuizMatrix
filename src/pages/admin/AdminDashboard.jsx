// Admin Dashboard - Main hub for quiz management
// Lists all quizzes created by the admin with status indicators
// Master Admin can see and manage ALL quizzes

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAdminQuizzes, useAllQuizzes, useQuiz } from '../../hooks/useQuiz';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, getStatusColor } from '../../utils/helpers';

const AdminDashboard = () => {
    const { user, isMasterAdmin } = useAuth();
    
    // Use different hooks based on master admin status
    const adminQuizzes = useAdminQuizzes();
    const allQuizzes = useAllQuizzes();
    
    // Select appropriate data based on master admin status
    const { quizzes, loading } = isMasterAdmin ? allQuizzes : adminQuizzes;
    
    const { deleteQuiz, restartQuiz, createQuizFromJSON } = useQuiz();
    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(null);
    const [restarting, setRestarting] = useState(null);
    const [showAllQuizzes, setShowAllQuizzes] = useState(true); // Toggle for master admin
    const [selectedAdmin, setSelectedAdmin] = useState('all'); // Filter by admin
    const [bulkDeleting, setBulkDeleting] = useState(false);

    // JSON import state
    const [showJsonModal, setShowJsonModal] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState('');
    const [importing, setImporting] = useState(false);

    // Get unique admins from quizzes for filter dropdown
    const uniqueAdmins = useMemo(() => {
        if (!isMasterAdmin || !quizzes) return [];
        const admins = new Map();
        quizzes.forEach(q => {
            if (q.createdBy && !admins.has(q.createdBy)) {
                admins.set(q.createdBy, {
                    id: q.createdBy,
                    email: q.creatorEmail || 'Unknown Admin'
                });
            }
        });
        return Array.from(admins.values());
    }, [quizzes, isMasterAdmin]);

    // Filter quizzes based on master admin toggle and selected admin
    const displayedQuizzes = useMemo(() => {
        if (!isMasterAdmin) return quizzes;
        
        let filtered = showAllQuizzes ? quizzes : quizzes.filter(q => q.createdBy === user?.uid);
        
        // Apply admin filter
        if (selectedAdmin !== 'all') {
            filtered = filtered.filter(q => q.createdBy === selectedAdmin);
        }
        
        return filtered;
    }, [quizzes, isMasterAdmin, showAllQuizzes, selectedAdmin, user?.uid]);

    // Bulk delete all filtered quizzes
    const handleBulkDelete = async () => {
        if (displayedQuizzes.length === 0) return;

        const adminEmail = selectedAdmin === 'all' 
            ? 'all admins' 
            : uniqueAdmins.find(a => a.id === selectedAdmin)?.email || 'selected admin';

        const confirmMessage = `⚠️ BULK DELETE WARNING\n\nYou are about to delete ${displayedQuizzes.length} quiz(es) from ${adminEmail}.\n\nThis action CANNOT be undone!\n\nType "DELETE" to confirm:`;
        
        const confirmation = window.prompt(confirmMessage);
        if (confirmation !== 'DELETE') {
            if (confirmation !== null) {
                alert('Bulk delete cancelled. You must type "DELETE" exactly to confirm.');
            }
            return;
        }

        setBulkDeleting(true);
        let deleted = 0;
        let failed = 0;

        for (const quiz of displayedQuizzes) {
            try {
                await deleteQuiz(quiz.id);
                deleted++;
            } catch (error) {
                console.error(`Failed to delete quiz ${quiz.id}:`, error);
                failed++;
            }
        }

        setBulkDeleting(false);
        alert(`Bulk delete complete!\n✓ Deleted: ${deleted}\n✗ Failed: ${failed}`);
    };

    const handleDeleteQuiz = async (quizId, quiz, e) => {
        e.stopPropagation();

        const isOwnQuiz = quiz.createdBy === user?.uid;
        const confirmMessage = isOwnQuiz
            ? 'Are you sure you want to delete this quiz? This cannot be undone.'
            : `⚠️ MASTER ADMIN DELETE\n\nThis quiz was created by: ${quiz.creatorEmail || 'Unknown'}\n\nAre you sure you want to delete it? This cannot be undone.`;

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setDeleting(quizId);
        try {
            await deleteQuiz(quizId);
        } catch (error) {
            console.error('Error deleting quiz:', error);
            alert('Failed to delete quiz');
        }
        setDeleting(null);
    };

    const handleRestartQuiz = async (quizId, e) => {
        e.stopPropagation();

        if (!window.confirm('Restart this quiz? All scores will be reset.')) {
            return;
        }

        setRestarting(quizId);
        try {
            await restartQuiz(quizId);
        } catch (error) {
            console.error('Error restarting quiz:', error);
            alert('Failed to restart quiz');
        }
        setRestarting(null);
    };

    const handleImportJSON = async () => {
        setJsonError('');

        // Parse JSON
        let jsonData;
        try {
            jsonData = JSON.parse(jsonInput);
        } catch {
            setJsonError('Invalid JSON format. Please check your input.');
            return;
        }

        setImporting(true);
        try {
            const result = await createQuizFromJSON(jsonData);
            setShowJsonModal(false);
            setJsonInput('');
            alert(`Quiz created successfully!\nCode: ${result.quizCode}\nQuestions: ${result.questionCount}`);
            navigate(`/admin/quiz/${result.id}`);
        } catch (error) {
            setJsonError(error.message);
        }
        setImporting(false);
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'draft': return '📝 Draft';
            case 'waiting': return '⏳ Waiting';
            case 'live': return '🔴 LIVE';
            case 'ended': return '✅ Ended';
            default: return status;
        }
    };

    const sampleJSON = `{
  "title": "Sample Quiz",
  "timeMode": "perQuestion",
  "timePerQuestion": 30,
  "questions": [
    {
      "text": "What is 2 + 2?",
      "options": ["3", "4", "5", "6"],
      "correctAnswer": 1,
      "imageUrl": "",
      "optionImages": ["", "", "", ""]
    }
  ]
}`;

    const sampleJSONOverall = `{
  "title": "Self-Paced Quiz",
  "timeMode": "overall",
  "totalTime": 600,
  "questions": [
    {
      "text": "Question with image?",
      "imageUrl": "https://example.com/image.jpg",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0
    }
  ]
}`;

    if (loading) {
        return <LoadingSpinner message="Loading your quizzes..." />;
    }

    return (
        <div className="admin-dashboard">
            <Header />

            <main className="dashboard-content">
                {/* Dashboard Header */}
                <div className="dashboard-header">
                    <div>
                        <h1>{isMasterAdmin && showAllQuizzes ? '👑 All Quizzes' : 'My Quizzes'}</h1>
                        <p>{isMasterAdmin && showAllQuizzes 
                            ? `Viewing ${displayedQuizzes.length} quiz(es)${selectedAdmin !== 'all' ? ' from selected admin' : ' from all admins'}`
                            : 'Create and manage your live quizzes'}</p>
                    </div>
                    <div className="header-buttons">
                        {isMasterAdmin && (
                            <button
                                className={`btn ${showAllQuizzes ? 'btn-accent' : 'btn-ghost'}`}
                                onClick={() => {
                                    setShowAllQuizzes(!showAllQuizzes);
                                    setSelectedAdmin('all');
                                }}
                            >
                                {showAllQuizzes ? '👑 All Quizzes' : '📋 My Quizzes'}
                            </button>
                        )}
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowJsonModal(true)}
                        >
                            📥 Import JSON
                        </button>
                        <button
                            className="btn btn-primary create-btn"
                            onClick={() => navigate('/admin/create')}
                        >
                            <span>+</span> Create New Quiz
                        </button>
                    </div>
                </div>

                {/* Master Admin Filter Controls */}
                {isMasterAdmin && showAllQuizzes && (
                    <div className="master-admin-controls">
                        <div className="filter-section">
                            <label htmlFor="admin-filter">Filter by Admin:</label>
                            <select
                                id="admin-filter"
                                className="admin-filter-select"
                                value={selectedAdmin}
                                onChange={(e) => setSelectedAdmin(e.target.value)}
                            >
                                <option value="all">All Admins ({quizzes.length} quizzes)</option>
                                {uniqueAdmins.map(admin => {
                                    const count = quizzes.filter(q => q.createdBy === admin.id).length;
                                    return (
                                        <option key={admin.id} value={admin.id}>
                                            {admin.email} ({count} quizzes)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        
                        <div className="bulk-actions">
                            <button
                                className="btn btn-danger"
                                onClick={handleBulkDelete}
                                disabled={bulkDeleting || displayedQuizzes.length === 0}
                            >
                                {bulkDeleting 
                                    ? '🗑️ Deleting...' 
                                    : `🗑️ Delete All (${displayedQuizzes.length})`}
                            </button>
                        </div>
                    </div>
                )}

                {/* JSON Import Modal */}
                {showJsonModal && (
                    <div className="modal-overlay" onClick={() => setShowJsonModal(false)}>
                        <div className="modal-content json-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Import Quiz from JSON</h2>
                                <button className="btn btn-ghost" onClick={() => setShowJsonModal(false)}>✕</button>
                            </div>

                            <div className="modal-body">
                                <p className="modal-hint">Paste your quiz JSON below:</p>

                                {jsonError && (
                                    <div className="error-box">
                                        <p>⚠️ {jsonError}</p>
                                    </div>
                                )}

                                <textarea
                                    className="json-textarea"
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder={sampleJSON}
                                    rows={12}
                                />

                                <details className="json-format-help">
                                    <summary>📋 JSON Format - Per Question Mode</summary>
                                    <pre>{sampleJSON}</pre>
                                </details>

                                <details className="json-format-help">
                                    <summary>📋 JSON Format - Overall Time (Self-Paced)</summary>
                                    <pre>{sampleJSONOverall}</pre>
                                </details>

                                <div className="json-fields-info">
                                    <p><strong>Fields:</strong></p>
                                    <ul>
                                        <li><code>timeMode</code>: "perQuestion" or "overall"</li>
                                        <li><code>timePerQuestion</code>: 10-120 seconds (per-question mode)</li>
                                        <li><code>totalTime</code>: 60-3600 seconds (overall mode)</li>
                                        <li><code>imageUrl</code>: Optional image URL for question</li>
                                        <li><code>optionImages</code>: Optional array of 4 image URLs</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setShowJsonModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleImportJSON}
                                    disabled={importing || !jsonInput.trim()}
                                >
                                    {importing ? 'Importing...' : 'Import Quiz'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quizzes Grid */}
                {displayedQuizzes.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <h2>No quizzes yet</h2>
                        <p>Create your first quiz to get started!</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/admin/create')}
                        >
                            Create Quiz
                        </button>
                    </div>
                ) : (
                    <div className="quizzes-grid">
                        {displayedQuizzes.map((quiz) => {
                            const isOwnQuiz = quiz.createdBy === user?.uid;
                            
                            return (
                                <div
                                    key={quiz.id}
                                    className={`quiz-card ${!isOwnQuiz && isMasterAdmin ? 'other-admin-quiz' : ''}`}
                                    onClick={() => navigate(`/admin/quiz/${quiz.id}`)}
                                >
                                    {/* Status Badge */}
                                    <div className={`status-badge ${getStatusColor(quiz.status)}`}>
                                        {getStatusLabel(quiz.status)}
                                    </div>

                                    {/* Owner Badge for Master Admin */}
                                    {isMasterAdmin && showAllQuizzes && (
                                        <div className={`owner-badge ${isOwnQuiz ? 'own' : 'other'}`}>
                                            {isOwnQuiz ? '👤 Mine' : `👥 ${quiz.creatorEmail || 'Unknown Admin'}`}
                                        </div>
                                    )}

                                    {/* Quiz Info */}
                                    <h3 className="quiz-title">{quiz.title}</h3>

                                    <div className="quiz-meta">
                                        <div className="meta-item">
                                            <span className="meta-icon">❓</span>
                                            <span>{quiz.totalQuestions || 0} questions</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-icon">⏱️</span>
                                            <span>
                                                {quiz.timeMode === 'overall' 
                                                    ? `${quiz.totalTime}s total` 
                                                    : `${quiz.timePerQuestion}s per question`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="quiz-code">
                                        <span>Code:</span>
                                        <strong>{quiz.quizCode}</strong>
                                    </div>

                                    <div className="quiz-date">
                                        Created: {formatDateTime(quiz.createdAt)}
                                    </div>

                                    {/* Actions */}
                                    <div className="quiz-actions">
                                        {quiz.status === 'draft' && (
                                            <button
                                                className="btn btn-small btn-secondary"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/admin/quiz/${quiz.id}/questions`);
                                                }}
                                            >
                                                Add Questions
                                            </button>
                                        )}
                                        {(quiz.status === 'waiting' || quiz.status === 'live') && (
                                            <button
                                                className="btn btn-small btn-accent"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/admin/quiz/${quiz.id}/control`);
                                                }}
                                            >
                                                Control Panel
                                            </button>
                                        )}
                                        {quiz.status === 'ended' && (
                                            <button
                                                className="btn btn-small btn-secondary"
                                                onClick={(e) => handleRestartQuiz(quiz.id, e)}
                                                disabled={restarting === quiz.id}
                                            >
                                                {restarting === quiz.id ? '...' : '🔄 Restart'}
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-small btn-danger"
                                            onClick={(e) => handleDeleteQuiz(quiz.id, quiz, e)}
                                            disabled={deleting === quiz.id}
                                            title={!isOwnQuiz ? 'Master Admin Delete' : 'Delete Quiz'}
                                        >
                                            {deleting === quiz.id ? '...' : '🗑️'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;