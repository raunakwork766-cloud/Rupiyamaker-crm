import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { Edit, Trash2, ChevronDown, ChevronRight, ChevronLeft, Award, Plus } from 'lucide-react';
import hrmsService from '../../services/hrmsService';

const DesignationSettings = () => {
    const [designations, setDesignations] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingDesignation, setEditingDesignation] = useState(null);
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [designationToDelete, setDesignationToDelete] = useState(null);

    // Hierarchical dropdown states for Department
    const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
    const [showMainDepartments, setShowMainDepartments] = useState(true);
    const [selectedMainDepartment, setSelectedMainDepartment] = useState(null);
    const [departmentSearch, setDepartmentSearch] = useState('');

    // Hierarchical dropdown states for Reports To
    const [showReportsToDropdown, setShowReportsToDropdown] = useState(false);
    const [showMainDesignations, setShowMainDesignations] = useState(true);
    const [selectedMainDesignation, setSelectedMainDesignation] = useState(null);
    const [reportsToSearch, setReportsToSearch] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        department_id: null,
        reporting_designation_id: null,
        is_active: true
    });

    useEffect(() => {
        fetchDesignations();
        fetchDepartments();
    }, []);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDepartmentDropdown && !event.target.closest('.department-dropdown-container')) {
                setShowDepartmentDropdown(false);
                setShowMainDepartments(true);
                setSelectedMainDepartment(null);
                setDepartmentSearch('');
            }
            if (showReportsToDropdown && !event.target.closest('.reports-to-dropdown-container')) {
                setShowReportsToDropdown(false);
                setShowMainDesignations(true);
                setSelectedMainDesignation(null);
                setReportsToSearch('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDepartmentDropdown, showReportsToDropdown]);

    const fetchDesignations = async () => {
        setLoading(true);
        try {
            const response = await hrmsService.getDesignations();
            
            if (response && response.data) {
                const designationData = Array.isArray(response.data) 
                    ? response.data 
                    : (response.data.designations || []);
                
                setDesignations(designationData);
            } else {
                setDesignations([]);
            }
        } catch (error) {
            message.error('Failed to fetch designations');
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const userData = localStorage.getItem('userData');
            if (!userData) {
                setDepartments([]);
                return;
            }

            const { user_id } = JSON.parse(userData);
            const url = `/api/departments/?user_id=${user_id}`;

            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                setDepartments(Array.isArray(data) ? data : []);
            } else {
                setDepartments([]);
            }
        } catch (error) {
            setDepartments([]);
        }
    };

    const buildTree = (items, parentIdField = 'reporting_designation_id') => {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }
        
        const map = new Map(items.map((item, i) => [item._id, i]));
        const tree = [];
        items.forEach(item => item.children = []);
        items.forEach(item => {
            if (item[parentIdField] !== null && item[parentIdField] !== undefined && map.has(item[parentIdField])) {
                items[map.get(item[parentIdField])].children.push(item);
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

    const openModal = (designation = null) => {
        setEditingDesignation(designation);
        if (designation) {
            setFormData({
                name: designation.name || '',
                description: designation.description || '',
                department_id: designation.department_id || null,
                reporting_designation_id: designation.reporting_designation_id || null,
                is_active: designation.is_active !== undefined ? designation.is_active : true
            });
        } else {
            setFormData({
                name: '',
                description: '',
                department_id: null,
                reporting_designation_id: null,
                is_active: true
            });
        }
        setIsModalVisible(true);
    };

    const closeModal = () => {
        setIsModalVisible(false);
        setEditingDesignation(null);
        setFormData({ name: '', description: '', department_id: null, reporting_designation_id: null, is_active: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            if (editingDesignation) {
                await hrmsService.updateDesignation(editingDesignation._id, formData);
                message.success('Designation updated successfully');
            } else {
                await hrmsService.createDesignation(formData);
                message.success('Designation created successfully');
            }
            
            closeModal();
            fetchDesignations();
        } catch (error) {
            message.error('Failed to save designation');
        }
    };

    const showDeleteConfirmation = (designation) => {
        setDesignationToDelete(designation);
        setDeleteModalVisible(true);
    };

    const handleDelete = async () => {
        if (!designationToDelete) return;
        
        try {
            await hrmsService.deleteDesignation(designationToDelete._id);
            message.success('Designation deleted successfully');
            setDeleteModalVisible(false);
            setDesignationToDelete(null);
            fetchDesignations();
        } catch (error) {
            message.error('Failed to delete designation');
        }
    };

    // Department hierarchical navigation functions
    const getMainDepartments = () => {
        return departments.filter(dept => {
            // Check various possible parent field names
            const hasParent = dept.parent_department_id || 
                             dept.parent_id || 
                             dept.parent_department || 
                             dept.parentDepartmentId ||
                             dept.parentId;
            
            const isMainDept = !hasParent || 
                              hasParent === null || 
                              hasParent === undefined || 
                              hasParent === '';
            
            return isMainDept;
        });
    };

    const getSubDepartments = (mainDepartmentId) => {
        const subDepts = departments.filter(dept => {
            // Check various possible parent field names
            const parentId = dept.parent_department_id || 
                           dept.parent_id || 
                           dept.parent_department || 
                           dept.parentDepartmentId ||
                           dept.parentId;
            
            return parentId === mainDepartmentId;
        });
        return subDepts;
    };

    const handleDepartmentNavigation = (departmentId, isSubDepartment = false) => {
        if (isSubDepartment) {
            setFormData(prev => ({ ...prev, department_id: departmentId }));
            setShowDepartmentDropdown(false);
            setShowMainDepartments(true);
            setSelectedMainDepartment(null);
            setDepartmentSearch('');
        } else {
            setSelectedMainDepartment(departmentId);
            setShowMainDepartments(false);
        }
    };

    const getSelectedDepartmentDisplay = () => {
        if (formData.department_id) {
            const dept = departments.find(d => d._id === formData.department_id);
            return dept ? dept.name : 'Select Department';
        }
        return 'Select Department';
    };

    // Reports To (Designation) hierarchical navigation functions
    const getMainDesignations = () => {
        return designations.filter(desig => !desig.reporting_designation_id);
    };

    const getSubDesignations = (mainDesignationId) => {
        return designations.filter(desig => desig.reporting_designation_id === mainDesignationId);
    };

    const handleDesignationNavigation = (designationId, isSubDesignation = false) => {
        if (isSubDesignation) {
            setFormData(prev => ({ ...prev, reporting_designation_id: designationId }));
            setShowReportsToDropdown(false);
            setShowMainDesignations(true);
            setSelectedMainDesignation(null);
            setReportsToSearch('');
        } else {
            setSelectedMainDesignation(designationId);
            setShowMainDesignations(false);
        }
    };

    const getSelectedDesignationDisplay = () => {
        if (formData.reporting_designation_id) {
            const desig = designations.find(d => d._id === formData.reporting_designation_id);
            return desig ? desig.name : 'Select Reports To';
        }
        return 'Select Reports To';
    };

    const populateHierarchicalOptions = (items, idField = '_id', nameField = 'name', level = 0, editingId = null) => {
        const options = [];
        items.forEach(item => {
            if (item[idField] === editingId) return;
            const prefix = '  '.repeat(level) + (level > 0 ? '↳ ' : '');
            options.push(
                <option key={item[idField]} value={item[idField]}>
                    {prefix}{item[nameField]}
                </option>
            );
            if (item.children && item.children.length > 0) {
                options.push(...populateHierarchicalOptions(item.children, idField, nameField, level + 1, editingId));
            }
        });
        return options;
    };

    const getDepartmentName = (departmentId) => {
        const dept = departments.find(d => d._id === departmentId);
        return dept ? dept.name : '-';
    };

    const renderDesignationTree = (nodes, isChild = false) => {
        return nodes.map(node => (
            <div key={node._id} className={`tree-item my-2 ${isChild ? 'child-item' : ''}`}>
                <div className="item-content bg-gray-900/50 hover:bg-gray-800/70 transition-colors duration-200 rounded-lg p-4 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3 flex items-center">
                        <span 
                            className={`toggle-icon cursor-pointer user-select-none inline-flex items-center justify-center w-6 h-6 text-gray-400 transition-transform duration-300 ${
                                node.children && node.children.length > 0 ? 'hover:text-gray-200' : 'invisible'
                            } ${collapsedNodes.has(node._id) ? 'rotate-[-90deg]' : ''}`}
                            onClick={() => node.children && node.children.length > 0 && toggleCollapse(node._id)}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </span>
                        <Award className="h-5 w-5 text-yellow-400 ml-2 mr-3" />
                        <span className="font-medium text-white">{node.name}</span>
                        {node.children && node.children.length > 0 && (
                            <span className="ml-3 bg-gray-700 text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                                {node.children.length}
                            </span>
                        )}
                    </div>
                    <div className="col-span-2 text-sm">
                        {node.department_id ? (
                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md text-xs">
                                {getDepartmentName(node.department_id)}
                            </span>
                        ) : (
                            <span className="text-gray-400">-</span>
                        )}
                    </div>
                    <div className="col-span-4 text-sm text-gray-400 truncate">
                        {node.description || '-'}
                    </div>
                    <div className="col-span-1 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                            node.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                            {node.is_active ? 'Active' : 'Inactive'}
                        </span>
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
                        className={`children-container ml-7 pl-6 border-l border-yellow-600/50 transition-all duration-400 overflow-hidden bg-white/[0.02] rounded-lg mt-2 ${
                            collapsedNodes.has(node._id) ? 'max-h-0 opacity-0 mt-0 pt-0 pb-0' : 'max-h-[1000px] opacity-100 pt-2 pb-2'
                        }`}
                    >
                        {renderDesignationTree(node.children, true)}
                    </div>
                )}
            </div>
        ));
    };

    const treeData = buildTree(designations);
    const departmentTree = buildTree(departments, 'parent_id');
    const designationTree = buildTree(designations);

    return (
        <div className="max-w-7xl mx-auto bg-gray-900/90 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl p-6 text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6 px-2">
                <h1 className="text-3xl font-bold text-white">Designations</h1>
                <button 
                    onClick={() => openModal()}
                    className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-bold py-2 px-5 rounded-lg flex items-center space-x-2 transform hover:scale-105 transition-transform"
                >
                    <Plus className="h-5 w-5" />
                    <span>Add Designation</span>
                </button>
            </div>

            {/* Column Headers */}
            <div className="item-content text-gray-400 uppercase text-xs font-semibold tracking-wide mb-4 px-4 grid grid-cols-12 gap-4">
                <div className="col-span-3">Designation Name</div>
                <div className="col-span-2">Department</div>
                <div className="col-span-4">Description</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-2 text-center">Actions</div>
            </div>

            {/* Designation Tree */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
                </div>
            ) : (
                <div className="space-y-2">
                    {renderDesignationTree(treeData)}
                </div>
            )}

            {/* Designation Form Modal */}
            {isModalVisible && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-white/10 p-8 rounded-xl w-full max-w-2xl">
                        <h2 className="text-2xl font-bold text-white mb-6">
                            {editingDesignation ? 'Edit Designation' : 'Add Designation'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Designation Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    placeholder="Enter designation name"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Department</label>
                                <div className="relative department-dropdown-container">
                                    <button
                                        type="button"
                                        onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 flex justify-between items-center"
                                    >
                                        <span>{getSelectedDepartmentDisplay()}</span>
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                    
                                    {showDepartmentDropdown && (
                                        <div className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                            {/* Header with search and navigation */}
                                            <div className="p-3 border-b border-gray-200 bg-white sticky top-0 z-10 rounded-t-lg">
                                                {/* Navigation header for sub-departments */}
                                                {!showMainDepartments && selectedMainDepartment && (
                                                    <div className="flex items-center justify-between mb-2">
                                                        <button
                                                            onClick={() => setShowMainDepartments(true)}
                                                            className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                        >
                                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                                            </svg>
                                                            Back to Main Departments
                                                        </button>
                                                        <span className="text-xs text-gray-600 font-medium">
                                                            {departments.find(d => d._id === selectedMainDepartment)?.name}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Search input */}
                                                <input
                                                    type="text"
                                                    placeholder="Search departments..."
                                                    value={departmentSearch}
                                                    onChange={(e) => setDepartmentSearch(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>

                                            {/* Dropdown content */}
                                            <div>
                                                {/* No Department Option */}
                                                <div 
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, department_id: null }));
                                                        setShowDepartmentDropdown(false);
                                                        setShowMainDepartments(true);
                                                        setSelectedMainDepartment(null);
                                                    }}
                                                    className="px-4 py-3 cursor-pointer text-black hover:bg-blue-200 transition-colors border-b border-gray-100 last:border-b-0 text-left"
                                                    style={{
                                                        backgroundColor: !formData.department_id ? '#FFFF00' : '',
                                                        color: '#000000',
                                                        fontWeight: !formData.department_id ? 'bold' : 'normal'
                                                    }}
                                                >
                                                    <div className="text-sm font-medium text-left select-none">
                                                        -- No Department --
                                                    </div>
                                                </div>
                                                
                                                {showMainDepartments ? (
                                                    <div>
                                                        {/* Main departments */}
                                                        {getMainDepartments()
                                                            .filter(dept => dept.name.toLowerCase().includes(departmentSearch.toLowerCase()))
                                                            .map(dept => {
                                                                const hasSubDepartments = getSubDepartments(dept._id).length > 0;
                                                                return (
                                                                <div 
                                                                    key={dept._id} 
                                                                    className="border-b border-gray-100 last:border-b-0"
                                                                >
                                                                    <div className="flex items-center">
                                                                        {/* Arrow button - only for departments with sub-departments */}
                                                                        <div className="w-8 flex justify-center flex-shrink-0">
                                                                            {hasSubDepartments ? (
                                                                                <button
                                                                                    type="button"
                                                                                    className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded transition-colors z-10"
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        console.log('Arrow clicked - navigating to sub-departments for:', dept.name);
                                                                                        handleDepartmentNavigation(dept._id);
                                                                                    }}
                                                                                    title="Show sub-departments"
                                                                                >
                                                                                    <svg 
                                                                                        className="w-3 h-3 transform transition-transform text-gray-600"
                                                                                        fill="none" 
                                                                                        stroke="currentColor" 
                                                                                        viewBox="0 0 24 24"
                                                                                    >
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                                    </svg>
                                                                                </button>
                                                                            ) : (
                                                                                <div className="w-6 h-6 flex items-center justify-center">
                                                                                    <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                                                                        <path d="M10 2v20l-5.5-5.5L10 2z"/>
                                                                                        <rect x="12" y="9" width="10" height="6" rx="1"/>
                                                                                    </svg>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Main clickable area for selecting the department */}
                                                                        <div
                                                                            className={`flex-1 px-3 py-3 cursor-pointer hover:bg-blue-200 flex flex-col transition-colors ${
                                                                                formData.department_id === dept._id ? 'text-black font-bold' : 'text-black'
                                                                            }`}
                                                                            style={{
                                                                                backgroundColor: formData.department_id === dept._id ? '#FFFF00' : '',
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                console.log('Main area clicked - selecting department:', dept.name);
                                                                                // Always select the main department when clicking the main area
                                                                                handleDepartmentNavigation(dept._id, true);
                                                                            }}
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="text-sm font-medium text-left select-none">
                                                                                    {dept.name}
                                                                                </div>
                                                                                {hasSubDepartments && (
                                                                                    <span className="text-xs text-gray-500 ml-2">
                                                                                        {getSubDepartments(dept._id).length} sub-dept{getSubDepartments(dept._id).length !== 1 ? 's' : ''}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        {/* Back to main departments */}
                                                        <div 
                                                            onClick={() => setShowMainDepartments(true)}
                                                            className="px-3 py-2 cursor-pointer border-b border-gray-200 text-blue-600 hover:bg-blue-50 flex items-center"
                                                        >
                                                            <ChevronLeft className="h-4 w-4 mr-2" />
                                                            Back to Main Departments
                                                        </div>
                                                        
                                                        {/* Sub departments */}
                                                        {selectedMainDepartment && getSubDepartments(selectedMainDepartment)
                                                            .filter(dept => dept.name.toLowerCase().includes(departmentSearch.toLowerCase()))
                                                            .map(dept => (
                                                                <div 
                                                                    key={dept._id} 
                                                                    onClick={() => handleDepartmentNavigation(dept._id, true)}
                                                                    className="px-4 py-3 cursor-pointer text-black hover:bg-blue-200 transition-colors border-b border-gray-100 last:border-b-0 text-left"
                                                                    style={{
                                                                        backgroundColor: formData.department_id === dept._id ? '#FFFF00' : '',
                                                                        color: '#000000',
                                                                        fontWeight: formData.department_id === dept._id ? 'bold' : 'normal'
                                                                    }}
                                                                >
                                                                    <div className="text-sm font-medium text-left select-none">
                                                                        {dept.name}
                                                                        <div className="text-xs text-gray-500 mt-1">
                                                                            Main Department: {departments.find(d => d._id === selectedMainDepartment)?.name}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Reports To</label>
                                <div className="relative reports-to-dropdown-container">
                                    <button
                                        type="button"
                                        onClick={() => setShowReportsToDropdown(!showReportsToDropdown)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 flex justify-between items-center"
                                    >
                                        <span>{getSelectedDesignationDisplay()}</span>
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                    
                                    {showReportsToDropdown && (
                                        <div className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                            {/* No Reports To Option */}
                                            <div 
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, reporting_designation_id: null }));
                                                    setShowReportsToDropdown(false);
                                                    setShowMainDesignations(true);
                                                    setSelectedMainDesignation(null);
                                                }}
                                                className="px-4 py-3 cursor-pointer text-black hover:bg-blue-200 transition-colors border-b border-gray-100 last:border-b-0 text-left"
                                                style={{
                                                    backgroundColor: !formData.reporting_designation_id ? '#FFFF00' : '',
                                                    color: '#000000',
                                                    fontWeight: !formData.reporting_designation_id ? 'bold' : 'normal'
                                                }}
                                            >
                                                <div className="text-sm font-medium text-left select-none">
                                                    No Reporting Designation
                                                </div>
                                            </div>
                                            
                                            {/* Search */}
                                            <div className="p-3 border-b border-gray-200">
                                                <input
                                                    type="text"
                                                    placeholder="Search designations..."
                                                    value={reportsToSearch}
                                                    onChange={(e) => setReportsToSearch(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            
                                            {showMainDesignations ? (
                                                <div>
                                                    {/* Main designations */}
                                                    {getMainDesignations()
                                                        .filter(desig => desig._id !== editingDesignation?._id) // Exclude current designation
                                                        .filter(desig => desig.name.toLowerCase().includes(reportsToSearch.toLowerCase()))
                                                        .map(desig => {
                                                            const hasSubDesignations = getSubDesignations(desig._id).length > 0;
                                                            return (
                                                                <div 
                                                                    key={desig._id} 
                                                                    onClick={() => hasSubDesignations ? handleDesignationNavigation(desig._id) : handleDesignationNavigation(desig._id, true)}
                                                                    className="px-4 py-3 cursor-pointer text-black hover:bg-blue-200 transition-colors border-b border-gray-100 last:border-b-0 text-left"
                                                                    style={{
                                                                        backgroundColor: formData.reporting_designation_id === desig._id ? '#FFFF00' : '',
                                                                        color: '#000000',
                                                                        fontWeight: formData.reporting_designation_id === desig._id ? 'bold' : 'normal'
                                                                    }}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="text-sm font-medium text-left select-none">
                                                                            {desig.name}
                                                                        </div>
                                                                        {hasSubDesignations && (
                                                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    {hasSubDesignations && (
                                                                        <div className="text-xs text-gray-500 mt-1">
                                                                            {getSubDesignations(desig._id).length} sub-designation{getSubDesignations(desig._id).length !== 1 ? 's' : ''}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            ) : (
                                                <div>
                                                    {/* Back to main designations */}
                                                    <div 
                                                        onClick={() => setShowMainDesignations(true)}
                                                        className="px-3 py-2 cursor-pointer border-b border-gray-200 text-blue-600 hover:bg-blue-50 flex items-center"
                                                    >
                                                        <ChevronLeft className="h-4 w-4 mr-2" />
                                                        Back to Main Designations
                                                    </div>
                                                    
                                                    {/* Sub designations */}
                                                    {selectedMainDesignation && getSubDesignations(selectedMainDesignation)
                                                        .filter(desig => desig._id !== editingDesignation?._id) // Exclude current designation
                                                        .filter(desig => desig.name.toLowerCase().includes(reportsToSearch.toLowerCase()))
                                                        .map(desig => (
                                                            <div 
                                                                key={desig._id} 
                                                                onClick={() => handleDesignationNavigation(desig._id, true)}
                                                                className="px-4 py-3 cursor-pointer text-black hover:bg-blue-200 transition-colors border-b border-gray-100 last:border-b-0 text-left"
                                                                style={{
                                                                    backgroundColor: formData.reporting_designation_id === desig._id ? '#FFFF00' : '',
                                                                    color: '#000000',
                                                                    fontWeight: formData.reporting_designation_id === desig._id ? 'bold' : 'normal'
                                                                }}
                                                            >
                                                                <div className="text-sm font-medium text-left select-none">
                                                                    {desig.name}
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        Main Designation: {designations.find(d => d._id === selectedMainDesignation)?.name}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                                <textarea 
                                    rows={3}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Enter description"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                                <select 
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    value={formData.is_active}
                                    onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})}
                                >
                                    <option value={true}>Active</option>
                                    <option value={false}>Inactive</option>
                                </select>
                            </div>
                            <div className="flex justify-end space-x-4">
                                <button 
                                    type="button" 
                                    onClick={closeModal}
                                    className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-5 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white font-semibold transition-colors"
                                >
                                    {editingDesignation ? 'Update' : 'Create'}
                                </button>
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
                            This will permanently delete the designation "{designationToDelete?.name}".
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

export default DesignationSettings;
