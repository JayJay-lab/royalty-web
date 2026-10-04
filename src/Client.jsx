import { useEffect, useMemo, useState } from 'react';
import { useApi, useForm, useLoad, useToast, Table, Loading } from './lib.jsx';

const emptyContribution = {
  userId: '',
  roleId: '',
  pct: ''
};

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function Pick({ row, people, roles, currentUserId, onChange, onRemove, canRemove }) {
  return (
    <div className="row contribution-row">
      <select
        value={row.userId}
        onChange={(e) => onChange('userId', e.target.value)}
      >
        <option value="">Select contributor</option>
        {people.map((person) => (
          <option key={person.user_id} value={person.user_id}>
            {person.full_name}
            {person.artist_name ? ` (${person.artist_name})` : ''}
            {person.user_id === currentUserId ? ' — you' : ''}
          </option>
        ))}
      </select>

      <select
        value={row.roleId}
        onChange={(e) => onChange('roleId', e.target.value)}
      >
        <option value="">Select role</option>
        {roles.map((role) => (
          <option key={role.roleId} value={role.roleId}>
            {role.roleName}
          </option>
        ))}
      </select>

      <input
        type="number"
        min="0.01"
        max="100"
        step="0.01"
        placeholder="Percentage"
        value={row.pct}
        onChange={(e) => onChange('pct', e.target.value)}
      />

      {canRemove && (
        <button type="button" className="d" onClick={onRemove}>
          Remove
        </button>
      )}
    </div>
  );
}

function buildContribution(row) {
  return {
    userId: Number(row.userId),
    roleId: Number(row.roleId),
    percentageCut: Number(row.pct)
  };
}

