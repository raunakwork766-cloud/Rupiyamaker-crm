import sys

file_path = '/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/Dialer.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if line.startswith('function AgentMappingModal({ show, onClose, agentMappings, uploadedAgents, onSave }) {'):
        start_idx = i
    if line.startswith('// ── Rules Modal'):
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_modal = """function AgentMappingModal({ show, onClose, agentMappings, uploadedAgents, onSave }) {
    const [view, setView] = useState('agents');
    const [agents, setAgents] = useState([]);
    const [unmappedExts, setUnmappedExts] = useState([]);
    const [saving, setSaving] = useState(false);
    
    // Form state
    const [newName, setNewName] = useState('');
    const [newDesig, setNewDesig] = useState('');
    const [newTeam, setNewTeam] = useState('');
    const [search, setSearch] = useState('');
    const [openDropId, setOpenDropId] = useState(null);

    useEffect(() => {
        if (!show) return;
        const allExtsMap = {};
        
        if (uploadedAgents) {
            uploadedAgents.forEach(a => {
                if (!allExtsMap[a.ext]) allExtsMap[a.ext] = { ext: a.ext, dialer_name: a.name, mapped_name: '', designation: '', team: '' };
            });
        }
        
        Object.entries(agentMappings).forEach(([ext, m]) => {
            if (allExtsMap[ext]) {
                allExtsMap[ext].mapped_name = m.mapped_name || '';
                allExtsMap[ext].designation = m.designation || '';
                allExtsMap[ext].team = m.team || '';
            } else {
                allExtsMap[ext] = { ext, dialer_name: m.dialer_name || '', mapped_name: m.mapped_name || '', designation: m.designation || '', team: m.team || '' };
            }
        });

        const grouped = {};
        const unmappedList = [];
        
        Object.values(allExtsMap).forEach(item => {
            if (item.mapped_name && item.mapped_name.trim()) {
                const key = item.mapped_name.trim();
                // Avoid using ID as the name directly since users could theoretically create dupe names, 
                // but let's use name as ID for simplicity since it groups them.
                if (!grouped[key]) {
                    grouped[key] = {
                        id: key,
                        mapped_name: key,
                        designation: item.designation || '',
                        team: item.team || '',
                        exts: []
                    };
                }
                grouped[key].exts.push({ ext: item.ext, dialer_name: item.dialer_name });
            } else {
                unmappedList.push({ ext: item.ext, dialer_name: item.dialer_name });
            }
        });

        setAgents(Object.values(grouped).sort((a,b)=> a.mapped_name.localeCompare(b.mapped_name)));
        setUnmappedExts(unmappedList.sort((a,b)=> a.ext.localeCompare(b.ext)));
        setSearch('');
        setOpenDropId(null);
    }, [show, agentMappings, uploadedAgents]);

    const handleCreateAgent = () => {
        if (!newName.trim()) return;
        const name = newName.trim();
        if (agents.find(a => a.mapped_name.toLowerCase() === name.toLowerCase())) {
            alert('A profile with this name already exists.');
            return;
        }
        setAgents([{ id: name, mapped_name: name, designation: newDesig.trim(), team: newTeam.trim(), exts: [] }, ...agents]);
        setNewName(''); setNewDesig(''); setNewTeam('');
    };

    const handleAssignExt = (agentId, extObj) => {
        setUnmappedExts(prev => prev.filter(e => e.ext !== extObj.ext));
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, exts: [...a.exts, extObj] } : a));
    };

    const handleUnassignExt = (agentId, extObj) => {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, exts: a.exts.filter(e => e.ext !== extObj.ext) } : a));
        setUnmappedExts(prev => [...prev, extObj].sort((a,b)=> a.ext.localeCompare(b.ext)));
    };
    
    const handleDeleteAgent = (agentId) => {
        if (!window.confirm("Are you sure you want to delete this profile? All mapped extensions will be thrown back to 'Unmapped'.")) return;
        const agent = agents.find(a => a.id === agentId);
        if (agent && agent.exts.length) {
            setUnmappedExts(prev => [...prev, ...agent.exts].sort((a,b)=> a.ext.localeCompare(b.ext)));
        }
        setAgents(prev => prev.filter(a => a.id !== agentId));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const uid = getCurrentUser()?._id || getCurrentUser()?.id || '';
            const bulkMappings = [];
            agents.forEach(ag => {
                ag.exts.forEach(e => {
                    bulkMappings.push({
                        ext: e.ext,
                        dialer_name: e.dialer_name,
                        mapped_name: ag.mapped_name,
                        designation: ag.designation,
                        team: ag.team
                    });
                });
            });

            await fetchWithAuth('/api/dialer/agent-mapping/bulk', {
                method: 'POST',
                body: JSON.stringify({ mappings: bulkMappings, user_id: uid }),
            });

            const originallyMapped = Object.keys(agentMappings);
            const nowUnmapped = unmappedExts.map(e => e.ext).filter(e => originallyMapped.includes(e));
            for (const x of nowUnmapped) {
                await fetchWithAuth(`/api/dialer/agent-mapping/${x}`, { method: 'DELETE' });
            }

            if (onSave) await onSave();
            onClose();
        } catch (e) { console.error('Save error', e); }
        setSaving(false);
    };

    if (!show) return null;

    const searchLow = search.toLowerCase();
    const filteredUnmapped = unmappedExts.filter(e => e.ext.includes(searchLow) || (e.dialer_name || '').toLowerCase().includes(searchLow));
    const filteredAgents = view === 'agents' && search ? agents.filter(a => a.mapped_name.toLowerCase().includes(searchLow) || a.exts.some(e => e.ext.includes(searchLow))) : agents;

    return (
        <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-10 font-sans transition-all" onClick={e => { if(e.target === e.currentTarget) onClose(); }}>
            <div className="bg-[#0f0f12] border border-[#2a2a30] rounded-2xl w-full max-w-[1100px] h-[88vh] flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden">
                
                {/* Header */}
                <div className="px-7 py-5 bg-gradient-to-r from-[#16161b] to-[#0f0f12] border-b border-[#2a2a30] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-[22px] shadow-inner font-black text-purple-400">
                            ID
                        </div>
                        <div>
                            <h2 className="text-[17px] font-black text-white tracking-wide uppercase">Agent Profiles Setup</h2>
                            <p className="text-[12px] text-[#888] font-semibold mt-0.5">Simply create an agent profile and attach unmapped extensions below.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-center">
                        <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-lg bg-[#18181b] border border-[#333] hover:bg-[#222] text-[#ccc] font-bold text-[12px] transition-colors">Discard</button>
                        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[12px] shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2">
                            {saving ? '⏳ Saving...' : '💾 Save Configurations'}
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    
                    {/* LEFT PANEL: Profiles */}
                    <div className="flex-[3] flex flex-col border-r border-[#2a2a30] bg-[#0c0c0e]">
                        <div className="p-5 border-b border-[#1f1f24] bg-[#101014] flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
                            <div className="text-[14px] font-black text-white px-2 uppercase tracking-wide flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Mapped Profiles ({agents.length})</div>
                            <div className="relative w-full md:w-64">
                                <input type="text" placeholder="Search profiles..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-[#18181c] border border-[#333] rounded-lg pl-4 pr-4 py-2 text-[12px] text-white font-medium focus:outline-none focus:border-purple-500 placeholder:text-[#666]" />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                            
                            {/* Create Agent Box */}
                            <div className="bg-[#16161b] border border-[#2a2a30] rounded-xl p-5 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                <h3 className="text-white text-[12px] uppercase tracking-widest font-black mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">+</span> Create New Profile
                                </h3>
                                <div className="flex flex-wrap gap-3 items-center">
                                    <input type="text" placeholder="Agent Name (e.g. John Doe)" value={newName} onChange={e=>setNewName(e.target.value)} className="flex-1 min-w-[180px] bg-[#0c0c0e] border border-[#333] rounded-lg px-4 py-2.5 text-[13px] text-white font-bold focus:border-blue-500 outline-none placeholder:text-[#555]" />
                                    <input type="text" placeholder="Designation" value={newDesig} onChange={e=>setNewDesig(e.target.value)} className="w-[140px] bg-[#0c0c0e] border border-[#333] rounded-lg px-4 py-2.5 text-[13px] text-white font-bold focus:border-blue-500 outline-none placeholder:text-[#555]" />
                                    <input type="text" placeholder="Team" value={newTeam} onChange={e=>setNewTeam(e.target.value)} className="w-[140px] bg-[#0c0c0e] border border-[#333] rounded-lg px-4 py-2.5 text-[13px] text-white font-bold focus:border-blue-500 outline-none placeholder:text-[#555]" />
                                    <button onClick={handleCreateAgent} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[13px] font-black transition-colors shadow-lg">CREATE</button>
                                </div>
                            </div>

                            {/* Profiles List */}
                            <div className="space-y-3">
                                {filteredAgents.length === 0 && <div className="text-center py-10 text-[#555] font-semibold text-[13px]">No profiles created yet.</div>}
                                {filteredAgents.map(ag => (
                                    <div key={ag.id} className="bg-[#121215] border border-[#2a2a30] rounded-xl p-4 flex flex-col md:flex-row gap-5 items-start md:items-center hover:border-[#444] transition-all relative">
                                        <div className="w-[200px] shrink-0 border-r border-[#222] pr-4">
                                            <h4 className="text-purple-400 text-[15px] font-black tracking-wide truncate">{ag.mapped_name}</h4>
                                            <div className="text-[11px] text-[#777] font-bold mt-1 uppercase tracking-wider flex flex-col gap-0.5">
                                                <span>{ag.designation || 'No Desig'}</span>
                                                <span className="text-[#555]">{ag.team || 'No Team'}</span>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-wrap gap-2 items-center min-h-[44px] bg-[#0c0c0e] border border-[#1f1f24] rounded-lg p-2">
                                            {ag.exts.length === 0 && <span className="text-[#555] text-[12px] font-medium italic px-2">No mappings...</span>}
                                            {ag.exts.map(e => (
                                                <div key={e.ext} className="bg-[#1a1225] border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-md flex items-center gap-2 text-[12px] font-black shadow-sm group/badge hover:bg-[#251835] transition-all">
                                                    <span>{e.ext} <span className="text-purple-400/40 font-semibold text-[11px] ml-1">({e.dialer_name || 'N/A'})</span></span>
                                                    <button onClick={() => handleUnassignExt(ag.id, e)} className="text-purple-300/40 hover:text-red-400 transition-colors ml-1 scale-110">✕</button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="relative">
                                                <button onClick={() => setOpenDropId(openDropId === ag.id ? null : ag.id)} className="px-4 py-2 bg-[#1b1b22] border border-[#333] hover:border-purple-500 hover:text-purple-400 text-[#ccc] rounded-lg text-[12px] font-black transition-all flex items-center gap-2 shadow-sm">
                                                    <span>+ Map Ext</span><span className="text-[8px]">▼</span>
                                                </button>
                                                {openDropId === ag.id && (
                                                    <div className="absolute right-0 top-full mt-2 w-[260px] bg-[#1a1a1f] border border-[#444] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[2000] overflow-hidden flex flex-col">
                                                        <div className="px-3 py-2 bg-[#111] border-b border-[#333] text-[10px] uppercase font-black text-purple-400 tracking-widest">Available Unmapped</div>
                                                        <div className="max-h-[250px] overflow-y-auto custom-scrollbar p-1.5">
                                                            {unmappedExts.length === 0 ? (
                                                                <div className="p-4 text-center text-[#666] text-[11px] font-semibold">No extensions left</div>
                                                            ) : (
                                                                unmappedExts.map(ue => (
                                                                    <button key={ue.ext} onClick={() => { handleAssignExt(ag.id, ue); setOpenDropId(null); }} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-purple-500/15 hover:text-white text-[#aaa] text-[12px] font-bold transition-all flex justify-between items-center group/btn">
                                                                        <span><span className="text-white group-hover/btn:text-purple-300">{ue.ext}</span></span>
                                                                        <span className="text-[#666] group-hover/btn:text-[#999] truncate max-w-[120px] text-[11px]">{ue.dialer_name}</span>
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <button onClick={() => handleDeleteAgent(ag.id)} className="w-[34px] h-[34px] flex items-center justify-center rounded-lg border border-[#333] bg-[#18181c] text-[#666] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all shadow-sm" title="Delete Profile">
                                                <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: Unmapped Extensions */}
                    <div className="flex-[1.2] flex flex-col bg-[#111114]">
                        <div className="p-5 border-b border-[#222] bg-[#16161a] flex justify-between items-center shrink-0">
                            <div className="text-[13px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Unmapped ({filteredUnmapped.length})</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {filteredUnmapped.length === 0 && <div className="col-span-full py-10 text-center text-[#555] font-semibold text-[13px]">Clean! All mapped.</div>}
                                {filteredUnmapped.map(ue => (
                                    <div key={ue.ext} className="bg-[#18181c] border border-[#2a2a30] rounded-lg p-3 flex flex-col gap-1 hover:border-[#444] transition-colors relative group">
                                        <span className="text-red-400 font-black text-[14px] leading-none">{ue.ext}</span>
                                        <span className="text-[#777] text-[11px] font-bold truncate leading-none mt-1">{ue.dialer_name || 'N/A'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
"""
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines[:start_idx])
        f.write(new_modal + "\n\n")
        f.writelines(lines[end_idx:])
    
    print(f"Replaced {start_idx} to {end_idx-1} in {file_path}")
else:
    print(f"Error: Could not find start or end index. start={start_idx}, end={end_idx}")

