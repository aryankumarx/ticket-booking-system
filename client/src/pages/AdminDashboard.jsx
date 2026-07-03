import { useState, useEffect } from 'react';
import { getVenues, createVenue, deleteVenue } from '../services/api';

export default function AdminDashboard() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  // form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [rows, setRows] = useState(8);
  const [seatsPerRow, setSeatsPerRow] = useState(12);
  const [categories, setCategories] = useState([
    { name: 'Premium', rowStart: 1, rowEnd: 2, color: '#f59e0b' },
    { name: 'Standard', rowStart: 3, rowEnd: 6, color: '#22c55e' },
    { name: 'Economy', rowStart: 7, rowEnd: 8, color: '#3b82f6' }
  ]);

  useEffect(() => { loadVenues(); }, []);

  async function loadVenues() {
    setLoading(true);
    try {
      const res = await getVenues();
      setVenues(res.data);
    } catch (err) {
      setError('Failed to load venues');
    }
    setLoading(false);
  }

  function addCategory() {
    setCategories([...categories, { name: '', rowStart: 1, rowEnd: 1, color: '#4CAF50' }]);
  }

  function updateCategory(idx, field, value) {
    const updated = [...categories];
    updated[idx][field] = field === 'rowStart' || field === 'rowEnd' ? parseInt(value) : value;
    setCategories(updated);
  }

  function removeCategory(idx) {
    setCategories(categories.filter((_, i) => i !== idx));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await createVenue({
        name, address,
        seatLayout: { rows, seatsPerRow, categories }
      });
      setShowForm(false);
      setName(''); setAddress('');
      loadVenues();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create venue');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this venue?')) return;
    try {
      await deleteVenue(id);
      loadVenues();
    } catch (err) {
      alert('Failed to delete');
    }
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>Manage venues and seat layouts</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Venue'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <form className="create-form" onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label>Venue Name</label>
                <input type="text" className="form-control" value={name}
                  onChange={e => setName(e.target.value)} placeholder="e.g. PVR Phoenix" required />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input type="text" className="form-control" value={address}
                  onChange={e => setAddress(e.target.value)} placeholder="e.g. MG Road, Bangalore" required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Rows</label>
                <input type="number" className="form-control" value={rows}
                  onChange={e => setRows(parseInt(e.target.value))} min="1" max="30" />
              </div>
              <div className="form-group">
                <label>Seats Per Row</label>
                <input type="number" className="form-control" value={seatsPerRow}
                  onChange={e => setSeatsPerRow(parseInt(e.target.value))} min="1" max="50" />
              </div>
            </div>

            <div className="form-group">
              <label>Seat Categories</label>
              <div className="category-builder">
                {categories.map((cat, i) => (
                  <div key={i} className="category-row">
                    <input type="text" className="form-control" placeholder="Category name"
                      value={cat.name} onChange={e => updateCategory(i, 'name', e.target.value)} />
                    <input type="number" className="form-control" placeholder="From row"
                      value={cat.rowStart} onChange={e => updateCategory(i, 'rowStart', e.target.value)} min="1" />
                    <input type="number" className="form-control" placeholder="To row"
                      value={cat.rowEnd} onChange={e => updateCategory(i, 'rowEnd', e.target.value)} min="1" />
                    <input type="color" value={cat.color}
                      onChange={e => updateCategory(i, 'color', e.target.value)} style={{ width: 40, height: 38, border: 'none', cursor: 'pointer' }} />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeCategory(i)}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm btn-add-category" onClick={addCategory}>
                  + Add Category
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary">Create Venue</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="spinner-container"><div className="spinner"></div></div>
      ) : venues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏟️</div>
          <h3>No venues yet</h3>
          <p>Create your first venue to get started</p>
        </div>
      ) : (
        <div className="events-grid">
          {venues.map(v => (
            <div key={v._id} className="card">
              <h3 style={{ marginBottom: 8 }}>{v.name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>📍 {v.address}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span className="pricing-badge">{v.seatLayout.rows} rows × {v.seatLayout.seatsPerRow} seats</span>
                {v.seatLayout.categories?.map((c, i) => (
                  <span key={i} className="pricing-badge">
                    <span className="category-color" style={{ backgroundColor: c.color }}></span>
                    {c.name} (Row {c.rowStart}-{c.rowEnd})
                  </span>
                ))}
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(v._id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