export function Dashboard({ user }) {
  const [data, , loading] = useLoad(`users/${user.userId}/balance`);

  if (loading || !data) return <Loading />;

  const due = num(data.totalBalanceDue);
  const paid = num(data.totalPaid);

  return (
    <>
      <div className="card">
        <h2>Hello, {data.fullName}</h2>

        <div className="stats">
          <div className="stat">
            <div className="mu">Balance due</div>
            <div className="big">R {due.toFixed(2)}</div>
          </div>

          <div className="stat">
            <div className="mu">Total paid</div>
            <div className="big">R {paid.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>My payouts</h2>
        <Table rows={data.payoutBreakdown} />
      </div>
    </>
  );
}

function trackOwnerId(track) {
  return track.uploaded_by ?? track.uploadedByUserId;
}

function trackId(track) {
  return track.track_id ?? track.trackId;
}

function contributionId(contribution) {
  return contribution.contribution_id ?? contribution.contributionId;
}

export function Tracks({ user }) {
  const api = useApi();
  const toast = useToast();
  const uid = Number(user.userId);

  const [tracks, reloadTracks, loadingTracks] = useLoad('data/tracks');
  const [contributions, reloadContributions, loadingContributions] = useLoad('data/contributions');
  const [people, , loadingPeople] = useLoad('data/users');
  const [roles, , loadingRoles] = useLoad('lookup/roles');
  const [payouts, reloadPayouts, loadingPayouts] = useLoad('data/payouts');

  const [form, bind, setForm] = useForm({
    title: '',
    duration: ''
  });

  const [rows, setRows] = useState([emptyContribution]);
  const [busy, setBusy] = useState(false);

  const loading =
    loadingTracks ||
    loadingContributions ||
    loadingPeople ||
    loadingRoles ||
    loadingPayouts;

  const peopleRows = people?.rows || [];
  const roleRows = roles || [];
  const trackRows = tracks?.rows || [];
  const contributionRows = contributions?.rows || [];
  const payoutRows = payouts?.rows || [];

  const roleMap = useMemo(
    () => new Map(roleRows.map((role) => [Number(role.roleId), role.roleName])),
    [roleRows]
  );

  const userMap = useMemo(
    () => new Map(peopleRows.map((person) => [Number(person.user_id), person])),
    [peopleRows]
  );

  const payoutByContribution = useMemo(() => {
    const map = new Map();

    for (const payout of payoutRows) {
      const cid = Number(payout.contribution_id);
      if (!Number.isFinite(cid)) continue;

      const existing = map.get(cid) || {
        amount: 0,
        paid: false
      };

      existing.amount += num(payout.amount_paid);
      if (String(payout.payout_status).toLowerCase() === 'paid') {
        existing.paid = true;
      }

      map.set(cid, existing);
    }

    return map;
  }, [payoutRows]);

  const myTracks = useMemo(() => {
    return trackRows
      .map((track) => {
        const id = Number(trackId(track));
        const ownerId = Number(trackOwnerId(track));

        const cs = contributionRows
          .filter((c) => Number(c.track_id) === id)
          .map((c) => {
            const contributor = userMap.get(Number(c.user_id));
            const role = roleMap.get(Number(c.role_id)) || `Role ${c.role_id}`;
            const payout = payoutByContribution.get(Number(c.contribution_id));

            return {
              ...c,
              name: contributor?.full_name || `User ${c.user_id}`,
              role,
              hasPayouts: Boolean(payout),
              paid: Boolean(payout?.paid),
              earned: payout?.amount || 0
            };
          });

        const mine = ownerId === uid || cs.some((c) => Number(c.user_id) === uid);

        if (!mine) return null;

        return {
          ...track,
          _key: id,
          id,
          ownerId,
          isOwner: ownerId === uid,
          contributions: cs,
          totalPercentage: cs.reduce((sum, c) => sum + num(c.percentage_cut), 0)
        };
      })
      .filter(Boolean);
  }, [
    trackRows,
    contributionRows,
    userMap,
    roleMap,
    payoutByContribution,
    uid
  ]);

  useEffect(() => {
    if (!roleRows.length || !peopleRows.length) return;

    setRows((old) =>
      old.map((row, index) => {
        if (row.userId && row.roleId) return row;

        if (index === 0) {
          return {
            ...row,
            userId: String(uid),
            roleId: String(roleRows[0].roleId),
            pct: row.pct || '100'
          };
        }

        return {
          ...row,
          roleId: row.roleId || String(roleRows[0].roleId)
        };
      })
    );
  }, [roleRows, peopleRows, uid]);

  const setRow = (index, key, value) => {
    setRows((old) =>
      old.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );
  };

  const addRow = () => {
    setRows((old) => [
      ...old,
      {
        ...emptyContribution,
        roleId: roleRows[0] ? String(roleRows[0].roleId) : ''
      }
    ]);
  };

  const removeRow = (index) => {
    setRows((old) => old.filter((_, i) => i !== index));
  };

  const upload = async () => {
    const title = (form.title || '').trim();
    const duration = Number(form.duration);

    if (!title) {
      toast('Enter a track title.', true);
      return;
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      toast('Duration must be a whole number of seconds greater than 0.', true);
      return;
    }

    if (!rows.length) {
      toast('Add at least one contributor.', true);
      return;
    }

    const seen = new Set();
    const contributionsBody = [];

    for (const row of rows) {
      const c = buildContribution(row);

      if (!c.userId || !c.roleId || !Number.isFinite(c.percentageCut) || c.percentageCut <= 0) {
        toast('Every contributor needs a person, role, and percentage.', true);
        return;
      }

      const key = `${c.userId}:${c.roleId}`;
      if (seen.has(key)) {
        toast('The same person cannot have the same role twice on one track.', true);
        return;
      }

      seen.add(key);
      contributionsBody.push(c);
    }

    const total = contributionsBody.reduce(
      (sum, contribution) => sum + contribution.percentageCut,
      0
    );

    if (total > 100) {
      toast(`Contribution percentages total ${total}%. They cannot exceed 100%.`, true);
      return;
    }

    setBusy(true);

    const result = await api(`users/${uid}/tracks`, 'POST', {
      title,
      duration,
      contributions: contributionsBody
    });

    setBusy(false);

    if (result) {
      toast('Track uploaded successfully.');
      setForm({ title: '', duration: '' });
      setRows([
        {
          userId: String(uid),
          roleId: roleRows[0] ? String(roleRows[0].roleId) : '',
          pct: '100'
        }
      ]);

      await Promise.all([
        reloadTracks(),
        reloadContributions(),
        reloadPayouts()
      ]);
    }
  };

 const removeContribution = async (row) => {
  if (!confirm(`Remove ${row.person} (${row.role}) from this track?`)) return;

  const result = await api(`data/contributions/${row._id}`, 'DELETE');

  if (result) {
    toast('Contributor removed.');
    await Promise.all([reloadContributions(), reloadTracks()]);
  }
};

const deleteTrack = async (track) => {
  if (!confirm(`Delete "${track.title}" and its contributors? This cannot be undone.`)) return;

  const result = await api(`users/${uid}/tracks/${track.id}`, 'DELETE');

  if (result) {
    toast('Track deleted.');
    await Promise.all([reloadTracks(), reloadContributions(), reloadPayouts()]);
  }
};

  if (loading) return <Loading text="Loading tracks and contributor information..." />;

  return (
    <>
      <div className="card">
        <h2>Upload a track</h2>

        <div className="row">
          <input {...bind('title', 'Track title')} />
          <input
            {...bind('duration', 'Duration (seconds)', 'number')}
            min="1"
            step="1"
          />
        </div>

        <h2>Contributions</h2>
        <p className="mu">
          The first contributor defaults to your account at 100%. You can add
          other contributors and adjust the percentages. The backend requires
          the total to be 100% or less.
        </p>

        {rows.map((row, index) => (
          <Pick
            key={index}
            row={row}
            people={peopleRows}
            roles={roleRows}
            currentUserId={uid}
            onChange={(key, value) => setRow(index, key, value)}
            onRemove={() => removeRow(index)}
            canRemove={rows.length > 1}
          />
        ))}

        <div className="row">
          <button type="button" onClick={addRow}>+ Contributor</button>
          <button type="button" className="p" onClick={upload} disabled={busy}>
            {busy ? 'Uploading...' : 'Upload track'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>My tracks</h2>

        {!myTracks.length ? (
          <p className="mu">
            You do not have any tracks yet. Upload a track above to get started.
          </p>
        ) : (
          myTracks.map((track) => (
            <div className="track-card" key={track._key}>
              <div className="track-heading">
                <div>
                  <h2>
                    {track.title}
                    {track.isOwner && <span className="b">uploaded by you</span>}
                  </h2>
                  <p className="mu">
                    {track.plays ?? 0} plays · duration {track.duration ?? 0}s ·
                    contributions total {track.totalPercentage.toFixed(2)}%
                  </p>
                </div>
                  {track.isOwner && !track.contributions.some((c) => c.hasPayouts) && (
                  <button type="button" className="d" onClick={() => deleteTrack(track)}>
                    Delete track
                  </button>
                )}
              </div>

              <Table
                rows={track.contributions.map((c) => ({
                  _key: Number(c.contribution_id),
                  person: c.name,
                  role: c.role,
                  percent: `${num(c.percentage_cut).toFixed(2)}%`,
                  earned: `R ${c.earned.toFixed(2)}`,
                  status: c.paid ? 'Paid' : c.hasPayouts ? 'Pending' : 'No payout yet',
                  _id: Number(c.contribution_id),
                  _paid: c.hasPayouts
                }))}
                actions={(row) =>
                  track.isOwner &&
                  !row._paid && (
                    <button
                      type="button"
                      className="d"
                      onClick={() => removeContribution(row)}
                    >
                      Remove
                    </button>
                  )
                }
              />

              {track.isOwner && (
                <p className="mu small">
                  You can remove contributors until a payout has been created for
                  that contribution.
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}

export function Profile({ user, setUser }) {
  const api = useApi();
  const toast = useToast();
  const uid = Number(user.userId);

  const [userData, reloadUser] = useLoad(`data/users`);
  const [bankData, reloadBanks] = useLoad('data/bank_accounts');

  const [details, setDetails] = useState(null);
  const [bank, bindBank, setBank] = useForm();

  const currentUser = userData?.rows?.find(
    (row) => Number(row.user_id) === uid
  );

  useEffect(() => {
    if (currentUser) {
      setDetails({
        fullName: currentUser.full_name || '',
        artistName: currentUser.artist_name || '',
        spotifyId: currentUser.spotify_id || '',
        email: currentUser.email || ''
      });
    }
  }, [currentUser]);

  const saveDetails = async () => {
    if (!details?.fullName?.trim() || !details?.email?.trim()) {
      toast('Full name and email are required.', true);
      return;
    }

    const result = await api(`users/${uid}`, 'PUT', {
      fullName: details.fullName.trim(),
      artistName: details.artistName.trim() || null,
      spotifyId: details.spotifyId.trim() || null,
      email: details.email.trim()
    });

    if (result) {
      setUser({ ...user, name: result.fullName });
      toast('Details saved.');
      reloadUser();
    }
  };

  const myBanks =
    bankData?.rows?.filter((row) => Number(row.user_id) === uid) || [];

  const addBank = async () => {
    const bankName = (bank.bank || '').trim();
    const accountNumber = (bank.account || '').trim();
    const branchCode = (bank.branch || '').trim();

    if (!bankName || !accountNumber || !branchCode) {
      toast('Enter the bank name, account number, and branch code.', true);
      return;
    }

    const result = await api('data/bank_accounts', 'POST', {
      user_id: uid,
      bank_name: bankName,
      account_number: accountNumber,
      branch_code: branchCode
    });

    if (result) {
      toast('Bank account added.');
      setBank({});
      reloadBanks();
    }
  };

  const removeBank = async (id) => {
    if (!confirm('Remove this bank account?')) return;

    const result = await api(`data/bank_accounts/${id}`, 'DELETE');

    if (result) {
      toast('Bank account removed.');
      reloadBanks();
    }
  };

  if (!currentUser || !details) return <Loading text="Loading your profile..." />;

  return (
    <>
      <div className="card">
        <h2>My details</h2>

        <div className="row">
          <input
            value={details.fullName}
            placeholder="Full name"
            onChange={(e) =>
              setDetails({ ...details, fullName: e.target.value })
            }
          />
          <input
            value={details.artistName}
            placeholder="Artist name"
            onChange={(e) =>
              setDetails({ ...details, artistName: e.target.value })
            }
          />
          <input
            value={details.spotifyId}
            placeholder="Spotify ID"
            onChange={(e) =>
              setDetails({ ...details, spotifyId: e.target.value })
            }
          />
          <input
            value={details.email}
            placeholder="Email"
            type="email"
            onChange={(e) =>
              setDetails({ ...details, email: e.target.value })
            }
          />
        </div>

        <div className="row">
          <button type="button" className="p" onClick={saveDetails}>
            Save details
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Bank accounts</h2>

        <Table
          rows={myBanks.map((row) => ({
            _key: row.bank_account_id,
            bank: row.bank_name,
            account: row.account_number,
            branch: row.branch_code,
            _id: row.bank_account_id
          }))}
          actions={(row) => (
            <button
              type="button"
              className="d"
              onClick={() => removeBank(row._id)}
            >
              Remove
            </button>
          )}
        />

        <div className="row">
          <input {...bindBank('bank', 'Bank name')} />
          <input {...bindBank('account', 'Account number')} />
          <input {...bindBank('branch', 'Branch code')} />
          <button type="button" className="p" onClick={addBank}>
            Add account
          </button>
        </div>
      </div>
    </>
  );
}
