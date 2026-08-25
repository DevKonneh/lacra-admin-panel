import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import logo from '../assets/lacra_logo.jpg';
import { Loader2 } from 'lucide-react';
import styles from './Login.module.css';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await apiClient.post('/auth/login', { email, password });
            if (response.data.status) {
                login(response.data.data.token, response.data.data.user);
                navigate('/');
            } else {
                setError(response.data.message || 'Login failed');
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.brand}>
                    <img src={logo} alt="LACRA" className={styles.logo} />
                    <div>
                        <div className={styles.brandName}>LACRA</div>
                        <div className={styles.brandSub}>Admin Portal</div>
                    </div>
                </div>

                <h1 className={styles.title}>Sign in</h1>
                <p className={styles.subtitle}>Enter your credentials to continue</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="email">Email</label>
                        <input
                            id="email"
                            className={styles.input}
                            type="email"
                            placeholder="you@lacra.gov.lr"
                            autoComplete="username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="password">Password</label>
                        <input
                            id="password"
                            className={styles.input}
                            type="password"
                            placeholder="••••••••"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <button className={styles.submit} type="submit" disabled={loading}>
                        {loading ? <Loader2 className={styles.spinner} /> : 'Sign In'}
                    </button>

                    <div className={styles.links}>
                        <button type="button" className={styles.linkBtn}>Forgot password?</button>
                        <Link to="/register" className={styles.linkBtn}>Register as Farmer</Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
