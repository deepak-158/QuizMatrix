// Utility helper functions for the QuizMatrix app

// Generate a unique quiz code (6 characters, alphanumeric)
export const generateQuizCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Format date/time for display
export const formatDateTime = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Calculate score based on time taken (faster = more points)
// Base score: 100, bonus up to 50 for speed
export const calculateScore = (isCorrect, timeTaken, totalTime) => {
    if (!isCorrect) return 0;

    const baseScore = 100;
    // Calculate speed bonus based on time taken vs total time
    const speedBonus = Math.floor((1 - timeTaken / totalTime) * 50);

    return baseScore + Math.max(0, speedBonus);
};

// Convert participants array to CSV format
export const convertToCSV = (participants, quizTitle) => {
    const headers = ['Rank', 'Name', 'Email', 'Score', 'Questions Answered'];

    const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);

    const rows = sortedParticipants.map((p, index) => [
        index + 1,
        p.displayName || 'Anonymous',
        p.email || '',
        p.score || 0,
        p.answeredQuestions?.length || 0
    ]);

    const csvContent = [
        [`Quiz Results: ${quizTitle}`],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        headers,
        ...rows
    ].map(row => row.join(',')).join('\n');

    return csvContent;
};

// Download CSV file
export const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Truncate text with ellipsis
export const truncateText = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

// Get status badge color
export const getStatusColor = (status) => {
    switch (status) {
        case 'draft': return 'status-draft';
        case 'waiting': return 'status-waiting';
        case 'live': return 'status-live';
        case 'ended': return 'status-ended';
        default: return '';
    }
};

// Validate quiz data
export const validateQuizData = (quiz) => {
    const errors = [];

    if (!quiz.title || quiz.title.trim().length < 3) {
        errors.push('Quiz title must be at least 3 characters');
    }

    if (!quiz.totalTime || quiz.totalTime < 60 || quiz.totalTime > 3600) {
        errors.push('Total quiz duration must be between 60 and 3600 seconds');
    }

    return errors;
};

// Validate question data
export const validateQuestionData = (question) => {
    const errors = [];

    if (!question.text || question.text.trim().length < 5) {
        errors.push('Question text must be at least 5 characters');
    }

    const validOptions = question.options?.filter(opt => opt && opt.trim().length > 0);
    if (!validOptions || validOptions.length < 2) {
        errors.push('At least 2 options are required');
    }

    if (question.correctAnswer === undefined || question.correctAnswer < 0) {
        errors.push('Please select the correct answer');
    }

    return errors;
};
