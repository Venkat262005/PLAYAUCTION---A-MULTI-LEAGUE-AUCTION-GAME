import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, UserPlus, Shield, Edit3, Trash2, Key, CheckCircle,
    AlertCircle, RefreshCw, X, Eye, EyeOff, UserCheck
} from 'lucide-react';

const StaffManager = ({ token, API_URL, currentUsername = '' }) => {
    const [staffList, setStaffList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('editor');
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState(null);

    const fetchStaff = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/staff`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setStaffList(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to fetch staff members:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        if (!username.trim() || !password) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/staff/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username: username.trim(),
                    password,
                    role
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: `Account for ${data.user.username} created successfully!` });
                setShowAddModal(false);
                setUsername('');
                setPassword('');
                setRole('editor');
                fetchStaff();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to create staff account' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Error creating account: ' + err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteStaff = async (id, staffUsername) => {
        if (!window.confirm(`Are you sure you want to remove staff member "${staffUsername}"?`)) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/staff/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: `Account "${staffUsername}" removed.` });
                fetchStaff();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to delete account' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Delete failed: ' + err.message });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <span className="p-2.5 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-xl text-blue-400">
                            <Users className="w-6 h-6" />
                        </span>
                        <span>Staff & Editor Management</span>
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Hire and manage staff editors. Editors can search, create, and modify players in staging drafts, but cannot directly alter production collections without your review.
                    </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                    <button
                        onClick={fetchStaff}
                        disabled={isLoading}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                        title="Refresh Staff List"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
                    </button>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/10 transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Hire / Add Staff</span>
                    </button>
                </div>
            </div>

            {/* Notification message */}
            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
                            message.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            <span>{message.text}</span>
                        </div>
                        <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Staff Table / Cards */}
            <div className="bg-[#121217] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                    <span className="text-xs uppercase tracking-wider font-bold text-gray-400">
                        Active Personnel ({staffList.length})
                    </span>
                    <span className="text-xs text-gray-500">Role-Based Access Control</span>
                </div>

                {isLoading && staffList.length === 0 ? (
                    <div className="py-16 text-center text-gray-500">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                        <p className="text-sm">Loading staff members...</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {staffList.map((user) => {
                            const isCurrentUser = user.username === currentUsername;
                            const isUserEditor = user.role === 'editor';

                            return (
                                <div
                                    key={user._id}
                                    className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm border ${
                                            isUserEditor
                                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                                : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {isUserEditor ? <Edit3 className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-sm text-white">{user.username}</h4>
                                                {isCurrentUser && (
                                                    <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full font-bold">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                                <span>Added {new Date(user.createdAt || Date.now()).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span className="font-mono text-gray-400">ID: {user._id.slice(-6)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                            isUserEditor
                                                ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                                                : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                                        }`}>
                                            {isUserEditor ? 'Editor (Staging Only)' : 'Full Admin'}
                                        </span>

                                        {!isCurrentUser && (
                                            <button
                                                onClick={() => handleDeleteStaff(user._id, user.username)}
                                                className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                                                title="Delete Account"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal: Add New Staff Member */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#16161b] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <UserPlus className="w-5 h-5 text-blue-400" />
                                    <span>Create Staff Credentials</span>
                                </h3>
                                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateStaff} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Username *</label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="e.g. editor_rahul"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Password *</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter password (min 4 characters)"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 pr-10"
                                            required
                                            minLength={4}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Role & Permissions</label>
                                    <div className="grid grid-cols-2 gap-3 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setRole('editor')}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                role === 'editor'
                                                    ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-bold'
                                                    : 'bg-white/5 border-white/10 text-gray-400'
                                            }`}
                                        >
                                            <div className="text-sm font-bold flex items-center gap-1.5">
                                                <Edit3 className="w-4 h-4" />
                                                <span>Editor (Staff)</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-1">Can stage changes, drafts require Admin approval.</p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setRole('admin')}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                role === 'admin'
                                                    ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400 font-bold'
                                                    : 'bg-white/5 border-white/10 text-gray-400'
                                            }`}
                                        >
                                            <div className="text-sm font-bold flex items-center gap-1.5">
                                                <Shield className="w-4 h-4" />
                                                <span>Full Admin</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-1">Can sign-off changes and directly alter database.</p>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !username.trim() || !password}
                                        className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Creating...' : 'Create Account'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StaffManager;
