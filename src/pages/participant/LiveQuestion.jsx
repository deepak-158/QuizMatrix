// Live Question Page - Main participant view during quiz
// Shows question, timer, answer options, and handles submissions
// Supports both per-question (admin-controlled) and overall (self-paced) modes

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Timer from '../../components/Timer';
import LoadingSpinner from '../../components/LoadingSpinner';
import Leaderboard from '../../components/Leaderboard';
import { useAuth } from '../../context/AuthContext';
import { useQuiz, useQuizSubscription, useQuestionsSubscription, useParticipantsSubscription } from '../../hooks/useQuiz';

// Memoized Question Navigator for self-paced mode
const QuestionNavigator = memo(({ 
    questionsCount, 
    selfPacedIndex, 
    answeredQuestionsArray,
    onGoToQuestion 
}) => {
    return (
        <div className="question-navigator">
            {Array.from({ length: questionsCount }, (_, idx) => (
                <button
                    key={idx}
                    className={`nav-dot ${idx === selfPacedIndex ? 'active' : ''} ${answeredQuestionsArray.includes(idx) ? 'answered' : ''}`}
                    onClick={() => onGoToQuestion(idx)}
                >
                    {idx + 1}
                </button>
            ))}
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.questionsCount === nextProps.questionsCount &&
        prevProps.selfPacedIndex === nextProps.selfPacedIndex &&
        prevProps.answeredQuestionsArray.length === nextProps.answeredQuestionsArray.length &&
        prevProps.answeredQuestionsArray.every((v, i) => v === nextProps.answeredQuestionsArray[i])
    );
});

QuestionNavigator.displayName = 'QuestionNavigator';

