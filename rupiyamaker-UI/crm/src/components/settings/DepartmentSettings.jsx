// Utility function for hierarchical filtering (must be outside component)
function filterHierarchicalOptions(nodes, search, editingId, level = 0, parentName = '') {
    let options = [];
    for (const node of nodes) {
        if (node._id === editingId) continue;
        const prefix = '↳ '.repeat(level);
        if (!search || node.name.toLowerCase().includes(search.toLowerCase())) {
            options.push({
                _id: node._id,
                name: node.name,
                prefix,
                level,
                parent_name: parentName
            });
        }
        if (node.children && node.children.length > 0) {
            options = options.concat(filterHierarchicalOptions(node.children, search, editingId, level + 1, node.name));
        }
    }
    return options;
}
import React, { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import { Edit, Trash2, ChevronDown, Building, Plus, X } from 'lucide-react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

const DepartmentSettings = () => {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [departmentToDelete, setDepartmentToDelete] = useState(null);
    const [parentSearch, setParentSearch] = useState('');
    const [showParentDropdown, setShowParentDropdown] = useState(false);
    
    // Hierarchical navigation state (like LeadCRM status dropdown)
    const [showMainDepartments, setShowMainDepartments] = useState(true);
    const [selectedMainDepartment, setSelectedMainDepartment] = useState(null);
    
    // Tree expansion state for split-click functionality
    const [expandedParentDepartments, setExpandedParentDepartments] = useState(new Set());

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        parent_id: null
    });

    useEffect(() => {
        fetchDepartments();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showParentDropdown && !event.target.closest('.parent-dropdown-container')) {
                setShowParentDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showParentDropdown]);

    const fetchDepartments = async () => {
        setLoading(true);
        try {
            const userData = localStorage.getItem('userData');
            if (!userData) {
                setDepartments([]);
                return;
            }

            const { user_id } = JSON.parse(userData);
            const url = `${API_BASE_URL}/departments/?user_id=${user_id}`;

            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                setDepartments(Array.isArray(data) ? data : []);
            } else {
                setDepartments([]);
            }
        } catch (error) {
            message.error('Failed to fetch departments');
            setDepartments([]);
        } finally {
            setLoading(false);
        }
    };

    const buildTree = (items, parentIdField = 'parent_id') => {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }
        
        // Create a deep copy to avoid mutating original data
        const itemsCopy = items.map(item => ({ ...item, children: [] }));
        const map = new Map(itemsCopy.map((item, i) => [item._id, i]));
        const tree = [];
        
        itemsCopy.forEach(item => {
            if (item[parentIdField] !== null && item[parentIdField] !== undefined && map.has(item[parentIdField])) {
                itemsCopy[map.get(item[parentIdField])].children.push(item);
            } else {
                tree.push(item);
            }
        });
        
        return tree;
    };

    const toggleCollapse = (nodeId) => {
        const newCollapsed = new Set(collapsedNodes);
        if (newCollapsed.has(nodeId)) {
            newCollapsed.delete(nodeId);
        } else {
            newCollapsed.add(nodeId);
        }
        setCollapsedNodes(newCollapsed);
    };

    // Hierarchical navigation functions (like LeadCRM status dropdown)
    const getMainDepartments = () => {
        return departments.filter(dept => dept.parent_id === null || dept.parent_id === undefined);
    };

    const getSubDepartments = (parentId) => {
        return departments.filter(dept => dept.parent_id === parentId);
    };

    const getFilteredDepartmentOptions = () => {
        if (parentSearch) {
            // When searching, show all matching departments regardless of hierarchy
            return departments.filter(dept => 
                dept._id !== editingDepartment?._id &&
                dept.name.toLowerCase().includes(parentSearch.toLowerCase())
            );
        }

        if (showMainDepartments) {
            // Show only main departments (top-level)
            return getMainDepartments().filter(dept => dept._id !== editingDepartment?._id);
        } else if (selectedMainDepartment) {
            // Show sub-departments of selected main department
            return getSubDepartments(selectedMainDepartment._id);
        }

        return [];
    };

    const handleBackToMainDepartments = () => {
        setShowMainDepartments(true);
        setSelectedMainDepartment(null);
        setParentSearch('');
    };

    // Toggle function for parent department expansion
    const toggleParentDepartmentExpansion = (departmentId) => {
        const newExpanded = new Set(expandedParentDepartments);
        if (newExpanded.has(departmentId)) {
            newExpanded.delete(departmentId);
        } else {
            newExpanded.add(departmentId);
        }
        setExpandedParentDepartments(newExpanded);
    };

    // Tree structure functions for parent department dropdown
    const buildParentDepartmentTree = () => {
        if (parentSearch) {
            // When searching, return flat list of matching departments (excluding current editing department)
            return departments.filter(dept => {
                const isCurrentDept = editingDepartment && dept._id === editingDepartment._id;
                return !isCurrentDept && dept.name.toLowerCase().includes(parentSearch.toLowerCase());
            }).map(dept => ({ ...dept, level: 0, hasChildren: false }));
        }

        // Build tree structure recursively
        const buildParentDepartmentSubtree = (parentDept, level = 0, parentName = null) => {
            const departmentId = parentDept._id;
            const subDepartments = getSubDepartments(departmentId).filter(dept => {
                // Exclude current editing department from options
                return !editingDepartment || dept._id !== editingDepartment._id;
            });

            const deptWithMeta = {
                ...parentDept,
                level,
                hasChildren: subDepartments.length > 0,
                isExpanded: expandedParentDepartments.has(departmentId),
                parentName
            };

            const result = [deptWithMeta];

            // If this department is expanded, add its children recursively
            if (expandedParentDepartments.has(departmentId)) {
                subDepartments.forEach(subDept => {
                    const childTree = buildParentDepartmentSubtree(subDept, level + 1, parentDept.name);
                    result.push(...childTree);
                });
            }

            return result;
        };

        // Start with main departments (those without parent_id), excluding current editing department
        const tree = [];
        const mainDepartments = getMainDepartments().filter(dept => {
            return !editingDepartment || dept._id !== editingDepartment._id;
        });

        mainDepartments.forEach(mainDept => {
            const subtree = buildParentDepartmentSubtree(mainDept, 0, null);
            tree.push(...subtree);
        });

        return tree;
    };

    const renderParentDepartmentTreeItem = (dept) => {
        const departmentId = dept._id;
        const isSelected = formData.parent_id === departmentId;
        const paddingLeft = dept.level * 20 + 16; // Indent based on level

        return (
            <div
                key={departmentId}
                className={`border-b border-gray-100 transition-colors ${
                    isSelected 
                        ? 'bg-yellow-200 text-black font-medium' 
                        : 'text-gray-800 hover:bg-blue-50'
                }`}
            >
                <div 
                    className="py-3 flex items-center justify-between"
                    style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '16px' }}
                >
                    <div className="flex items-center flex-1">
                        {/* Expandable Arrow (clickable only for expansion) */}
                        {dept.hasChildren && !parentSearch ? (
                            <div
                                className="cursor-pointer p-1 hover:bg-gray-200 rounded mr-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleParentDepartmentExpansion(departmentId);
                                }}
                            >
                                <svg 
                                    className={`w-4 h-4 text-gray-500 transition-transform ${dept.isExpanded ? 'rotate-90' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        ) : (
                            /* Spacer for departments without children to maintain alignment */
                            <div className="w-6 h-6 mr-1 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                        )}
                        
                        {/* Department Name (clickable for selection) */}
                        <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => {
                                // Select the department as parent
                                setFormData({...formData, parent_id: departmentId});
                                setShowParentDropdown(false);
                                setParentSearch('');
                                setExpandedParentDepartments(new Set());
                            }}
                        >
                            <span>{dept.name}</span>
                        </div>
                    </div>
                    
                    {/* Sub-department count indicator */}
                    {dept.hasChildren && !parentSearch && (
                        <div className="text-xs text-gray-500 ml-2">
                            {getSubDepartments(departmentId).length} sub-department{getSubDepartments(departmentId).length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
                
                {/* Parent context for sub-departments */}
                {dept.level > 0 && dept.parentName && (
                    <div className="text-xs text-gray-500 mt-1" style={{ paddingLeft: `${paddingLeft}px` }}>
                        Sub-department of {dept.parentName}
                    </div>
                )}
            </div>
        );
    };

    const handleDepartmentNavigation = (department) => {
        const hasSubDepartments = getSubDepartments(department._id).length > 0;
        
        if (hasSubDepartments && showMainDepartments && !parentSearch) {
            // Navigate to sub-departments
            setShowMainDepartments(false);
            setSelectedMainDepartment(department);
        } else {
            // Select this department as parent
            setFormData({...formData, parent_id: department._id});
            setShowParentDropdown(false);
            setParentSearch('');
            setShowMainDepartments(true);
            setSelectedMainDepartment(null);
        }
    };

    const openModal = (department = null) => {
        setEditingDepartment(department);
        if (department) {
            setFormData({
                name: department.name || '',
                description: department.description || '',
                parent_id: department.parent_id || null
            });
        } else {
            setFormData({
                name: '',
                description: '',
                parent_id: null
            });
        }
        // Reset hierarchical navigation state
        setShowMainDepartments(true);
        setSelectedMainDepartment(null);
        setParentSearch('');
        setExpandedParentDepartments(new Set());
        setIsModalVisible(true);
    };

    const closeModal = () => {
        setIsModalVisible(false);
        setEditingDepartment(null);
        setFormData({ name: '', description: '', parent_id: null });
        // Reset hierarchical navigation state
        setShowMainDepartments(true);
        setSelectedMainDepartment(null);
        setParentSearch('');
        setShowParentDropdown(false);
        setExpandedParentDepartments(new Set());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            let url;
            if (editingDepartment) {
                url = `${API_BASE_URL}/departments/${editingDepartment._id}`;
            } else {
                // For POST requests, we need to include user_id parameter
                const userData = localStorage.getItem('userData');
                const { user_id } = JSON.parse(userData);
                url = `${API_BASE_URL}/departments/?user_id=${user_id}`;
            }
            
            const method = editingDepartment ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                message.success(`Department ${editingDepartment ? 'updated' : 'created'} successfully`);
                closeModal();
                fetchDepartments();
            } else {
                throw new Error('Failed to save department');
            }
        } catch (error) {
            console.error('Error saving department:', error);
            message.error('Failed to save department');
        }
    };

    const showDeleteConfirmation = (department) => {
        setDepartmentToDelete(department);
        setDeleteModalVisible(true);
    };

    const handleDelete = async () => {
        if (!departmentToDelete) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/departments/${departmentToDelete._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                message.success('Department deleted successfully');
                setDeleteModalVisible(false);
                setDepartmentToDelete(null);
                fetchDepartments();
            } else {
                throw new Error('Failed to delete department');
            }
        } catch (error) {
            console.error('Error deleting department:', error);
            message.error('Failed to delete department');
        }
    };

    const populateHierarchicalOptions = (nodes, level = 0, editingId = null) => {
        const options = [];
        nodes.forEach(node => {
            if (node._id === editingId) return;
            const prefix = '  '.repeat(level) + (level > 0 ? '↳ ' : '');
            options.push(
                <option key={node._id} value={node._id}>
                    {prefix}{node.name}
                </option>
            );
            if (node.children && node.children.length > 0) {
                options.push(...populateHierarchicalOptions(node.children, level + 1, editingId));
            }
        });
        return options;
    };

    const renderDepartmentTree = (nodes, isChild = false) => {
        if (!nodes || nodes.length === 0) {
            return <div className="text-gray-400 p-4">No departments to display</div>;
        }
        
        return nodes.map(node => (
            <div key={node._id} className={`tree-item my-2 ${isChild ? 'child-item' : ''}`}>
                <div className="item-content bg-gray-900/50 hover:bg-gray-800/70 transition-colors duration-200 rounded-lg p-4 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-6 flex items-center">
                        <span 
                            className={`toggle-icon cursor-pointer user-select-none inline-flex items-center justify-center w-6 h-6 text-gray-400 transition-transform duration-300 ${
                                node.children && node.children.length > 0 ? 'hover:text-gray-200' : 'invisible'
                            } ${collapsedNodes.has(node._id) ? 'rotate-[-90deg]' : ''}`}
                            onClick={() => node.children && node.children.length > 0 && toggleCollapse(node._id)}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </span>
                        <Building className="h-5 w-5 text-blue-400 ml-2 mr-3" />
                        <span className="font-medium text-white">{node.name}</span>
                        {node.children && node.children.length > 0 && (
                            <span className="ml-3 bg-gray-700 text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                                {node.children.length}
                            </span>
                        )}
                    </div>
                    <div className="col-span-4 text-sm text-gray-400 truncate">
                        {node.description || '-'}
                    </div>
                    <div className="col-span-2 flex items-center justify-end space-x-3">
                        <Edit 
                            className="h-5 w-5 text-gray-400 hover:text-white hover:scale-110 transition-all cursor-pointer"
                            onClick={() => openModal(node)}
                        />
                        <Trash2 
                            className="h-5 w-5 text-gray-400 hover:text-red-400 hover:scale-110 transition-all cursor-pointer"
                            onClick={() => showDeleteConfirmation(node)}
                        />
                    </div>
                </div>
                {node.children && node.children.length > 0 && (
                    <div 
                        className={`children-container ml-7 pl-6 border-l border-blue-600/50 transition-all duration-400 overflow-hidden bg-white/[0.02] rounded-lg mt-2 ${
                            collapsedNodes.has(node._id) ? 'max-h-0 opacity-0 mt-0 pt-0 pb-0' : 'max-h-[1000px] opacity-100 pt-2 pb-2'
                        }`}
                    >
                        {renderDepartmentTree(node.children, true)}
                    </div>
                )}
            </div>
        ));
    };

    // Use useMemo to prevent unnecessary rebuilding of tree data
    const treeData = useMemo(() => {
        return buildTree(departments);
    }, [departments]);

    return (
        <div className="max-w-7xl mx-auto bg-gray-900/90 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl p-6 text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6 px-2">
                <h1 className="text-3xl font-bold text-white">Departments</h1>
                <button 
                    onClick={() => openModal()}
                    className="bg-gradient-to-r from-blue-500 to-sky-600 text-white font-bold py-2 px-5 rounded-lg flex items-center space-x-2 transform hover:scale-105 transition-transform"
                >
                    <Plus className="h-5 w-5" />
                    <span>Add Department</span>
                </button>
            </div>

            {/* Column Headers */}
            <div className="item-content text-gray-400 uppercase text-xs font-semibold tracking-wide mb-4 px-4 grid grid-cols-12 gap-4">
                <div className="col-span-6">Department Name</div>
                <div className="col-span-4">Description</div>
                <div className="col-span-2 text-center">Actions</div>
            </div>

            {/* Department Tree */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : treeData.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Building className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No departments found</p>
                    <p className="text-sm">Click "Add Department" to create your first department</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {renderDepartmentTree(treeData)}
                </div>
            )}

            {/* Department Form Modal */}
            {isModalVisible && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 opacity-100 transition-opacity duration-300">
                    <div className="bg-gray-800 border border-white/10 p-8 rounded-xl w-full max-w-2xl transform scale-100 transition-transform duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">
                                {editingDepartment ? 'Edit Department' : 'Add Department'}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-white transition-colors p-1"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Department Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    placeholder="Enter department name"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Enter description"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Parent Department</label>
                                <div className="relative parent-dropdown-container">
                                    {/* Dropdown Button */}
                                    <button
                                        type="button"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center"
                                        onClick={() => setShowParentDropdown(!showParentDropdown)}
                                    >
                                        <span className="text-left">
                                            {(() => {
                                                if (formData.parent_id === null) {
                                                    return "No Parent";
                                                }
                                                const selectedParent = departments.find(dept => dept._id === formData.parent_id);
                                                return selectedParent ? selectedParent.name : "Select Parent Department";
                                            })()}
                                        </span>
                                        <svg
                                            className={`w-5 h-5 transition-transform ${showParentDropdown ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {showParentDropdown && (
                                        <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-xl mt-1 max-h-80 overflow-hidden flex flex-col">
                                            {/* Header with Search */}
                                            <div className="p-3 border-b border-gray-200 bg-white sticky top-0">
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                        </svg>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:border-blue-400"
                                                        placeholder="Search departments..."
                                                        value={parentSearch}
                                                        onChange={(e) => setParentSearch(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>

                                            {/* Options List */}
                                            <div className="overflow-y-auto max-h-60">
                                                {/* No Parent Option */}
                                                <div
                                                    className={`px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                                                        formData.parent_id === null 
                                                            ? 'bg-yellow-200 text-black font-medium' 
                                                            : 'text-gray-800 hover:bg-blue-50'
                                                    }`}
                                                    onClick={() => {
                                                        setFormData({...formData, parent_id: null});
                                                        setShowParentDropdown(false);
                                                        setParentSearch('');
                                                        setExpandedParentDepartments(new Set());
                                                    }}
                                                >
                                                    <div className="flex items-center">
                                                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                        </svg>
                                                        No Parent
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">Top level department</div>
                                                </div>

                                                {/* Department Tree */}
                                                {buildParentDepartmentTree().map(dept => renderParentDepartmentTreeItem(dept))}

                                                {/* No Results Message */}
                                                {buildParentDepartmentTree().length === 0 && (
                                                    <div className="px-4 py-6 text-center text-gray-500">
                                                        <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                        </svg>
                                                        <div className="font-medium text-gray-600">
                                                            {departments.length === 0 
                                                                ? 'No departments created yet' 
                                                                : parentSearch 
                                                                    ? `No departments found matching "${parentSearch}"` 
                                                                    : 'No departments available as parent'
                                                            }
                                                        </div>
                                                        {departments.length === 0 ? (
                                                            <div className="text-xs mt-2 text-gray-400">
                                                                Create your first department to establish hierarchy
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs mt-2 text-gray-400">
                                                                Total departments: {departments.length} | Available as parent: {buildParentDepartmentTree().length}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end space-x-4">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                                    >
                                        <X size={16} className="inline mr-2" />
                                        Cancel
                                    </button>
                                    <button
                                        type="submit" 
                                        className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalVisible && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-800 border border-white/10 p-8 rounded-xl max-w-md text-center">
                        <h2 className="text-2xl font-bold text-white mb-4">Are you sure?</h2>
                        <p className="text-gray-400 mb-6">
                            This will permanently delete the department "{departmentToDelete?.name}" and all its sub-departments.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button 
                                onClick={() => setDeleteModalVisible(false)}
                                className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDelete}
                                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentSettings;
