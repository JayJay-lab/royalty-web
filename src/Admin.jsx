import { useState } from 'react';
import {
  useApi,
  useLoad,
  useForm,
  useToast,
  Table,
  userBody,
  UserFields,
  Loading
} from './lib.jsx';

const REPORTS = {
  earnings: 'Earnings per user',
  'revenue-by-source': 'Revenue by source',
  'top-tracks': 'Top tracks',
  'contribution-issues': 'Percentage issues',
  'pending-payouts': 'Pending payouts',
  'audit-log': 'Audit log'
};

export function Reports() {
  const [report, setReport] = useState('earnings');
  const [data, , loading] = useLoad('reports/' + report);

  return (
    <div className="card">
      <h2>Reports</h2>

      <div className="row">
        {Object.entries(REPORTS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={key === report ? 'on' : ''}
            onClick={() => setReport(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : <Table rows={data} />}
    </div>
  );
}

export function Users() {
  const api = useApi();
  const toast = useToast();
  const [users, reload, loading] = useLoad('users');
  const [form, bind, setForm] = useForm();

  const add = async () => {
    const result = await api('users', 'POST', userBody(form));

    if (result) {
      toast('User added.');
      setForm({});
      reload();
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this user?')) return;

    const result = await api(`users/${id}`, 'DELETE');

    if (result !== null) {
      toast('User deleted.');
      reload();
    }
  };

  return (
    <>
      <div className="card">
        <h2>Add user</h2>
        <UserFields bind={bind} />
        <div className="row">
          <button type="button" className="p" onClick={add}>
            Add user
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Users</h2>
        {loading ? (
          <Loading />
        ) : (
          <Table
            rows={users}
            actions={(row) => (
              <button
                type="button"
                className="d"
                onClick={() => remove(row.userId)}
              >
                Delete
              </button>
            )}
          />
        )}
      </div>
    </>
  );
}

export function Revenue() {
  const api = useApi();
  const toast = useToast();

  const [sources] = useLoad('revenue/sources');
  const [events, reloadEvents, loadingEvents] = useLoad('revenue/events');

  const [form, bind, setForm] = useForm({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  const create = async () => {
    if (!form.source && !sources?.[0]?.sourceId) {
      toast('No revenue source is available.', true);
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast('Enter a gross amount greater than 0.', true);
      return;
    }

    const result = await api('revenue/events', 'POST', {
      sourceId: Number(form.source || sources[0].sourceId),
      grossAmount: amount,
      eventDate: form.date || null
    });

    if (result) {
      toast('Revenue event created.');
      setForm((old) => ({ ...old, amount: '', date: '' }));
      reloadEvents();
    }
  };

  const allocate = async (id) => {
    const result = await api(`revenue/events/${id}/allocate`, 'POST');

    if (result) {
      toast(`Allocated across ${result.tracksAllocated} tracks.`);
      reloadEvents();
    }
  };

  const pay = async () => {
    const year = Number(form.year);
    const month = Number(form.month);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      toast('Enter a valid year and month (1-12).', true);
      return;
    }

    const result = await api(`revenue/pay/${year}/${month}`, 'POST');

    if (result) {
      toast(`${result.payoutsMarkedPaid} payouts marked as paid.`);
    }
  };

  return (
    <>
      <div className="card">
        <h2>New revenue event</h2>

        <div className="row">
          <select {...bind('source')}>
            <option value="">Select source</option>
            {sources?.map((source) => (
              <option key={source.sourceId} value={source.sourceId}>
                {source.sourceName}
              </option>
            ))}
          </select>

          <input
            {...bind('amount', 'Gross amount', 'number')}
            min="0"
            step="0.01"
          />

          <input {...bind('date', '', 'date')} />

          <button type="button" className="p" onClick={create}>
            Create
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Pay clients for a month</h2>
        <p className="mu">Marks pending payouts for that month as paid.</p>

        <div className="row">
          <input {...bind('year', 'Year', 'number')} />
          <input {...bind('month', 'Month (1-12)', 'number')} min="1" max="12" />
          <button type="button" className="p" onClick={pay}>
            Pay clients
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Revenue events</h2>

        {loadingEvents ? (
          <Loading />
        ) : (
          <Table
            rows={events}
            actions={(row) =>
              row.allocated ? (
                <span className="mu">Allocated</span>
              ) : (
                <button type="button" onClick={() => allocate(row.revenueEventId)}>
                  Allocate
                </button>
              )
            }
          />
        )}
      </div>
    </>
  );
}

const blankColumn = { name: '', type: 'text', ref: '' };

export function Tables() {
  const api = useApi();
  const toast = useToast();

  const [tables, reload] = useLoad('tables');
  const [types] = useLoad('tables/types');

  const [name, setName] = useState('');
  const [columns, setColumns] = useState([blankColumn]);
  const [importForm, setImportForm] = useState({ name: '', file: null });

  const setColumn = (index, key, value) => {
    setColumns((old) =>
      old.map((column, i) =>
        i === index ? { ...column, [key]: value } : column
      )
    );
  };

  const create = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      toast('Enter a table name.', true);
      return;
    }

    const bodyColumns = columns
      .filter((column) => column.name.trim())
      .map((column) => ({
        name: column.name.trim(),
        type: column.type,
        referencesTable: column.ref || null
      }));

    if (!bodyColumns.length) {
      toast('Add at least one column.', true);
      return;
    }

    const result = await api('tables', 'POST', {
      tableName: trimmedName,
      columns: bodyColumns
    });

    if (result) {
      toast('Table created.');
      setName('');
      setColumns([blankColumn]);
      reload();
    }
  };

  const drop = async (tableName) => {
    if (!confirm(`Drop table ${tableName}? Its data will be deleted.`)) return;

    const result = await api(`tables/${tableName}`, 'DELETE');

    if (result) {
      toast('Table dropped.');
      reload();
    }
  };

  const importCsv = async () => {
    if (!importForm.name.trim()) {
      toast('Enter a table name.', true);
      return;
    }

    if (!importForm.file) {
      toast('Choose a CSV file.', true);
      return;
    }

    const formData = new FormData();
    formData.append('tableName', importForm.name.trim());
    formData.append('file', importForm.file);

    const result = await api('tables/import', 'POST', formData);

    if (result) {
      toast(`Imported ${result.rows} rows.`);
      setImportForm({ name: '', file: null });
      reload();
    }
  };

  return (
    <>
      <div className="card">
        <h2>Create table</h2>

        <div className="row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="table_name"
          />
        </div>

        {columns.map((column, index) => (
          <div className="row" key={index}>
            <input
              value={column.name}
              onChange={(e) => setColumn(index, 'name', e.target.value)}
              placeholder="column_name"
            />

            <select
              value={column.type}
              onChange={(e) => setColumn(index, 'type', e.target.value)}
            >
              {types?.map((type) => <option key={type}>{type}</option>)}
            </select>

            <select
              value={column.ref}
              onChange={(e) => setColumn(index, 'ref', e.target.value)}
            >
              <option value="">Link to: none</option>
              {tables?.map((table) => (
                <option key={table.name} value={table.name}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="row">
          <button type="button" onClick={() => setColumns([...columns, blankColumn])}>
            + Column
          </button>

          <button type="button" className="p" onClick={create}>
            Create table
          </button>
        </div>

        <p className="mu">
          An id column is added automatically. "Link to" adds a foreign key.
        </p>
      </div>

      <div className="card">
        <h2>Import table from CSV</h2>

        <div className="row">
          <input
            value={importForm.name}
            onChange={(e) =>
              setImportForm({ ...importForm, name: e.target.value })
            }
            placeholder="new_table_name"
          />

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) =>
              setImportForm({
                ...importForm,
                file: e.target.files?.[0] || null
              })
            }
          />

          <button type="button" className="p" onClick={importCsv}>
            Import
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Tables</h2>

        <Table
          rows={tables?.map((table) => ({
            _key: table.name,
            name: table.name,
            type: table.isCore ? 'core' : 'custom'
          }))}
          actions={(row) =>
            row.type === 'custom' && (
              <button
                type="button"
                className="d"
                onClick={() => drop(row.name)}
              >
                Drop
              </button>
            )
          }
        />
      </div>
    </>
  );
}

export function Data() {
  const [tables] = useLoad('tables');
  const [selected, setSelected] = useState('');

  const table = selected || tables?.[0]?.name;

  return (
    <div className="card">
      <h2>Data</h2>

      <select
        value={table || ''}
        onChange={(e) => setSelected(e.target.value)}
      >
        {tables?.map((item) => (
          <option key={item.name} value={item.name}>
            {item.name}
          </option>
        ))}
      </select>

      {table && <Rows key={table} table={table} />}
    </div>
  );
}

function Rows({ table }) {
  const api = useApi();
  const toast = useToast();

  const [data, reload, loading] = useLoad('data/' + table);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);

  if (loading || !data) return <Loading />;

  const primaryKey = data.columns.find((column) => column.isPk);

  if (!primaryKey) {
    return (
      <>
        <p className="mu">This table is read-only.</p>
        <Table rows={data.rows} />
      </>
    );
  }

  const clear = () => {
    setEditingId(null);
    setForm({});
  };

  const edit = (row) => {
    setEditingId(row[primaryKey.name]);

    const next = {};
    data.columns.forEach((column) => {
      next[column.name] = row[column.name] ?? '';
    });

    setForm(next);
  };

  const save = async () => {
    const result =
      editingId === null
        ? await api(`data/${table}`, 'POST', form)
        : await api(`data/${table}/${editingId}`, 'PUT', form);

    if (result) {
      toast(editingId === null ? 'Row added.' : 'Row updated.');
      clear();
      reload();
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this row?')) return;

    const result = await api(`data/${table}/${id}`, 'DELETE');

    if (result) {
      toast('Row deleted.');
      reload();
    }
  };

  const inputType = (column) => {
    if (/int|numeric|double|real|decimal/.test(column.type)) return 'number';
    if (column.type === 'date') return 'date';
    return 'text';
  };

  return (
    <>
      {!data.readOnly && (
        <>
          <h2>{editingId === null ? 'Add row' : `Edit row ${editingId}`}</h2>

          <div className="row">
            {data.columns
              .filter((column) => !column.isPk)
              .map((column) =>
                column.type === 'boolean' ? (
                  <select
                    key={column.name}
                    value={String(form[column.name] ?? '')}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [column.name]: e.target.value
                      })
                    }
                  >
                    <option value="">{column.name}</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    key={column.name}
                    type={inputType(column)}
                    step="any"
                    title={column.name}
                    placeholder={
                      column.name + (column.hasDefault ? ' (default)' : '')
                    }
                    value={form[column.name] ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [column.name]: e.target.value
                      })
                    }
                  />
                )
              )}
          </div>

          <div className="row">
            <button type="button" className="p" onClick={save}>
              Save
            </button>
            <button type="button" onClick={clear}>
              Clear
            </button>
          </div>
        </>
      )}

      <Table
        rows={data.rows}
        actions={
          data.readOnly
            ? null
            : (row) => (
                <>
                  <button type="button" onClick={() => edit(row)}>Edit</button>{' '}
                  <button
                    type="button"
                    className="d"
                    onClick={() => remove(row[primaryKey.name])}
                  >
                    Delete
                  </button>
                </>
              )
        }
      />
    </>
  );
}
