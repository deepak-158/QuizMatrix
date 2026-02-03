// Timer - Countdown timer component synced with server timestamp
// Displays remaining time and triggers callback when time is up

import { useState, useEffect, memo, useRef } from 'react';

const Timer = memo(({
    startTime,           // Server timestamp when question started
    duration,            // Duration in seconds
    onTimeUp,           // Callback when time runs out
    isActive = true     // Whether timer should be running
}) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const hasEndedRef = useRef(false);
    const onTimeUpRef = useRef(onTimeUp);
    const startTimeRef = useRef(startTime);
    const initializedRef = useRef(false);

    // Keep ref updated
    useEffect(() => {
        onTimeUpRef.current = onTimeUp;
    }, [onTimeUp]);

    // Only reset when startTime actually changes (new question)
    useEffect(() => {
        // Convert startTime to comparable value
        let newStartMs = null;
        if (startTime?.toDate) {
            newStartMs = startTime.toDate().getTime();
        } else if (startTime?.seconds) {
            newStartMs = startTime.seconds * 1000;
        } else if (startTime) {
            newStartMs = new Date(startTime).getTime();
        }

        let oldStartMs = null;
        if (startTimeRef.current?.toDate) {
            oldStartMs = startTimeRef.current.toDate().getTime();
        } else if (startTimeRef.current?.seconds) {
            oldStartMs = startTimeRef.current.seconds * 1000;
        } else if (startTimeRef.current) {
            oldStartMs = new Date(startTimeRef.current).getTime();
        }

        // Only reset if startTime actually changed (not just re-render)
        if (newStartMs !== oldStartMs || !initializedRef.current) {
            hasEndedRef.current = false;
            startTimeRef.current = startTime;
            initializedRef.current = true;
            setTimeLeft(duration);
        }
    }, [startTime, duration]);

    useEffect(() => {
        if (!isActive || hasEndedRef.current) return;

        // Calculate time left based on server timestamp
        const calculateTimeLeft = () => {
            if (!startTimeRef.current) return duration;

            const now = Date.now();
            let start;
            if (startTimeRef.current.toDate) {
                start = startTimeRef.current.toDate().getTime();
            } else if (startTimeRef.current.seconds) {
                start = startTimeRef.current.seconds * 1000;
            } else {
                start = new Date(startTimeRef.current).getTime();
            }
            const elapsed = Math.floor((now - start) / 1000);
            return Math.max(0, duration - elapsed);
        };

        // Set initial time
        const initialTime = calculateTimeLeft();
        setTimeLeft(initialTime);

        // Update every second
        const interval = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);

            if (remaining <= 0 && !hasEndedRef.current) {
                hasEndedRef.current = true;
                clearInterval(interval);
                if (onTimeUpRef.current) onTimeUpRef.current();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [duration, isActive]);

    // Calculate percentage for progress bar
    const percentage = (timeLeft / duration) * 100;

    // Determine color based on time remaining
    const getTimerColor = () => {
        if (percentage > 50) return 'timer-green';
        if (percentage > 25) return 'timer-yellow';
        return 'timer-red';
    };

    return (
        <div className="timer-container">
            <div className="timer-display">
                <span className={`timer-text ${getTimerColor()}`}>
                    {timeLeft}
                </span>
                <span className="timer-label">seconds</span>
            </div>
            <div className="timer-bar-container">
                <div
                    className={`timer-bar ${getTimerColor()}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
});

Timer.displayName = 'Timer';

export default Timer;

