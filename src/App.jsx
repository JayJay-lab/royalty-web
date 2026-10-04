import { useState } from 'react';
import { useApi, useForm, useToast, userBody } from './lib.jsx';
import { Reports, Users, Revenue, Tables, Data } from './Admin.jsx';
import { Dashboard, Tracks, Profile } from './Client.jsx';

const ADMIN = [
  ['Reports', Reports],
  ['Users', Users],
  ['Revenue and payouts', Revenue],
  ['Tables', Tables],
  ['Data', Data]
];

const CLIENT = [
  ['Dashboard', Dashboard],
  ['My tracks', Tracks],
  ['Profile', Profile]
];

function Field({ label, children }) {
  return (
    <label className="fld">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Auth({ onAuth }) {
  const api = useApi();
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [form, bind, setForm] = useForm();

  const go = (nextMode) => {
    setMode(nextMode);
    setForm({});
  };

  const login = async () => {
    const email = (form.email || '').trim();

    if (!email) {
      toast('Enter your email address.', true);
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast('Enter a valid email address.', true);
      return;
    }

    const result = await api('auth/login', 'POST', {
      role: 'client',
      username: email
    });

    if (result) onAuth(result);
  };

  const adminLogin = async () => {
    if (!(form.username || '').trim() || !(form.password || '')) {
      toast('Enter the admin username and password.', true);
      return;
    }

    const result = await api('auth/login', 'POST', {
      role: 'admin',
      username: form.username.trim(),
      password: form.password
    });

    if (result) onAuth(result);
  };

  const register = async () => {
    const required = [
      ['fullName', 'full name'],
      ['email', 'email address'],
      ['bank', 'bank name'],
      ['account', 'account number'],
      ['branch', 'branch code']
    ];

    const missing = required.find(([key]) => !(form[key] || '').trim());

    if (missing) {
      toast(`Please enter your ${missing[1]}.`, true);
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast('Enter a valid email address.', true);
      return;
    }

    const created = await api('users', 'POST', userBody(form));
    if (!created) return;

    const loggedIn = await api('auth/login', 'POST', {
      role: 'client',
      username: created.email
    });

    if (loggedIn) onAuth(loggedIn);
  };

  const submit = (handler) => (event) => {
    event.preventDefault();
    handler();
  };

  const link = (label, nextMode) => (
    <a
      href="#"
      onClick={(event) => {
        event.preventDefault();
        go(nextMode);
      }}
    >
      {label}
    </a>
  );

  if (mode === 'admin') {
    return (
      <form className="card auth-card" onSubmit={submit(adminLogin)}>
        <div className="brand">
          <div className="brand-mark">RM</div>
          <div>
            <h1>Royalty Manager</h1>
            <p className="mu">Administrator access</p>
          </div>
        </div>

        <h2>Admin sign in</h2>

        <Field label="Username">
          <input {...bind('username', 'admin')} autoComplete="username" />
        </Field>

        <Field label="Password">
          <input
            {...bind('password', 'Password', 'password')}
            autoComplete="current-password"
          />
        </Field>

        <div className="row">
          <button className="p" type="submit">Sign in</button>
          <button type="button" onClick={() => go('login')}>Back</button>
        </div>
      </form>
    );
  }

  return (
    <form className="card auth-card" onSubmit={submit(mode === 'login' ? login : register)}>
      <div className="brand">
        <div className="brand-mark">RM</div>
        <div>
          <h1>Royalty Manager</h1>
          <p className="mu">Music royalty management</p>
        </div>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={mode === 'login' ? 'on' : ''}
          onClick={() => go('login')}
        >
          Log in
        </button>
        <button
          type="button"
          className={mode === 'signup' ? 'on' : ''}
          onClick={() => go('signup')}
        >
          Sign up
        </button>
      </div>

      {mode === 'login' ? (
        <>
          <p className="mu">
            Log in using the email address registered on your royalty account.
          </p>

          <Field label="Email address">
            <input
              {...bind('email', 'you@example.com', 'email')}
              autoComplete="email"
            />
          </Field>

          <button className="p full" type="submit">Log in</button>

          <p className="mu">
            No account yet? {link('Sign up', 'signup')}
          </p>
        </>
      ) : (
        <>
          <p className="mu">
            Fields marked * are required. Bank details are used for royalty payouts.
          </p>

          <div className="row">
            <Field label="Full name *">
              <input {...bind('fullName', 'Full name')} autoComplete="name" />
            </Field>

            <Field label="Email address *">
              <input {...bind('email', 'you@example.com', 'email')} autoComplete="email" />
            </Field>
          </div>

          <div className="row">
            <Field label="Artist name">
              <input {...bind('artist', 'Optional')} />
            </Field>

            <Field label="Spotify ID">
              <input {...bind('spotify', 'Optional')} />
            </Field>
          </div>

          <div className="row">
            <Field label="Bank name *">
              <input {...bind('bank', 'e.g. FNB')} />
            </Field>

            <Field label="Account number *">
              <input {...bind('account', 'Account number')} />
            </Field>

            <Field label="Branch code *">
              <input {...bind('branch', 'Branch code')} />
            </Field>
          </div>

          <button className="p full" type="submit">Create account</button>

          <p className="mu">
            Already registered? {link('Log in', 'login')}
          </p>
        </>
      )}

      <p className="mu small">{link('Admin sign in', 'admin')}</p>
    </form>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(0);

  const logout = () => {
    setUser(null);
    setTab(0);
  };

  if (!user) {
    return (
      <div className="center">
        <Auth onAuth={(loggedIn) => {
          setUser(loggedIn);
          setTab(0);
        }} />
      </div>
    );
  }

  const items = user.role === 'admin' ? ADMIN : CLIENT;
  const safeTab = Math.min(tab, items.length - 1);
  const View = items[safeTab][1];

  return (
    <>
      <header>
        <strong>Royalty Manager</strong>

        <div className="header-user">
          <span>{user.name} <span className="b">{user.role}</span></span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>

      <div className="app">
        <nav>
          {items.map(([name], index) => (
            <button
              key={name}
              className={index === safeTab ? 'on' : ''}
              onClick={() => setTab(index)}
            >
              {name}
            </button>
          ))}
        </nav>

        <main>
          <View user={user} setUser={setUser} />
        </main>
      </div>
    </>
  );
}