// Memoized Question Options Component - prevents re-renders from timer
const QuestionOptions = memo(({
    currentQuestion, 
    selectedAnswer, 
    showResult, 
    wasCorrect, 
    isQuestionAnswered, 
    isSelfPaced,
    submitting,
    onOptionClick 
}) => {
    const optionLabels = ['A', 'B', 'C', 'D'];
    const optionColors = ['option-red', 'option-blue', 'option-yellow', 'option-green'];

    return (
        <div className="options-grid modern">
            {currentQuestion.options.map((option, idx) => {
                let optionClass = `option-btn ${optionColors[idx]}`;

                if (showResult && !isSelfPaced) {
                    if (idx === currentQuestion.correctAnswer) {
                        optionClass += ' correct';
                    } else if (idx === selectedAnswer && !wasCorrect) {
                        optionClass += ' incorrect';
                    }
                } else if (selectedAnswer === idx) {
                    optionClass += ' selected';
                }

                if (isQuestionAnswered && isSelfPaced) {
                    optionClass += ' disabled';
                }

                return (
                    <button
                        key={idx}
                        className={optionClass}
                        onClick={() => onOptionClick(idx)}
                        disabled={isQuestionAnswered || submitting}
                    >
                        <span className="option-letter">{optionLabels[idx]}</span>
                        {currentQuestion.optionImages?.[idx] && (
                            <img 
                                src={currentQuestion.optionImages[idx]} 
                                alt={`Option ${optionLabels[idx]}`}
                                className="option-image"
                            />
                        )}
                        <span className="option-text">{option}</span>
                    </button>
                );
            })}
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render if these specific props change
    // Use optional chaining to prevent errors on undefined
    return (
        prevProps.currentQuestion?.id === nextProps.currentQuestion?.id &&
        prevProps.currentQuestion?.text === nextProps.currentQuestion?.text &&
        prevProps.selectedAnswer === nextProps.selectedAnswer &&
        prevProps.showResult === nextProps.showResult &&
        prevProps.wasCorrect === nextProps.wasCorrect &&
        prevProps.isQuestionAnswered === nextProps.isQuestionAnswered &&
        prevProps.isSelfPaced === nextProps.isSelfPaced &&
        prevProps.submitting === nextProps.submitting
    );
});

QuestionOptions.displayName = 'QuestionOptions';

// Memoized Question Card Component
const QuestionCard = memo(({ 
    currentQuestion, 
    currentQuestionIndex,
    totalQuestions,
    selectedAnswer, 
    showResult, 
    wasCorrect,
    lastPoints,
    isQuestionAnswered, 
    isSelfPaced,
    submitting,
    selfPacedIndex,
    answeredQuestionsSize,
    onOptionClick,
    onSubmitAnswer,
    onGoToPrevious,
    onGoToNext,
    hasAnswered
}) => {
    return (
        <div className={`question-card ${showResult ? 'show-result' : ''}`}>
            {/* Question Image */}
            {currentQuestion.imageUrl && (
                <div className="question-image">
                    <img src={currentQuestion.imageUrl} alt="Question" />
                </div>
            )}
            
            <h2 className="question-text">{currentQuestion.text}</h2>

            {/* Answer Options - Modern Kahoot/Quizizz style */}
            <QuestionOptions
                currentQuestion={currentQuestion}
                selectedAnswer={selectedAnswer}
                showResult={showResult}
                wasCorrect={wasCorrect}
                isQuestionAnswered={isQuestionAnswered}
                isSelfPaced={isSelfPaced}
                submitting={submitting}
                onOptionClick={onOptionClick}
            />

            {/* Submit Button */}
            {selectedAnswer !== null && !isQuestionAnswered && (
                <button
                    className="btn btn-primary btn-large submit-btn"
                    onClick={onSubmitAnswer}
                    disabled={submitting}
                >
                    {submitting ? 'Submitting...' : 'Submit Answer'}
                </button>
            )}

            {/* Result Feedback (per-question mode) */}
            {showResult && !isSelfPaced && (
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

            {/* Self-paced Navigation */}
            {isSelfPaced && (
                <div className="self-paced-nav">
                    <button
                        className="btn btn-secondary"
                        onClick={onGoToPrevious}
                        disabled={selfPacedIndex === 0}
                    >
                        ← Previous
                    </button>
                    <span className="nav-status">
                        {answeredQuestionsSize} / {totalQuestions} answered
                    </span>
                    <button
                        className="btn btn-secondary"
                        onClick={onGoToNext}
                        disabled={selfPacedIndex === totalQuestions - 1}
                    >
                        Next →
                    </button>
                </div>
            )}

            {/* Waiting for next question (per-question mode) */}
            {!isSelfPaced && hasAnswered && (
                <p className="waiting-next">Waiting for next question...</p>
            )}

            {/* Answered indicator for self-paced */}
            {isSelfPaced && isQuestionAnswered && (
                <p className="answered-indicator">✓ Answer submitted for this question</p>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render when question-related props change
    // Use optional chaining to prevent errors on undefined
    return (
        prevProps.currentQuestion?.id === nextProps.currentQuestion?.id &&
        prevProps.currentQuestion?.text === nextProps.currentQuestion?.text &&
        prevProps.currentQuestionIndex === nextProps.currentQuestionIndex &&
        prevProps.selectedAnswer === nextProps.selectedAnswer &&
        prevProps.showResult === nextProps.showResult &&
        prevProps.wasCorrect === nextProps.wasCorrect &&
        prevProps.lastPoints === nextProps.lastPoints &&
        prevProps.isQuestionAnswered === nextProps.isQuestionAnswered &&
        prevProps.isSelfPaced === nextProps.isSelfPaced &&
        prevProps.submitting === nextProps.submitting &&
        prevProps.selfPacedIndex === nextProps.selfPacedIndex &&
        prevProps.answeredQuestionsSize === nextProps.answeredQuestionsSize &&
        prevProps.hasAnswered === nextProps.hasAnswered &&
        prevProps.totalQuestions === nextProps.totalQuestions
    );
});

QuestionCard.displayName = 'QuestionCard';

const LiveQuestion = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { quiz, loading: quizLoading } = useQuizSubscription(quizId);
    const { questions } = useQuestionsSubscription(quizId);
    const { participants } = useParticipantsSubscription(quizId);
    const { submitAnswer, hasAnswered: checkHasAnswered, joinQuiz } = useQuiz();

    // Self-paced mode state
    const [selfPacedIndex, setSelfPacedIndex] = useState(0);
    const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
    
    // Per-question mode state
    const [showResult, setShowResult] = useState(false);
    const [lastPoints, setLastPoints] = useState(0);
    const [wasCorrect, setWasCorrect] = useState(false);
    const [answerStartTime, setAnswerStartTime] = useState(null);
    const [displayScore, setDisplayScore] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Refs to avoid callback recreation - values that change but shouldn't cause re-renders
    const participantsRef = useRef(participants);
    const answerStartTimeRef = useRef(null);
    const answeredQuestionsRef = useRef(answeredQuestions);
    const questionsRef = useRef(questions);
    const quizRef = useRef(quiz);
    const hasAnsweredRef = useRef(hasAnswered);
    const submittingRef = useRef(submitting);
    const selectedAnswerRef = useRef(selectedAnswer);
    const currentQuestionIndexRef = useRef(0);
    const prevQuestionIndexRef = useRef(-1); // Track previous question to detect actual changes

    // Check if quiz is in self-paced mode
    const isSelfPaced = quiz?.timeMode === 'overall';
    const isSelfPacedRef = useRef(isSelfPaced);

    // Keep refs updated
    useEffect(() => {
        answeredQuestionsRef.current = answeredQuestions;
    }, [answeredQuestions]);
    
    useEffect(() => {
        questionsRef.current = questions;
    }, [questions]);
    
    useEffect(() => {
        quizRef.current = quiz;
        isSelfPacedRef.current = quiz?.timeMode === 'overall';
    }, [quiz]);
    
    useEffect(() => {
        hasAnsweredRef.current = hasAnswered;
    }, [hasAnswered]);
    
    useEffect(() => {
        submittingRef.current = submitting;
    }, [submitting]);
    
    useEffect(() => {
        selectedAnswerRef.current = selectedAnswer;
    }, [selectedAnswer]);

    // Memoize current question index to prevent unnecessary recalculations
    const currentQuestionIndex = useMemo(() => {
        if (isSelfPaced) {
            return selfPacedIndex;
        }
        return quiz?.currentQuestionIndex ?? -1;
    }, [isSelfPaced, selfPacedIndex, quiz?.currentQuestionIndex]);

    // Keep currentQuestionIndex ref updated
    useEffect(() => {
        currentQuestionIndexRef.current = currentQuestionIndex;
    }, [currentQuestionIndex]);

    // Keep participants ref updated without causing re-renders
    useEffect(() => {
        participantsRef.current = participants;
        const myParticipant = participants.find(p => p.oduid === user?.uid);
        if (myParticipant?.score !== undefined && myParticipant.score !== displayScore) {
            setDisplayScore(myParticipant.score);
        }
    }, [participants, user?.uid, displayScore]);

    const currentParticipant = participantsRef.current.find(p => p.oduid === user?.uid);

    // Join quiz if not already joined
    useEffect(() => {
        if (quiz && user && !currentParticipant) {
            joinQuiz(quizId);
        }
    }, [quiz, user, currentParticipant, quizId, joinQuiz]);

    // Set answer start time for per-question mode
    useEffect(() => {
        if (!isSelfPaced && quiz?.questionStartTime) {
            answerStartTimeRef.current = quiz.questionStartTime;
            setAnswerStartTime(quiz.questionStartTime);
        }
    }, [quiz?.questionStartTime, isSelfPaced]);

    // Set answer start time for self-paced mode (quiz start time)
    useEffect(() => {
        if (isSelfPaced && quiz?.quizStartTime) {
            answerStartTimeRef.current = quiz.quizStartTime;
            setAnswerStartTime(quiz.quizStartTime);
        }
    }, [quiz?.quizStartTime, isSelfPaced]);

    // Check if already answered when question changes (per-question mode)
    // Only reset state when the question index ACTUALLY changes to a new value
    useEffect(() => {
        if (!isSelfPaced && quiz && quiz.currentQuestionIndex >= 0) {
            const currentIdx = quiz.currentQuestionIndex;
            
            // Only reset if this is a NEW question (index changed)
            if (prevQuestionIndexRef.current !== currentIdx) {
                prevQuestionIndexRef.current = currentIdx;
                
                const checkAnswered = async () => {
                    const answered = await checkHasAnswered(quizId, currentIdx);
                    setHasAnswered(answered);
                    setSelectedAnswer(null);
                    setShowResult(false);
                };
                checkAnswered();
            }
        }
    }, [quiz?.currentQuestionIndex, quizId, checkHasAnswered, isSelfPaced]);

    // Handle time running out - uses refs to avoid re-creation
    const handleTimeUp = useCallback(() => {
        if (isSelfPacedRef.current) {
            // In self-paced mode, quiz ends when time is up
            navigate(`/quiz/${quizId}/results`);
        } else {
            if (!hasAnsweredRef.current) {
                setHasAnswered(true);
                setShowResult(true);
                setWasCorrect(false);
                setLastPoints(0);
            }
        }
    }, [navigate, quizId]); // Minimal deps - uses refs

    // Handle option selection - uses refs to avoid re-creation
    const handleOptionClick = useCallback((optionIndex) => {
        if (hasAnsweredRef.current || submittingRef.current) return;
        if (isSelfPacedRef.current && answeredQuestionsRef.current.has(currentQuestionIndexRef.current)) return;
        
        setSelectedAnswer(optionIndex);
    }, []); // Empty deps - uses refs

    // Handle answer submission - uses refs to avoid re-creation
    const handleSubmitAnswer = useCallback(async () => {
        const currentSelectedAnswer = selectedAnswerRef.current;
        const currentIndex = currentQuestionIndexRef.current;
        const selfPaced = isSelfPacedRef.current;
        
        if (currentSelectedAnswer === null || submittingRef.current) return;
        if (!selfPaced && hasAnsweredRef.current) return;
        if (selfPaced && answeredQuestionsRef.current.has(currentIndex)) return;

        setSubmitting(true);

        try {
            const currentQuestion = questionsRef.current[currentIndex];
            if (!currentQuestion) {
                throw new Error('Question not found');
            }

            const isCorrect = currentSelectedAnswer === currentQuestion.correctAnswer;

            // Calculate time taken
            let startTime;
            const timeRef = answerStartTimeRef.current;
            if (timeRef?.toDate) {
                startTime = timeRef.toDate();
            } else if (timeRef?.seconds) {
                startTime = new Date(timeRef.seconds * 1000);
            } else if (timeRef) {
                startTime = new Date(timeRef);
            } else {
                startTime = new Date();
            }

            const timeTaken = Math.max(0, (Date.now() - startTime.getTime()) / 1000);
            const quiz = quizRef.current;
            const maxTime = selfPaced ? quiz?.totalTime : quiz?.timePerQuestion;

            const points = await submitAnswer(
                quizId,
                currentIndex,
                currentSelectedAnswer,
                timeTaken,
                isCorrect,
                maxTime
            );

            if (selfPaced) {
                setAnsweredQuestions(prev => new Set([...prev, currentIndex]));
                setDisplayScore(prev => prev + points);
                setSelectedAnswer(null);
            } else {
                setHasAnswered(true);
                setShowResult(true);
                setWasCorrect(isCorrect);
                setLastPoints(points);
                setDisplayScore(prev => prev + points);
            }
        } catch (error) {
            console.error('Error submitting answer:', error);
            alert('Failed to submit answer: ' + error.message);
        }

        setSubmitting(false);
    }, [submitAnswer, quizId]); // Minimal deps - uses refs for everything else

    // Navigation for self-paced mode - uses refs to avoid re-creation
    const goToQuestion = useCallback((index) => {
        const questionsLength = questionsRef.current?.length || 0;
        if (isSelfPacedRef.current && index >= 0 && index < questionsLength) {
            setSelfPacedIndex(index);
            setSelectedAnswer(null);
        }
    }, []); // Empty deps - uses refs

    const goToPrevious = useCallback(() => {
        setSelfPacedIndex(prev => Math.max(0, prev - 1));
        setSelectedAnswer(null);
    }, []);
    
    const goToNext = useCallback(() => {
        const questionsLength = questionsRef.current?.length || 0;
        setSelfPacedIndex(prev => Math.min(questionsLength - 1, prev + 1));
        setSelectedAnswer(null);
    }, []);

    // Determine waiting state - different logic for self-paced vs per-question mode
    // MUST be defined before any early returns
    const isWaitingState = useMemo(() => {
        if (!quiz) return true;
        
        // Always waiting if quiz status is waiting or draft
        if (quiz.status === 'waiting' || quiz.status === 'draft') {
            return true;
        }
        
        // For self-paced mode, wait until quizStartTime is set (quiz started)
        if (isSelfPaced) {
            return !quiz.quizStartTime;
        }
        
        // For per-question mode, wait until first question is pushed
        return quiz.currentQuestionIndex === undefined || 
               quiz.currentQuestionIndex === null ||
               quiz.currentQuestionIndex < 0;
    }, [quiz, isSelfPaced]);

    // Memoize answered questions as array for stable comparison in child components
    const answeredQuestionsArray = useMemo(() => 
        Array.from(answeredQuestions), 
        [answeredQuestions]
    );

    // Live question state - use the memoized currentQuestionIndex
    const currentQuestion = questions?.[currentQuestionIndex];
    const isQuestionAnswered = isSelfPaced ? answeredQuestions.has(currentQuestionIndex) : hasAnswered;

    // Memoize timer props to prevent unnecessary Timer re-renders
    // MUST be defined before any early returns
    const timerStartTime = useMemo(() => {
        if (!quiz) return null;
        return isSelfPaced ? quiz.quizStartTime : quiz.questionStartTime;
    }, [isSelfPaced, quiz]);
    
    const timerDuration = useMemo(() => {
        if (!quiz) return 30;
        return isSelfPaced ? (quiz.totalTime || 300) : (quiz.timePerQuestion || 30);
    }, [isSelfPaced, quiz]);

    const timerIsActive = useMemo(() => 
        isSelfPaced ? true : !hasAnswered,
        [isSelfPaced, hasAnswered]
    );

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

    // Wait for questions to load
    if (!questions || questions.length === 0) {
        return <LoadingSpinner message="Loading questions..." />;
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

    // Waiting state UI
    if (isWaitingState) {
        const timeInfo = isSelfPaced 
            ? `${Math.floor((quiz.totalTime || 300) / 60)}m ${(quiz.totalTime || 300) % 60}s total`
            : `${quiz.timePerQuestion || 30}s per question`;
        
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
                            <span>{questions.length} questions · {timeInfo}</span>
                            {isSelfPaced && <span className="mode-badge">Self-Paced Mode</span>}
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

    // If question not found at index, show loading
    if (!currentQuestion) {
        return <LoadingSpinner message="Loading question..." />;
    }

    // Ensure we have valid timer start time before rendering
    if (!timerStartTime) {
        return <LoadingSpinner message="Syncing with server..." />;
    }

    return (
        <div className="live-question-page">
            <Header />

            <main className="question-content">
                {/* Top Bar - Progress and Score */}
                <div className="question-top-bar">
                    <div className="question-progress">
                        <span className="progress-text">
                            Question {currentQuestionIndex + 1} / {questions.length}
                        </span>
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="score-display">
                        <span className="score-label">Score</span>
                        <span className="score-value">{displayScore}</span>
                    </div>
                </div>

                {/* Timer - Separate from question content to prevent re-renders */}
                <Timer
                    key={`timer-${currentQuestionIndex}-${timerStartTime?.seconds || timerStartTime}`}
                    startTime={timerStartTime}
                    duration={timerDuration}
                    onTimeUp={handleTimeUp}
                    isActive={timerIsActive}
                />

                {/* Question Navigator for self-paced mode - Memoized */}
                {isSelfPaced && (
                    <QuestionNavigator
                        questionsCount={questions.length}
                        selfPacedIndex={selfPacedIndex}
                        answeredQuestionsArray={answeredQuestionsArray}
                        onGoToQuestion={goToQuestion}
                    />
                )}

                {/* Question Card - Memoized to prevent re-renders from timer */}
                <QuestionCard
                    currentQuestion={currentQuestion}
                    currentQuestionIndex={currentQuestionIndex}
                    totalQuestions={questions.length}
                    selectedAnswer={selectedAnswer}
                    showResult={showResult}
                    wasCorrect={wasCorrect}
                    lastPoints={lastPoints}
                    isQuestionAnswered={isQuestionAnswered}
                    isSelfPaced={isSelfPaced}
                    submitting={submitting}
                    selfPacedIndex={selfPacedIndex}
                    answeredQuestionsSize={answeredQuestions.size}
                    onOptionClick={handleOptionClick}
                    onSubmitAnswer={handleSubmitAnswer}
                    onGoToPrevious={goToPrevious}
                    onGoToNext={goToNext}
                    hasAnswered={hasAnswered}
                />
            </main>
        </div>
    );
};

export default LiveQuestion;
