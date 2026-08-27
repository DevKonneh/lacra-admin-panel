import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import logo from '../assets/lacra_logo.jpg';
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import styles from './Login.module.css';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
            {/* Left brand/hero panel - visible on larger screens only */}
            <div className={styles.hero}>
                <div className={styles.heroCircleLg} />
                <div className={styles.heroCircleSm} />

                <div className={styles.heroTop}>
                    <img src={logo} alt="LACRA" className={styles.heroLogo} />
                    <div>
                        <div className={styles.heroBrandName}>LACRA</div>
                        <div className={styles.heroBrandSub}>Commodity Management Information System</div>
                    </div>
                </div>

                <div className={styles.heroBody}>
                    <h1 className={styles.heroTitle}>Farm Mapping &amp; EUDR Compliance Platform</h1>
                    <p className={styles.heroSubtitle}>
                        Manage farmer registrations, farm boundary mapping, traceability and
                        deforestation risk analysis in one place &mdash; built for LACRA's
                        national commodity compliance program.
                    </p>

                    <div className={styles.heroStats}>
                        <div className={styles.heroStat}>
                            <span className={styles.heroStatValue}>EUDR</span>
                            <span className={styles.heroStatLabel}>Aligned Traceability</span>
                        </div>
                        <div className={styles.heroStat}>
                            <span className={styles.heroStatValue}>GPS</span>
                            <span className={styles.heroStatLabel}>Farm Boundary Mapping</span>
                        </div>
                        <div className={styles.heroStat}>
                            <span className={styles.heroStatValue}>24/7</span>
                            <span className={styles.heroStatLabel}>Field Data Sync</span>
                        </div>
                    </div>
                </div>

                <div className={styles.heroFooter}>
                    &copy; {new Date().getFullYear()} LACRA &middot; Liberia Agriculture Commodity Regulatory Authority
                </div>
            </div>

            {/* Right form panel */}
            <div className={styles.formPanel}>
                <div className={styles.card}>
                    <div className={styles.brand}>
                        <img src={logo} alt="LACRA" className={styles.logo} />
                        <div>
                            <div className={styles.brandName}>LACRA</div>
                            <div className={styles.brandSub}>Admin Portal</div>
                        </div>
                    </div>

                    <h1 className={styles.title}>Welcome back</h1>
                    <p className={styles.subtitle}>Sign in to your account to continue</p>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="email">Email</label>
                            <div className={styles.inputWrap}>
                                <span className={styles.inputIcon}><Mail size={16} /></span>
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
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="password">Password</label>
                            <div className={styles.inputWrap}>
                                <span className={styles.inputIcon}><Lock size={16} /></span>
                                <input
                                    id="password"
                                    className={styles.input}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className={styles.togglePasswordBtn}
                                    onClick={() => setShowPassword((v) => !v)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className={styles.error}>
                                <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                                <span>{error}</span>
                            </div>
                        )}

                        <button className={styles.submit} type="submit" disabled={loading}>
                            {loading ? <Loader2 className={styles.spinner} /> : 'Sign In'}
                        </button>

                        <div className={styles.links}>
                            <Link to="/register" className={styles.linkBtn}>Register as Farmer</Link>
                        </div>
                    </form>

                    <p className={styles.footerNote}>
                        Protected access &middot; LACRA EUDR Platform
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
