// Timer - Countdown timer component synced with server timestamp
// Displays remaining time and triggers callback when time is up

import { useState, useEffect } from 'react';

const Timer = ({
    startTime,           // Server timestamp when quiz started
    duration,            // Total quiz duration in seconds
    onTimeUp,           // Callback when time runs out
    isActive = true     // Whether timer should be running
}) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [hasEnded, setHasEnded] = useState(false);

    useEffect(() => {
        if (!isActive || hasEnded) return;

        // Calculate remaining time based on quiz start time
        const calculateTimeLeft = () => {
            if (!startTime) return duration;

            const now = Date.now();
            const start = startTime.toDate ? startTime.toDate().getTime() : startTime;
            const elapsed = Math.floor((now - start) / 1000);
            const remaining = Math.max(0, duration - elapsed);

            return remaining;
        };

        // Set initial time
        setTimeLeft(calculateTimeLeft());

        // Update every 100ms for smooth countdown
        const interval = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);

            if (remaining <= 0 && !hasEnded) {
                setHasEnded(true);
                clearInterval(interval);
                if (onTimeUp) onTimeUp();
            }
        }, 100);

        return () => clearInterval(interval);
    }, [startTime, duration, isActive, onTimeUp, hasEnded]);

    // Reset when startTime changes
    useEffect(() => {
        setHasEnded(false);
        setTimeLeft(duration);
    }, [startTime, duration]);

    // Calculate percentage for progress bar
    const percentage = (timeLeft / duration) * 100;

    // Determine color based on time remaining
    const getTimerColor = () => {
        if (percentage > 50) return 'timer-green';
        if (percentage > 25) return 'timer-yellow';
        return 'timer-red';
    };

    // Format time as MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="timer-container">
            <div className="timer-display">
                <span className={`timer-text ${getTimerColor()}`}>
                    {formatTime(timeLeft)}
                </span>
                <span className="timer-label">remaining</span>
            </div>
            <div className="timer-bar-container">
                <div
                    className={`timer-bar ${getTimerColor()}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

export default Timer;
