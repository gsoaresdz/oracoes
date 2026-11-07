import { useState, type FormEvent } from 'react';
import { UserError, type Store } from '../lib/types';

export function Login({ store }: { store: Store }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await store.signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof UserError ? e.message : 'Não foi possível entrar. Verifique sua conexão.');
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <h1>Orações</h1>
      <p className="muted">Entre para ver as orações do dia.</p>
      <form className="card form" onSubmit={submit}>
        <label>
          E-mail
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
