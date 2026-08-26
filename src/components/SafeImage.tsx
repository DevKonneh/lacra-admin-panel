import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * SafeImage — a drop-in replacement for <img> that gracefully falls back
 * to a placeholder instead of the browser's broken-image icon whenever the
 * source is missing OR fails to load (e.g. a stale `/uploads/...` path from
 * before the Cloudinary migration, whose file no longer exists on Render's
 * disk after a restart).
 *
 * Usage:
 *   <SafeImage src={resolveFileUrl(farmer.profilePhoto)} alt="Farmer" className="h-24 w-24 rounded-lg object-cover" />
 *
 * Pass a custom `fallback` node to match a specific design (e.g. the same
 * "no photo" placeholder already used elsewhere for that field) — otherwise
 * a generic grey placeholder with an image-off icon is shown.
 */
interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError'> {
    fallback?: React.ReactNode;
    fallbackLabel?: string;
}

const SafeImage: React.FC<SafeImageProps> = ({
    src,
    alt,
    className,
    style,
    fallback,
    fallbackLabel = 'Photo unavailable',
    ...rest
}) => {
    // Track which src the current "failed" flag applies to, so that when the
    // caller passes a new src (e.g. navigating between farms/farmers) we can
    // reset it. This is done synchronously during render (the recommended
    // "adjusting state when a prop changes" pattern) rather than in a
    // useEffect, which would cause an extra cascading render — see
    // https://react.dev/learn/you-might-not-need-an-effect
    const [failedState, setFailedState] = useState<{ src?: typeof src; failed: boolean }>({ src, failed: false });
    if (failedState.src !== src) {
        setFailedState({ src, failed: false });
    }
    const failed = failedState.src === src && failedState.failed;

    if (!src || failed) {
        if (fallback) return <>{fallback}</>;
        // Generic fallback: keeps the caller's className (so sizing/rounding/
        // borders still apply, since those classes were meant for this slot)
        // but overrides layout-critical style props so the icon+label center
        // nicely regardless of what the original <img> style looked like.
        const fallbackStyle: React.CSSProperties = {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: '#f9fafb',
            color: '#9ca3af',
            fontSize: 11,
            textAlign: 'center',
            padding: 4,
            ...style,
        };
        return (
            <div
                className={className}
                style={fallbackStyle}
                title={typeof alt === 'string' ? alt : fallbackLabel}
                role="img"
                aria-label={typeof alt === 'string' ? alt : fallbackLabel}
                data-safe-image-fallback="true"
            >
                <ImageOff style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span>{fallbackLabel}</span>
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            style={style}
            onError={() => setFailedState({ src, failed: true })}
            {...rest}
        />
    );
};

export default SafeImage;
