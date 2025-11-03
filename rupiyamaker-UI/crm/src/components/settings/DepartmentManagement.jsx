import React, { useState, useEffect } from 'react';
import { ChevronDown, Edit2, Trash2, Plus, Users, Building } from 'lucide-react';

const DepartmentManagement = () => {
    const [departments, setDepartments] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        parent_id: null
    });

    // Sample data - replace with API calls
    useEffect(() => {
        // This should be replaced with actual API call
        const sampleDepartments = [
            { _id: '1', name: 'Sales Department', description: 'Handles all sales operations', parent_id: null, is_active: true },
            { _id: '2', name: 'HR Department', description: 'Human Resources', parent_id: null, is_active: true },
            { _id: '3', name: 'Technology Department', description: 'IT and Software Development', parent_id: null, is_active: true },
            { _id: '4', name: 'Team Achievers', description: 'Top performing sales team', parent_id: '1', is_active: true },
            { _id: '5', name: 'Team Winners', description: 'Sub-team of Achievers', parent_id: '4', is_active: true },
            { _id: '6', name: 'Recruitment', description: 'Handles hiring', parent_id: '2', is_active: true },
            { _id: '7', name: 'Core Dev Team', description: 'Primary dev team', parent_id: '3', is_active: true },
        ];
        setDepartments(sampleDepartments);
    }, []);

    const buildTree = (items) => {
        const map = new Map(items.map((item, i) => [item._id, i]));
        const tree = [];
        items.forEach(item => item.children = []);
        items.forEach(item => {
            if (item.parent_id !== null && map.has(item.parent_id)) {
                items[map.get(item.parent_id)].children.push(item);
            } else {
                tree.push(item);
            }
        });
        return tree;
    };

    const handleAddDepartment = () => {
        setEditingDept(null);
        setFormData({ name: '', description: '', parent_id: null });
        setShowModal(true);
    };

    const handleEditDepartment = (dept) => {
        setEditingDept(dept);
        setFormData({
            name: dept.name,
            description: dept.description || '',
            parent_id: dept.parent_id
        });
        setShowModal(true);
    };

    const handleDeleteDepartment = (dept) => {
        setDeleteTarget(dept);
        setShowDeleteModal(true);
    };

    const confirmDelete = () => {
        // Find all child departments recursively
        const getAllChildIds = (parentId) => {
            const children = departments.filter(d => d.parent_id === parentId);
            let allIds = [parentId];
            children.forEach(child => {
                allIds = [...allIds, ...getAllChildIds(child._id)];
            });
            return allIds;
        };

        const idsToDelete = getAllChildIds(deleteTarget._id);
        setDepartments(prev => prev.filter(d => !idsToDelete.includes(d._id)));
        setShowDeleteModal(false);
        setDeleteTarget(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (editingDept) {
            // Update existing department
            setDepartments(prev => prev.map(d => 
                d._id === editingDept._id 
                    ? { ...d, ...formData, updated_at: new Date().toISOString() }
                    : d
            ));
        } else {
            // Add new department
            const newDept = {
                _id: Date.now().toString(),
                ...formData,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            setDepartments(prev => [...prev, newDept]);
        }
        
        setShowModal(false);
        setFormData({ name: '', description: '', parent_id: null });
    };

    const toggleExpand = (e) => {
        const childrenContainer = e.target.closest('.tree-item').querySelector('.children-container');
        const toggleIcon = e.target.closest('.toggle-icon');
        
        if (childrenContainer) {
            childrenContainer.classList.toggle('collapsed');
            toggleIcon.classList.toggle('collapsed');
        }
    };

    const renderDepartmentTree = (nodes, isChild = false) => {
        return nodes.map(node => (
            <div key={node._id} className={`tree-item my-2 ${isChild ? 'child-item' : ''}`}>
                <div className="item-content grid items-center p-3 transition-colors hover:bg-gray-800 rounded-lg" 
                     style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 3fr) 1fr' }}>
                    <div className="flex items-center">
                        <span 
                            className={`toggle-icon cursor-pointer select-none inline-flex items-center justify-center w-6 h-6 text-gray-400 transition-transform hover:text-gray-200 ${
                                node.children?.length > 0 ? '' : 'invisible'
                            }`}
                            onClick={toggleExpand}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </span>
                        <span className="font-medium text-white ml-2">{node.name}</span>
                        {node.children?.length > 0 && (
                            <span className="ml-3 bg-gray-700 text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                                {node.children.length}
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-gray-400 truncate pr-4">
                        {node.description || '-'}
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                        <button
                            onClick={() => handleEditDepartment(node)}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                            <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => handleDeleteDepartment(node)}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                {node.children?.length > 0 && (
                    <div className="children-container collapsed ml-7 pl-6 border-l border-indigo-500 overflow-hidden transition-all duration-300 bg-white bg-opacity-5 rounded-lg mt-2">
                        {renderDepartmentTree(node.children, true)}
                    </div>
                )}
            </div>
        ));
    };

    const PopulateHierarchicalSelect = ({ value, onChange, editingId = null }) => {
        const renderOptions = (nodes, level = 0) => {
            return nodes.map(node => {
                if (node._id === editingId) return null;
                const prefix = '  '.repeat(level) + (level > 0 ? '↳ ' : '');
                return (
                    <React.Fragment key={node._id}>
                        <option value={node._id}>{prefix}{node.name}</option>
                        {node.children?.length > 0 && renderOptions(node.children, level + 1)}
                    </React.Fragment>
                );
            }).filter(Boolean);
        };

        return (
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">No Parent</option>
                {renderOptions(buildTree(departments))}
            </select>
        );
    };

    return (
        <div className="max-w-7xl mx-auto bg-gray-900 bg-opacity-90 backdrop-blur-lg border border-gray-700 rounded-xl shadow-2xl p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 px-2">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Building className="h-8 w-8 text-blue-500" />
                    Departments
                </h1>
                <button
                    onClick={handleAddDepartment}
                    className="bg-gradient-to-r from-blue-500 to-sky-600 text-white font-bold py-2 px-5 rounded-lg flex items-center space-x-2 transform hover:scale-105 transition-transform"
                >
                    <Plus className="h-4 w-4" />
                    <span>Add Department</span>
                </button>
            </div>

            {/* Table Header */}
            <div className="grid items-center p-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider" 
                 style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 3fr) 1fr' }}>
                <div>Department Name</div>
                <div>Description</div>
                <div className="text-center">Actions</div>
            </div>

            {/* Department List */}
            <div className="space-y-1">
                {renderDepartmentTree(buildTree(departments))}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl w-full max-w-md transform transition-transform">
                        <h2 className="text-2xl font-bold text-white mb-6">
                            {editingDept ? 'Edit Department' : 'Add Department'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Department Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Parent Department
                                </label>
                                <PopulateHierarchicalSelect
                                    value={formData.parent_id}
                                    onChange={(value) => setFormData(prev => ({ ...prev, parent_id: value }))}
                                    editingId={editingDept?._id}
                                />
                            </div>
                            <div className="flex justify-end space-x-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl w-full max-w-md text-center">
                        <h2 className="text-2xl font-bold text-white mb-4">Are you sure?</h2>
                        <p className="text-gray-400 mb-6">
                            This will permanently delete the department and all its sub-departments.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .children-container.collapsed {
                    max-height: 0;
                    margin-top: 0;
                    opacity: 0;
                    padding-top: 0;
                    padding-bottom: 0;
                }
                .toggle-icon.collapsed {
                    transform: rotate(-90deg);
                }
                .child-item {
                    position: relative;
                }
                .child-item::before {
                    content: '';
                    position: absolute;
                    top: 22px;
                    left: -25px;
                    width: 20px;
                    height: 1px;
                    background-color: #4f46e5;
                }
            `}</style>
        </div>
    );
};

export default DepartmentManagement;
