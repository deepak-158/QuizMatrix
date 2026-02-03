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
            creatorEmail: user.email,
            sharedWith: [], // Array of admin emails who can manage this quiz
            status: 'draft',
            currentQuestionIndex: -1,
            questionStartTime: null,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'quizzes'), newQuiz);
        return { id: docRef.id, quizCode };
    };

    // Create quiz from JSON data
    const createQuizFromJSON = async (jsonData) => {
        // Validate JSON structure
        if (!jsonData.title || typeof jsonData.title !== 'string') {
            throw new Error('Invalid JSON: "title" is required and must be a string');
        }
        if (!Array.isArray(jsonData.questions) || jsonData.questions.length === 0) {
            throw new Error('Invalid JSON: "questions" must be a non-empty array');
        }

        // Validate time settings based on mode
        const timeMode = jsonData.timeMode || 'perQuestion';
        if (timeMode === 'overall') {
            if (!jsonData.totalTime || typeof jsonData.totalTime !== 'number') {
                throw new Error('Invalid JSON: "totalTime" is required for overall time mode');
            }
            if (jsonData.totalTime < 60 || jsonData.totalTime > 3600) {
                throw new Error('Invalid JSON: "totalTime" must be between 60 and 3600 seconds');
            }
        } else {
            if (!jsonData.timePerQuestion || typeof jsonData.timePerQuestion !== 'number') {
                throw new Error('Invalid JSON: "timePerQuestion" is required for per-question mode');
            }
            if (jsonData.timePerQuestion < 10 || jsonData.timePerQuestion > 120) {
                throw new Error('Invalid JSON: "timePerQuestion" must be between 10 and 120 seconds');
            }
        }

        // Validate each question
        for (let i = 0; i < jsonData.questions.length; i++) {
            const q = jsonData.questions[i];
            if (!q.text || typeof q.text !== 'string') {
                throw new Error(`Invalid question ${i + 1}: "text" is required`);
            }
            if (!Array.isArray(q.options) || q.options.length !== 4) {
                throw new Error(`Invalid question ${i + 1}: "options" must be an array of 4 items`);
            }
            if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
                throw new Error(`Invalid question ${i + 1}: "correctAnswer" must be 0, 1, 2, or 3`);
            }
            // Validate imageUrl if provided
            if (q.imageUrl && typeof q.imageUrl !== 'string') {
                throw new Error(`Invalid question ${i + 1}: "imageUrl" must be a string`);
            }
            // Validate optionImages if provided
            if (q.optionImages && (!Array.isArray(q.optionImages) || q.optionImages.length !== 4)) {
                throw new Error(`Invalid question ${i + 1}: "optionImages" must be an array of 4 items`);
            }
        }

        // Create the quiz
        const quizCode = generateQuizCode();
        const newQuiz = {
            title: jsonData.title,
            timeMode: timeMode,
            timePerQuestion: jsonData.timePerQuestion || 30,
            totalTime: jsonData.totalTime || 300,
            quizCode,
            createdBy: user.uid,
            creatorEmail: user.email,
            sharedWith: [],
            status: 'draft',
            currentQuestionIndex: -1,
            questionStartTime: null,
            createdAt: serverTimestamp()
        };

        const quizRef = await addDoc(collection(db, 'quizzes'), newQuiz);
        const quizId = quizRef.id;

        // Add all questions (matching addQuestion structure)
        const questionsRef = collection(db, 'quizzes', quizId, 'questions');
        let addedCount = 0;

        for (let i = 0; i < jsonData.questions.length; i++) {
            const q = jsonData.questions[i];
            try {
                await addDoc(questionsRef, {
                    text: q.text,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    imageUrl: q.imageUrl || '',
                    optionImages: q.optionImages || ['', '', '', ''],
                    index: i,
                    createdAt: serverTimestamp()
                });
                addedCount++;
            } catch (err) {
                console.error(`Error adding question ${i + 1}:`, err);
                throw new Error(`Failed to add question ${i + 1}: ${err.message}`);
            }
        }

        // Update quiz with total questions count
        const quizDocRef = doc(db, 'quizzes', quizId);
        await updateDoc(quizDocRef, { totalQuestions: addedCount });

        return { id: quizId, quizCode, questionCount: addedCount };
    };

    // Share quiz with another admin
    const shareQuiz = async (quizId, adminEmail) => {
        const quizRef = doc(db, 'quizzes', quizId);
        const quizSnap = await getDoc(quizRef);

        if (!quizSnap.exists()) throw new Error('Quiz not found');

        const currentShared = quizSnap.data().sharedWith || [];
        if (!currentShared.includes(adminEmail.toLowerCase())) {
            await updateDoc(quizRef, {
                sharedWith: [...currentShared, adminEmail.toLowerCase()]
            });
        }
    };

    // ============================================================================
    // ALLOWED PARTICIPANTS MANAGEMENT
    // ============================================================================

    // Add allowed participant email(s) to a quiz
    const addAllowedParticipants = async (quizId, emails) => {
        const quizRef = doc(db, 'quizzes', quizId);
        const quizSnap = await getDoc(quizRef);

        if (!quizSnap.exists()) throw new Error('Quiz not found');

        const currentAllowed = quizSnap.data().allowedParticipants || [];
        const normalizedEmails = emails.map(e => e.trim().toLowerCase()).filter(e => e);
        
        // Filter out duplicates
        const newEmails = normalizedEmails.filter(e => !currentAllowed.includes(e));
        
        if (newEmails.length > 0) {
            await updateDoc(quizRef, {
                allowedParticipants: [...currentAllowed, ...newEmails],
                isRestricted: true // Enable restriction when participants are added
            });
        }
        
        return newEmails.length;
    };

    // Remove allowed participant email from a quiz
    const removeAllowedParticipant = async (quizId, email) => {
        const quizRef = doc(db, 'quizzes', quizId);
        const quizSnap = await getDoc(quizRef);

        if (!quizSnap.exists()) throw new Error('Quiz not found');

        const currentAllowed = quizSnap.data().allowedParticipants || [];
        const updatedAllowed = currentAllowed.filter(e => e !== email.toLowerCase());
        
        await updateDoc(quizRef, {
            allowedParticipants: updatedAllowed,
            // If no participants left, disable restriction
            isRestricted: updatedAllowed.length > 0
        });
    };

    // Toggle quiz restriction (open to all vs restricted)
    const toggleQuizRestriction = async (quizId, isRestricted) => {
        const quizRef = doc(db, 'quizzes', quizId);
        await updateDoc(quizRef, { isRestricted });
    };

    // Check if user is allowed to join a quiz
    const isUserAllowedToJoin = async (quizId, userEmail) => {
        const quizRef = doc(db, 'quizzes', quizId);
        const quizSnap = await getDoc(quizRef);

        if (!quizSnap.exists()) throw new Error('Quiz not found');

        const quizData = quizSnap.data();
        
        // If quiz is not restricted, anyone can join
        if (!quizData.isRestricted) return true;
        
        // Check if user's email is in allowed list
        const allowedParticipants = quizData.allowedParticipants || [];
        return allowedParticipants.includes(userEmail.toLowerCase());
    };

    // Remove admin from shared list
    const unshareQuiz = async (quizId, adminEmail) => {
        const quizRef = doc(db, 'quizzes', quizId);
        const quizSnap = await getDoc(quizRef);

        if (!quizSnap.exists()) throw new Error('Quiz not found');

        const currentShared = quizSnap.data().sharedWith || [];
        await updateDoc(quizRef, {
            sharedWith: currentShared.filter(e => e !== adminEmail.toLowerCase())
        });
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
            currentQuestionIndex: -1
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

        await updateQuiz(quizId, {
            status: 'live',
            currentQuestionIndex: nextIndex,
            questionStartTime: serverTimestamp()
        });

        return true;
    };

    // Start self-paced quiz (all questions available at once)
    const startSelfPacedQuiz = async (quizId) => {
        await updateQuiz(quizId, {
            status: 'live',
            currentQuestionIndex: 0, // All questions available from index 0
            quizStartTime: serverTimestamp()
        });
    };

    // End the quiz
    const endQuiz = async (quizId) => {
        await updateQuiz(quizId, {
            status: 'ended'
        });
    };

    // Restart the quiz - reset to waiting state and clear all data
    const restartQuiz = async (quizId) => {
        try {
            // Reset quiz to waiting state
            await updateQuiz(quizId, {
                status: 'waiting',
                currentQuestionIndex: -1,
                questionStartTime: null
            });

            // Delete all participants (they need to rejoin)
            await deleteSubcollection(quizId, 'participants');

            // Delete all responses
            await deleteSubcollection(quizId, 'responses');
        } catch (error) {
            throw error;
        }
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
    const submitAnswer = async (quizId, questionIndex, selectedAnswer, timeTaken, isCorrect, maxTime) => {
        try {
            // Calculate points first
            const points = calculateScore(isCorrect, timeTaken, maxTime);

            // Ensure participant exists (create if not)
            const participantRef = doc(db, 'quizzes', quizId, 'participants', user.uid);
            const participantSnap = await getDoc(participantRef);

            if (!participantSnap.exists()) {
                // Create participant if not exists
                await setDoc(participantRef, {
                    oduid: user.uid,
                    displayName: user.displayName || 'Anonymous',
                    email: user.email || '',
                    photoURL: user.photoURL || '',
                    score: 0,
                    answeredQuestions: [],
                    joinedAt: serverTimestamp()
                });
            }

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

            // Update participant score
            const currentSnap = await getDoc(participantRef);
            if (currentSnap.exists()) {
                const currentData = currentSnap.data();
                const newScore = (currentData.score || 0) + points;
                const newAnswered = [...(currentData.answeredQuestions || []), questionIndex];

                await updateDoc(participantRef, {
                    score: newScore,
                    answeredQuestions: newAnswered
                });
            }

            return points;
        } catch (error) {
            throw error;
        }
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
        createQuizFromJSON,
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
        startSelfPacedQuiz,
        endQuiz,
        restartQuiz,

        // Sharing
        shareQuiz,
        unshareQuiz,

        // Allowed participants management
        addAllowedParticipants,
        removeAllowedParticipant,
        toggleQuizRestriction,
        isUserAllowedToJoin,

        // Participant operations
        joinQuiz,
        submitAnswer,
        hasAnswered
    };
};

