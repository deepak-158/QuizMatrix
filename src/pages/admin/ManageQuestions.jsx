// Manage Questions Page - Add, edit, and delete quiz questions
// Each question has text, 4 options, and correct answer selection

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useQuiz, useQuizSubscription, useQuestionsSubscription } from '../../hooks/useQuiz';
import { validateQuestionData } from '../../utils/helpers';

const ManageQuestions = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { quiz, loading: quizLoading } = useQuizSubscription(quizId);
    const { questions, loading: questionsLoading } = useQuestionsSubscription(quizId);
    const { addQuestion, updateQuestion, deleteQuestion, startQuiz } = useQuiz();

    const [showForm, setShowForm] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [formData, setFormData] = useState({
        text: '',
        imageUrl: '',
        options: ['', '', '', ''],
        correctAnswer: -1
    });
    const [errors, setErrors] = useState([]);
    const [saving, setSaving] = useState(false);

    const resetForm = useCallback(() => {
        setFormData({
            text: '',
            imageUrl: '',
            options: ['', '', '', ''],
            correctAnswer: -1
        });
        setErrors([]);
        setShowForm(false);
        setEditingQuestion(null);
    }, []);

    // Reset form when editing question changes
    useEffect(() => {
        if (editingQuestion) {
            setFormData({
                text: editingQuestion.text,
                imageUrl: editingQuestion.imageUrl || '',
                options: [...editingQuestion.options],
                correctAnswer: editingQuestion.correctAnswer
            });
            setShowForm(true);
        } else {
            resetForm();
        }
    }, [editingQuestion, resetForm]);

    const handleTextChange = (e) => {
        setFormData(prev => ({ ...prev, text: e.target.value }));
        setErrors([]);
    };

    const handleImageChange = (e) => {
        setFormData(prev => ({ ...prev, imageUrl: e.target.value }));
        setErrors([]);
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...formData.options];
        newOptions[index] = value;
        setFormData(prev => ({ ...prev, options: newOptions }));
        setErrors([]);
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
                                                    <img src={question.imageUrl} alt="Question" style={{ maxWidth: '100%', maxHeight: '150px', marginTop: '8px', borderRadius: '4px' }} />
                                                </div>
                                            )}
                                            <div className="options-preview">
                                                {question.options.map((opt, optIdx) => (
                                                    <span
                                                        key={optIdx}
                                                        className={`option-tag ${optIdx === question.correctAnswer ? 'correct' : ''}`}
                                                    >
                                                        {optionLabels[optIdx]}: {opt}
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

                                {/* Question Image */}
                                <div className="form-group">
                                    <label>Question Image (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.imageUrl}
                                        onChange={handleImageChange}
                                        placeholder="Paste image URL here (e.g., https://example.com/image.jpg)"
                                    />
                                    {formData.imageUrl && (
                                        <div className="image-preview">
                                            <img src={formData.imageUrl} alt="Question preview" style={{ maxWidth: '100%', maxHeight: '200px', marginTop: '10px', borderRadius: '4px' }} />
                                        </div>
                                    )}
                                    <span className="hint">Add an image to your question by pasting a direct image URL</span>
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
                                                <input
                                                    type="text"
                                                    value={option}
                                                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                                                    placeholder={`Option ${optionLabels[idx]}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
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
