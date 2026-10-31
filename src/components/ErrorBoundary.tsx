import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    // Optional label shown in the fallback UI so different mount points
    // (e.g. "the registration wizard") can be distinguished in error
    // reports, without needing a different component per usage site.
    label?: string;
    // Called once when an error is caught, in addition to showing the
    // fallback UI - e.g. ApplicationWizard uses this to clear a
    // possibly-corrupted local draft rather than surfacing the same
    // crash forever on every reload.
    onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// Without an error boundary anywhere in the app, ANY uncaught exception
// thrown during render (a null/undefined field access on a legacy or
// unexpectedly-shaped draft record, for example) unmounts the entire
// React tree and the user is left looking at a permanently blank white
// screen with no way to recover short of manually clearing storage and
// reloading. This boundary catches render-time errors anywhere below it
// and shows a clear, actionable recovery screen instead - critical for a
// public, unauthenticated registration flow where most applicants have
// no way to "go to devtools and check the console".
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // eslint-disable-next-line no-console
        console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info.componentStack);
        this.props.onError?.(error);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 sm:p-6">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-card border border-brand-border p-6 sm:p-8 text-center">
                        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle size={28} className="text-red-500" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-800 mb-1.5">Something went wrong</h1>
                        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                            An unexpected error occurred while displaying this page. This has been logged. Your previously submitted
                            applications are not affected. Please try reloading the page or starting again.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                type="button"
                                onClick={this.handleReload}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-brand-green text-white transition-all duration-150 hover:bg-brand-green-hover focus:outline-none focus:ring-4 focus:ring-brand-green/20"
                            >
                                <RotateCcw size={16} /> Reload Page
                            </button>
                            <button
                                type="button"
                                onClick={this.handleGoHome}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border-2 border-slate-200 text-slate-600 transition-all duration-150 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
                            >
                                <Home size={16} /> Go to Homepage
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