// ============================================================================
// REAL-TIME SUBSCRIPTION HOOKS
// ============================================================================

// Hook to subscribe to ALL quizzes (for master admin)
export const useAllQuizzes = () => {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Query for all quizzes, ordered by creation date
        const allQuizzesQuery = query(
            collection(db, 'quizzes'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            allQuizzesQuery,
            (snapshot) => {
                const allQuizzes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setQuizzes(allQuizzes);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching all quizzes:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return { quizzes, loading, error };
};

// Hook to subscribe to admin's quizzes (owned + shared)
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

        // Query for owned quizzes
        const ownedQuery = query(
            collection(db, 'quizzes'),
            where('createdBy', '==', user.uid)
        );

        // Query for shared quizzes (where user's email is in sharedWith array)
        const sharedQuery = query(
            collection(db, 'quizzes'),
            where('sharedWith', 'array-contains', user.email?.toLowerCase())
        );

        let ownedQuizzes = [];
        let sharedQuizzes = [];
        let ownedLoaded = false;
        let sharedLoaded = false;

        const mergeQuizzes = () => {
            if (ownedLoaded && sharedLoaded) {
                // Merge and deduplicate
                const allQuizzes = [...ownedQuizzes];
                sharedQuizzes.forEach(sq => {
                    if (!allQuizzes.find(q => q.id === sq.id)) {
                        allQuizzes.push({ ...sq, isShared: true });
                    }
                });
                // Sort by createdAt
                allQuizzes.sort((a, b) => {
                    const aTime = a.createdAt?.toDate?.() || new Date(0);
                    const bTime = b.createdAt?.toDate?.() || new Date(0);
                    return bTime - aTime;
                });
                setQuizzes(allQuizzes);
                setLoading(false);
            }
        };

        const unsubOwned = onSnapshot(
            ownedQuery,
            (snapshot) => {
                ownedQuizzes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    isOwned: true
                }));
                ownedLoaded = true;
                mergeQuizzes();
            },
            (err) => {
                console.error('Error fetching owned quizzes:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        const unsubShared = onSnapshot(
            sharedQuery,
            (snapshot) => {
                sharedQuizzes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                sharedLoaded = true;
                mergeQuizzes();
            },
            (err) => {
                // Ignore errors for shared query (may fail if no index)
                sharedLoaded = true;
                mergeQuizzes();
            }
        );

        return () => {
            unsubOwned();
            unsubShared();
        };
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

// Hook to subscribe to quizzes where user is registered as allowed participant
export const useRegisteredQuizzes = () => {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!user?.email) {
            setLoading(false);
            return;
        }

        // Query for quizzes where user's email is in allowedParticipants
        const registeredQuery = query(
            collection(db, 'quizzes'),
            where('allowedParticipants', 'array-contains', user.email.toLowerCase())
        );

        const unsubscribe = onSnapshot(
            registeredQuery,
            (snapshot) => {
                const quizzesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Sort by createdAt (newest first)
                quizzesData.sort((a, b) => {
                    const aTime = a.createdAt?.toDate?.() || new Date(0);
                    const bTime = b.createdAt?.toDate?.() || new Date(0);
                    return bTime - aTime;
                });
                setQuizzes(quizzesData);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching registered quizzes:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user?.email]);

    return { quizzes, loading, error };
};

export default useQuiz;
