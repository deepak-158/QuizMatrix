// Create Quiz Page - Form to create a new quiz
// Sets title, time mode (overall or per-question), and generates unique code

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import { useQuiz } from '../../hooks/useQuiz';
import { validateQuizData } from '../../utils/helpers';

const CreateQuiz = () => {
    const navigate = useNavigate();
    const { createQuiz } = useQuiz();

    const [formData, setFormData] = useState({
        title: '',
        timeMode: 'perQuestion', // 'perQuestion' or 'overall'
        timePerQuestion: 30,
        totalTime: 300
    });
    const [errors, setErrors] = useState([]);
    const [saving, setSaving] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'totalTime' || name === 'timePerQuestion' ? parseInt(value) || 30 : value
        }));
        setErrors([]);
    };

    const handleTimeModeChange = (mode) => {
        setFormData(prev => ({ ...prev, timeMode: mode }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate
        const validationErrors = validateQuizData(formData);
        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setSaving(true);
        try {
            const { id, quizCode } = await createQuiz(formData);

            // Show success and redirect to add questions
            alert(`Quiz created! Your quiz code is: ${quizCode}`);
            navigate(`/admin/quiz/${id}/questions`);

        } catch (error) {
            console.error('Error creating quiz:', error);
            setErrors(['Failed to create quiz. Please try again.']);
        }
        setSaving(false);
    };

    return (
        <div className="create-quiz-page">
            <Header />

            <main className="page-content">
                <div className="form-container">
                    <div className="form-header">
                        <button
                            className="btn btn-ghost back-btn"
                            onClick={() => navigate('/admin')}
                        >
                            ← Back
                        </button>
                        <h1>Create New Quiz</h1>
                        <p>Set up your quiz details</p>
                    </div>

                    <form onSubmit={handleSubmit} className="quiz-form">
                        {/* Error Messages */}
                        {errors.length > 0 && (
                            <div className="error-box">
                                {errors.map((error, idx) => (
                                    <p key={idx}>⚠️ {error}</p>
                                ))}
                            </div>
                        )}

                        {/* Quiz Title */}
                        <div className="form-group">
                            <label htmlFor="title">Quiz Title *</label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g., Tech Quiz 2024"
                                maxLength={100}
                                autoFocus
                            />
                            <span className="hint">Give your quiz a descriptive name</span>
                        </div>

                        {/* Time Mode Selection */}
                        <div className="form-group">
                            <label>Quiz Timing Mode *</label>
                            <div className="mode-buttons">
                                <button
                                    type="button"
                                    className={`mode-btn ${formData.timeMode === 'perQuestion' ? 'active' : ''}`}
                                    onClick={() => handleTimeModeChange('perQuestion')}
                                >
                                    <span className="mode-icon">⏱️</span>
                                    <span className="mode-title">Per Question</span>
                                    <span className="mode-desc">Admin controls timing</span>
                                </button>
                                <button
                                    type="button"
                                    className={`mode-btn ${formData.timeMode === 'overall' ? 'active' : ''}`}
                                    onClick={() => handleTimeModeChange('overall')}
                                >
                                    <span className="mode-icon">⏳</span>
                                    <span className="mode-title">Overall Time</span>
                                    <span className="mode-desc">Self-paced quiz</span>
                                </button>
                            </div>
                        </div>

                        {/* Per Question Time Settings */}
                        {formData.timeMode === 'perQuestion' && (
                            <div className="form-group">
                                <label htmlFor="timePerQuestion">Time per Question (seconds) *</label>
                                <div className="time-input">
                                    <input
                                        type="range"
                                        id="timePerQuestion"
                                        name="timePerQuestion"
                                        min="10"
                                        max="120"
                                        step="5"
                                        value={formData.timePerQuestion}
                                        onChange={handleChange}
                                    />
                                    <span className="time-display">{formData.timePerQuestion}s</span>
                                </div>
                                <div className="time-presets">
                                    {[15, 30, 45, 60, 90].map(time => (
                                        <button
                                            key={time}
                                            type="button"
                                            className={`preset-btn ${formData.timePerQuestion === time ? 'active' : ''}`}
                                            onClick={() => setFormData(prev => ({ ...prev, timePerQuestion: time }))}
                                        >
                                            {time}s
                                        </button>
                                    ))}
                                </div>
                                <span className="hint">Admin controls when each question starts</span>
                            </div>
                        )}

                        {/* Overall Time Settings */}
                        {formData.timeMode === 'overall' && (
                            <div className="form-group">
                                <label htmlFor="totalTime">Total Quiz Duration *</label>
                                <div className="time-input">
                                    <input
                                        type="range"
                                        id="totalTime"
                                        name="totalTime"
                                        min="60"
                                        max="3600"
                                        step="30"
                                        value={formData.totalTime}
                                        onChange={handleChange}
                                    />
                                    <span className="time-display">{Math.floor(formData.totalTime / 60)}m {formData.totalTime % 60}s</span>
                                </div>
                                <div className="time-presets">
                                    {[300, 600, 900, 1200, 1800].map(time => (
                                        <button
                                            key={time}
                                            type="button"
                                            className={`preset-btn ${formData.totalTime === time ? 'active' : ''}`}
                                            onClick={() => setFormData(prev => ({ ...prev, totalTime: time }))}
                                        >
                                            {Math.floor(time / 60)}m
                                        </button>
                                    ))}
                                </div>
                                <span className="hint">Participants can navigate questions freely</span>
                            </div>
                        )}

                        {/* Info Box */}
                        <div className="info-box">
                            <h4>📌 {formData.timeMode === 'perQuestion' ? 'Per Question Mode' : 'Overall Time Mode'}</h4>
                            {formData.timeMode === 'perQuestion' ? (
                                <ul>
                                    <li>Admin controls when each question appears</li>
                                    <li>All participants see the same question</li>
                                    <li>Timer resets for each question</li>
                                    <li>Best for live, synchronized quizzes</li>
                                </ul>
                            ) : (
                                <ul>
                                    <li>Participants answer at their own pace</li>
                                    <li>Navigate between questions freely</li>
                                    <li>Quiz auto-submits when time runs out</li>
                                    <li>Best for exams and assessments</li>
                                </ul>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="btn btn-primary btn-large full-width"
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <span className="spinner-small"></span>
                                    Creating Quiz...
                                </>
                            ) : (
                                'Create Quiz & Add Questions →'
                            )}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default CreateQuiz;
