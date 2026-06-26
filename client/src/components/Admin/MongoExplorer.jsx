import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database, Layers, Folder, FolderPlus, Plus, Trash2, RefreshCw,
    Search, Save, X, Copy, Upload, FileSpreadsheet, AlertCircle,
    ChevronLeft, ChevronRight, Filter, Braces, ListTree, CheckSquare,
    Square, Settings2, Terminal
} from 'lucide-react';

const PAGE_SIZE = 50;

const parseInputValue = (raw, type) => {
    if (type === 'number') return raw === '' ? null : Number(raw);
    if (type === 'boolean') return raw === 'true';
    if (type === 'null') return null;
    if (type === 'json') {
        try { return JSON.parse(raw || 'null'); } catch { return raw; }
    }
    return raw;
};

const inferType = (val) => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'object') return 'json';
    return 'string';
};

const formatPreview = (val) => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'object') return JSON.stringify(val).slice(0, 60) + (JSON.stringify(val).length > 60 ? '…' : '');
    return String(val).slice(0, 80);
};

const docToFields = (doc) =>
    Object.entries(doc || {}).map(([key, value]) => ({
        key,
        value: typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value ?? ''),
        type: inferType(value),
        isNew: false,
    }));

const MongoExplorer = ({
    selectedDb,
    token,
    apiUrl = '',
    collections = [],
    onRefreshCollections,
    onMessage,
    isProcessing,
    setIsProcessing,
}) => {
    const [newCollName, setNewCollName] = useState('');
    const [activeCollection, setActiveCollection] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filterText, setFilterText] = useState('{}');
    const [sortText, setSortText] = useState('{"_id": -1}');
    const [showFilterBar, setShowFilterBar] = useState(false);
    const [collStats, setCollStats] = useState(null);
    const [loading, setLoading] = useState(false);

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [activeDoc, setActiveDoc] = useState(null);
    const [originalDoc, setOriginalDoc] = useState(null);
    const [editorMode, setEditorMode] = useState('fields'); // fields | json
    const [fields, setFields] = useState([]);
    const [jsonText, setJsonText] = useState('{}');
    const [isNewDoc, setIsNewDoc] = useState(false);

    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState([]);
    const [importStrategy, setImportStrategy] = useState('append');
    const [importError, setImportError] = useState(null);
    const [importFileName, setImportFileName] = useState('');

    const headers = useMemo(() => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    }), [token]);

    const notify = (type, text) => onMessage?.({ type, text });

    const loadCollectionStats = useCallback(async (coll) => {
        try {
            const res = await fetch(
                `${apiUrl}/api/admin/collections/stats?dbName=${selectedDb}&collectionName=${coll}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            if (res.ok) setCollStats(data);
        } catch {
            setCollStats(null);
        }
    }, [apiUrl, selectedDb, token]);

    const loadDocuments = useCallback(async (coll, pageNum = 1) => {
        if (!coll) return;
        setLoading(true);
        try {
            let filter = {};
            try { filter = JSON.parse(filterText || '{}'); } catch { /* use empty */ }

            const params = new URLSearchParams({
                dbName: selectedDb,
                collectionName: coll,
                page: String(pageNum),
                limit: String(PAGE_SIZE),
                sort: sortText,
                filter: JSON.stringify(filter),
            });
            if (search.trim()) params.set('search', search.trim());

            const res = await fetch(`${apiUrl}/api/admin/collections/data?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
                setDocuments(data.data || []);
                setTotal(data.total || 0);
                setPage(data.page || pageNum);
            } else {
                notify('error', data.error || 'Failed to load documents');
            }
        } catch {
            notify('error', 'Failed to load documents');
        } finally {
            setLoading(false);
        }
    }, [apiUrl, selectedDb, token, filterText, sortText, search]);

    useEffect(() => {
        setActiveCollection(null);
        setDocuments([]);
        setActiveDoc(null);
        setSelectedIds(new Set());
        setCollStats(null);
    }, [selectedDb]);

    useEffect(() => {
        if (activeCollection) {
            loadCollectionStats(activeCollection);
            loadDocuments(activeCollection, 1);
        }
    }, [activeCollection]); // eslint-disable-line react-hooks/exhaustive-deps

    const openDoc = (doc) => {
        setActiveDoc(doc);
        setOriginalDoc(JSON.parse(JSON.stringify(doc)));
        setFields(docToFields(doc));
        setJsonText(JSON.stringify(doc, null, 2));
        setIsNewDoc(false);
        setEditorMode('fields');
    };

    const openNewDoc = () => {
        const blank = {};
        setActiveDoc(blank);
        setOriginalDoc(null);
        setFields([]);
        setJsonText('{\n  \n}');
        setIsNewDoc(true);
        setEditorMode('json');
    };

    const closeEditor = () => {
        setActiveDoc(null);
        setOriginalDoc(null);
        setIsNewDoc(false);
    };

    const handleCreateCollection = async () => {
        if (!newCollName.trim()) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`${apiUrl}/api/admin/collections/create`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ dbName: selectedDb, collectionName: newCollName.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                notify('success', data.message);
                setNewCollName('');
                onRefreshCollections?.();
            } else notify('error', data.error);
        } catch {
            notify('error', 'Collection creation failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDropCollection = async (coll) => {
        if (!window.confirm(`Drop collection "${coll}" and ALL its documents?`)) return;
        setIsProcessing(true);
        try {
            const res = await fetch(
                `${apiUrl}/api/admin/collections/drop?dbName=${selectedDb}&collectionName=${coll}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            if (res.ok) {
                notify('success', data.message);
                if (activeCollection === coll) {
                    setActiveCollection(null);
                    closeEditor();
                }
                onRefreshCollections?.();
            } else notify('error', data.error);
        } catch {
            notify('error', 'Drop failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSyncRegistry = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch(`${apiUrl}/api/admin/registry/sync`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) notify('success', data.message || 'Registry synced');
            else notify('error', data.error);
        } catch {
            notify('error', 'Sync failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteDoc = async (id) => {
        if (!window.confirm('Delete this document?')) return;
        setIsProcessing(true);
        try {
            const res = await fetch(
                `${apiUrl}/api/admin/data/delete?dbName=${selectedDb}&collectionName=${activeCollection}&id=${encodeURIComponent(id)}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            if (res.ok) {
                notify('success', 'Document deleted');
                closeEditor();
                loadDocuments(activeCollection, page);
                loadCollectionStats(activeCollection);
            } else notify('error', data.error);
        } catch {
            notify('error', 'Delete failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Delete ${selectedIds.size} selected document(s)?`)) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`${apiUrl}/api/admin/data/bulk-delete`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    dbName: selectedDb,
                    collectionName: activeCollection,
                    ids: [...selectedIds],
                }),
            });
            const data = await res.json();
            if (res.ok) {
                notify('success', data.message);
                setSelectedIds(new Set());
                closeEditor();
                loadDocuments(activeCollection, page);
                loadCollectionStats(activeCollection);
            } else notify('error', data.error);
        } catch {
            notify('error', 'Bulk delete failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDuplicate = async (id) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`${apiUrl}/api/admin/data/duplicate`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ dbName: selectedDb, collectionName: activeCollection, id }),
            });
            const data = await res.json();
            if (res.ok) {
                notify('success', 'Document duplicated');
                loadDocuments(activeCollection, page);
                if (data.document) openDoc(data.document);
            } else notify('error', data.error);
        } catch {
            notify('error', 'Duplicate failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const buildDocFromFields = () => {
        const doc = {};
        for (const f of fields) {
            if (!f.key || f.key === '_id') continue;
            doc[f.key] = parseInputValue(f.value, f.type);
        }
        return doc;
    };

    const handleSave = async () => {
        if (!activeCollection) return;
        setIsProcessing(true);
        try {
            if (isNewDoc) {
                let doc;
                if (editorMode === 'json') {
                    doc = JSON.parse(jsonText);
                } else {
                    doc = buildDocFromFields();
                }
                const res = await fetch(`${apiUrl}/api/admin/data/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ dbName: selectedDb, collectionName: activeCollection, document: doc }),
                });
                const data = await res.json();
                if (res.ok) {
                    notify('success', 'Document created');
                    setIsNewDoc(false);
                    loadDocuments(activeCollection, 1);
                    loadCollectionStats(activeCollection);
                    if (data.document) openDoc(data.document);
                } else notify('error', data.error);
                return;
            }

            const id = originalDoc?._id ?? activeDoc?._id;
            if (!id) { notify('error', 'Missing document id'); return; }

            if (editorMode === 'json') {
                const doc = JSON.parse(jsonText);
                const res = await fetch(`${apiUrl}/api/admin/data/replace`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ dbName: selectedDb, collectionName: activeCollection, id, document: doc }),
                });
                const data = await res.json();
                if (res.ok) {
                    notify('success', 'Document replaced');
                    if (data.document) openDoc(data.document);
                    loadDocuments(activeCollection, page);
                } else notify('error', data.error);
                return;
            }

            const newDoc = buildDocFromFields();
            const origKeys = Object.keys(originalDoc || {}).filter((k) => k !== '_id');
            const newKeys = Object.keys(newDoc);
            const unset = origKeys.filter((k) => !newKeys.includes(k));
            const set = {};
            for (const k of newKeys) {
                if (JSON.stringify(newDoc[k]) !== JSON.stringify(originalDoc?.[k])) set[k] = newDoc[k];
            }

            const res = await fetch(`${apiUrl}/api/admin/data/patch`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ dbName: selectedDb, collectionName: activeCollection, id, set, unset }),
            });
            const data = await res.json();
            if (res.ok) {
                notify('success', 'Document saved');
                if (data.document) openDoc(data.document);
                loadDocuments(activeCollection, page);
            } else notify('error', data.error);
        } catch (err) {
            notify('error', err.message || 'Save failed — check JSON syntax');
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === documents.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(documents.map((d) => d._id)));
    };

    const addField = () => {
        setFields((prev) => [...prev, { key: '', value: '', type: 'string', isNew: true }]);
    };

    const updateField = (idx, patch) => {
        setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    };

    const removeField = (idx) => {
        setFields((prev) => prev.filter((_, i) => i !== idx));
    };

    const parseImportFile = (text, fileName) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext === 'csv') {
            const lines = text.trim().split(/\r?\n/).filter(Boolean);
            if (lines.length < 2) throw new Error('CSV needs header + rows');
            const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
            return lines.slice(1).map((line) => {
                const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
                return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
            });
        }
        if (ext === 'jsonl' || ext === 'txt') {
            return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
        }
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [parsed];
    };

    const handleImportFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportFileName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                setImportData(parseImportFile(ev.target.result, file.name));
                setImportError(null);
            } catch (err) {
                setImportError(err.message);
                setImportData([]);
            }
        };
        reader.readAsText(file);
    };

    const handleImportSubmit = async () => {
        if (!importData.length || !activeCollection) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`${apiUrl}/api/admin/collections/import`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    dbName: selectedDb,
                    collectionName: activeCollection,
                    documents: importData,
                    strategy: importStrategy,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                notify('success', data.message || `Imported ${importData.length} documents`);
                setShowImportModal(false);
                setImportData([]);
                loadDocuments(activeCollection, 1);
                loadCollectionStats(activeCollection);
            } else notify('error', data.error);
        } catch {
            notify('error', 'Import failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const previewKeys = collStats?.sampleKeys?.slice(0, 8) || [];

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-12rem)] min-h-[640px]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                {/* Collections sidebar */}
                <div className="lg:col-span-3 flex flex-col h-full bg-[#121216] border border-white/10 rounded-[2rem] p-5 shadow-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <Layers className="w-5 h-5 text-yellow-500" />
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-tight">Collections</h2>
                            <p className="text-[9px] text-gray-500 font-bold uppercase">{selectedDb}</p>
                        </div>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="New collection…"
                            value={newCollName}
                            onChange={(e) => setNewCollName(e.target.value)}
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-yellow-500/50"
                        />
                        <button
                            onClick={handleCreateCollection}
                            disabled={isProcessing || !newCollName.trim()}
                            className="bg-yellow-500 text-black px-3 py-2 rounded-xl disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                        {collections.map((coll) => (
                            <div
                                key={coll}
                                onClick={() => { setActiveCollection(coll); closeEditor(); setSelectedIds(new Set()); }}
                                className={`px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all group ${
                                    activeCollection === coll
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-black/20 hover:bg-white/5 border border-white/5 text-gray-400'
                                }`}
                            >
                                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                    <Folder className="w-4 h-4 flex-shrink-0" />
                                    <span className="text-xs font-bold truncate">{coll}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDropCollection(coll); }}
                                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleSyncRegistry}
                        disabled={isProcessing}
                        className="mt-4 w-full bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                        Sync player cache
                    </button>
                </div>

                {/* Main explorer */}
                <div className="lg:col-span-9 flex flex-col h-full gap-4 min-h-0">
                    {!activeCollection ? (
                        <div className="flex-1 bg-[#121216] border border-white/10 rounded-[2rem] flex flex-col items-center justify-center text-gray-500">
                            <Database className="w-12 h-12 text-yellow-500/40 mb-4" />
                            <h3 className="font-black uppercase tracking-widest text-gray-400">Select a collection</h3>
                            <p className="text-sm mt-2 text-center max-w-md">Browse, filter, create, edit, and delete documents — like MongoDB Compass.</p>
                        </div>
                    ) : (
                        <>
                            {/* Toolbar */}
                            <div className="bg-[#121216] border border-white/10 rounded-[1.5rem] p-4 flex flex-wrap gap-3 items-center">
                                <div className="flex items-center gap-2 min-w-0">
                                    <ListTree className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-black text-sm uppercase">{activeCollection}</h3>
                                        <p className="text-[10px] text-gray-500">{total} documents{collStats ? ` · ${collStats.indexes?.length || 0} indexes` : ''}</p>
                                    </div>
                                </div>

                                <div className="flex-1" />

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Quick search…"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && loadDocuments(activeCollection, 1)}
                                        className="bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs w-44 outline-none focus:border-yellow-500/50"
                                    />
                                </div>

                                <button
                                    onClick={() => setShowFilterBar((v) => !v)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                                        showFilterBar ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500' : 'border-white/10 text-gray-400'
                                    }`}
                                >
                                    <Filter className="w-3.5 h-3.5" /> Filter
                                </button>

                                <button onClick={() => loadDocuments(activeCollection, page)} className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white">
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>

                                <button
                                    onClick={() => setShowImportModal(true)}
                                    className="px-3 py-2 rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1.5"
                                >
                                    <Upload className="w-3.5 h-3.5 text-yellow-500" /> Import
                                </button>

                                <button
                                    onClick={openNewDoc}
                                    className="px-4 py-2 rounded-xl text-xs font-black bg-yellow-500 text-black flex items-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Insert
                                </button>

                                {selectedIds.size > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="px-3 py-2 rounded-xl text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30"
                                    >
                                        Delete ({selectedIds.size})
                                    </button>
                                )}
                            </div>

                            {showFilterBar && (
                                <div className="bg-[#121216] border border-white/10 rounded-[1.5rem] p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-gray-500 mb-1 block">MongoDB filter (JSON)</label>
                                        <textarea
                                            value={filterText}
                                            onChange={(e) => setFilterText(e.target.value)}
                                            className="w-full h-20 bg-black/50 border border-white/10 rounded-xl p-3 font-mono text-xs text-yellow-500/80 outline-none resize-none"
                                            placeholder='{"role": "Batsman"}'
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-gray-500 mb-1 block">Sort (JSON)</label>
                                        <textarea
                                            value={sortText}
                                            onChange={(e) => setSortText(e.target.value)}
                                            className="w-full h-20 bg-black/50 border border-white/10 rounded-xl p-3 font-mono text-xs text-yellow-500/80 outline-none resize-none"
                                            placeholder='{"_id": -1}'
                                        />
                                    </div>
                                    <div className="md:col-span-2 flex justify-end">
                                        <button
                                            onClick={() => loadDocuments(activeCollection, 1)}
                                            className="px-4 py-2 bg-yellow-500 text-black rounded-xl text-xs font-black"
                                        >
                                            Apply query
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0">
                                {/* Document list */}
                                <div className="bg-[#121216] border border-white/10 rounded-[1.5rem] flex flex-col min-h-0 overflow-hidden">
                                    <div className="p-3 border-b border-white/5 flex items-center gap-2 text-[10px] text-gray-500 uppercase font-black">
                                        <button onClick={toggleSelectAll} className="p-1">
                                            {selectedIds.size === documents.length && documents.length > 0
                                                ? <CheckSquare className="w-4 h-4 text-yellow-500" />
                                                : <Square className="w-4 h-4" />}
                                        </button>
                                        Documents
                                        {previewKeys.length > 0 && (
                                            <span className="ml-auto normal-case font-mono text-gray-600 truncate max-w-[50%]">
                                                keys: {previewKeys.join(', ')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {loading && documents.length === 0 ? (
                                            <div className="p-8 text-center text-gray-600 text-sm">Loading…</div>
                                        ) : documents.length === 0 ? (
                                            <div className="p-8 text-center text-gray-600 text-sm italic">No documents match this query</div>
                                        ) : (
                                            documents.map((doc) => {
                                                const id = doc._id;
                                                const isActive = activeDoc?._id === id;
                                                const label = doc.name || doc.player || doc.playerId || doc.roomId || doc.username || String(id).slice(0, 12);
                                                return (
                                                    <div
                                                        key={String(id)}
                                                        onClick={() => openDoc(doc)}
                                                        className={`px-3 py-3 border-b border-white/5 cursor-pointer flex items-start gap-2 transition-colors ${
                                                            isActive ? 'bg-yellow-500/10 border-l-2 border-l-yellow-500' : 'hover:bg-white/[0.03]'
                                                        }`}
                                                    >
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleSelect(id); }}
                                                            className="mt-0.5 flex-shrink-0"
                                                        >
                                                            {selectedIds.has(id)
                                                                ? <CheckSquare className="w-4 h-4 text-yellow-500" />
                                                                : <Square className="w-4 h-4 text-gray-600" />}
                                                        </button>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-sm font-bold truncate">{label}</div>
                                                            <div className="text-[10px] font-mono text-yellow-500/50 truncate">{String(id)}</div>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {Object.entries(doc).slice(0, 4).filter(([k]) => k !== '_id').map(([k, v]) => (
                                                                    <span key={k} className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded border border-white/5 text-gray-400">
                                                                        {k}: {formatPreview(v)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="p-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                                        <button
                                            disabled={page <= 1}
                                            onClick={() => loadDocuments(activeCollection, page - 1)}
                                            className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span>Page {page} / {totalPages} · {total} total</span>
                                        <button
                                            disabled={page >= totalPages}
                                            onClick={() => loadDocuments(activeCollection, page + 1)}
                                            className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Document editor */}
                                <div className="bg-[#121216] border border-white/10 rounded-[1.5rem] flex flex-col min-h-0 overflow-hidden">
                                    {!activeDoc ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-center">
                                            <Settings2 className="w-10 h-10 mb-3 opacity-40" />
                                            <p className="text-sm">Select a document or click <strong className="text-yellow-500">Insert</strong> to add one.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="p-3 border-b border-white/5 flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black uppercase text-gray-400">
                                                    {isNewDoc ? 'New document' : 'Edit document'}
                                                </span>
                                                <div className="flex-1" />
                                                <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                                                    <button
                                                        onClick={() => setEditorMode('fields')}
                                                        className={`px-3 py-1 rounded-md text-[10px] font-black uppercase flex items-center gap-1 ${
                                                            editorMode === 'fields' ? 'bg-yellow-500 text-black' : 'text-gray-500'
                                                        }`}
                                                    >
                                                        <ListTree className="w-3 h-3" /> Fields
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (editorMode === 'fields') setJsonText(JSON.stringify(buildDocFromFields(), null, 2));
                                                            setEditorMode('json');
                                                        }}
                                                        className={`px-3 py-1 rounded-md text-[10px] font-black uppercase flex items-center gap-1 ${
                                                            editorMode === 'json' ? 'bg-yellow-500 text-black' : 'text-gray-500'
                                                        }`}
                                                    >
                                                        <Braces className="w-3 h-3" /> JSON
                                                    </button>
                                                </div>
                                                {!isNewDoc && activeDoc._id && (
                                                    <>
                                                        <button
                                                            onClick={() => handleDuplicate(activeDoc._id)}
                                                            className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white"
                                                            title="Duplicate"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteDoc(activeDoc._id)}
                                                            className="p-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={closeEditor} className="p-2 rounded-lg hover:bg-white/5">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                                                {editorMode === 'json' ? (
                                                    <textarea
                                                        value={jsonText}
                                                        onChange={(e) => setJsonText(e.target.value)}
                                                        className="w-full h-full min-h-[280px] bg-black/50 border border-white/10 rounded-xl p-4 font-mono text-xs text-yellow-500/90 outline-none resize-none"
                                                        spellCheck={false}
                                                    />
                                                ) : (
                                                    <div className="space-y-3">
                                                        {!isNewDoc && activeDoc._id !== undefined && (
                                                            <div className="flex gap-2 items-center bg-black/30 rounded-xl p-3 border border-white/5">
                                                                <span className="text-[10px] font-black text-gray-500 uppercase w-24">_id</span>
                                                                <span className="font-mono text-xs text-yellow-500/70 flex-1 truncate">{String(activeDoc._id)}</span>
                                                            </div>
                                                        )}
                                                        {fields.map((field, idx) => (
                                                            <div key={idx} className="flex gap-2 items-start bg-black/30 rounded-xl p-3 border border-white/5 group">
                                                                <input
                                                                    value={field.key}
                                                                    onChange={(e) => updateField(idx, { key: e.target.value })}
                                                                    placeholder="field name"
                                                                    disabled={!field.isNew && field.key === '_id'}
                                                                    className="w-28 flex-shrink-0 bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-yellow-500/50 disabled:opacity-50"
                                                                />
                                                                <select
                                                                    value={field.type}
                                                                    onChange={(e) => updateField(idx, { type: e.target.value })}
                                                                    className="w-20 flex-shrink-0 bg-black/60 border border-white/10 rounded-lg px-1 py-1.5 text-[10px] outline-none"
                                                                >
                                                                    <option value="string">str</option>
                                                                    <option value="number">num</option>
                                                                    <option value="boolean">bool</option>
                                                                    <option value="null">null</option>
                                                                    <option value="json">json</option>
                                                                </select>
                                                                {field.type === 'json' ? (
                                                                    <textarea
                                                                        value={field.value}
                                                                        onChange={(e) => updateField(idx, { value: e.target.value })}
                                                                        className="flex-1 min-h-[60px] bg-black/40 border border-white/10 rounded-lg p-2 font-mono text-xs outline-none resize-y"
                                                                    />
                                                                ) : field.type === 'boolean' ? (
                                                                    <select
                                                                        value={field.value}
                                                                        onChange={(e) => updateField(idx, { value: e.target.value })}
                                                                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none"
                                                                    >
                                                                        <option value="true">true</option>
                                                                        <option value="false">false</option>
                                                                    </select>
                                                                ) : (
                                                                    <input
                                                                        value={field.value}
                                                                        onChange={(e) => updateField(idx, { value: e.target.value })}
                                                                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none"
                                                                        placeholder="value"
                                                                    />
                                                                )}
                                                                <button
                                                                    onClick={() => removeField(idx)}
                                                                    className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={addField}
                                                            className="w-full py-2.5 border border-dashed border-white/10 rounded-xl text-xs font-bold text-gray-500 hover:border-yellow-500/40 hover:text-yellow-500 flex items-center justify-center gap-2"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" /> Add field
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-3 border-t border-white/5">
                                                <button
                                                    onClick={handleSave}
                                                    disabled={isProcessing}
                                                    className="w-full py-3 bg-yellow-500 text-black rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    {isProcessing ? 'Saving…' : isNewDoc ? 'Insert document' : 'Save changes'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Import modal */}
            <AnimatePresence>
                {showImportModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowImportModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative bg-[#121216] border border-white/10 w-full max-w-2xl rounded-[2rem] shadow-3xl overflow-hidden max-h-[85vh] flex flex-col"
                        >
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-black uppercase flex items-center gap-2">
                                        <Terminal className="w-5 h-5 text-yellow-500" /> Import data
                                    </h2>
                                    <p className="text-[10px] text-gray-500 mt-1">{selectedDb}.{activeCollection}</p>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-4 overflow-y-auto flex-1">
                                <label className="block border-2 border-dashed border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-yellow-500/30">
                                    <input type="file" accept=".json,.csv,.jsonl,.txt" onChange={handleImportFile} className="hidden" />
                                    <FileSpreadsheet className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                                    <p className="text-sm font-bold">{importFileName || 'Choose JSON, CSV, or JSONL'}</p>
                                </label>
                                {importData.length > 0 && (
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setImportStrategy('append')} className={`flex-1 py-2 rounded-xl text-xs font-black ${importStrategy === 'append' ? 'bg-yellow-500 text-black' : 'bg-white/5'}`}>Append</button>
                                        <button type="button" onClick={() => setImportStrategy('overwrite')} className={`flex-1 py-2 rounded-xl text-xs font-black ${importStrategy === 'overwrite' ? 'bg-red-500 text-white' : 'bg-white/5'}`}>Overwrite collection</button>
                                    </div>
                                )}
                                {importError && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex gap-2">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" /> {importError}
                                    </div>
                                )}
                                {importData.length > 0 && (
                                    <pre className="bg-black/50 rounded-xl p-4 text-[10px] font-mono text-gray-400 max-h-40 overflow-auto">
                                        {JSON.stringify(importData.slice(0, 2), null, 2)}
                                        {importData.length > 2 && `\n… +${importData.length - 2} more`}
                                    </pre>
                                )}
                            </div>
                            <div className="p-6 border-t border-white/5 flex gap-3">
                                <button onClick={() => setShowImportModal(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-bold">Cancel</button>
                                <button
                                    onClick={handleImportSubmit}
                                    disabled={isProcessing || !importData.length}
                                    className="flex-1 py-3 rounded-xl bg-yellow-500 text-black font-black text-sm disabled:opacity-50"
                                >
                                    Import {importData.length || 0} docs
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MongoExplorer;
