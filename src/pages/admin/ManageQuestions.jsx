// Manage Questions Page - Add, edit, and delete quiz questions
// Each question has text, 4 options, and correct answer selection

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useQuiz, useQuizSubscription, useQuestionsSubscription } from '../../hooks/useQuiz';
import { validateQuestionData } from '../../utils/helpers';
import { ADMIN_EMAILS } from '../../firebase/firebase';

const ManageQuestions = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { quiz, loading: quizLoading } = useQuizSubscription(quizId);
    const { questions, loading: questionsLoading } = useQuestionsSubscription(quizId);
    const { 
        addQuestion, 
        updateQuestion, 
        deleteQuestion, 
        startQuiz, 
        updateQuiz, 
        shareQuiz, 
        unshareQuiz,
        addAllowedParticipants,
        removeAllowedParticipant,
        toggleQuizRestriction
    } = useQuiz();

    const [showForm, setShowForm] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [formData, setFormData] = useState({
        text: '',
        options: ['', '', '', ''],
        correctAnswer: -1,
        imageUrl: '',
        optionImages: ['', '', '', '']
    });
    const [errors, setErrors] = useState([]);
    const [saving, setSaving] = useState(false);

    // Duration editor state
    const [editingDuration, setEditingDuration] = useState(false);
    const [newDuration, setNewDuration] = useState(30);
    const [savingDuration, setSavingDuration] = useState(false);

    // Share state
    const [shareEmail, setShareEmail] = useState('');
    const [sharingInProgress, setSharingInProgress] = useState(false);

    // Allowed participants state
    const [participantEmail, setParticipantEmail] = useState('');
    const [bulkEmails, setBulkEmails] = useState('');
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [participantLoading, setParticipantLoading] = useState(false);
    const [participantSearch, setParticipantSearch] = useState('');

    // Sync newDuration with quiz when quiz loads
    useEffect(() => {
        if (quiz?.timePerQuestion) {
            setNewDuration(quiz.timePerQuestion);
        }
    }, [quiz?.timePerQuestion]);

    // Reset form when editing question changes
    useEffect(() => {
        if (editingQuestion) {
            setFormData({
                text: editingQuestion.text,
                options: [...editingQuestion.options],
                correctAnswer: editingQuestion.correctAnswer,
                imageUrl: editingQuestion.imageUrl || '',
                optionImages: editingQuestion.optionImages || ['', '', '', '']
            });
            setShowForm(true);
        } else {
            resetForm();
        }
    }, [editingQuestion]);

    const resetForm = () => {
        setFormData({
            text: '',
            options: ['', '', '', ''],
            correctAnswer: -1,
            imageUrl: '',
            optionImages: ['', '', '', '']
        });
        setErrors([]);
        setShowForm(false);
        setEditingQuestion(null);
    };

    const handleTextChange = (e) => {
        setFormData(prev => ({ ...prev, text: e.target.value }));
        setErrors([]);
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...formData.options];
        newOptions[index] = value;
        setFormData(prev => ({ ...prev, options: newOptions }));
        setErrors([]);
    };

    const handleImageUrlChange = (e) => {
        setFormData(prev => ({ ...prev, imageUrl: e.target.value }));
    };

    const handleOptionImageChange = (index, value) => {
        const newOptionImages = [...formData.optionImages];
        newOptionImages[index] = value;
        setFormData(prev => ({ ...prev, optionImages: newOptionImages }));
    };

    const handleCorrectAnswerChange = (index) => {
        setFormData(prev => ({ ...prev, correctAnswer: index }));
        setErrors([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationErrors = validateQuestionData(formData);
        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setSaving(true);
        try {
            if (editingQuestion) {
                await updateQuestion(quizId, editingQuestion.id, formData);
            } else {
                await addQuestion(quizId, formData);
            }
            resetForm();
        } catch (error) {
            console.error('Error saving question:', error);
            setErrors(['Failed to save question. Please try again.']);
        }
        setSaving(false);
    };

    const handleDeleteQuestion = async (questionId) => {
        if (!window.confirm('Delete this question?')) return;

        try {
            await deleteQuestion(quizId, questionId);
        } catch (error) {
            console.error('Error deleting question:', error);
            alert('Failed to delete question');
        }
    };

    const handleStartQuiz = async () => {
        if (questions.length === 0) {
            alert('Please add at least one question before starting the quiz');
            return;
        }

        if (!window.confirm('Start the quiz? Participants will be able to join with the quiz code.')) {
            return;
        }

        try {
            await startQuiz(quizId);
            navigate(`/admin/quiz/${quizId}/control`);
        } catch (error) {
            console.error('Error starting quiz:', error);
            alert('Failed to start quiz');
        }
    };

    // Duration editor handlers
    const handleSaveDuration = async () => {
        if (newDuration < 5 || newDuration > 120) {
            alert('Duration must be between 5 and 120 seconds');
            return;
        }

        setSavingDuration(true);
        try {
            await updateQuiz(quizId, { timePerQuestion: newDuration });
            setEditingDuration(false);
        } catch (error) {
            console.error('Error updating duration:', error);
            alert('Failed to update duration');
        }
        setSavingDuration(false);
    };

    // Share handlers
    const handleShareQuiz = async () => {
        const email = shareEmail.trim().toLowerCase();
        if (!email) return;

        // Check if it's a valid admin email
        if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
            alert('This email is not registered as an admin');
            return;
        }

        // Can't share with yourself
        if (email === quiz.creatorEmail?.toLowerCase()) {
            alert('Cannot share with quiz creator');
            return;
        }

        setSharingInProgress(true);
        try {
            await shareQuiz(quizId, email);
            setShareEmail('');
        } catch (error) {
            console.error('Error sharing quiz:', error);
            alert('Failed to share quiz');
        }
        setSharingInProgress(false);
    };

    const handleUnshareQuiz = async (email) => {
        if (!window.confirm(`Remove ${email} from shared admins?`)) return;

        setSharingInProgress(true);
        try {
            await unshareQuiz(quizId, email);
        } catch (error) {
            console.error('Error removing share:', error);
            alert('Failed to remove admin');
        }
        setSharingInProgress(false);
    };

    // Allowed Participants Handlers
    const handleAddParticipant = async () => {
        const email = participantEmail.trim().toLowerCase();
        if (!email) return;

        // Basic email validation
        if (!email.includes('@')) {
            alert('Please enter a valid email address');
            return;
        }

        setParticipantLoading(true);
        try {
            await addAllowedParticipants(quizId, [email]);
            setParticipantEmail('');
        } catch (error) {
            console.error('Error adding participant:', error);
            alert('Failed to add participant');
        }
        setParticipantLoading(false);
    };

    const handleBulkImport = async () => {
        // Parse emails from bulk input (supports comma, newline, or semicolon separated)
        const emails = bulkEmails
            .split(/[,;\n]+/)
            .map(e => e.trim().toLowerCase())
            .filter(e => e && e.includes('@'));

        if (emails.length === 0) {
            alert('No valid email addresses found');
            return;
        }

        setParticipantLoading(true);
        try {
            const added = await addAllowedParticipants(quizId, emails);
            setBulkEmails('');
            setShowBulkImport(false);
            alert(`Successfully added ${added} new participant(s)`);
        } catch (error) {
            console.error('Error bulk importing participants:', error);
            alert('Failed to import participants');
        }
        setParticipantLoading(false);
    };

    const handleRemoveParticipant = async (email) => {
        if (!window.confirm(`Remove ${email} from allowed participants?`)) return;

        setParticipantLoading(true);
        try {
            await removeAllowedParticipant(quizId, email);
        } catch (error) {
            console.error('Error removing participant:', error);
            alert('Failed to remove participant');
        }
        setParticipantLoading(false);
    };

    const handleToggleRestriction = async () => {
        const newRestricted = !quiz.isRestricted;
        
        if (newRestricted && (!quiz.allowedParticipants || quiz.allowedParticipants.length === 0)) {
            alert('Please add at least one allowed participant before enabling restrictions');
            return;
        }

        try {
            await toggleQuizRestriction(quizId, newRestricted);
        } catch (error) {
            console.error('Error toggling restriction:', error);
            alert('Failed to update quiz settings');
        }
    };

    // Filter participants for search
    const filteredParticipants = (quiz?.allowedParticipants || []).filter(email =>
        email.toLowerCase().includes(participantSearch.toLowerCase())
    );

    const timePresets = [15, 30, 45, 60, 90];

    if (quizLoading || questionsLoading) {
        return <LoadingSpinner message="Loading questions..." />;
    }

    if (!quiz) {
        return (
            <div className="error-page">
                <h2>Quiz not found</h2>
                <button className="btn btn-primary" onClick={() => navigate('/admin')}>
                    Back to Dashboard
                </button>
            </div>
        );
    }

    const optionLabels = ['A', 'B', 'C', 'D'];

    return (
        <div className="manage-questions-page">
            <Header />

            <main className="page-content">
                {/* Page Header */}
                <div className="page-header">
                    <button
                        className="btn btn-ghost back-btn"
                        onClick={() => navigate('/admin')}
                    >
                        ← Back
                    </button>
                    <div className="header-info">
                        <h1>{quiz.title}</h1>
                        <p>Quiz Code: <strong className="quiz-code">{quiz.quizCode}</strong></p>
                    </div>
                    <div className="header-actions">
                        {questions.length > 0 && quiz.status === 'draft' && (
                            <button
                                className="btn btn-accent"
                                onClick={handleStartQuiz}
                            >
                                🚀 Start Quiz
                            </button>
                        )}
                    </div>
                </div>

                {/* Quiz Settings - Duration Editor */}
                <div className="quiz-settings-card">
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-icon">⏱️</span>
                            <span>Time per Question</span>
                        </div>
                        {!editingDuration ? (
                            <div className="setting-value">
                                <strong>{quiz.timePerQuestion}s</strong>
                                {quiz.status === 'draft' && (
                                    <button
                                        className="btn btn-ghost btn-small"
                                        onClick={() => setEditingDuration(true)}
                                    >
                                        ✏️ Edit
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="setting-editor">
                                <div className="time-presets">
                                    {timePresets.map(time => (
                                        <button
                                            key={time}
                                            className={`preset-btn ${newDuration === time ? 'active' : ''}`}
                                            onClick={() => setNewDuration(time)}
                                        >
                                            {time}s
                                        </button>
                                    ))}
                                </div>
                                <div className="custom-time">
                                    <input
                                        type="number"
                                        min="5"
                                        max="120"
                                        value={newDuration}
                                        onChange={(e) => setNewDuration(parseInt(e.target.value) || 5)}
                                    />
                                    <span>seconds</span>
                                </div>
                                <div className="setting-actions">
                                    <button
                                        className="btn btn-ghost btn-small"
                                        onClick={() => {
                                            setNewDuration(quiz.timePerQuestion);
                                            setEditingDuration(false);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary btn-small"
                                        onClick={handleSaveDuration}
                                        disabled={savingDuration}
                                    >
                                        {savingDuration ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Share Setting */}
                    <div className="setting-row" style={{ marginTop: 'var(--space-lg)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-lg)' }}>
                        <div className="setting-label">
                            <span className="setting-icon">👥</span>
                            <span>Share with Admins</span>
                        </div>
                        <div className="share-section">
                            <div className="share-input-row">
                                <input
                                    type="email"
                                    placeholder="Admin email address"
                                    value={shareEmail}
                                    onChange={(e) => setShareEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleShareQuiz()}
                                />
                                <button
                                    className="btn btn-primary btn-small"
                                    onClick={handleShareQuiz}
                                    disabled={sharingInProgress || !shareEmail.trim()}
                                >
                                    {sharingInProgress ? '...' : '+ Share'}
                                </button>
                            </div>
                            {quiz.sharedWith && quiz.sharedWith.length > 0 && (
                                <div className="shared-list">
                                    {quiz.sharedWith.map(email => (
                                        <div key={email} className="shared-chip">
                                            <span>{email}</span>
                                            <button
                                                className="btn-remove"
                                                onClick={() => handleUnshareQuiz(email)}
                                                title="Remove"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <span className="hint">Only registered admins can be added</span>
                        </div>
                    </div>
                </div>

                {/* Allowed Participants Section */}
                <div className="quiz-settings-card participants-card">
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-icon">🎫</span>
                            <span>Allowed Participants</span>
                            <span className={`restriction-badge ${quiz.isRestricted ? 'restricted' : 'open'}`}>
                                {quiz.isRestricted ? '🔒 Restricted' : '🌐 Open to All'}
                            </span>
                        </div>
                        <div className="restriction-toggle">
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={quiz.isRestricted || false}
                                    onChange={handleToggleRestriction}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                            <span className="toggle-label">
                                {quiz.isRestricted ? 'Only registered emails can join' : 'Anyone with code can join'}
                            </span>
                        </div>
                    </div>

                    {quiz.status === 'draft' && (
                        <div className="participants-management">
                            {/* Add Single Participant */}
                            <div className="add-participant-row">
                                <input
                                    type="email"
                                    placeholder="Participant email address"
                                    value={participantEmail}
                                    onChange={(e) => setParticipantEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                                />
                                <button
                                    className="btn btn-primary btn-small"
                                    onClick={handleAddParticipant}
                                    disabled={participantLoading || !participantEmail.trim()}
                                >
                                    {participantLoading ? '...' : '+ Add'}
                                </button>
                                <button
                                    className="btn btn-secondary btn-small"
                                    onClick={() => setShowBulkImport(!showBulkImport)}
                                >
                                    📋 Bulk Import
                                </button>
                            </div>

                            {/* Bulk Import Section */}
                            {showBulkImport && (
                                <div className="bulk-import-section">
                                    <p className="bulk-hint">
                                        Paste emails from Google Forms/Sheets (comma, newline, or semicolon separated)
                                    </p>
                                    <textarea
                                        placeholder="email1@gmail.com, email2@gmail.com&#10;email3@gmail.com"
                                        value={bulkEmails}
                                        onChange={(e) => setBulkEmails(e.target.value)}
                                        rows={4}
                                    />
                                    <div className="bulk-actions">
                                        <button
                                            className="btn btn-ghost btn-small"
                                            onClick={() => {
                                                setBulkEmails('');
                                                setShowBulkImport(false);
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-primary btn-small"
                                            onClick={handleBulkImport}
                                            disabled={participantLoading || !bulkEmails.trim()}
                                        >
                                            {participantLoading ? 'Importing...' : 'Import All'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Participants List */}
                    {quiz.allowedParticipants && quiz.allowedParticipants.length > 0 && (
                        <div className="participants-list-section">
                            <div className="participants-header">
                                <span className="participants-count">
                                    {quiz.allowedParticipants.length} registered participant(s)
                                </span>
                                {quiz.allowedParticipants.length > 5 && (
                                    <input
                                        type="text"
                                        placeholder="Search emails..."
                                        value={participantSearch}
                                        onChange={(e) => setParticipantSearch(e.target.value)}
                                        className="search-input"
                                    />
                                )}
                            </div>
                            <div className="participants-list">
                                {filteredParticipants.slice(0, 50).map(email => (
                                    <div key={email} className="participant-chip">
                                        <span>{email}</span>
                                        {quiz.status === 'draft' && (
                                            <button
                                                className="btn-remove"
                                                onClick={() => handleRemoveParticipant(email)}
                                                title="Remove"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {filteredParticipants.length > 50 && (
                                    <span className="more-hint">
                                        +{filteredParticipants.length - 50} more...
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {(!quiz.allowedParticipants || quiz.allowedParticipants.length === 0) && (
                        <div className="no-participants">
                            <p>No participants registered yet.</p>
                            <span className="hint">
                                {quiz.isRestricted 
                                    ? 'Add email addresses to allow specific participants to join this quiz.' 
                                    : 'Currently anyone with the quiz code can join.'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="questions-layout">
                    {/* Questions List */}
                    <div className="questions-list">
                        <div className="list-header">
                            <h2>Questions ({questions.length})</h2>
                            {!showForm && quiz.status === 'draft' && (
                                <button
                                    className="btn btn-primary btn-small"
                                    onClick={() => setShowForm(true)}
                                >
                                    + Add Question
                                </button>
                            )}
                        </div>

                        {questions.length === 0 ? (
                            <div className="empty-questions">
                                <p>No questions yet. Add your first question!</p>
                            </div>
                        ) : (
                            <div className="questions-cards">
                                {questions.map((question, idx) => (
                                    <div key={question.id} className="question-card">
                                        <div className="question-number">Q{idx + 1}</div>
                                        <div className="question-content">
                                            <p className="question-text">{question.text}</p>
                                            {question.imageUrl && (
                                                <div className="question-image-preview">
                                                    <img src={question.imageUrl} alt="Question" />
                                                </div>
                                            )}
                                            <div className="options-preview">
                                                {question.options.map((opt, optIdx) => (
                                                    <span
                                                        key={optIdx}
                                                        className={`option-tag ${optIdx === question.correctAnswer ? 'correct' : ''}`}
                                                    >
                                                        {optionLabels[optIdx]}: {opt}
                                                        {question.optionImages?.[optIdx] && ' 🖼️'}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {quiz.status === 'draft' && (
                                            <div className="question-actions">
                                                <button
                                                    className="btn btn-ghost btn-small"
                                                    onClick={() => setEditingQuestion(question)}
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-small"
                                                    onClick={() => handleDeleteQuestion(question.id)}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Question Form */}
                    {showForm && quiz.status === 'draft' && (
                        <div className="question-form-container">
                            <form onSubmit={handleSubmit} className="question-form">
                                <div className="form-header-inline">
                                    <h3>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h3>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={resetForm}
                                    >
                                        ✕
                                    </button>
                                </div>

                                {errors.length > 0 && (
                                    <div className="error-box">
                                        {errors.map((error, idx) => (
                                            <p key={idx}>⚠️ {error}</p>
                                        ))}
                                    </div>
                                )}

                                {/* Question Text */}
                                <div className="form-group">
                                    <label>Question Text *</label>
                                    <textarea
                                        value={formData.text}
                                        onChange={handleTextChange}
                                        placeholder="Enter your question..."
                                        rows={3}
                                        autoFocus
                                    />
                                </div>

                                {/* Question Image URL */}
                                <div className="form-group">
                                    <label>Question Image URL (optional)</label>
                                    <input
                                        type="url"
                                        value={formData.imageUrl}
                                        onChange={handleImageUrlChange}
                                        placeholder="https://example.com/image.jpg"
                                    />
                                    {formData.imageUrl && (
                                        <div className="image-preview">
                                            <img 
                                                src={formData.imageUrl} 
                                                alt="Question preview" 
                                                onError={(e) => e.target.style.display = 'none'}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Options */}
                                <div className="form-group">
                                    <label>Answer Options (click to mark as correct) *</label>
                                    <div className="options-input">
                                        {formData.options.map((option, idx) => (
                                            <div
                                                key={idx}
                                                className={`option-input-row ${formData.correctAnswer === idx ? 'is-correct' : ''}`}
                                                onClick={() => handleCorrectAnswerChange(idx)}
                                            >
                                                <span className="option-letter">{optionLabels[idx]}</span>
                                                <div className="option-inputs">
                                                    <input
                                                        type="text"
                                                        value={option}
                                                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                                                        placeholder={`Option ${optionLabels[idx]}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <input
                                                        type="url"
                                                        value={formData.optionImages[idx]}
                                                        onChange={(e) => handleOptionImageChange(idx, e.target.value)}
                                                        placeholder="Image URL (optional)"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="option-image-input"
                                                    />
                                                    {formData.optionImages[idx] && (
                                                        <div className="option-image-preview">
                                                            <img 
                                                                src={formData.optionImages[idx]} 
                                                                alt={`Option ${optionLabels[idx]}`}
                                                                onError={(e) => e.target.style.display = 'none'}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                {formData.correctAnswer === idx && (
                                                    <span className="correct-badge">✓ Correct</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <span className="hint">Click on an option to mark it as the correct answer</span>
                                </div>

                                {/* Submit */}
                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={resetForm}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving...' : (editingQuestion ? 'Update Question' : 'Add Question')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ManageQuestions;
