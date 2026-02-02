// Create Quiz Page - Form to create a new quiz
// Sets title, time per question, and generates unique code

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
        totalTime: 300
    });
    const [errors, setErrors] = useState([]);
    const [saving, setSaving] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'totalTime' ? parseInt(value) || 300 : value
        }));
        setErrors([]);
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

                        {/* Total Quiz Time */}
                        <div className="form-group">
                            <label htmlFor="totalTime">Total Quiz Duration (seconds) *</label>
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
                            <span className="hint">Total time for participants to answer all questions</span>
                        </div>

                        {/* Time Presets */}
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

                        {/* Info Box */}
                        <div className="info-box">
                            <h4>📌 What happens next?</h4>
                            <ul>
                                <li>A unique quiz code will be generated</li>
                                <li>You'll add questions to your quiz</li>
                                <li>Share the code with participants</li>
                                <li>Participants have the total time to answer all questions</li>
                                <li>Start the quiz when everyone has joined!</li>
                            </ul>
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
