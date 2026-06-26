import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Play, CheckCircle, LogOut, Search, 
    Trash2, User, Image, BarChart3, Settings,
    X, Save, AlertCircle, RefreshCw, Plus,
    Database, Layers, Folder, FolderPlus, Home,
    ChevronRight, ArrowRightLeft, Activity,
    Eye, ChevronDown, List, Terminal, Upload,
    MessageSquare,
    FileSpreadsheet
} from 'lucide-react';
import MongoExplorer from '../../components/Admin/MongoExplorer';

const getPlayerLabel = (p) => {
    if (!p) return 'Unknown';
    if (p.name || p.player || p.Player) return p.name || p.player || p.Player;
    const first = p['First Name'] || p.First_Name || p.firstName || '';
    const last = p.Surname || p.surname || '';
    return `${first} ${last}`.trim() || 'Unknown';
};

const getPlayerImage = (p) =>
    p?.image_path || p?.photoUrl || p?.image_url || p?.imagepath || p?.image || '';

const AdminDashboard = () => {
    const [view, setView] = useState('registry'); // 'registry' or 'infrastructure'
    const [stats, setStats] = useState({ totalPlayers: 0, activeRooms: 0, finishedRooms: 0 });
    const [databases, setDatabases] = useState([]);
    const [selectedDb, setSelectedDb] = useState('ipl');
    const [collections, setCollections] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchCollection, setSearchCollection] = useState('__all__');
    const [playerPools, setPlayerPools] = useState([]);
    const [players, setPlayers] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState(null);
    const [isFetchingStats, setIsFetchingStats] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCollName, setNewCollName] = useState('');
    const [viewingCollection, setViewingCollection] = useState(null);
    const [collectionData, setCollectionData] = useState([]);
    const [editDoc, setEditDoc] = useState(null);
    const [showJsonModal, setShowJsonModal] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [isNewDoc, setIsNewDoc] = useState(false);
    
    // Bulk Import States
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState([]);
    const [importStrategy, setImportStrategy] = useState('append'); // 'append' or 'overwrite'
    const [importError, setImportError] = useState(null);
    const [importFileName, setImportFileName] = useState('');
    const [feedbackItems, setFeedbackItems] = useState([]);
    const [feedbackFilter, setFeedbackFilter] = useState('new');
    const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
    
    const navigate = useNavigate();
    const token = localStorage.getItem('adminToken');
    const API_URL = import.meta.env.VITE_API_URL || '';
    const searchTimerRef = useRef(null);

    useEffect(() => {
        if (!token) {
            navigate('/admin/login');
            return;
        }
        fetchStats();
        fetchDatabases();
    }, [token, navigate]);

    useEffect(() => {
        if (selectedDb) {
            fetchStats();
            fetchCollections(selectedDb);
            setSearchQuery('');
            setPlayers([]);
            setSelectedPlayer(null);
        }
    }, [selectedDb]);

    useEffect(() => {
        if (view === 'feedback') fetchFeedback();
    }, [view, fetchFeedback]);

    const fetchStats = async () => {
        setIsFetchingStats(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/stats?dbName=${selectedDb}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setStats(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsFetchingStats(false);
        }
    };

    const fetchDatabases = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/databases`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setDatabases(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateDb = async () => {
        const dbName = window.prompt("Enter new database name:");
        if (!dbName) return;
        const normalizedDbName = dbName.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!normalizedDbName) {
            alert("Invalid database name");
            return;
        }
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/databases/create`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ dbName: normalizedDbName })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                await fetchDatabases();
                setSelectedDb(normalizedDbName);
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Database creation failed' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDropDb = async () => {
        if (['ipl', 'admin', 'local', 'config'].includes(selectedDb.toLowerCase())) {
            alert("System database cannot be dropped!");
            return;
        }
        const confirmName = window.prompt(`To confirm dropping database '${selectedDb}', type the database name below exactly:`);
        if (confirmName !== selectedDb) {
            alert("Database name confirmation failed. Drop aborted.");
            return;
        }
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/databases/drop?dbName=${selectedDb}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setSelectedDb('ipl');
                await fetchDatabases();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Database deletion failed' });
        } finally {
            setIsProcessing(false);
        }
    };

    const fetchCollections = async (dbName) => {
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [allRes, poolsRes] = await Promise.all([
                fetch(`${API_URL}/api/admin/collections?dbName=${encodeURIComponent(dbName)}`, { headers }),
                fetch(`${API_URL}/api/admin/collections?dbName=${encodeURIComponent(dbName)}&playerPoolsOnly=true`, { headers }),
            ]);
            const data = await allRes.json();
            const pools = poolsRes.ok ? await poolsRes.json() : [];

            if (allRes.ok) {
                setCollections(data);
                setPlayerPools(pools.length ? pools : data);
                const league = String(dbName || 'ipl').toLowerCase();
                const defaultPool =
                    league === 'ipl' && pools.includes('ipl_data') ? 'ipl_data' : '__all__';
                setSearchCollection(defaultPool);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCollectionData = async (collName) => {
        setViewingCollection(collName);
        setCollectionData([]);
        try {
            const res = await fetch(`${API_URL}/api/admin/collections/data?dbName=${selectedDb}&collectionName=${collName}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setCollectionData(data.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchFeedback = useCallback(async () => {
        setIsFetchingFeedback(true);
        try {
            const filterQuery = feedbackFilter === 'all' ? '' : `?status=${encodeURIComponent(feedbackFilter)}`;
            const res = await fetch(`${API_URL}/api/admin/feedback${filterQuery}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setFeedbackItems(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsFetchingFeedback(false);
        }
    }, [API_URL, feedbackFilter, token]);

    const updateFeedbackStatus = async (id, status) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/feedback/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (res.ok) {
                setFeedbackItems(prev => prev.map(item => item._id === id ? data : item));
                setMessage({ type: 'success', text: `Feedback marked as ${status}` });
            } else {
                setMessage({ type: 'error', text: data.error || 'Could not update feedback' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Could not update feedback' });
        }
    };

    const handleCreateData = async () => {
        try {
            const doc = JSON.parse(jsonInput);
            setIsProcessing(true);
            const res = await fetch(`${API_URL}/api/admin/data/create`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ dbName: selectedDb, collectionName: viewingCollection, document: doc })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Document created successfully' });
                setShowJsonModal(false);
                fetchCollectionData(viewingCollection);
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Invalid JSON format or server error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateData = async () => {
        try {
            const updates = JSON.parse(jsonInput);
            setIsProcessing(true);
            const res = await fetch(`${API_URL}/api/admin/data/update`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    dbName: selectedDb, 
                    collectionName: viewingCollection, 
                    id: editDoc._id, 
                    updates 
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Document updated successfully' });
                setShowJsonModal(false);
                setEditDoc(null);
                fetchCollectionData(viewingCollection);
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Invalid JSON format or server error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteData = async (id) => {
        if (!window.confirm('Delete this document? This action is irreversible.')) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/data/delete?dbName=${selectedDb}&collectionName=${viewingCollection}&id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Document deleted' });
                fetchCollectionData(viewingCollection);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Deletion failed' });
        } finally {
            setIsProcessing(false);
        }
    };

    const openEditModal = (doc) => {
        setEditDoc(doc);
        setJsonInput(JSON.stringify(doc, null, 2));
        setIsNewDoc(false);
        setShowJsonModal(true);
    };

    const openCreateModal = () => {
        setEditDoc(null);
        setJsonInput('{\n  \n}');
        setIsNewDoc(true);
        setShowJsonModal(true);
    };

    const handleSyncRegistry = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/registry/sync`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ dbName: selectedDb })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                fetchStats();
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Synchronization failed' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreateCollection = async () => {
        if (!newCollName) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/collections/create`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ dbName: selectedDb, collectionName: newCollName })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setNewCollName('');
                
                const finalCollName = data.collectionName || newCollName.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
                await fetchCollections(selectedDb);
                fetchCollectionData(finalCollName);
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to create collection' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to create collection' });
        } finally {
            setIsProcessing(false);
        }
    };

    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/);
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        if (headers.length === 0 || !headers[0]) return [];
        
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = [];
            let currentValue = '';
            let insideQuotes = false;
            
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"' || char === "'") {
                    insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                    values.push(currentValue.trim());
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            values.push(currentValue.trim());
            
            const doc = {};
            headers.forEach((header, index) => {
                let val = values[index];
                if (val !== undefined) {
                    val = val.replace(/^["']|["']$/g, '');
                    if (val === '') {
                        doc[header] = null;
                    } else if (!isNaN(Number(val))) {
                        doc[header] = Number(val);
                    } else if (val.toLowerCase() === 'true') {
                        doc[header] = true;
                    } else if (val.toLowerCase() === 'false') {
                        doc[header] = false;
                    } else {
                        doc[header] = val;
                    }
                }
            });
            result.push(doc);
        }
        return result;
    };

    const handleImportFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setImportFileName(file.name);
        setImportError(null);
        setImportData([]);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                let parsed = [];
                
                if (file.name.endsWith('.json')) {
                    parsed = JSON.parse(text);
                    if (!Array.isArray(parsed)) {
                        if (typeof parsed === 'object' && parsed !== null) {
                            parsed = [parsed];
                        } else {
                            throw new Error("JSON file must contain a valid object or array of objects");
                        }
                    }
                } else if (file.name.endsWith('.jsonl') || file.name.endsWith('.txt')) {
                    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                    parsed = lines.map((line, idx) => {
                        try {
                            return JSON.parse(line);
                        } catch (err) {
                            throw new Error(`Invalid JSON on line ${idx + 1}`);
                        }
                    });
                } else if (file.name.endsWith('.csv')) {
                    parsed = parseCSV(text);
                } else {
                    throw new Error("Unsupported file format. Please upload a .json, .csv, .jsonl, or .txt file.");
                }
                
                if (parsed.length === 0) {
                    throw new Error("The file is empty or contains no records.");
                }
                
                setImportData(parsed);
            } catch (err) {
                console.error(err);
                setImportError(err.message || "Failed to parse file.");
            }
        };
        reader.readAsText(file);
    };

    const handleImportSubmit = async () => {
        if (importData.length === 0) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/collections/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    dbName: selectedDb,
                    collectionName: viewingCollection,
                    documents: importData,
                    overwrite: importStrategy === 'overwrite'
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setShowImportModal(false);
                setImportData([]);
                setImportFileName('');
                fetchCollectionData(viewingCollection);
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to import documents' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to import documents' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDropCollection = async (collName) => {
        if (!window.confirm(`Permanently DROP collection '${collName}' from '${selectedDb}'? ALL DATA WILL BE LOST.`)) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/collections/drop?dbName=${selectedDb}&collectionName=${collName}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                if (viewingCollection === collName) setViewingCollection(null);
                fetchCollections(selectedDb);
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to drop collection' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to drop collection' });
        } finally {
            setIsProcessing(false);
        }
    };

    const searchPlayers = useCallback((q) => {
        setSearchQuery(q);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        if (q.length < 2) {
            setPlayers([]);
            return;
        }

        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${API_URL}/api/admin/players/search?q=${encodeURIComponent(q)}&dbName=${encodeURIComponent(selectedDb)}&collectionName=${encodeURIComponent(searchCollection)}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();
                if (res.ok) setPlayers(Array.isArray(data) ? data : []);
                else setPlayers([]);
            } catch (err) {
                console.error(err);
                setPlayers([]);
            }
        }, 280);
    }, [API_URL, selectedDb, searchCollection, token]);

    const handleUpdatePlayer = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/players/update`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    playerId: selectedPlayer.playerId || selectedPlayer.id || selectedPlayer._id,
                    updates: selectedPlayer,
                    currentDb: selectedDb,
                    poolName: selectedPlayer.poolName || (searchCollection !== '__all__' ? searchCollection : undefined),
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Player updated across all registries' });
                setSelectedPlayer(null);
                setSearchQuery('');
                setPlayers([]);
                fetchStats();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update player' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeletePlayer = async () => {
        if (!window.confirm(`Permanently delete ${getPlayerLabel(selectedPlayer)}?`)) return;
        const pid = selectedPlayer.playerId || selectedPlayer.id || selectedPlayer._id;
        const coll = selectedPlayer.poolName || (searchCollection !== '__all__' ? searchCollection : playerPools[0]);
        if (!coll) {
            setMessage({ type: 'error', text: 'Could not determine player collection' });
            return;
        }
        setIsProcessing(true);
        try {
            const res = await fetch(
                `${API_URL}/api/admin/players/${encodeURIComponent(pid)}?currentDb=${encodeURIComponent(selectedDb)}&currentCollection=${encodeURIComponent(coll)}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.ok) {
                setMessage({ type: 'success', text: 'Player removed from database' });
                setSelectedPlayer(null);
                fetchStats();
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Deletion failed' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMovePlayer = async (targetColl) => {
        if (!targetColl) return;
        const pid = selectedPlayer.playerId || selectedPlayer.id || selectedPlayer._id;
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/players/move`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    playerId: pid,
                    fromDb: selectedDb,
                    fromCollection: selectedPlayer.poolName || (searchCollection !== '__all__' ? searchCollection : playerPools[0]),
                    toDb: selectedDb,
                    toCollection: targetColl
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setSelectedPlayer({ ...selectedPlayer, poolName: targetColl });
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Move operation failed' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreatePlayer = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const player = {
            playerId: formData.get('playerId'),
            name: formData.get('name'),
            player: formData.get('name'),
            role: formData.get('role'),
            basePrice: Number(formData.get('basePrice')),
            image_path: formData.get('image_path'),
            poolName: formData.get('targetCollection'),
            stats: {
                matches: Number(formData.get('matches') || 0),
                runs: Number(formData.get('runs') || 0),
                wickets: Number(formData.get('wickets') || 0)
            }
        };
        const targetCollection = formData.get('targetCollection');

        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/players/create`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ player, targetDb: selectedDb, targetCollection })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'New player deployed to database' });
                setShowCreateModal(false);
                fetchStats();
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Deployment failed' });
        } finally {
            setIsProcessing(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-white font-sans selection:bg-yellow-500/30">
            {/* Sidebar-style Mini Nav */}
            <div className="fixed left-0 top-0 bottom-0 w-20 bg-black/40 backdrop-blur-3xl border-r border-white/5 flex flex-col items-center py-8 z-50">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 mb-12">
                    <Settings className="w-6 h-6 text-black" />
                </div>
                
                <nav className="flex flex-col gap-6">
                    <NavBtn active={view === 'registry'} onClick={() => setView('registry')} icon={<Users className="w-6 h-6" />} label="Players" />
                    <NavBtn active={view === 'feedback'} onClick={() => setView('feedback')} icon={<MessageSquare className="w-6 h-6" />} label="Feedback" />
                    <NavBtn active={view === 'infrastructure'} onClick={() => setView('infrastructure')} icon={<Database className="w-6 h-6" />} label="Data" />
                    <NavBtn active={false} onClick={fetchStats} icon={<Activity className="w-6 h-6" />} label="Health" />
                </nav>

                <div className="mt-auto">
                    <button onClick={logout} className="p-4 text-gray-500 hover:text-red-400 transition-colors">
                        <LogOut className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <main className="pl-20">
                {/* Header Section */}
                <header className="h-24 border-b border-white/5 px-8 flex items-center justify-between sticky top-0 bg-[#0a0a0c]/80 backdrop-blur-xl z-30">
                    <div className="flex items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                                {view === 'registry' ? 'Player Protocol' : 'MongoDB Explorer'}
                                <ChevronRight className="w-5 h-5 text-gray-700" />
                                <span className="text-yellow-500 uppercase text-xs tracking-widest bg-yellow-500/10 px-3 py-1 rounded-full">{selectedDb}</span>
                            </h1>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Authorized Administrative Access • Play Auction 2026</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2 py-1">
                            <select 
                                value={selectedDb}
                                onChange={(e) => setSelectedDb(e.target.value)}
                                className="bg-transparent text-xs font-bold outline-none cursor-pointer pr-4 text-white"
                            >
                                {databases.map(db => <option key={db} value={db} className="bg-neutral-900 text-white">{db.toUpperCase()}</option>)}
                            </select>
                            
                            <button 
                                onClick={handleCreateDb}
                                title="Create New Database"
                                className="p-1 hover:bg-white/10 text-yellow-500 rounded-lg transition-colors flex items-center justify-center"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>

                            {!['ipl', 'admin', 'local', 'config'].includes(selectedDb.toLowerCase()) && (
                                <button 
                                    onClick={handleDropDb}
                                    title="Drop Selected Database"
                                    className="p-1 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors flex items-center justify-center"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-xs font-medium text-gray-300">System Live</span>
                        </div>
                    </div>
                </header>

                <div className="p-8 space-y-8">
                    {/* View Controller */}
                    {view === 'feedback' ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight">Feedback Inbox</h2>
                                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">User issues, suggestions, and improvements</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {['new', 'reviewed', 'resolved', 'all'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setFeedbackFilter(status)}
                                            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${feedbackFilter === status ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {isFetchingFeedback ? (
                                    <div className="col-span-full text-center py-16 text-gray-500 font-black uppercase tracking-widest">Loading feedback...</div>
                                ) : feedbackItems.length > 0 ? (
                                    feedbackItems.map((item) => (
                                        <div key={item._id} className="bg-[#121216] border border-white/10 rounded-[2rem] p-5 space-y-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-lg font-black">{item.name || 'Anonymous'}</span>
                                                        <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${item.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : item.status === 'reviewed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                                                            {item.status}
                                                        </span>
                                                        <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 text-white/50">
                                                            {item.category}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">
                                                        {item.playerName || 'Guest'} · {item.league?.toUpperCase() || 'IPL'} · {item.page || '/'}
                                                        {item.roomCode ? ` · Room ${item.roomCode}` : ''}
                                                    </div>
                                                </div>
                                                <div className="text-right text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                                                </div>
                                            </div>
                                            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{item.message}</p>
                                            {item.contact && (
                                                <div className="text-[10px] text-yellow-400/80 font-bold uppercase tracking-widest">
                                                    Contact: {item.contact}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {['new', 'reviewed', 'resolved'].map((status) => (
                                                    <button
                                                        key={status}
                                                        onClick={() => updateFeedbackStatus(item._id, status)}
                                                        className={`px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${item.status === status ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                                                    >
                                                        Mark {status}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-16 text-gray-500 font-black uppercase tracking-widest bg-white/5 border border-white/10 rounded-[2rem]">
                                        No feedback yet for this filter.
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : view === 'registry' ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <StatCard 
                                    label="Registry Total" 
                                    value={stats.totalPlayers} 
                                    icon={<Users className="w-6 h-6" />}
                                    color="from-blue-500/20 to-indigo-500/20"
                                    accent="bg-blue-500"
                                    isLoading={isFetchingStats}
                                />
                                <StatCard 
                                    label="Live Engines" 
                                    value={stats.activeRooms} 
                                    icon={<Play className="w-6 h-6" />}
                                    color="from-emerald-500/20 to-teal-500/20"
                                    accent="bg-emerald-500"
                                    isLoading={isFetchingStats}
                                />
                                <StatCard 
                                    label="Finalized Rooms" 
                                    value={stats.finishedRooms} 
                                    icon={<CheckCircle className="w-6 h-6" />}
                                    color="from-orange-500/20 to-red-500/20"
                                    accent="bg-orange-500"
                                    isLoading={isFetchingStats}
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* Registry Column */}
                                <div className="lg:col-span-12">
                                    <section className="bg-[#121216] border border-white/10 rounded-[2.5rem] overflow-visible shadow-2xl">
                                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Layers className="w-5 h-5 text-yellow-500" />
                                                <h2 className="text-xl font-bold">Search Protocol</h2>
                                            </div>
                                            <button 
                                                onClick={() => setShowCreateModal(true)}
                                                className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 rounded-full text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/20"
                                            >
                                                <Plus className="w-4 h-4" />
                                                INITIALIZE ASSET
                                            </button>
                                        </div>

                                        <div className="p-8">
                                            <div className="flex gap-4 max-w-3xl mx-auto">
                                                <select
                                                    value={searchCollection}
                                                    onChange={(e) => {
                                                        setSearchCollection(e.target.value);
                                                        setPlayers([]);
                                                        if (searchQuery.length >= 2) searchPlayers(searchQuery);
                                                    }}
                                                    className="bg-black/40 border border-white/10 rounded-2xl px-6 py-5 focus:outline-none focus:border-yellow-500/50 appearance-none cursor-pointer font-bold text-sm text-yellow-500 min-w-[200px]"
                                                >
                                                    {selectedDb.toLowerCase() === 'ipl' && playerPools.includes('ipl_data') && (
                                                        <option value="ipl_data">Master Registry (ipl_data)</option>
                                                    )}
                                                    <option value="__all__">All pools</option>
                                                    {playerPools.filter((c) => c !== 'ipl_data').map((c) => (
                                                        <option key={c} value={c}>Pool: {c}</option>
                                                    ))}
                                                </select>
                                                <div className="relative group flex-1">
                                                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-yellow-500 transition-colors" />
                                                    <input 
                                                        type="text"
                                                    placeholder={`Search ${searchCollection === '__all__' ? 'all pools' : searchCollection} in ${selectedDb.toUpperCase()}...`}
                                                        value={searchQuery}
                                                        onChange={(e) => searchPlayers(e.target.value)}
                                                        className="w-full bg-black/40 border border-white/10 rounded-2xl pl-16 pr-6 py-5 focus:outline-none focus:border-yellow-500/50 focus:ring-4 focus:ring-yellow-500/10 transition-all placeholder:text-gray-600 font-medium"
                                                    />
                                                    
                                                    <AnimatePresence>
                                                    {players.length > 0 && (
                                                        <motion.div 
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 10 }}
                                                            className="absolute top-full left-0 right-0 bg-[#1c1c22] border border-white/10 rounded-[2rem] mt-4 overflow-hidden z-20 shadow-3xl max-h-[400px] overflow-y-auto custom-scrollbar"
                                                        >
                                                            {players.map((p, idx) => (
                                                                <div 
                                                                    key={`${p._id}-${p.poolName || idx}`}
                                                                    onClick={() => { setSelectedPlayer({ ...p, poolName: p.poolName || searchCollection }); setPlayers([]); }}
                                                                    className="p-5 hover:bg-yellow-500/10 cursor-pointer flex items-center justify-between border-b border-white/5 last:border-0 group/item transition-colors"
                                                                >
                                                                    <div className="flex items-center gap-5">
                                                                        <img src={getPlayerImage(p)} alt="" className="w-14 h-14 rounded-2xl object-cover bg-black border border-white/10" onError={(e) => { e.target.style.display = 'none'; }} />
                                                                        <div>
                                                                            <div className="font-bold text-lg group-hover/item:text-yellow-500 transition-colors">{getPlayerLabel(p)}</div>
                                                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                                                                <span className="bg-white/5 px-2 py-0.5 rounded uppercase font-bold">{p.role || p.Role || p.Specialism || '—'}</span>
                                                                                {p.poolName && (
                                                                                    <span className="bg-yellow-500/10 text-yellow-500/80 px-2 py-0.5 rounded uppercase font-bold text-[10px]">{p.poolName}</span>
                                                                                )}
                                                                                {(p.playerId || p.id) && (
                                                                                    <span className="text-yellow-500/50 font-mono">#{p.playerId || p.id}</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-lg font-black text-yellow-500">{p.basePrice} L</div>
                                                                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-tighter">Market Val</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                                </div>
                                            </div>

                                            {selectedPlayer && (
                                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-12 grid grid-cols-1 md:grid-cols-12 gap-12">
                                                    <div className="md:col-span-7 space-y-8">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-2 h-8 bg-yellow-500 rounded-full" />
                                                                <h3 className="text-xl font-black uppercase tracking-tight">Configuration</h3>
                                                            </div>
                                                            <button onClick={() => setSelectedPlayer(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                                                        </div>

                                                        <form onSubmit={handleUpdatePlayer} className="space-y-8">
                                                            <div className="grid grid-cols-2 gap-8">
                                                                <Field label="Market Value (Lakhs)" icon={<Database className="w-4 h-4" />}>
                                                                    <input 
                                                                        type="number"
                                                                        value={selectedPlayer.basePrice || ''}
                                                                        onChange={(e) => setSelectedPlayer({...selectedPlayer, basePrice: Number(e.target.value)})}
                                                                        className="w-full bg-transparent outline-none font-black text-2xl text-yellow-500 placeholder-yellow-500/30"
                                                                        placeholder="Not Set"
                                                                    />
                                                                </Field>
                                                                <Field label="Asset Role" icon={<Layers className="w-4 h-4" />}>
                                                                    <select 
                                                                        value={selectedPlayer.role}
                                                                        onChange={(e) => setSelectedPlayer({...selectedPlayer, role: e.target.value})}
                                                                        className="w-full bg-transparent outline-none font-black text-xl uppercase appearance-none cursor-pointer"
                                                                    >
                                                                        <option value="Batsman">Batsman</option>
                                                                        <option value="Bowler">Bowler</option>
                                                                        <option value="All-Rounder">All-Rounder</option>
                                                                        <option value="Wicketkeeper">Wicketkeeper</option>
                                                                    </select>
                                                                </Field>
                                                                <div className="col-span-2">
                                                                    <Field label="Asset Visual URL" icon={<Image className="w-4 h-4" />}>
                                                                        <input 
                                                                            type="text"
                                                                            value={selectedPlayer.image_path || ''}
                                                                            onChange={(e) => setSelectedPlayer({...selectedPlayer, image_path: e.target.value})}
                                                                            className="w-full bg-transparent outline-none font-mono text-xs text-gray-400"
                                                                        />
                                                                    </Field>
                                                                </div>
                                                            </div>

                                                            <div className="pt-4 space-y-6">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-2 h-6 bg-blue-500 rounded-full" />
                                                                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Performance Matrix</h3>
                                                                </div>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                    {Object.entries(selectedPlayer).map(([k, v]) => {
                                                                        if (['_id', 'id', 'playerId', 'name', 'player', 'image_path', 'photoUrl', 'basePrice', 'role', 'poolName'].includes(k)) return null;
                                                                        return (
                                                                            <div key={k} className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-yellow-500/50 focus-within:bg-black/60 transition-colors">
                                                                                <div className="text-[10px] text-gray-500 uppercase font-black tracking-tighter mb-1 truncate">{k.replace(/_/g, ' ')}</div>
                                                                                <input 
                                                                                    type={typeof v === 'number' ? 'number' : 'text'}
                                                                                    value={selectedPlayer[k] ?? ''}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
                                                                                        setSelectedPlayer({...selectedPlayer, [k]: val});
                                                                                    }}
                                                                                    className="w-full bg-transparent outline-none font-black text-lg text-white placeholder-gray-700 truncate"
                                                                                    placeholder="-"
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-4 pt-4">
                                                                <button 
                                                                    type="submit"
                                                                    disabled={isProcessing}
                                                                    className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-600 hover:scale-[1.02] active:scale-[0.98] text-black font-black py-5 rounded-[2rem] shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                                                >
                                                                    <Save className="w-6 h-6" />
                                                                    COMMIT ASSET UPDATE
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    onClick={handleDeletePlayer}
                                                                    disabled={isProcessing}
                                                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-8 rounded-[2rem] transition-all active:scale-95 disabled:opacity-50"
                                                                >
                                                                    <Trash2 className="w-6 h-6" />
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>

                                                    <div className="md:col-span-5">
                                                        <div className="sticky top-32">
                                                            <div className="relative bg-gradient-to-b from-[#1c1c22] to-[#0a0a0c] border border-white/10 rounded-[3rem] p-8 shadow-3xl">
                                                                <div className="aspect-[4/5] rounded-[2rem] overflow-hidden bg-black mb-8 border border-white/5 relative">
                                                                    <img src={getPlayerImage(selectedPlayer)} alt="" className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                                                                    <div className="absolute bottom-6 left-6 right-6">
                                                                        <h4 className="text-3xl font-black uppercase tracking-tight leading-none">{getPlayerLabel(selectedPlayer)}</h4>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-8">
                                                                    <div>
                                                                        <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Base Value</span>
                                                                        <div className="text-3xl font-black">{selectedPlayer.basePrice} L</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Pool</span>
                                                                        <div className="text-sm font-bold text-yellow-500 uppercase">{selectedPlayer.poolName || 'MASTER'}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {!selectedPlayer && stats.totalPlayers === 0 && (
                                                <div className="mt-12 p-12 border-2 border-dashed border-white/5 rounded-[3rem] text-center bg-yellow-500/[0.02]">
                                                    <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
                                                    <h3 className="text-xl font-bold text-gray-300">Master Registry is Empty</h3>
                                                    <p className="text-gray-500 mt-2 max-w-md mx-auto">You can browse pool data in the <span className="text-yellow-500 font-bold">Storage</span> tab or initialize new assets here.</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <MongoExplorer
                            selectedDb={selectedDb}
                            token={token}
                            apiUrl={API_URL}
                            collections={collections}
                            onRefreshCollections={() => fetchCollections(selectedDb)}
                            onMessage={setMessage}
                            isProcessing={isProcessing}
                            setIsProcessing={setIsProcessing}
                        />
                    )}
                </div>
            </main>

            {/* Create Player Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="relative bg-[#121216] border border-white/10 w-full max-w-2xl rounded-[3rem] shadow-3xl overflow-hidden"
                        >
                            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-yellow-500/10 to-transparent">
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tight">Initialize Asset</h2>
                                    <p className="text-xs text-gray-500 uppercase font-black tracking-widest mt-1">Registry Deployment Matrix • {selectedDb}</p>
                                </div>
                                <button onClick={() => setShowCreateModal(false)} className="bg-white/5 hover:bg-white/10 p-3 rounded-full transition-colors"><X className="w-7 h-7" /></button>
                            </div>

                            <form onSubmit={handleCreatePlayer} className="p-10 space-y-8">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Unique Protocol ID</label>
                                        <input name="playerId" required className="w-full bg-black/40 border border-white/10 rounded-[1.5rem] px-6 py-4 focus:border-yellow-500/50 outline-none font-mono" placeholder="VK_01" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Asset Full Name</label>
                                        <input name="name" required className="w-full bg-black/40 border border-white/10 rounded-[1.5rem] px-6 py-4 focus:border-yellow-500/50 outline-none" placeholder="Virat Kohli" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Protocol Role</label>
                                        <select name="role" className="w-full bg-black/40 border border-white/10 rounded-[1.5rem] px-6 py-4 focus:border-yellow-500/50 outline-none appearance-none cursor-pointer uppercase font-bold text-sm">
                                            <option value="Batsman">Batsman</option>
                                            <option value="Bowler">Bowler</option>
                                            <option value="All-Rounder">All-Rounder</option>
                                            <option value="Wicketkeeper">Wicketkeeper</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Registry Pool</label>
                                        <select name="targetCollection" required className="w-full bg-black/40 border border-white/10 rounded-[1.5rem] px-6 py-4 focus:border-yellow-500/50 outline-none appearance-none cursor-pointer uppercase font-bold text-sm">
                                            {selectedDb.toLowerCase() === 'ipl' && playerPools.includes('ipl_data') && (
                                                <option value="ipl_data">Global Matrix (ipl_data)</option>
                                            )}
                                            {playerPools.filter((c) => c !== 'ipl_data').map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" disabled={isProcessing} className="w-full bg-yellow-500 text-black font-black py-5 rounded-[2rem] shadow-2xl shadow-yellow-500/20 active:scale-95 transition-all text-lg uppercase tracking-widest">
                                    {isProcessing ? 'INITIALIZING...' : 'CONFIRM DEPLOYMENT'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* JSON Editor Modal */}
            <AnimatePresence>
                {showJsonModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowJsonModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="relative bg-[#121216] border border-white/10 w-full max-w-2xl rounded-[3rem] shadow-3xl overflow-hidden"
                        >
                            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-yellow-500/10 to-transparent">
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tight">{isNewDoc ? 'Create Entry' : 'Edit Entry'}</h2>
                                    <p className="text-xs text-gray-500 uppercase font-black tracking-widest mt-1">Raw Protocol Buffer • {selectedDb}.{viewingCollection}</p>
                                </div>
                                <button onClick={() => setShowJsonModal(false)} className="bg-white/5 hover:bg-white/10 p-3 rounded-full transition-colors"><X className="w-7 h-7" /></button>
                            </div>

                            <div className="p-10 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Document Payload (JSON)</label>
                                    <textarea 
                                        value={jsonInput}
                                        onChange={(e) => setJsonInput(e.target.value)}
                                        className="w-full h-80 bg-black/60 border border-white/10 rounded-[1.5rem] p-6 focus:border-yellow-500/50 outline-none font-mono text-sm text-yellow-500/80 custom-scrollbar resize-none"
                                        placeholder="{ ... }"
                                    />
                                </div>
                                
                                <div className="flex gap-4">
                                    <button 
                                        onClick={isNewDoc ? handleCreateData : handleUpdateData}
                                        disabled={isProcessing}
                                        className="flex-1 bg-yellow-500 text-black font-black py-5 rounded-[2rem] shadow-2xl shadow-yellow-500/20 active:scale-95 transition-all text-lg uppercase tracking-widest flex items-center justify-center gap-3"
                                    >
                                        <Save className="w-5 h-5" />
                                        {isProcessing ? 'PROCESSING...' : (isNewDoc ? 'CREATE DOCUMENT' : 'SAVE CHANGES')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bulk Document Import Modal */}
            <AnimatePresence>
                {showImportModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowImportModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="relative bg-[#121216] border border-white/10 w-full max-w-3xl rounded-[3rem] shadow-3xl overflow-hidden flex flex-col max-h-[85vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-yellow-500/10 to-transparent flex-shrink-0">
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                                        <Upload className="w-8 h-8 text-yellow-500" />
                                        Import Registry Documents
                                    </h2>
                                    <p className="text-xs text-gray-500 uppercase font-black tracking-widest mt-1">Upload Data Stream • {selectedDb}.{viewingCollection}</p>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="bg-white/5 hover:bg-white/10 p-3 rounded-full transition-colors"><X className="w-7 h-7" /></button>
                            </div>

                            {/* Modal Body - Scrollable */}
                            <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                                {/* Upload Zone */}
                                <div className="space-y-3">
                                    <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Data Source File</label>
                                    <div className="relative group border-2 border-dashed border-white/10 hover:border-yellow-500/30 rounded-[2rem] p-10 bg-black/25 flex flex-col items-center justify-center text-center transition-all cursor-pointer">
                                        <input 
                                            type="file" 
                                            accept=".json,.csv,.jsonl,.txt"
                                            onChange={handleImportFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/5 group-hover:scale-110 transition-transform">
                                            <FileSpreadsheet className="w-8 h-8 text-yellow-500" />
                                        </div>
                                        <p className="text-sm font-bold text-white group-hover:text-yellow-500 transition-colors">
                                            {importFileName ? importFileName : "Drag and drop your file here, or browse"}
                                        </p>
                                        <p className="text-xs text-gray-500 uppercase font-black tracking-widest mt-2">Supports JSON Array, CSV, or Line-delimited JSONL</p>
                                    </div>
                                </div>

                                {/* Strategy Selection & Quick Status */}
                                {importData.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {/* Import Mode Selection */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Conflict Strategy</label>
                                            <div className="flex gap-4 p-2 bg-black/40 border border-white/5 rounded-2xl">
                                                <button 
                                                    type="button"
                                                    onClick={() => setImportStrategy('append')}
                                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase transition-all ${
                                                        importStrategy === 'append' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                                >
                                                    Append Records
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setImportStrategy('overwrite')}
                                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase transition-all ${
                                                        importStrategy === 'overwrite' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                                >
                                                    Overwrite / Replace
                                                </button>
                                            </div>
                                        </div>

                                        {/* Data Summary Stats */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Buffer Analysis</label>
                                            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between h-[4.5rem]">
                                                <div>
                                                    <span className="text-[10px] text-gray-500 uppercase font-black">Total Records Detected</span>
                                                    <div className="text-xl font-black text-yellow-500">{importData.length} documents</div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-gray-500 uppercase font-black">Columns found</span>
                                                    <div className="text-xs font-bold text-gray-300 font-mono">
                                                        {Object.keys(importData[0] || {}).slice(0, 3).join(', ')} {Object.keys(importData[0] || {}).length > 3 ? '...' : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Error/Warning Alerts */}
                                {importError && (
                                    <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[1.5rem] flex items-center gap-4 text-red-400 animate-in shake duration-300">
                                        <AlertCircle className="w-8 h-8 flex-shrink-0" />
                                        <div>
                                            <div className="font-black uppercase text-xs tracking-wider">Parse Validation Failed</div>
                                            <div className="text-sm font-semibold mt-1">{importError}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Live Preview Panel */}
                                {importData.length > 0 && (
                                    <div className="space-y-3 animate-in fade-in duration-500">
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest ml-1">Registry Buffer Preview (First 3 entries)</label>
                                        <div className="bg-black/60 border border-white/10 rounded-[1.5rem] p-6 max-h-56 overflow-auto custom-scrollbar font-mono text-[11px] text-gray-400 space-y-4">
                                            {importData.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="pb-3 border-b border-white/5 last:border-0 last:pb-0">
                                                    <div className="text-yellow-500/60 font-bold mb-1">// Document #{idx + 1}</div>
                                                    <pre className="whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                                                </div>
                                            ))}
                                            {importData.length > 3 && (
                                                <div className="text-gray-600 font-bold italic pt-1 text-center">
                                                    + {importData.length - 3} more records...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-10 border-t border-white/5 flex gap-4 bg-black/20 flex-shrink-0">
                                <button 
                                    onClick={() => setShowImportModal(false)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-[1.5rem] border border-white/10 transition-colors uppercase text-sm tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleImportSubmit}
                                    disabled={isProcessing || importData.length === 0}
                                    className="flex-1 bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-[1.5rem] shadow-2xl shadow-yellow-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3"
                                >
                                    <Upload className="w-5 h-5" />
                                    {isProcessing ? 'IMPORTING...' : `CONFIRM IMPORT`}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Notification Toast */}
            <AnimatePresence>
                {message && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`fixed bottom-10 right-10 z-[200] px-8 py-5 rounded-2xl shadow-2xl border flex items-center gap-4 ${
                            message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}
                    >
                        {message.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                        <span className="font-black uppercase tracking-tight">{message.text}</span>
                        <button onClick={() => setMessage(null)} className="ml-4 opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
                .perspective-1000 { perspective: 1000px; }
                .rotate-y-12 { transform: rotateY(12deg); }
            `}</style>
        </div>
    );
};

const NavBtn = ({ active, icon, onClick, label }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all group ${
            active ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-500 hover:text-white hover:bg-white/5'
        }`}
    >
        {icon}
        <span className="text-[8px] uppercase font-black tracking-widest">{label}</span>
    </button>
);

const Field = ({ label, icon, children }) => (
    <div className="space-y-2 group">
        <label className="text-[10px] uppercase font-black text-gray-600 tracking-widest ml-1 flex items-center gap-2 group-focus-within:text-yellow-500/50 transition-colors">
            {icon} {label}
        </label>
        <div className="bg-black/40 border border-white/5 rounded-2xl px-6 py-4 focus-within:border-yellow-500/50 focus-within:ring-4 focus-within:ring-yellow-500/5 transition-all">
            {children}
        </div>
    </div>
);

const StatCard = ({ label, value, icon, color, accent, isLoading }) => (
    <div className={`relative bg-gradient-to-br ${color} border border-white/10 p-8 rounded-[2.5rem] overflow-hidden group hover:border-white/20 transition-all duration-700`}>
        <div className={`absolute -right-4 -bottom-4 w-32 h-32 ${accent} opacity-[0.03] blur-3xl group-hover:opacity-[0.08] transition-opacity`} />
        
        <div className="flex items-start justify-between relative z-10">
            <div className={`w-14 h-14 rounded-2xl ${accent}/10 flex items-center justify-center border border-white/5 text-white/80 group-hover:text-white transition-colors`}>
                {icon}
            </div>
        </div>

        <div className="mt-6 relative z-10">
            <p className="text-gray-500 text-xs font-black uppercase tracking-[0.2em]">{label}</p>
            <div className="flex items-baseline gap-2 mt-1">
                {isLoading ? (
                    <div className="h-12 w-24 bg-white/5 rounded-xl animate-pulse" />
                ) : (
                    <h3 className="text-5xl font-black tracking-tighter">{value}</h3>
                )}
            </div>
        </div>
    </div>
);

export default AdminDashboard;
