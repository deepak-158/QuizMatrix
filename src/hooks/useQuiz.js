// useQuiz - Custom hook for quiz-related Firestore operations
// Handles real-time subscriptions and quiz CRUD operations

import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../context/AuthContext';
import { generateQuizCode, calculateScore } from '../utils/helpers';

export const useQuiz = () => {
    const { user } = useAuth();

    // ============================================================================
    // QUIZ CRUD OPERATIONS
    // ============================================================================

    // Create a new quiz
    const createQuiz = async (quizData) => {
        const quizCode = generateQuizCode();

        const newQuiz = {
            ...quizData,
            quizCode,
            createdBy: user.uid,
            status: 'draft',
            currentQuestionIndex: -1,
            quizStartTime: null,
            questionStartTime: null,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'quizzes'), newQuiz);
        return { id: docRef.id, quizCode };
    };

    // Update quiz details
    const updateQuiz = async (quizId, updates) => {
        const quizRef = doc(db, 'quizzes', quizId);
        await updateDoc(quizRef, updates);
    };

    // Delete a quiz
    const deleteQuiz = async (quizId) => {
        // Delete all subcollections first
        await deleteSubcollection(quizId, 'questions');
        await deleteSubcollection(quizId, 'participants');
        await deleteSubcollection(quizId, 'responses');

        // Then delete the quiz document
        await deleteDoc(doc(db, 'quizzes', quizId));
    };

    // Helper to delete subcollection
    const deleteSubcollection = async (quizId, subcollectionName) => {
        const snapshot = await getDocs(collection(db, 'quizzes', quizId, subcollectionName));
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
    };

    // Get quiz by code
    const getQuizByCode = async (code) => {
        const q = query(
            collection(db, 'quizzes'),
            where('quizCode', '==', code.toUpperCase())
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const docData = snapshot.docs[0];
        return { id: docData.id, ...docData.data() };
    };

    // ============================================================================
    // QUESTION OPERATIONS
    // ============================================================================

    // Add a question to a quiz
    const addQuestion = async (quizId, questionData) => {
        const questionsRef = collection(db, 'quizzes', quizId, 'questions');

        // Get current question count for index
        const snapshot = await getDocs(questionsRef);
        const index = snapshot.size;

        const newQuestion = {
            ...questionData,
            index,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(questionsRef, newQuestion);

        // Update quiz total questions count
        await updateQuiz(quizId, { totalQuestions: index + 1 });

        return docRef.id;
    };

    // Update a question
    const updateQuestion = async (quizId, questionId, updates) => {
        const questionRef = doc(db, 'quizzes', quizId, 'questions', questionId);
        await updateDoc(questionRef, updates);
    };

    // Delete a question
    const deleteQuestion = async (quizId, questionId) => {
        await deleteDoc(doc(db, 'quizzes', quizId, 'questions', questionId));

        // Re-index remaining questions and update count
        const questionsRef = collection(db, 'quizzes', quizId, 'questions');
        const snapshot = await getDocs(query(questionsRef, orderBy('index')));

        let newIndex = 0;
        for (const doc of snapshot.docs) {
            await updateDoc(doc.ref, { index: newIndex });
            newIndex++;
        }

        await updateQuiz(quizId, { totalQuestions: newIndex });
    };

    // Get all questions for a quiz
    const getQuestions = async (quizId) => {
        const q = query(
            collection(db, 'quizzes', quizId, 'questions'),
            orderBy('index')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    // ============================================================================
    // LIVE QUIZ CONTROL
    // ============================================================================

    // Start the quiz (move from draft/waiting to live)
    const startQuiz = async (quizId) => {
        await updateQuiz(quizId, {
            status: 'waiting',
            currentQuestionIndex: -1,
            quizStartTime: null
        });
    };

    // Move to next question
    const nextQuestion = async (quizId, currentIndex, totalQuestions) => {
        const nextIndex = currentIndex + 1;

        if (nextIndex >= totalQuestions) {
            // Quiz is over
            await updateQuiz(quizId, {
                status: 'ended',
                currentQuestionIndex: currentIndex
            });
            return false;
        }

        const updateData = {
            status: 'live',
            currentQuestionIndex: nextIndex,
            questionStartTime: serverTimestamp()
        };

        // Set quiz start time only on first question
        if (nextIndex === 0) {
            updateData.quizStartTime = serverTimestamp();
        }

        await updateQuiz(quizId, updateData);
        return true;
    };

    // End the quiz
    const endQuiz = async (quizId) => {
        await updateQuiz(quizId, {
            status: 'ended'
        });
    };

    // Restart the quiz - reset to waiting state and clear all scores
    const restartQuiz = async (quizId) => {
        // Reset quiz to waiting state
        await updateQuiz(quizId, {
            status: 'waiting',
            currentQuestionIndex: -1,
            questionStartTime: null
        });

        // Reset all participant scores and answered questions
        const participantsRef = collection(db, 'quizzes', quizId, 'participants');
        const participantsSnap = await getDocs(participantsRef);

        const resetPromises = participantsSnap.docs.map(participantDoc =>
            updateDoc(participantDoc.ref, {
                score: 0,
                answeredQuestions: []
            })
        );
        await Promise.all(resetPromises);

        // Delete all responses
        await deleteSubcollection(quizId, 'responses');
    };

    // ============================================================================
    // PARTICIPANT OPERATIONS
    // ============================================================================

    // Join a quiz as participant
    const joinQuiz = async (quizId) => {
        const participantRef = doc(db, 'quizzes', quizId, 'participants', user.uid);

        // Check if already joined
        const existingSnap = await getDoc(participantRef);
        if (existingSnap.exists()) {
            return existingSnap.data();
        }

        const participantData = {
            oduid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            score: 0,
            answeredQuestions: [],
            joinedAt: serverTimestamp()
        };

        await setDoc(participantRef, participantData);
        return participantData;
    };

    // Submit an answer
    const submitAnswer = async (quizId, questionIndex, selectedAnswer, timeTaken, isCorrect, totalQuizTime) => {
        // Add response document
        const responsesRef = collection(db, 'quizzes', quizId, 'responses');
        await addDoc(responsesRef, {
            odquestionIndex: questionIndex,
            oduserId: user.uid,
            odselectedAnswer: selectedAnswer,
            odisCorrect: isCorrect,
            odtimeTaken: timeTaken,
            odsubmittedAt: serverTimestamp()
        });

        // Calculate and update score
        const points = calculateScore(isCorrect, timeTaken, totalQuizTime);

        const participantRef = doc(db, 'quizzes', quizId, 'participants', user.uid);
        const participantSnap = await getDoc(participantRef);

        if (participantSnap.exists()) {
            const currentData = participantSnap.data();
            await updateDoc(participantRef, {
                score: (currentData.score || 0) + points,
                answeredQuestions: [...(currentData.answeredQuestions || []), questionIndex]
            });
        }

        return points;
    };

    // Check if user already answered a question
    const hasAnswered = async (quizId, questionIndex) => {
        const participantRef = doc(db, 'quizzes', quizId, 'participants', user.uid);
        const snap = await getDoc(participantRef);

        if (!snap.exists()) return false;

        const data = snap.data();
        return data.answeredQuestions?.includes(questionIndex) || false;
    };

    return {
        // Quiz operations
        createQuiz,
        updateQuiz,
        deleteQuiz,
        getQuizByCode,

        // Question operations
        addQuestion,
        updateQuestion,
        deleteQuestion,
        getQuestions,

        // Live quiz control
        startQuiz,
        nextQuestion,
        endQuiz,
        restartQuiz,

        // Participant operations
        joinQuiz,
        submitAnswer,
        hasAnswered
    };
};

// ============================================================================
// REAL-TIME SUBSCRIPTION HOOKS
// ============================================================================

// Hook to subscribe to admin's quizzes
export const useAdminQuizzes = () => {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        // Simple query without orderBy to avoid composite index requirement
        const q = query(
            collection(db, 'quizzes'),
            where('createdBy', '==', user.uid)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const quizzesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Sort client-side by createdAt (newest first)
                quizzesData.sort((a, b) => {
                    const aTime = a.createdAt?.toDate?.() || new Date(0);
                    const bTime = b.createdAt?.toDate?.() || new Date(0);
                    return bTime - aTime;
                });
                setQuizzes(quizzesData);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Error fetching quizzes:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    return { quizzes, loading, error };
};

// Hook to subscribe to a single quiz
export const useQuizSubscription = (quizId) => {
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!quizId) return;

        const unsubscribe = onSnapshot(
            doc(db, 'quizzes', quizId),
            (snapshot) => {
                if (snapshot.exists()) {
                    setQuiz({ id: snapshot.id, ...snapshot.data() });
                } else {
                    setQuiz(null);
                }
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [quizId]);

    return { quiz, loading };
};

// Hook to subscribe to quiz questions
export const useQuestionsSubscription = (quizId) => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!quizId) return;

        const q = query(
            collection(db, 'quizzes', quizId, 'questions'),
            orderBy('index')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const questionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setQuestions(questionsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [quizId]);

    return { questions, loading };
};

// Hook to subscribe to quiz participants
export const useParticipantsSubscription = (quizId) => {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!quizId) return;

        const unsubscribe = onSnapshot(
            collection(db, 'quizzes', quizId, 'participants'),
            (snapshot) => {
                const participantsData = snapshot.docs.map(doc => ({
                    oduid: doc.id,
                    ...doc.data()
                }));
                setParticipants(participantsData);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [quizId]);

    return { participants, loading };
};

export default useQuiz;
