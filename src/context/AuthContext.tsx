import React, { createContext, useContext, useState } from 'react';
import apiClient from '../api/client';

interface User {
    id: string;
    email: string;
    role: string;
    name: string;
    // Populated from the assigned "Permission Group" (Role.permissions) at
    // login, when the account has one assigned. Used only to further
    // narrow which nav sections are shown within a role — never to grant
    // access beyond what the role-based route checks already allow. See
    // Sidebar.tsx's hasPermission() for how this is consumed.
    permissions?: string[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Read the persisted user synchronously (lazy useState initializer) instead
// of via a useEffect. The previous effect-based version left `user` as
// `null` for the component's very first render on every full page load
// (direct link open, browser refresh, or back/forward) even though
// `token` was already available from localStorage — so a role-gated route
// guard (AdminRoute/AdminOrInspectorRoute, which check `user?.role`)
// would redirect away an already-authorized user before the effect ran,
// e.g. an ADMIN opening/refreshing /farmers/verification directly. Reading
// both token and user synchronously up front keeps them in lockstep from
// the first render, so route guards never see a stale/null user while a
// valid token is already present.
function readStoredUser(): User | null {
    try {
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

// Apply the persisted token to apiClient's default Authorization header
// exactly once at module load, before the first component ever renders —
// rather than mutating apiClient.defaults from inside the AuthProvider
// render body (flagged by eslint-plugin-react-hooks's immutability rule,
// since apiClient is defined outside the component/hook). login()/logout()
// still update the header directly, same as before.
const initialToken = localStorage.getItem('token');
if (initialToken) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => readStoredUser());
    const [token, setToken] = useState<string | null>(initialToken);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete apiClient.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
