// Quiz Control Page - Admin control panel during live quiz
// Shows current question, controls, and real-time participant count
// Supports both per-question (admin-controlled) and overall (self-paced) modes

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import Leaderboard from '../../components/Leaderboard';
import Timer from '../../components/Timer';
import { useQuiz, useQuizSubscription, useQuestionsSubscription, useParticipantsSubscription } from '../../hooks/useQuiz';


const QuizControl = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { quiz, loading: quizLoading } = useQuizSubscription(quizId);
    const { questions } = useQuestionsSubscription(quizId);
    const { participants } = useParticipantsSubscription(quizId);
    const { nextQuestion, endQuiz, restartQuiz, startSelfPacedQuiz } = useQuiz();

    const [transitioning, setTransitioning] = useState(false);
    const autoAdvanceRef = useRef(false); // Prevent multiple auto-advances
    const lastQuestionIndexRef = useRef(-1);

    // Check if quiz is in self-paced mode
    const isSelfPaced = quiz?.timeMode === 'overall';

    // Reset auto-advance flag when question changes
    useEffect(() => {
        if (quiz?.currentQuestionIndex !== lastQuestionIndexRef.current) {
            autoAdvanceRef.current = false;
            lastQuestionIndexRef.current = quiz?.currentQuestionIndex ?? -1;
        }
    }, [quiz?.currentQuestionIndex]);

    const handleNextQuestion = async () => {
        if (transitioning) return;
        setTransitioning(true);
        try {
            await nextQuestion(quizId, quiz.currentQuestionIndex, questions.length);
        } catch (error) {
            console.error('Error moving to next question:', error);
            alert('Failed to move to next question');
        }
        setTransitioning(false);
    };

    // Start self-paced quiz - shows all questions at once
    const handleStartSelfPaced = async () => {
        if (transitioning) return;
        setTransitioning(true);
        try {
            await startSelfPacedQuiz(quizId);
        } catch (error) {
            console.error('Error starting self-paced quiz:', error);
            alert('Failed to start quiz');
        }
        setTransitioning(false);
    };

    // Auto-advance when timer ends (only for per-question mode)
    const handleAutoNext = useCallback(() => {
        if (isSelfPaced) return; // Don't auto-advance in self-paced mode
        if (autoAdvanceRef.current || transitioning) return;
        autoAdvanceRef.current = true;
        handleNextQuestion();
    }, [quizId, quiz?.currentQuestionIndex, questions?.length, transitioning, isSelfPaced]);

    // Handle quiz end for self-paced mode (when total time runs out)
    const handleSelfPacedTimeUp = useCallback(async () => {
        if (!isSelfPaced) return;
        try {
            await endQuiz(quizId);
        } catch (error) {
            console.error('Error ending quiz:', error);
        }
    }, [quizId, isSelfPaced, endQuiz]);

    const handleEndQuiz = async () => {
        if (!window.confirm('Are you sure you want to end the quiz now?')) return;

        try {
            await endQuiz(quizId);
        } catch (error) {
            console.error('Error ending quiz:', error);
            alert('Failed to end quiz');
        }
    };

    const handleRestartQuiz = async () => {
        if (!window.confirm('Restart quiz? This will reset all participant scores and start fresh.')) return;

        setTransitioning(true);
        try {
            await restartQuiz(quizId);
        } catch (error) {
            console.error('Error restarting quiz:', error);
            alert('Failed to restart quiz');
        }
        setTransitioning(false);
    };

    if (quizLoading) {
        return <LoadingSpinner message="Loading quiz control..." />;
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

    const currentQuestion = quiz.currentQuestionIndex >= 0
        ? questions[quiz.currentQuestionIndex]
        : null;

    const optionLabels = ['A', 'B', 'C', 'D'];

    return (
        <div className="quiz-control-page">
            <Header />

            <main className="control-content">
                {/* Status Bar */}
                <div className="control-status-bar">
                    <div className="status-info">
                        <h1>{quiz.title}</h1>
                        <div className="status-chips">
                            <span className="chip">Code: <strong>{quiz.quizCode}</strong></span>
                            <span className={`chip status-${quiz.status}`}>
                                {quiz.status === 'waiting' && '⏳ Waiting for start'}
                                {quiz.status === 'live' && '🔴 LIVE'}
                                {quiz.status === 'ended' && '✅ Ended'}
                            </span>
                        </div>
                    </div>
                    <div className="participant-count">
                        <span className="count-number">{participants.length}</span>
                        <span className="count-label">Participants</span>
                    </div>
                </div>

                <div className="control-layout">
                    {/* Main Control Area */}
                    <div className="control-main">
                        {/* Waiting State */}
                        {quiz.status === 'waiting' && (
                            <div className="waiting-state">
                                <div className="waiting-icon">⏳</div>
                                <h2>Waiting for Participants</h2>
                                <p>Share the quiz code with participants:</p>
                                <div className="big-code">{quiz.quizCode}</div>
                                <p className="participant-info">
                                    {participants.length} participant(s) have joined
                                </p>
                                
                                {/* Mode indicator */}
                                <div className="mode-indicator">
                                    {isSelfPaced ? (
                                        <>
                                            <span className="mode-badge self-paced">Self-Paced Mode</span>
                                            <p className="mode-description">
                                                Participants will have {Math.floor(quiz.totalTime / 60)}m {quiz.totalTime % 60}s to complete all {questions.length} questions at their own pace.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <span className="mode-badge per-question">Per-Question Mode</span>
                                            <p className="mode-description">
                                                You control when each question starts. {quiz.timePerQuestion}s per question.
                                            </p>
                                        </>
                                    )}
                                </div>

                                <button
                                    className="btn btn-primary btn-large"
                                    onClick={isSelfPaced ? handleStartSelfPaced : handleNextQuestion}
                                    disabled={transitioning || participants.length === 0}
                                >
                                    {transitioning ? 'Starting...' : (isSelfPaced ? '🚀 Start Quiz' : '🚀 Start First Question')}
                                </button>
                                {participants.length === 0 && (
                                    <p className="hint">Wait for at least one participant to join</p>
                                )}
                            </div>
                        )}

                        {/* Live Question State - Per-question mode */}
                        {quiz.status === 'live' && !isSelfPaced && currentQuestion && (
                            <div className="live-question-control">
                                <div className="question-progress">
                                    Question {quiz.currentQuestionIndex + 1} of {questions.length}
                                </div>

                                {/* Timer for admin - auto-advances when time is up */}
                                <Timer
                                    key={`timer-${quiz.currentQuestionIndex}-${quiz.questionStartTime?.seconds || quiz.questionStartTime}`}
                                    startTime={quiz.questionStartTime}
                                    duration={quiz.timePerQuestion}
                                    isActive={true}
                                    onTimeUp={handleAutoNext}
                                />

                                <div className="current-question-card">
                                    <h2 className="question-text">{currentQuestion.text}</h2>

                                    {/* Question Image */}
                                    {currentQuestion.imageUrl && (
                                        <div className="question-image-display">
                                            <img src={currentQuestion.imageUrl} alt="Question" style={{ maxWidth: '100%', maxHeight: '300px', marginTop: '15px', borderRadius: '4px' }} />
                                        </div>
                                    )}

                                    {/* Options - DON'T show correct answer during live quiz */}
                                    <div className="options-display">
                                        {currentQuestion.options.map((option, idx) => (
                                            <div
                                                key={idx}
                                                className="option-display"
                                            >
                                                <span className="option-letter">{optionLabels[idx]}</span>
                                                <span className="option-text">{option}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="control-actions">
                                    <button
                                        className="btn btn-primary btn-large"
                                        onClick={handleNextQuestion}
                                        disabled={transitioning}
                                    >
                                        {transitioning ? 'Loading...' : (
                                            quiz.currentQuestionIndex + 1 >= questions.length
                                                ? '🏁 Finish Quiz'
                                                : '➡️ Next Question'
                                        )}
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleEndQuiz}
                                        disabled={transitioning}
                                    >
                                        End Quiz Now
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Live State - Self-paced mode */}
                        {quiz.status === 'live' && isSelfPaced && (
                            <div className="self-paced-control">
                                <div className="mode-badge self-paced large">Self-Paced Quiz In Progress</div>
                                
                                <Timer
                                    startTime={quiz.quizStartTime}
                                    duration={quiz.totalTime}
                                    isActive={true}
                                    onTimeUp={handleSelfPacedTimeUp}
                                />

                                <div className="self-paced-info">
                                    <p>Participants are answering questions at their own pace.</p>
                                    <p><strong>{questions.length}</strong> questions available</p>
                                </div>

                                <div className="questions-overview">
                                    <h3>All Questions</h3>
                                    {questions.map((q, idx) => (
                                        <div key={idx} className="question-mini">
                                            <span className="q-num">Q{idx + 1}</span>
                                            <span className="q-text">{q.text.substring(0, 50)}{q.text.length > 50 ? '...' : ''}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="control-actions">
                                    <button
                                        className="btn btn-danger btn-large"
                                        onClick={handleEndQuiz}
                                        disabled={transitioning}
                                    >
                                        🏁 End Quiz Now
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Ended State - NOW show correct answers */}
                        {quiz.status === 'ended' && (
                            <div className="ended-state">
                                <div className="ended-icon">🏆</div>
                                <h2>Quiz Ended!</h2>

                                {/* Show all questions with correct answers */}
                                <div className="questions-review">
                                    <h3>Answer Key</h3>
                                    {questions.map((q, qIdx) => (
                                        <div key={qIdx} className="review-question">
                                            <p className="review-q-text"><strong>Q{qIdx + 1}:</strong> {q.text}</p>
                                            <p className="review-answer">
                                                ✓ Correct: <strong>{optionLabels[q.correctAnswer]}) {q.options[q.correctAnswer]}</strong>
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="control-actions" style={{ marginTop: '20px' }}>
                                    <button
                                        className="btn btn-primary btn-large"
                                        onClick={() => navigate(`/admin/quiz/${quizId}/results`)}
                                    >
                                        📊 View Full Results
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-large"
                                        onClick={handleRestartQuiz}
                                        disabled={transitioning}
                                    >
                                        {transitioning ? 'Restarting...' : '🔄 Restart Quiz'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Leaderboard Sidebar */}
                    <div className="control-sidebar">
                        <Leaderboard
                            participants={participants}
                            title="Live Leaderboard"
                            maxDisplay={15}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default QuizControl;

