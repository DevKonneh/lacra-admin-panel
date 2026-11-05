import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    padded?: boolean;
}

/**
 * Shared card container: flat border, no shadow (or only a hairline one via
 * the lightened `shadow-card` token), moderate rounding (`rounded-lg`).
 * Replaces the mix of `shadow-sm/md/lg` + `rounded-xl` containers scattered
 * across pages with one consistent, lower-decoration wrapper.
 */
const Card: React.FC<CardProps> = ({ children, padded = true, className = '', ...rest }) => (
    <div
        className={`bg-white border border-slate-200 rounded-lg ${padded ? 'p-4' : ''} ${className}`}
        {...rest}
    >
        {children}
    </div>
);

export default Card;
