import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
    value: number;
    suffix?: string;
    duration?: number;
}

/**
 * Counts up from 0 to `value` when it first mounts / changes.
 * Uses requestAnimationFrame with an ease-out curve for a smooth, snappy feel
 * instead of a linear tick — mimics how real product dashboards animate KPIs.
 */
const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, suffix = '', duration = 700 }) => {
    const [display, setDisplay] = useState(0);
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        const start = performance.now();
        const from = 0;
        const to = value;

        const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setDisplay(Math.round(from + (to - from) * eased));
            if (progress < 1) {
                frameRef.current = requestAnimationFrame(tick);
            }
        };

        frameRef.current = requestAnimationFrame(tick);
        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return <>{display}{suffix}</>;
};

export default AnimatedCounter;
