// Live Question Page - Main participant view during quiz
// Shows question, timer, answer options, and handles submissions

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Timer from '../../components/Timer';
import LoadingSpinner from '../../components/LoadingSpinner';
import Leaderboard from '../../components/Leaderboard';
import { useAuth } from '../../context/AuthContext';
import { useQuiz, useQuizSubscription, useQuestionsSubscription, useParticipantsSubscription } from '../../hooks/useQuiz';

const LiveQuestion = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { quiz, loading: quizLoading } = useQuizSubscription(quizId);
    const { questions } = useQuestionsSubscription(quizId);
    const { participants } = useParticipantsSubscription(quizId);
    const { submitAnswer, hasAnswered: checkHasAnswered, joinQuiz } = useQuiz();

    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [lastPoints, setLastPoints] = useState(0);
    const [wasCorrect, setWasCorrect] = useState(false);
    const [answerStartTime, setAnswerStartTime] = useState(null);
    const [lastQuestionIndex, setLastQuestionIndex] = useState(-1);

    // Get current participant data
    const currentParticipant = participants.find(p => p.oduid === user?.uid);

    // Join quiz if not already joined
    useEffect(() => {
        if (quiz && user && !currentParticipant) {
            joinQuiz(quizId);
        }
    }, [quiz, user, currentParticipant, quizId, joinQuiz]);

    // Check if already answered when question changes
    useEffect(() => {
        // Only trigger when question index actually changes
        if (quiz && quiz.currentQuestionIndex >= 0 && quiz.currentQuestionIndex !== lastQuestionIndex) {
            const checkAnswered = async () => {
                const answered = await checkHasAnswered(quizId, quiz.currentQuestionIndex);
                setHasAnswered(answered);
                setSelectedAnswer(null);
                setShowResult(false);
                setAnswerStartTime(quiz.questionStartTime);
                setLastQuestionIndex(quiz.currentQuestionIndex);
            };
            checkAnswered();
        }
    }, [quiz?.currentQuestionIndex, quizId, checkHasAnswered, lastQuestionIndex]);

    // Handle time running out
    const handleTimeUp = useCallback(() => {
        if (!hasAnswered) {
            setHasAnswered(true);
            setShowResult(true);
            setWasCorrect(false);
            setLastPoints(0);
        }
    }, [hasAnswered]);

    // Handle answer selection
    const handleSelectAnswer = (optionIndex) => {
        if (hasAnswered || submitting) return;
        setSelectedAnswer(optionIndex);
    };

    // Handle answer submission
    const handleSubmit = async () => {
        if (selectedAnswer === null || hasAnswered || submitting) return;

        setSubmitting(true);

        try {
            const currentQuestion = questions[quiz.currentQuestionIndex];
            if (!currentQuestion) {
                throw new Error('Question not found');
            }

            const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

            // Calculate time taken - handle both Firestore Timestamp and Date
            let startTime;
            if (answerStartTime?.toDate) {
                startTime = answerStartTime.toDate();
            } else if (answerStartTime?.seconds) {
                startTime = new Date(answerStartTime.seconds * 1000);
            } else if (answerStartTime) {
                startTime = new Date(answerStartTime);
            } else {
                startTime = new Date();
            }

            const timeTaken = Math.max(0, (Date.now() - startTime.getTime()) / 1000);

            const points = await submitAnswer(
                quizId,
                quiz.currentQuestionIndex,
                selectedAnswer,
                timeTaken,
                isCorrect,
                quiz.timePerQuestion
            );

            setHasAnswered(true);
            setShowResult(true);
            setWasCorrect(isCorrect);
            setLastPoints(points);
        } catch (error) {
            console.error('Error submitting answer:', error);
            alert('Failed to submit answer: ' + error.message);
        }

        setSubmitting(false);
    };

    // Loading state
    if (quizLoading) {
        return <LoadingSpinner message="Loading quiz..." />;
    }

    // Quiz not found
    if (!quiz) {
        return (
            <div className="error-page">
                <h2>Quiz not found</h2>
                <button className="btn btn-primary" onClick={() => navigate('/join')}>
                    Back to Join
                </button>
            </div>
        );
    }

    // Quiz ended - redirect to results
    if (quiz.status === 'ended') {
        return (
            <div className="quiz-ended-page">
                <Header />
                <main className="ended-content">
                    <div className="ended-card">
                        <div className="ended-icon">🏆</div>
                        <h1>Quiz Ended!</h1>
                        <p>Your final score: <strong>{currentParticipant?.score || 0}</strong></p>
                        <Leaderboard
                            participants={participants}
                            title="Final Results"
                            maxDisplay={10}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/join')}
                        >
                            Join Another Quiz
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // Waiting state
    if (quiz.status === 'waiting' || quiz.currentQuestionIndex < 0) {
        return (
            <div className="quiz-lobby-page">
                <Header />
                <main className="lobby-content">
                    <div className="lobby-card">
                        <div className="waiting-animation">
                            <span className="pulse-dot"></span>
                        </div>
                        <h1>Waiting for Quiz to Start</h1>
                        <p>The host will start the quiz shortly</p>
                        <div className="quiz-info">
                            <span><strong>{quiz.title}</strong></span>
                            <span>{questions.length} questions · {quiz.timePerQuestion}s each</span>
                        </div>
                        <div className="participant-list">
                            <h4>Participants ({participants.length})</h4>
                            <div className="participants-preview">
                                {participants.slice(0, 5).map(p => (
                                    <div key={p.oduid} className="participant-chip">
                                        {p.photoURL && (
                                            <img src={p.photoURL} alt="" referrerPolicy="no-referrer" />
                                        )}
                                        <span>{p.displayName}</span>
                                    </div>
                                ))}
                                {participants.length > 5 && (
                                    <span className="more-count">+{participants.length - 5} more</span>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Live question state
    const currentQuestion = questions[quiz.currentQuestionIndex];
    const optionLabels = ['A', 'B', 'C', 'D'];

    if (!currentQuestion) {
        return <LoadingSpinner message="Loading question..." />;
    }

    return (
        <div className="live-question-page">
            <Header />

            <main className="question-content">
                {/* Top Bar - Progress and Timer */}
                <div className="question-top-bar">
                    <div className="question-progress">
                        <span className="progress-text">
                            Question {quiz.currentQuestionIndex + 1} / {questions.length}
                        </span>
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${((quiz.currentQuestionIndex + 1) / questions.length) * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="score-display">
                        <span className="score-label">Score</span>
                        <span className="score-value">{currentParticipant?.score || 0}</span>
                    </div>
                </div>

                {/* Timer */}
                <Timer
                    startTime={quiz.questionStartTime}
                    duration={quiz.timePerQuestion}
                    onTimeUp={handleTimeUp}
                    isActive={!hasAnswered}
                />

                {/* Question Card */}
                <div className={`question-card ${showResult ? 'show-result' : ''}`}>
                    <h2 className="question-text">{currentQuestion.text}</h2>

                    {/* Answer Options */}
                    <div className="options-grid">
                        {currentQuestion.options.map((option, idx) => {
                            let optionClass = 'option-btn';

                            if (showResult) {
                                if (idx === currentQuestion.correctAnswer) {
                                    optionClass += ' correct';
                                } else if (idx === selectedAnswer && !wasCorrect) {
                                    optionClass += ' incorrect';
                                }
                            } else if (selectedAnswer === idx) {
                                optionClass += ' selected';
                            }

                            return (
                                <button
                                    key={idx}
                                    className={optionClass}
                                    onClick={() => handleSelectAnswer(idx)}
                                    disabled={hasAnswered || submitting}
                                >
                                    <span className="option-letter">{optionLabels[idx]}</span>
                                    <span className="option-text">{option}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Result Feedback */}
                    {showResult && (
                        <div className={`result-feedback ${wasCorrect ? 'correct' : 'incorrect'}`}>
                            {wasCorrect ? (
                                <>
                                    <span className="result-icon">✓</span>
                                    <span>Correct! +{lastPoints} points</span>
                                </>
                            ) : (
                                <>
                                    <span className="result-icon">✗</span>
                                    <span>
                                        {selectedAnswer === null ? 'Time\'s up!' : 'Wrong answer!'}
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Submit Button */}
                    {!hasAnswered && (
                        <button
                            className="btn btn-primary btn-large submit-answer-btn"
                            onClick={handleSubmit}
                            disabled={selectedAnswer === null || submitting}
                        >
                            {submitting ? 'Submitting...' : 'Submit Answer'}
                        </button>
                    )}

                    {/* Waiting for next question */}
                    {hasAnswered && (
                        <p className="waiting-next">Waiting for next question...</p>
                    )}
                </div>
            </main>
        </div>
    );
};

export default LiveQuestion;
