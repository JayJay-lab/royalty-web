import { createContext, useCallback, useContext, useEffect, useState } from 'react';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://musicroyaltyapi.onrender.com';
const ToastCtx = createContext(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, bad = false) => {
    setToast({ message, bad });
    window.clearTimeout(show.timer);
    show.timer = window.setTimeout(() => setToast(null), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className={'toast' + (toast.bad ? ' bad' : '')}>
          {toast.message}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

// All frontend API calls go through /api, which Vite proxies to ASP.NET in development.
export function useApi() {
  const toast = useToast();

  return useCallback(async (path, method = 'GET', body) => {
    const options = { method, headers: {} };

    if (body instanceof FormData) {
      options.body = body;
    } else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    try {

      const response = await fetch(`${API_BASE_URL}/api/${path}`, options);
      const text = await response.text();

      let data = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // Keep non-JSON error/success bodies as text.
      }

      if (!response.ok) {
        const message =
          typeof data === 'string' && data.trim()
            ? data
            : data?.message || `Request failed (${response.status})`;

        toast(message, true);
        return null;
      }

      return data;
    } catch (error) {
      toast('Cannot reach the API. Make sure the ASP.NET backend is running.', true);
      return null;
    }
  }, [toast]);
}

export function useLoad(path) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await api(path);
    setData(result);
    setLoading(false);
    return result;
  }, [api, path]);

  useEffect(() => {
    load();
  }, [load]);

  return [data, load, loading];
}

export function useForm(initial = {}) {
  const [form, setForm] = useState(initial);

  const bind = (key, placeholder = '', type = 'text') => ({
    value: form[key] ?? '',
    onChange: (event) => setForm((old) => ({ ...old, [key]: event.target.value })),
    placeholder,
    type
  });

  return [form, bind, setForm];
}

// Object keys beginning with "_" are intentionally hidden from the table.
export function Table({ rows, actions }) {
  if (!rows || !rows.length) {
    return <p className="mu">No data.</p>;
  }

  const keys = Object.keys(rows[0]).filter((key) => !key.startsWith('_'));

  const display = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="sc">
      <table>
        <thead>
          <tr>
            {keys.map((key) => <th key={key}>{key}</th>)}
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row._key ?? index}>
              {keys.map((key) => <td key={key}>{display(row[key])}</td>)}
              {actions && <td>{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const userBody = (form) => ({
  fullName: (form.fullName || '').trim(),
  artistName: (form.artist || '').trim() || null,
  spotifyId: (form.spotify || '').trim() || null,
  email: (form.email || '').trim(),
  bankAccount: form.bank
    ? {
        bankName: form.bank.trim(),
        accountNumber: (form.account || '').trim(),
        branchCode: (form.branch || '').trim()
      }
    : null
});

export function UserFields({ bind }) {
  return (
    <>
      <div className="row">
        <input {...bind('fullName', 'Full name')} />
        <input {...bind('artist', 'Artist name (optional)')} />
        <input {...bind('email', 'Email address', 'email')} />
        <input {...bind('spotify', 'Spotify ID (optional)')} />
      </div>
      <div className="row">
        <input {...bind('bank', 'Bank name')} />
        <input {...bind('account', 'Account number')} />
        <input {...bind('branch', 'Branch code')} />
      </div>
    </>
  );
}

export function Loading({ text = 'Loading...' }) {
  return <p className="mu">{text}</p>;
}
