import re

with open('/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/Dialer.jsx', 'r') as f:
    text = f.read()

# Find the start of AgentMappingModal
start_str = "function AgentMappingModal({ show, onClose, agentMappings, uploadedAgents, onSave }) {"
start_idx = text.find(start_str)

# Find the end by looking for the rules modal
end_str = "// ── Rules Modal ───────────────────────────────────────────────────────────────"
end_idx = text.find(end_str)

if start_idx == -1 or end_idx == -1:
    print("Could not find start or end")
    exit(1)

new_modal_code = """function AgentMappingModal({ show, onClose, agentMappings, uploadedAgents, onSave }) {
    const [agents, setAgents] = useState([]);
    const [unmappedExts, setUnmappedExts] = useState([]);
    const [saving, setSaving] = useState(false);
    
    const [newName, setNewName] = useState('');
    const [newDesig, setNewDesig] = useState('');
    const [newTeam, setNewTeam] = useState('');
    const [search, setSearch] = useState('');
    
    // For mapping dropdown
    const [openDropId, setOpenDropId] = useState(null);
    const [dropSearch, setDropSearch] = useState('');

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
                if (!grouped[key]) {
                    grouped[key] = { id: key, mapped_name: key, designation: item.designation || '', team: item.team || '', exts: [] };
                }
                grouped[key].exts.push({ ext: item.ext, dialer_name: item.dialer_name });
            } else {
                unmappedList.push({ ext: item.ext, dialer_name: item.dialer_name });
            }
        });

        setAgents(Object.values(grouped).sort((a,b)=> a.mapped_name.localeCompare(b.mapped_name)));
        setUnmappedExts(unmappedList.sort((a,b)=> a.ext.localeCompare(b.ext)));
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
        if (!window.confirm("Are you sure you want to delete this profile? All mapped extensions will become unmapped.")) return;
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
                    bulkMappings.push({ ext: e.ext, dialer_name: e.dialer_name, mapped_name: ag.mapped_name, designation: ag.designation, team: ag.team });
                });
            });

            await fetchWithAuth('/api/dialer/agent-mapping/bulk', { method: 'POST', body: JSON.stringify({ mappings: bulkMappings, user_id: uid }) });

            const originallyMapped = Object.keys(agentMappings);
            const nowUnmapped = unmappedExts.map(e => e.ext).filter(e => originallyMapped.includes(e));
            for (const x of nowUnmapped) {
                await fetchWithAuth(`/api/dialer/agent-mapping/${x}`, { method: 'DELETE' });
            }

            if (onSave) await onSave();
            onClose();
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    if (!show) return null;

    const filteredUnmapped = unmappedExts.filter(e => e.ext.includes(search.toLowerCase()) || (e.dialer_name || '').toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[9999] bg-[#000000e6] backdrop-blur-xl flex items-center justify-center p-4 lg:p-10 font-sans opacity-100 transition-opacity duration-300">
            <div className="bg-[#0b0c10] border border-[#1f212a] rounded-[24px] w-full max-w-[1240px] h-[85vh] flex flex-col shadow-[0_30px_100px_rgba(0,0,0,1)] overflow-hidden relative">
                
                {/* Header Section */}
                <div className="px-8 py-5 border-b border-[#1f212a] bg-[#0b0c10] flex justify-between items-center z-10 shrink-0 sticky top-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 tracking-tight">Agent Configuration</h2>
                            <p className="text-[13px] text-[#8e8ea0] font-medium mt-0.5">Streamlined extension mapping & profile management.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-center">
                        <button onClick={onClose} disabled={saving} className="px-6 py-2.5 rounded-xl bg-transparent border border-[#2a2c35] hover:bg-[#1a1c23] hover:text-white text-[#8e8ea0] font-bold text-[13px] transition-all">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-[13px] shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all flex items-center gap-2">
                            {saving ? 'Saving Changes...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#0a0a0c]">
                    
                    {/* LEFT PANEL: Agents Manager */}
                    <div className="flex-[2.5] flex flex-col border-r border-[#1f212a] relative overflow-hidden">
                        
                        {/* Create Agent Banner */}
                        <div className="p-6 border-b border-[#1f212a] bg-[#0d0e12] shrink-0">
                            <h3 className="text-[12px] uppercase text-[#8e8ea0] font-black tracking-widest mb-3 pl-1">Create Profile</h3>
                            <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-center">
                                <input type="text" placeholder="Agent Name (e.g. John Doe)" value={newName} onChange={e=>setNewName(e.target.value)} className="flex-1 min-w-[200px] h-11 bg-[#15161d] border border-[#2a2c35] rounded-xl px-4 text-[14px] text-white font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none placeholder:text-[#5c5f6e] transition-all shadow-inner" />
                                <input type="text" placeholder="Designation" value={newDesig} onChange={e=>setNewDesig(e.target.value)} className="w-full sm:w-[150px] h-11 bg-[#15161d] border border-[#2a2c35] rounded-xl px-4 text-[14px] text-white font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none placeholder:text-[#5c5f6e] transition-all shadow-inner" />
                                <input type="text" placeholder="Team" value={newTeam} onChange={e=>setNewTeam(e.target.value)} className="w-full sm:w-[150px] h-11 bg-[#15161d] border border-[#2a2c35] rounded-xl px-4 text-[14px] text-white font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none placeholder:text-[#5c5f6e] transition-all shadow-inner" />
                                <button onClick={handleCreateAgent} className="h-11 px-6 bg-[#2a2c35] hover:bg-white text-white hover:text-black rounded-xl text-[14px] font-bold transition-all shadow-sm flex items-center justify-center gap-2 group whitespace-nowrap">
                                    <span className="text-[18px] group-hover:rotate-90 transition-transform">＋</span> Add
                                </button>
                            </div>
                        </div>

                        {/* Agents List Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#111218] via-[#0a0a0c] to-[#0a0a0c]">
                            {agents.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-40 select-none pointer-events-none mt-10">
                                    <svg className="w-20 h-20 text-[#8e8ea0] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    <p className="text-[15px] text-white font-bold">No Agents Yet</p>
                                    <p className="text-[13px] text-[#8e8ea0]">Create your first agent profile above.</p>
                                </div>
                            )}

                            {agents.map(ag => (
                                <div key={ag.id} className="group relative bg-[#13141b] border border-[#1f212a] hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col lg:flex-row gap-5 items-start lg:items-center transition-all shadow-sm hover:shadow-[0_4px_20px_-5px_rgba(99,102,241,0.15)]">
                                    
                                    {/* Delete Btn */}
                                    <button onClick={() => handleDeleteAgent(ag.id)} className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-[#1a1c23] hover:bg-red-500/20 text-[#5c5f6e] hover:text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-500/30">
                                        <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>

                                    {/* Info Info */}
                                    <div className="w-[200px] shrink-0 border-r border-[#1f212a] pr-4">
                                        <h4 className="text-white text-[16px] font-extrabold tracking-wide truncate">{ag.mapped_name}</h4>
                                        <div className="flex gap-2 items-center mt-1.5">
                                            <span className="bg-[#1f212a] text-[#a1a1aa] px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">{ag.designation || 'N/A'}</span>
                                            <span className="bg-[#1f212a] text-[#a1a1aa] px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">{ag.team || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Mapped Extensions Pills */}
                                    <div className="flex-1 flex flex-wrap gap-2 items-center min-h-[38px]">
                                        {ag.exts.length === 0 && <span className="text-[#5c5f6e] text-[13px] font-medium px-1 select-none">No extensions mapped</span>}
                                        {ag.exts.map(e => (
                                            <div key={e.ext} className="group/pill inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg hover:bg-indigo-500/20 transition-all cursor-default">
                                                <span className="text-indigo-300 font-bold text-[13px] leading-none shrink-0">{e.ext}</span>
                                                <span className="text-indigo-400/50 text-[11px] font-semibold leading-none truncate max-w-[80px]">{e.dialer_name}</span>
                                                <button onClick={() => handleUnassignExt(ag.id, e)} className="ml-1 w-4 h-4 rounded-full flex items-center justify-center bg-indigo-500/20 text-indigo-300 hover:bg-red-500 hover:text-white transition-all text-[10px]">✕</button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action Toggle Mappings */}
                                    <div className="shrink-0 relative">
                                        <button 
                                            onClick={() => { setOpenDropId(openDropId === ag.id ? null : ag.id); setDropSearch(''); }} 
                                            className={`h-10 px-4 rounded-xl font-bold text-[13px] transition-all flex items-center gap-2 border ${openDropId === ag.id ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' : 'bg-[#1a1c23] hover:bg-[#20222a] text-[#a1a1aa] border-[#2a2c35]'}`}
                                        >
                                            <span>＋ Links</span>
                                            <svg className={`w-4 h-4 transition-transform ${openDropId === ag.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        
                                        {/* Dropdown Popover */}
                                        {openDropId === ag.id && (
                                            <>
                                                <div className="fixed inset-0 z-[99]" onClick={(e) => {e.stopPropagation(); setOpenDropId(null);}}></div>
                                                <div className="absolute right-0 top-full mt-2 w-[320px] bg-[#1a1c23] border border-[#2a2c35] rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] z-[100] overflow-hidden flex flex-col animate-[modalIn_.15s_ease-out]">
                                                    <div className="p-3 border-b border-[#2a2c35]">
                                                        <input 
                                                            autoFocus type="text" placeholder="Search unmapped..." 
                                                            value={dropSearch} onChange={e=>setDropSearch(e.target.value)} 
                                                            className="w-full bg-[#111218] border border-[#2a2c35] rounded-xl px-3 py-2 text-[12px] text-white focus:outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                    <div className="max-h-[260px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                                        {(() => {
                                                            const filteredDrop = unmappedExts.filter(ue => ue.ext.includes(dropSearch.toLowerCase()) || (ue.dialer_name||'').toLowerCase().includes(dropSearch.toLowerCase()));
                                                            if (filteredDrop.length === 0) return <div className="p-4 text-center text-[#5c5f6e] text-[12px] font-semibold">No extensions to map</div>;
                                                            return filteredDrop.map(ue => (
                                                                <button key={ue.ext} onClick={() => handleAssignExt(ag.id, ue)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-indigo-500/10 hover:border-indigo-500/30 border border-transparent text-left transition-all">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-white text-[13px] font-bold">{ue.ext}</span>
                                                                        <span className="text-[#8e8ea0] text-[11px] truncate max-w-[180px]">{ue.dialer_name || 'No Name'}</span>
                                                                    </div>
                                                                    <span className="text-indigo-400 text-[18px] font-black group-hover:scale-110 transition-transform">＋</span>
                                                                </button>
                                                            ));
                                                        })()}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Reference Unmapped List */}
                    <div className="flex-[1] flex flex-col bg-[#0a0b0e]">
                        <div className="p-6 border-b border-[#1f212a] flex flex-col gap-4 shrink-0 bg-[#0d0e12]">
                            <div className="flex justify-between items-center">
                                <h3 className="text-[12px] uppercase text-[#8e8ea0] font-black tracking-widest flex items-center gap-2">
                                    <span className="relative flex h-2.5 w-2.5">
                                      {unmappedExts.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </span>
                                    Unmapped ({unmappedExts.length})
                                </h3>
                            </div>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c5f6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input type="text" placeholder="Filter list..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full min-h-[44px] bg-[#15161d] border border-[#2a2c35] rounded-xl pl-9 pr-4 text-[13px] text-white font-medium focus:border-indigo-500 outline-none placeholder:text-[#5c5f6e] transition-colors" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <div className="flex flex-col gap-2">
                                {unmappedExts.length === 0 && (
                                    <div className="p-8 text-center text-[#5c5f6e] font-semibold text-[13px] border border-dashed border-[#1f212a] rounded-2xl mx-2">
                                        🎉 Awesome! <br/>Every single extension is mapped.
                                    </div>
                                )}
                                {filteredUnmapped.map(ue => (
                                    <div key={ue.ext} className="bg-[#111218] border border-[#1f212a] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[#2a2c35] transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-[#d4d4d8] font-bold text-[14px]">{ue.ext}</span>
                                            <span className="text-[#71717a] text-[11px] font-medium truncate max-w-[140px] mt-0.5">{ue.dialer_name || 'N/A'}</span>
                                        </div>
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

// ── Rules Modal
"""

new_text = text[:start_idx] + new_modal_code + text[end_idx + len(end_str):]

with open('/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/Dialer.jsx', 'w') as f:
    f.write(new_text)

print("Updated Dialer.jsx modal successfully.")
