import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const UserList = () => {
    const { token } = useAuth();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        phone: '',
        role_id: '',
        active: 'Y'
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) setUsers(data.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
        setLoading(false);
    };

    const fetchRoles = async () => {
        try {
            const response = await fetch('/api/roles', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) setRoles(data.data);
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = isEditing ? `/api/users/${editId}` : '/api/users';
            const method = isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (data.success) {
                setShowModal(false);
                fetchUsers();
                resetForm();
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Error saving user');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus user ini?')) return;
        try {
            const response = await fetch(`/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) fetchUsers();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handleEdit = (user) => {
        setFormData({
            username: user.username,
            password: '', // Leave empty if not changing
            full_name: user.full_name,
            phone: user.phone || '',
            role_id: user.role_id,
            active: user.active
        });
        setIsEditing(true);
        setEditId(user.id);
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({ username: '', password: '', full_name: '', phone: '', role_id: '', active: 'Y' });
        setIsEditing(false);
        setEditId(null);
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Manajemen User</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    + Tambah User
                </button>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Nama Lengkap</th>
                            <th>No Telepon</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>{user.username}</td>
                                <td>{user.full_name}</td>
                                <td>{user.phone || '-'}</td>
                                <td>{user.role_name}</td>
                                <td>
                                    <span className={`badge ${user.active === 'Y' ? 'badge-success' : 'badge-danger'}`}>
                                        {user.active === 'Y' ? 'Aktif' : 'Non-Aktif'}
                                    </span>
                                </td>
                                <td>
                                    <div className="action-buttons">
                                        <button className="btn-icon" onClick={() => handleEdit(user)} title="Edit User">✏️</button>
                                        <button className="btn-icon" onClick={() => {
                                            setFormData({
                                                username: user.username,
                                                password: '',
                                                full_name: user.full_name,
                                                phone: user.phone || '',
                                                role_id: user.role_id,
                                                active: user.active
                                            });
                                            setIsEditing(true);
                                            setEditId(user.id);
                                            setShowModal(true);
                                        }} title="Reset Password" style={{ fontSize: '0.9rem', marginRight: '5px' }}>🔑</button>
                                        <button className="btn-icon" onClick={() => handleDelete(user.id)} title="Delete User">🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{isEditing ? 'Edit User' : 'Tambah User'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Username</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Password {isEditing && '(Kosongkan jika tidak berubah)'}</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        required={!isEditing}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nama Lengkap</label>
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>No Telepon</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="Contoh: 081234567890"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Role</label>
                                    <select
                                        value={formData.role_id}
                                        onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Pilih Role --</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select
                                        value={formData.active}
                                        onChange={e => setFormData({ ...formData, active: e.target.value })}
                                    >
                                        <option value="Y">Aktif</option>
                                        <option value="N">Non-Aktif</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserList;
