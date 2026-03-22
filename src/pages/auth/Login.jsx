import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);

            const { error } = await signIn({ email, password });
            if (error) throw error;

            navigate('/dashboard');   // FIXED

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white'
        }}>
            <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <div style={{ background: 'var(--color-primary)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Lock size={30} color="white" />
                </div>
                <h2 style={{ marginBottom: '30px' }}>Zoo Management Login</h2>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <input
                        type="email"
                        placeholder="Email"
                        className="glass-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ padding: '15px' }}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        className="glass-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ padding: '15px' }}
                    />
                    <button
                        type="submit"
                        className="glass-button"
                        disabled={loading}
                        style={{
                            padding: '15px',
                            background: 'var(--color-secondary)',
                            fontSize: '16px',
                            marginTop: '10px'
                        }}
                    >
                        {loading ? 'Logging in...' : 'Sign In'}
                    </button>
                </form>
                <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                    Contact administrator for access.
                </p>
            </div>
        </div>
    );
}
