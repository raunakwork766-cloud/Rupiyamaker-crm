import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { Edit, Trash2, ChevronDown, Users, Plus, Shield, Download } from 'lucide-react';
import { updateRoleWithImmediateRefresh, setupPermissionRefreshListeners } from '../../utils/immediatePermissionRefresh.js';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

const RoleSettings = () => {
    const [roles, setRoles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState(null);
    
    // Initialize all permission modules as collapsed by default
    const [collapsedPermissions, setCollapsedPermissions] = useState(new Set([
        'SuperAdmin', 'feeds', 'leads', 'login', 'tasks', 'ickets', 'hrms', 
        'leaves', 'attendance', 'warnings', 'users', 'charts', 'apps', 
        'settings', 'interview', 'reports'
    ]));

    // Hierarchical dropdown states for Department
    const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
    const [showMainDepartments, setShowMainDepartments] = useState(true);
    const [selectedMainDepartment, setSelectedMainDepartment] = useState(null);
    const [departmentSearch, setDepartmentSearch] = useState('');
    const [expandedDepartments, setExpandedDepartments] = useState(new Set());

    // Hierarchical dropdown states for Reporting Role
    const [showReportingDropdown, setShowReportingDropdown] = useState(false);
    const [showMainRoles, setShowMainRoles] = useState(true);
    const [selectedMainRole, setSelectedMainRole] = useState(null);
    const [reportingSearch, setReportingSearch] = useState('');
    const [expandedReportingRoles, setExpandedReportingRoles] = useState(new Set());
    const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
    const [dropdownSearchTerms, setDropdownSearchTerms] = useState({});

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        department_id: null,
        reporting_id: null,
        permissions: []
    });

    // Simplified permission structure with SuperAdmin, Interview Panel, and Reports
    const allPermissions = {
        'SuperAdmin': ['*'],
        'feeds': ['show','post', 'all', 'delete'],
        
        // Leads CRM - Section-wise permissions matching sidebar structure (2 sections only)
        'Leads CRM': {
            'Create LEAD': ['show', 'add', 'reassignment_popup'],
            'PL & ODD LEADS': ['show', 'own', 'junior', 'all', 'assign', 'download_obligation', 'status_update', 'delete'],
        },
        
        'login': ['show', 'own', 'junior', 'all', 'channel', 'edit', 'delete'],
        'tasks': ['show', 'own', 'junior', 'all', 'delete'],
        'tickets': ['show', 'own', 'junior', 'all', 'delete'],
        'warnings': ['show', 'own', 'junior', 'all', 'delete'],
        'interview': ['show', 'junior', 'all', 'settings', 'delete'],
        'hrms': ['show', ],
        'employees': ['show', 'password', 'junior', 'all', 'role', 'delete'],
        'leaves': ['show', 'own', 'junior', 'all', 'delete'],
        'attendance': ['show', 'own', 'junior', 'all', 'delete'],
        'apps': ['show', 'manage'],
        "notification":['show', 'delete', 'send'],
        'reports': ['show'],
        'settings': ['show'],
    };

    // Permission descriptions for UI
    const permissionDescriptions = {
        '*': '⭐ Super Admin - Complete system access with all permissions',
        'show': '👁️ Show - Can see the module in navigation menu',
        'own': '👤 Own Only - Can only manage their own records',
        'junior': '🔸 Manager Level - Can manage subordinate records + own',
        'all': '🔑 Admin Level - Can manage all records',
        'settings': '⚙️ Settings - Can manage module settings and configurations',
        'delete': '🗑️ Delete - Can delete records in this module',
        'add': '➕ Add - Can create new records',
        'edit': '✏️ Edit - Can modify existing records',
        'assign': '👥 Assign - Can assign records to other users',
        'reassignment_popup': '🔄 Reassignment Popup - Can view and interact with reassignment popup window',
        'download_obligation': '📥 Download - Can download obligation documents',
        'status_update': '🔄 Status Update - Can update record status',
        'view_other': '👀 View Others - Can view other users records (deprecated)'
    };

    useEffect(() => {
        fetchRoles();
        fetchDepartments();
        
        // Debug: Log component mount
        console.log('RoleSettings component mounted');
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (openDropdownIndex !== null) {
                // Check if click is outside the dropdown
                const dropdownElement = event.target.closest('.reporting-role-dropdown');
                if (!dropdownElement) {
                    setOpenDropdownIndex(null);
                    setDropdownSearchTerms({});
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openDropdownIndex]);

    // Debug effect to track permission changes
    useEffect(() => {
        console.log('Permissions state changed:', formData.permissions);
    }, [formData.permissions]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDepartmentDropdown && !event.target.closest('.department-dropdown-container')) {
                setShowDepartmentDropdown(false);
            }
            if (showReportingDropdown && !event.target.closest('.reporting-dropdown-container')) {
                setShowReportingDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDepartmentDropdown, showReportingDropdown]);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const userData = localStorage.getItem('userData');
            if (!userData) {
                setRoles([]);
                return;
            }

            const { user_id } = JSON.parse(userData);
            
            // Try different URL formats to handle the 307 redirect
            const urls = [
                `/api/roles?user_id=${user_id}`,
                `/api/roles/?user_id=${user_id}`,
                `/api/roles/`,
                `/api/roles`
            ];
            
            let data = null;
            let success = false;
            
            for (const url of urls) {
                try {
                    console.log('Trying URL:', url);
                    
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    
                    console.log(`Response for ${url}:`, response.status, response.statusText);
                    
                    if (response.ok) {
                        data = await response.json();
                        console.log('Successfully fetched roles from:', url);
                        console.log('Raw roles data:', data);
                        success = true;
                        break;
                    } else if (response.status === 307) {
                        const location = response.headers.get('Location');
                        console.log('307 Redirect to:', location);
                        continue;
                    }
                } catch (err) {
                    console.log(`Error with ${url}:`, err.message);
                    continue;
                }
            }
            
            if (success && data) {
                const rolesArray = Array.isArray(data) ? data : [];
                console.log('Processed roles array:', rolesArray);
                setRoles(rolesArray);
            } else {
                console.error('All URL attempts failed');
                setRoles([]);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
            message.error('Failed to fetch roles');
            setRoles([]);
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

    const buildTree = (items, parentIdField = 'reporting_ids') => {
        console.log('🌳 buildTree called with items:', items);
        
        if (!Array.isArray(items) || items.length === 0) {
            console.log('⚠️ buildTree: No items to build tree');
            return [];
        }
        
        // Handle both old reporting_id and new reporting_ids format
        const map = new Map(items.map((item, i) => [item.id || item._id, { ...item, children: [] }]));
        const tree = [];
        
        console.log('📋 buildTree: Created map with', map.size, 'items');
        
        items.forEach(item => {
            const itemCopy = map.get(item.id || item._id);
            
            // Check if this role reports to anyone
            let hasParent = false;
            
            // Support both new reporting_ids (array) and old reporting_id (single)
            const reportingIds = item.reporting_ids || (item.reporting_id ? [item.reporting_id] : []);
            
            console.log(`📌 Processing role: ${item.name}, reporting_ids:`, reportingIds);
            
            if (reportingIds.length > 0) {
                // For roles with multiple reporting relationships, 
                // add them as child to the FIRST reporting role only (to avoid duplication in tree)
                const primaryReportingId = reportingIds[0];
                
                console.log(`   Primary reporting ID for ${item.name}:`, primaryReportingId);
                
                if (map.has(primaryReportingId)) {
                    const parent = map.get(primaryReportingId);
                    parent.children.push(itemCopy);
                    hasParent = true;
                    console.log(`   ✅ Added ${item.name} as child of ${parent.name}`);
                } else {
                    console.log(`   ⚠️ Parent role ${primaryReportingId} not found in map`);
                }
            }
            
            // If no parent relationship found, it's a top-level role
            if (!hasParent) {
                tree.push(itemCopy);
                console.log(`   ⭐ Added ${item.name} as top-level role`);
            }
        });
        
        console.log('🎯 buildTree result - Top level roles:', tree.length);
        console.log('🌲 Tree structure:', tree);
        
        return tree;
    };

    const togglePermissionCollapse = (module) => {
        const newCollapsed = new Set(collapsedPermissions);
        if (newCollapsed.has(module)) {
            newCollapsed.delete(module);
        } else {
            newCollapsed.add(module);
        }
        setCollapsedPermissions(newCollapsed);
    };

    // Department hierarchical navigation functions
    const getMainDepartments = () => {
        return departments.filter(dept => dept.parent_id === null || dept.parent_id === undefined);
    };

    const getSubDepartments = (parentId) => {
        return departments.filter(dept => dept.parent_id === parentId);
    };

    const getFilteredDepartmentOptions = () => {
        if (departmentSearch) {
            return departments.filter(dept => 
                dept.name.toLowerCase().includes(departmentSearch.toLowerCase())
            );
        }

        if (showMainDepartments) {
            return getMainDepartments();
        } else if (selectedMainDepartment) {
            return getSubDepartments(selectedMainDepartment._id);
        }

        return [];
    };

    const handleDepartmentNavigation = (department) => {
        const departmentId = department._id || department.id;
        const hasSubDepartments = getSubDepartments(departmentId).length > 0;
        
        if (hasSubDepartments && showMainDepartments && !departmentSearch) {
            setShowMainDepartments(false);
            setSelectedMainDepartment(department);
        } else {
            setFormData({...formData, department_id: departmentId});
            setShowDepartmentDropdown(false);
            setDepartmentSearch('');
            setShowMainDepartments(true);
            setSelectedMainDepartment(null);
        }
    };

    const handleBackToMainDepartments = () => {
        setShowMainDepartments(true);
        setSelectedMainDepartment(null);
        setDepartmentSearch('');
    };

    // Toggle function for department expansion
    const toggleDepartmentExpansion = (departmentId) => {
        const newExpanded = new Set(expandedDepartments);
        if (newExpanded.has(departmentId)) {
            newExpanded.delete(departmentId);
        } else {
            newExpanded.add(departmentId);
        }
        setExpandedDepartments(newExpanded);
    };

    // Tree structure functions for department dropdown
    const buildDepartmentTree = () => {
        if (departmentSearch) {
            // When searching, return flat list of matching departments
            return departments.filter(dept => 
                dept.name.toLowerCase().includes(departmentSearch.toLowerCase())
            ).map(dept => ({ ...dept, level: 0, hasChildren: false }));
        }

        // Build tree structure recursively
        const buildDepartmentSubtree = (parentDept, level = 0, parentName = null) => {
            const departmentId = parentDept._id || parentDept.id;
            const subDepartments = getSubDepartments(departmentId);

            const deptWithMeta = {
                ...parentDept,
                level,
                hasChildren: subDepartments.length > 0,
                isExpanded: expandedDepartments.has(departmentId),
                parentName
            };

            const result = [deptWithMeta];

            // If this department is expanded, add its children recursively
            if (expandedDepartments.has(departmentId)) {
                subDepartments.forEach(subDept => {
                    const childTree = buildDepartmentSubtree(subDept, level + 1, parentDept.name);
                    result.push(...childTree);
                });
            }

            return result;
        };

        // Start with main departments (those without parent_id)
        const tree = [];
        const mainDepartments = getMainDepartments();

        mainDepartments.forEach(mainDept => {
            const subtree = buildDepartmentSubtree(mainDept, 0, null);
            tree.push(...subtree);
        });

        return tree;
    };

    const renderDepartmentTreeItem = (dept) => {
        const departmentId = dept._id || dept.id;
        const isSelected = formData.department_id === departmentId;
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
                        {dept.hasChildren && !departmentSearch ? (
                            <div
                                className="cursor-pointer p-1 hover:bg-gray-200 rounded mr-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDepartmentExpansion(departmentId);
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
                                // Select the department
                                setFormData({...formData, department_id: departmentId});
                                setShowDepartmentDropdown(false);
                                setDepartmentSearch('');
                                setExpandedDepartments(new Set());
                            }}
                        >
                            <span>{dept.name}</span>
                        </div>
                    </div>
                    
                    {/* Sub-department count indicator */}
                    {dept.hasChildren && !departmentSearch && (
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

    // Reporting Role hierarchical navigation functions
    const getMainRoles = () => {
        console.log('All roles:', roles);
        console.log('Filtering main roles...');
        const mainRoles = roles.filter(role => {
            const reportingId = role.reporting_id;
            console.log(`Role ${role.name}: reporting_id = ${reportingId} (type: ${typeof reportingId})`);
            // Check for null, undefined, empty string, or "null" string
            const isMainRole = reportingId === null || 
                              reportingId === undefined || 
                              reportingId === '' || 
                              reportingId === 'null' ||
                              reportingId === 'None';
            console.log(`Is main role: ${isMainRole}`);
            return isMainRole;
        });
        console.log('Main roles found:', mainRoles);
        return mainRoles;
    };

    const getSubRoles = (parentId) => {
        console.log(`Getting sub-roles for parent ID: ${parentId}`);
        const subRoles = roles.filter(role => {
            const match = role.reporting_id === parentId || 
                         role.reporting_id === String(parentId);
            console.log(`Role ${role.name}: reporting_id = ${role.reporting_id}, matches parent: ${match}`);
            return match;
        });
        console.log('Sub-roles found:', subRoles);
        return subRoles;
    };

    const getFilteredReportingOptions = () => {
        console.log('🔄 getFilteredReportingOptions called (hierarchical)');
        console.log('reportingSearch:', reportingSearch);
        console.log('showMainRoles:', showMainRoles);
        console.log('selectedMainRole:', selectedMainRole);
        console.log('editingRole:', editingRole);

        if (reportingSearch) {
            // When searching, show all matching roles
            const searchResults = roles.filter(role => {
                const isCurrentRole = editingRole && (
                    role._id === editingRole._id || 
                    role.id === editingRole.id ||
                    role._id === editingRole.id ||
                    role.id === editingRole._id
                );
                return !isCurrentRole && role.name.toLowerCase().includes(reportingSearch.toLowerCase());
            });
            console.log('🔍 Search results:', searchResults);
            return searchResults;
        }

        if (showMainRoles) {
            // Show main roles (those without reporting_id)
            const allMainRoles = getMainRoles();
            const filteredMainRoles = allMainRoles.filter(role => {
                if (!editingRole) return true; // Show all when adding new role
                return role._id !== editingRole._id && 
                       role.id !== editingRole.id &&
                       role._id !== editingRole.id &&
                       role.id !== editingRole._id;
            });
            console.log('📁 Main roles:', filteredMainRoles);
            return filteredMainRoles;
        } else if (selectedMainRole) {
            // Show sub-roles of the selected main role
            const subRoles = getSubRoles(selectedMainRole._id || selectedMainRole.id);
            const filteredSubRoles = subRoles.filter(role => {
                if (!editingRole) return true;
                return role._id !== editingRole._id && 
                       role.id !== editingRole.id &&
                       role._id !== editingRole.id &&
                       role.id !== editingRole._id;
            });
            console.log('📂 Sub-roles for', selectedMainRole.name + ':', filteredSubRoles);
            return filteredSubRoles;
        }

        console.log('❌ No options to return');
        return [];
    };

    const handleReportingNavigation = (role) => {
        const hasSubRoles = getSubRoles(role._id).length > 0;
        
        if (hasSubRoles && showMainRoles && !reportingSearch) {
            // Navigate to show sub-roles
            setShowMainRoles(false);
            setSelectedMainRole(role);
        } else {
            // Select the role directly
            setFormData({...formData, reporting_id: role._id});
            setShowReportingDropdown(false);
            setReportingSearch('');
            setShowMainRoles(true);
            setSelectedMainRole(null);
        }
    };

    const handleBackToMainRoles = () => {
        setShowMainRoles(true);
        setSelectedMainRole(null);
        setReportingSearch('');
    };

    // Tree structure functions for reporting dropdown
    const toggleReportingRoleExpansion = (roleId) => {
        const newExpanded = new Set(expandedReportingRoles);
        if (newExpanded.has(roleId)) {
            newExpanded.delete(roleId);
        } else {
            newExpanded.add(roleId);
        }
        setExpandedReportingRoles(newExpanded);
    };

    const buildReportingRoleTree = () => {
        if (reportingSearch) {
            // When searching, return flat list of matching roles
            return roles.filter(role => {
                const isCurrentRole = editingRole && (
                    role._id === editingRole._id || 
                    role.id === editingRole.id ||
                    role._id === editingRole.id ||
                    role.id === editingRole._id
                );
                return !isCurrentRole && role.name.toLowerCase().includes(reportingSearch.toLowerCase());
            }).map(role => ({ ...role, level: 0, hasChildren: false }));
        }

        // Build tree structure recursively
        const buildRoleSubtree = (parentRole, level = 0, parentName = null) => {
            const roleId = parentRole._id || parentRole.id;
            const subRoles = getSubRoles(roleId).filter(role => {
                if (!editingRole) return true;
                return role._id !== editingRole._id && 
                       role.id !== editingRole.id &&
                       role._id !== editingRole.id &&
                       role.id !== editingRole._id;
            });

            const roleWithMeta = {
                ...parentRole,
                level,
                hasChildren: subRoles.length > 0,
                isExpanded: expandedReportingRoles.has(roleId),
                parentName
            };

            const result = [roleWithMeta];

            // If this role is expanded, add its children recursively
            if (expandedReportingRoles.has(roleId)) {
                subRoles.forEach(subRole => {
                    const childTree = buildRoleSubtree(subRole, level + 1, parentRole.name);
                    result.push(...childTree);
                });
            }

            return result;
        };

        // Start with main roles (those without reporting_id)
        const tree = [];
        const mainRoles = getMainRoles().filter(role => {
            if (!editingRole) return true;
            return role._id !== editingRole._id && 
                   role.id !== editingRole.id &&
                   role._id !== editingRole.id &&
                   role.id !== editingRole._id;
        });

        mainRoles.forEach(mainRole => {
            const subtree = buildRoleSubtree(mainRole, 0, null);
            tree.push(...subtree);
        });

        return tree;
    };

    const renderReportingRoleTreeItem = (role) => {
        const isSelected = formData.reporting_id === (role._id || role.id);
        const paddingLeft = role.level * 20 + 16; // Indent based on level
        const roleId = role._id || role.id;

        return (
            <div
                key={roleId}
                className="border-b border-gray-100 transition-colors text-black hover:bg-blue-200"
                style={{
                    backgroundColor: isSelected ? '#FFFF00' : '',
                    color: '#000000',
                    fontWeight: isSelected ? 'bold' : 'normal'
                }}
            >
                <div 
                    className="py-3 flex items-center justify-between"
                    style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '16px' }}
                >
                    <div className="flex items-center flex-1">
                        {/* Expandable Arrow (clickable only for expansion) */}
                        {role.hasChildren && !reportingSearch ? (
                            <div
                                className="cursor-pointer p-1 hover:bg-gray-200 rounded mr-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleReportingRoleExpansion(roleId);
                                }}
                            >
                                <svg 
                                    className={`w-4 h-4 text-gray-500 transition-transform ${role.isExpanded ? 'rotate-90' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        ) : (
                            /* Spacer for roles without children to maintain alignment */
                            <div className="w-6 h-6 mr-1 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        )}
                        
                        {/* Role Name (clickable for selection) */}
                        <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => {
                                // Select the role
                                setFormData({...formData, reporting_id: roleId});
                                setShowReportingDropdown(false);
                                setReportingSearch('');
                                setExpandedReportingRoles(new Set());
                            }}
                        >
                            <span>{role.name}</span>
                        </div>
                    </div>
                    
                    {/* Sub-role count indicator */}
                    {role.hasChildren && !reportingSearch && (
                        <div className="text-xs text-gray-500 ml-2">
                            {getSubRoles(roleId).length} sub-role{getSubRoles(roleId).length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
                
                {/* Parent context for sub-roles */}
                {role.level > 0 && role.parentName && (
                    <div className="text-xs text-gray-500 mt-1" style={{ paddingLeft: `${paddingLeft}px` }}>
                        Sub-role of {role.parentName}
                    </div>
                )}
            </div>
        );
    };

    const openModal = (role = null) => {
        setEditingRole(role);
        if (role) {
            // Convert permissions array format to object format for easier handling
            const permissionsObj = {};
            
            // Track if we have nested leads permissions - if yes, skip unified "leads" processing
            let hasNestedLeadsPermissions = false;
            
            if (role.permissions && Array.isArray(role.permissions)) {
                // First pass: Check if nested leads permissions exist
                role.permissions.forEach(perm => {
                    if (perm.page.startsWith('leads.') && perm.page !== 'leads') {
                        hasNestedLeadsPermissions = true;
                    }
                });
                
                console.log('🔍 DEBUG: Loading role permissions, hasNestedLeadsPermissions:', hasNestedLeadsPermissions);
                
                role.permissions.forEach(perm => {
                    // Special handling for SuperAdmin - page "*" and actions "*"
                    if (perm.page === '*' && perm.actions === '*') {
                        permissionsObj['SuperAdmin'] = ['*'];
                    } 
                    // Handle nested "leads.*" permissions - convert to our new nested structure
                    else if (perm.page.startsWith('leads.')) {
                        const section = perm.page.split('.')[1];
                        let sectionName = '';
                        
                        // Map backend section names to our UI section names
                        if (section === 'create_lead') {
                            sectionName = 'Create LEAD';
                        } else if (section === 'pl_&_odd_leads' || section === 'pl_odd_leads') {
                            sectionName = 'PL & ODD LEADS';
                        }
                        
                        if (sectionName) {
                            const nestedKey = `Leads CRM.${sectionName}`;
                            if (!permissionsObj[nestedKey]) {
                                permissionsObj[nestedKey] = [];
                            }
                            const actions = Array.isArray(perm.actions) ? perm.actions : [perm.actions];
                            permissionsObj[nestedKey] = [...(permissionsObj[nestedKey] || []), ...actions];
                            
                            console.log(`🔍 DEBUG: Loaded nested permission "${nestedKey}" with ${actions.length} actions:`, actions);
                        }
                    }
                    // Handle old "leads" permission format - distribute to appropriate sections
                    // ONLY if we don't have explicit nested permissions (backward compatibility)
                    else if (perm.page === 'leads' && !hasNestedLeadsPermissions) {
                        console.log('🔍 DEBUG: Processing unified leads permission (no nested permissions found)');
                        const actions = Array.isArray(perm.actions) ? perm.actions : [perm.actions];
                        
                        // Distribute actions to appropriate sections based on their type
                        const createActions = actions.filter(a => ['show', 'add', 'edit', 'delete'].includes(a));
                        const viewActions = actions.filter(a => ['show', 'own', 'junior', 'all'].includes(a));
                        const otherActions = actions.filter(a => ['assign', 'download_obligation', 'status_update', 'delete'].includes(a));
                        
                        // If we have create-type actions, add to Create LEAD section
                        if (createActions.length > 0) {
                            const createKey = 'Leads CRM.Create LEAD';
                            if (!permissionsObj[createKey]) {
                                permissionsObj[createKey] = [];
                            }
                            createActions.forEach(action => {
                                if (!permissionsObj[createKey].includes(action)) {
                                    permissionsObj[createKey].push(action);
                                }
                            });
                        }
                        
                        // Add viewing and other actions to PL & ODD LEADS section
                        const allLeadActions = [...new Set([...viewActions, ...otherActions])];
                        if (allLeadActions.length > 0) {
                            const plOddKey = 'Leads CRM.PL & ODD LEADS';
                            if (!permissionsObj[plOddKey]) {
                                permissionsObj[plOddKey] = [];
                            }
                            allLeadActions.forEach(action => {
                                if (!permissionsObj[plOddKey].includes(action)) {
                                    permissionsObj[plOddKey].push(action);
                                }
                            });
                        }
                    }
                    // Skip unified "leads" if nested permissions exist (they take precedence)
                    else if (perm.page === 'leads' && hasNestedLeadsPermissions) {
                        console.log('🔍 DEBUG: Skipping unified leads permission (nested permissions exist and take precedence)');
                    }
                    // Handle all other regular permissions
                    else {
                        if (!permissionsObj[perm.page]) {
                            permissionsObj[perm.page] = [];
                        }
                        const actions = Array.isArray(perm.actions) ? perm.actions : [perm.actions];
                        permissionsObj[perm.page] = [...(permissionsObj[perm.page] || []), ...actions];
                    }
                });
            }
            
            // Handle backward compatibility for reporting_id -> reporting_ids migration
            let reportingIds = role.reporting_ids || [];
            if (!reportingIds.length && role.reporting_id) {
                reportingIds = [role.reporting_id];
            }
            // Filter out empty strings
            reportingIds = reportingIds.filter(id => id);
            
            setFormData({
                name: role.name || '',
                description: role.description || '',
                department_id: role.department_id || null,
                reporting_ids: reportingIds,  // Changed from reporting_id to reporting_ids (array)
                permissions: permissionsObj
            });
        } else {
            setFormData({
                name: '',
                description: '',
                department_id: null,
                reporting_ids: [],  // Changed from reporting_id to reporting_ids (array)
                permissions: {}
            });
        }
        // Reset hierarchical navigation states
        setShowMainDepartments(true);
        setSelectedMainDepartment(null);
        setDepartmentSearch('');
        setShowDepartmentDropdown(false);
        setExpandedDepartments(new Set());
        setShowMainRoles(true);
        setSelectedMainRole(null);
        setReportingSearch('');
        setShowReportingDropdown(false);
        setExpandedReportingRoles(new Set());
        setIsModalVisible(true);
    };

    const closeModal = () => {
        setIsModalVisible(false);
        setEditingRole(null);
        setFormData({ name: '', description: '', department_id: null, reporting_ids: [], permissions: {} });  // Changed from reporting_id to reporting_ids
        // Reset hierarchical navigation states
        setShowMainDepartments(true);
        setSelectedMainDepartment(null);
        setDepartmentSearch('');
        setShowDepartmentDropdown(false);
        setExpandedDepartments(new Set());
        setShowMainRoles(true);
        setSelectedMainRole(null);
        setReportingSearch('');
        setShowReportingDropdown(false);
        setExpandedReportingRoles(new Set());
    };

    // Function to refresh user permissions after role update
    const refreshUserPermissions = async () => {
        try {
            const userData = localStorage.getItem('userData');
            if (!userData) return;

            const { user_id, role_id } = JSON.parse(userData);
            
            // Check if the edited role matches the current user's role
            if (editingRole && (editingRole.id === role_id || editingRole._id === role_id)) {
                // Fetch the updated user permissions
                const response = await fetch(`${API_BASE_URL}/users/${user_id}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    const updatedUserData = await response.json();
                    
                    // Update localStorage with new permissions in userData
                    const currentUserData = JSON.parse(localStorage.getItem('userData'));
                    const updatedData = {
                        ...currentUserData,
                        permissions: updatedUserData.permissions || []
                    };
                    localStorage.setItem('userData', JSON.stringify(updatedData));
                    
                    // IMPORTANT: Also update userPermissions separately (used by permission utilities)
                    localStorage.setItem('userPermissions', JSON.stringify(updatedUserData.permissions || []));
                    
                    // Trigger a custom event to notify other components
                    window.dispatchEvent(new CustomEvent('permissionsUpdated', { 
                        detail: { permissions: updatedUserData.permissions } 
                    }));
                    
                    message.info('Your permissions have been updated. Some features may now be available or restricted.');
                }
            }
        } catch (error) {
            console.error('Error refreshing user permissions:', error);
            // Don't show error to user as this is a background operation
        }
    };

    const handlePermissionChange = (module, action, checked) => {
        console.log('handlePermissionChange called:', { module, action, checked });
        
        const newPermissions = { ...formData.permissions };
        
        // Special handling for SuperAdmin - when selected, clear all other permissions and set global access
        if (module === 'SuperAdmin' && checked) {
            console.log('SuperAdmin selected - clearing all other permissions');
            // Clear all existing permissions and set SuperAdmin
            setFormData({ 
                ...formData, 
                permissions: { 
                    'SuperAdmin': ['*'] 
                } 
            });
            return;
        }
        
        // Special handling for SuperAdmin - when unchecked, remove it completely
        if (module === 'SuperAdmin' && !checked) {
            console.log('SuperAdmin unchecked - removing SuperAdmin permission');
            // Remove SuperAdmin permission completely
            const newPerms = { ...formData.permissions };
            delete newPerms.SuperAdmin;
            setFormData({ 
                ...formData, 
                permissions: newPerms 
            });
            return;
        }
        
        // If user selects any other permission while SuperAdmin is active, remove SuperAdmin
        if (module !== 'SuperAdmin' && formData.permissions.SuperAdmin) {
            console.log('Removing SuperAdmin as other permission is selected');
            delete newPermissions.SuperAdmin;
        }
        
        if (!newPermissions[module]) {
            newPermissions[module] = [];
        }
        
        // Get available actions for this module (handle nested modules)
        let availableActions = [];
        if (module.includes('.')) {
            // Nested module like "Leads CRM.Create LEAD"
            const [parentModule, section] = module.split('.');
            availableActions = allPermissions[parentModule]?.[section] || [];
        } else {
            availableActions = allPermissions[module] || [];
        }
        
        if (checked) {
            // When checking any permission, add it
            if (!newPermissions[module].includes(action)) {
                newPermissions[module].push(action);
                console.log(`Added ${action} to ${module}`);
            }
        } else {
            // When unchecking, simply remove the permission
            newPermissions[module] = newPermissions[module].filter(a => a !== action);
            console.log(`Removed ${action} from ${module}. Remaining:`, newPermissions[module]);
            
            // CRITICAL FIX: Keep module with empty array instead of deleting
            // This ensures backend receives explicit "no permissions" signal
            // Deleting the module would cause it to be skipped in handleSubmit
            console.log(`Module ${module} kept with ${newPermissions[module].length} permissions`);
        }
        
        console.log('Final permissions state:', newPermissions);
        setFormData({ ...formData, permissions: newPermissions });
    };

    const handleModuleToggle = (module, checked) => {
        console.log('handleModuleToggle called:', { module, checked, currentPermissions: formData.permissions });
        
        const newPermissions = { ...formData.permissions };
        
        if (checked) {
            // Select all permissions for this module
            // Check if module is a nested key (e.g., "Leads CRM.Create LEAD")
            if (module.includes('.')) {
                const [parentModule, section] = module.split('.');
                const sectionActions = allPermissions[parentModule]?.[section];
                if (sectionActions) {
                    newPermissions[module] = [...sectionActions];
                    console.log(`Selecting all permissions for nested ${module}:`, newPermissions[module]);
                }
            } else {
                // Regular module - check if it has nested structure
                const moduleData = allPermissions[module];
                if (typeof moduleData === 'object' && !Array.isArray(moduleData)) {
                    // It's a nested module, don't handle "All" checkbox for parent
                    console.log(`${module} is a nested module, skipping parent toggle`);
                } else {
                    newPermissions[module] = [...allPermissions[module]];
                    console.log(`Selecting all permissions for ${module}:`, newPermissions[module]);
                }
            }
        } else {
            // Deselect all permissions for this module
            // CRITICAL FIX: Keep module with empty array instead of deleting
            newPermissions[module] = [];
            console.log(`Deselecting all permissions for ${module}, keeping with empty array`);
        }
        
        console.log('Updated permissions:', newPermissions);
        setFormData({ ...formData, permissions: newPermissions });
    };

    const handleSelectAllPermissions = (checked) => {
        if (checked) {
            const allSelected = {};
            Object.keys(allPermissions).forEach(module => {
                allSelected[module] = [...allPermissions[module]];
            });
            setFormData({ ...formData, permissions: allSelected });
        } else {
            setFormData({ ...formData, permissions: {} });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        console.log('🔍 DEBUG: Starting handleSubmit...');
        console.log('🔍 DEBUG: formData.permissions:', JSON.stringify(formData.permissions, null, 2));
        
        // Convert permissions object back to array format for backend
        const permissionsArray = [];
        
        // Special handling for SuperAdmin - convert to page: "*", actions: "*"
        if (formData.permissions.SuperAdmin && formData.permissions.SuperAdmin.length > 0) {
            permissionsArray.push({
                page: "*",
                actions: "*"
            });
        } else {
            // Collect all Leads CRM permissions for backward compatibility
            const leadsPermissions = new Set();
            
            // Handle regular and nested permissions
            Object.keys(formData.permissions).forEach(module => {
                const permissions = formData.permissions[module];
                
                console.log(`🔍 DEBUG: Processing module "${module}" with permissions:`, permissions);
                
                // Check if it's a nested permission (e.g., "Leads CRM.Create LEAD")
                if (module.includes('.')) {
                    const [parentModule, section] = module.split('.');
                    
                    // ALWAYS save nested permissions, even if empty (to indicate no permissions)
                    // This is critical for permission checks to work correctly
                    const pageName = parentModule === 'Leads CRM' ? 'leads' : parentModule.toLowerCase();
                    const formattedPage = `${pageName}.${section.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_')}`;
                    
                    console.log(`🔍 DEBUG: Nested permission - page: "${formattedPage}", actions:`, permissions);
                    
                    permissionsArray.push({
                        page: formattedPage,
                        actions: permissions.length > 0 ? permissions : []
                    });
                    
                    // Collect permissions for unified "leads" entry (only non-empty permissions)
                    if (parentModule === 'Leads CRM' && permissions.length > 0) {
                        permissions.forEach(perm => leadsPermissions.add(perm));
                    }
                } else if (permissions.length > 0) {
                    // Regular flat permissions (only save if not empty)
                    console.log(`🔍 DEBUG: Regular permission - page: "${module}", actions:`, permissions);
                    permissionsArray.push({
                        page: module,
                        actions: permissions
                    });
                }
            });
            
            // Add unified "leads" permission for backward compatibility
            // This combines ALL permissions from all Leads CRM sections
            if (leadsPermissions.size > 0) {
                const leadsArray = Array.from(leadsPermissions);
                console.log(`🔍 DEBUG: Adding unified leads permissions:`, leadsArray);
                permissionsArray.push({
                    page: "leads",
                    actions: leadsArray
                });
            }
        }
        
        console.log('🔍 DEBUG: Final permissionsArray BEFORE submitData:', JSON.stringify(permissionsArray, null, 2));
        
        const submitData = {
            ...formData,
            permissions: permissionsArray
        };
        
        console.log('🔍 DEBUG: Complete submitData:', JSON.stringify(submitData, null, 2));
        
        try {
            // Use the new immediate refresh system instead of manual API calls
            console.log('🚀 Using immediate permission refresh system...');
            console.log('📤 Submitting to backend...');
            
            const roleId = editingRole ? (editingRole.id || editingRole._id) : null;
            console.log('🔍 DEBUG: Role ID:', roleId);
            console.log('🔍 DEBUG: Edit mode:', !!editingRole);
            
            const result = await updateRoleWithImmediateRefresh(submitData, roleId);
            
            console.log('✅ Role updated with immediate permission refresh:', result);
            message.success(`Role ${editingRole ? 'updated' : 'created'} successfully! Permissions applied immediately.`);
            
            closeModal();
            fetchRoles();
            
        } catch (error) {
            console.error('❌ Error saving role:', error);
            console.error('❌ Error details:', {
                message: error.message,
                stack: error.stack,
                response: error.response
            });
            message.error('Failed to save role: ' + (error.message || 'Unknown error'));
        }
    };

    const showDeleteConfirmation = (role) => {
        // Check if role has direct reports
        const hasDirectReports = roles.some(r => r.reporting_id === (role.id || role._id));
        
        if (hasDirectReports) {
            message.error({
                content: (
                    <div>
                        <p className="font-semibold">Cannot delete role "{role.name}"</p>
                        <p className="text-sm mt-1">This role has direct reports. Please reassign or delete subordinate roles first.</p>
                    </div>
                ),
                duration: 5
            });
            return;
        }
        
        setRoleToDelete(role);
        setDeleteModalVisible(true);
    };

    const handleDelete = async () => {
        if (!roleToDelete) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/roles/${roleToDelete.id || roleToDelete._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                message.success('Role deleted successfully');
                setDeleteModalVisible(false);
                setRoleToDelete(null);
                fetchRoles();
            } else {
                const errorData = await response.json().catch(() => ({}));
                let errorMessage = 'Failed to delete role';
                
                if (response.status === 400 && errorData.detail) {
                    if (errorData.detail.includes('direct reports')) {
                        errorMessage = 'Cannot delete role with direct reports. Please reassign subordinate roles first.';
                    } else {
                        errorMessage = errorData.detail;
                    }
                }
                
                message.error({
                    content: errorMessage,
                    duration: 5
                });
                setDeleteModalVisible(false);
                setRoleToDelete(null);
            }
        } catch (error) {
            console.error('Error deleting role:', error);
            message.error('Network error occurred while deleting role');
            setDeleteModalVisible(false);
            setRoleToDelete(null);
        }
    };

    // Export functions for PDF and Excel
    // Export comprehensive HTML report - OPENS IN NEW TAB
    const exportToHTML = async () => {
        try {
            console.log('Generating comprehensive HTML report...');
            
            // Get user data
            const userData = localStorage.getItem('userData');
            const token = localStorage.getItem('token');
            
            if (!userData || !token) {
                message.error('Authentication required');
                return;
            }

            const { user_id } = JSON.parse(userData);
            message.loading('Fetching latest data from database...', 0);

            // Fetch latest roles using the same approach as fetchRoles
            let freshRoles = null;
            const roleUrls = [
                `/api/roles?user_id=${user_id}`,
                `/api/roles/?user_id=${user_id}`,
                `/api/roles/`,
                `/api/roles`
            ];
            
            for (const url of roleUrls) {
                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (response.ok) {
                        freshRoles = await response.json();
                        console.log('Roles fetched from:', url, '- Count:', freshRoles?.length);
                        break;
                    }
                } catch (err) {
                    console.log(`Error with ${url}:`, err.message);
                    continue;
                }
            }

            // Fetch latest departments
            let freshDepartments = null;
            try {
                const deptResponse = await fetch(`/api/departments/?user_id=${user_id}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (deptResponse.ok) {
                    freshDepartments = await deptResponse.json();
                    console.log('Departments fetched - Count:', freshDepartments?.length);
                }
            } catch (err) {
                console.log('Error fetching departments:', err.message);
                // Use existing departments as fallback
                freshDepartments = departments;
            }

            message.destroy();

            // Use fresh data or fallback to current state
            const reportRoles = (freshRoles && Array.isArray(freshRoles) && freshRoles.length > 0) ? freshRoles : roles;
            const reportDepartments = (freshDepartments && Array.isArray(freshDepartments) && freshDepartments.length > 0) ? freshDepartments : departments;

            if (!reportRoles || reportRoles.length === 0) {
                message.warning('No roles data available');
                return;
            }

            console.log('Generating report with:', reportRoles.length, 'roles and', reportDepartments.length, 'departments');
            
            // Generate interactive HTML report with fresh data
            const htmlContent = generateInteractiveHTMLReport(reportRoles, reportDepartments);
            
            // Open in new window/tab
            const reportWindow = window.open('', '_blank');
            if (!reportWindow) {
                message.error('Unable to open report window. Please check if pop-ups are blocked.');
                return;
            }
            
            reportWindow.document.write(htmlContent);
            reportWindow.document.close();
            
            message.success('Report generated successfully!');
        } catch (error) {
            message.destroy();
            console.error('Error generating HTML report:', error);
            message.error('Failed to generate report: ' + error.message);
        }
    };

    // Generate interactive HTML report with fixed columns and proper data from database
    const generateInteractiveHTMLReport = (freshRoles, freshDepartments) => {
        try {
            // Use fresh data from database
            const reportRoles = freshRoles || roles;
            const reportDepartments = freshDepartments || departments;

            // Build permission modules from allPermissions constant (ALL possible permissions)
            const permissionModules = [];
            
            Object.entries(allPermissions).forEach(([module, actions]) => {
                // Skip SuperAdmin - it's shown separately
                if (module === 'SuperAdmin') return;
                
                // Handle nested modules (Leads CRM) - CREATE SEPARATE COLUMNS FOR EACH SECTION
                if (typeof actions === 'object' && !Array.isArray(actions)) {
                    // Nested module - create separate module for each section
                    Object.entries(actions).forEach(([sectionName, sectionActions]) => {
                        if (Array.isArray(sectionActions)) {
                            permissionModules.push({
                                module: `${module} - ${sectionName}`,
                                originalModule: module,
                                section: sectionName,
                                actions: [...sectionActions], // Keep original order, no sorting
                                isNested: true
                            });
                            console.log(`Created nested module: ${module} - ${sectionName}, pageKey will be: ${module}.${sectionName}`);
                        }
                    });
                } else if (Array.isArray(actions)) {
                    // Simple module
                    permissionModules.push({
                        module: module,
                        originalModule: module,
                        section: null,
                        actions: [...actions], // Keep original order, no sorting
                        isNested: false
                    });
                }
            });
            
            console.log('All permission modules:', permissionModules.map(m => ({ name: m.module, isNested: m.isNested, section: m.section })));

            // Calculate permissions count for each role
            const getPermCount = (role) => {
                if (!role.permissions || !Array.isArray(role.permissions)) return 0;
                return role.permissions.reduce((count, perm) => {
                    if (perm.page === '*') {
                        // Super Admin - count ALL permissions properly
                        let total = 0;
                        Object.values(allPermissions).forEach(actions => {
                            if (actions === '*' || (Array.isArray(actions) && actions.includes('*'))) {
                                // Skip the SuperAdmin entry itself
                                return;
                            }
                            if (typeof actions === 'object' && !Array.isArray(actions)) {
                                // Nested module (Leads CRM) - count all sub-sections
                                Object.values(actions).forEach(sectionActions => {
                                    if (Array.isArray(sectionActions)) {
                                        total += sectionActions.length;
                                    }
                                });
                            } else if (Array.isArray(actions)) {
                                // Simple module - count actions
                                total += actions.length;
                            }
                        });
                        return total;
                    }
                    
                    // For regular roles - check if this is a nested permission (Leads CRM)
                    // Nested permissions are stored like "leads.create_lead" or "leads.pl_odd_leads"
                    if (perm.page && perm.page.includes('.')) {
                        // This is a nested permission - count the actions in it
                        return count + (perm.actions?.length || 0);
                    }
                    
                    // For simple permissions, just count the actions
                    return count + (perm.actions?.length || 0);
                }, 0);
            };
            
            // Build header row 1 (module names with colspan)
            let headerRow1 = `
                <tr>
                    <th rowspan="2" class="sticky-col role-col">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <span>Role Name</span>
                            <div style="display: flex; gap: 4px;">
                                <button onclick="toggleFilter()" class="filter-btn" title="Filter Roles">🔍</button>
                                <button onclick="sortTable()" class="sort-btn" title="Sort A-Z / Z-A">⇅</button>
                            </div>
                        </div>
                    </th>
                    <th rowspan="2">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <span>Department</span>
                            <button onclick="sortByDepartment()" class="sort-btn" title="Sort by Department">⇅</button>
                        </div>
                    </th>
                    <th rowspan="2">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <span>Reports To</span>
                            <button onclick="sortByReportsTo()" class="sort-btn" title="Sort by Reports To">⇅</button>
                        </div>
                    </th>
                    <th rowspan="2" class="sticky-col perm-col">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <span>Permissions</span>
                            <button onclick="sortByPermissions()" class="sort-btn" title="Sort by Permission Count">⇅</button>
                        </div>
                    </th>`;
            
            permissionModules.forEach((mod, idx) => {
                const isLastModule = idx === permissionModules.length - 1;
                headerRow1 += `<th colspan="${mod.actions.length}" class="module-header ${isLastModule ? '' : 'module-partition'}">${mod.module.toUpperCase()}</th>`;
            });
            headerRow1 += '</tr>';
            
            // Build header row 2 (action names)
            let headerRow2 = '<tr>';
            permissionModules.forEach((mod, modIdx) => {
                mod.actions.forEach((action, actIdx) => {
                    const isFirstAction = actIdx === 0 && modIdx > 0;
                    headerRow2 += `<th class="action-header ${isFirstAction ? 'action-partition' : ''}">${action}</th>`;
                });
            });
            headerRow2 += '</tr>';
            
            // Build data rows
            let dataRows = '';
            reportRoles.forEach(role => {
                const isSuperAdmin = role.permissions && role.permissions.some(p => p.page === '*');
                const dept = reportDepartments.find(d => (d.id || d._id) === role.department_id);
                const reportingIds = role.reporting_ids || (role.reporting_id ? [role.reporting_id] : []);
                const reportingRoles = reportingIds
                    .map(rid => reportRoles.find(r => (r.id || r._id) === rid))
                    .filter(r => r)
                    .map(r => r.name);
                const permCount = getPermCount(role);
                
                // Debug logging
                console.log(`Processing role: ${role.name}`);
                console.log('Role permissions:', role.permissions);
                
                dataRows += '<tr class="data-row">';
                dataRows += `<td class="sticky-col role-name" data-role="${role.name.toLowerCase()}">${role.name}</td>`;
                dataRows += `<td class="dept-cell">${dept?.name || '-'}</td>`;
                dataRows += `<td class="reports-cell">${reportingRoles.length > 0 ? reportingRoles.join(', ') : 'Top Level'}</td>`;
                dataRows += `<td class="sticky-col perm-cell">${permCount}</td>`;
                
                // Check each permission
                permissionModules.forEach((mod, modIdx) => {
                    mod.actions.forEach((action, actIdx) => {
                        const isFirstAction = actIdx === 0 && modIdx > 0;
                        let hasPermission = false;
                        
                        if (isSuperAdmin) {
                            hasPermission = true;
                        } else if (role.permissions && Array.isArray(role.permissions)) {
                            if (mod.isNested) {
                                // For nested modules (Leads CRM sections), check specific section
                                // Database stores as "leads.create_lead" but we display as "Leads CRM - Create LEAD"
                                // Need to convert display format to database format
                                const dbModule = mod.originalModule === 'Leads CRM' ? 'leads' : mod.originalModule.toLowerCase();
                                const dbSection = mod.section.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
                                const pageKey = `${dbModule}.${dbSection}`;
                                
                                const modulePerm = role.permissions.find(p => p.page === pageKey);
                                
                                // Debug logging for Leads CRM
                                if (mod.originalModule === 'Leads CRM' && actIdx === 0) {
                                    console.log(`  Checking ${role.name} for ${mod.module}`);
                                    console.log('  Display format:', `${mod.originalModule}.${mod.section}`);
                                    console.log('  Database format (looking for):', pageKey);
                                    console.log('  Available pages in permissions:', role.permissions.map(p => p.page));
                                    console.log('  Found permission:', modulePerm);
                                }
                                
                                if (modulePerm && modulePerm.actions && modulePerm.actions.includes(action)) {
                                    hasPermission = true;
                                }
                            } else {
                                // For simple modules, check directly
                                const modulePerm = role.permissions.find(p => p.page === mod.module);
                                if (modulePerm && modulePerm.actions && modulePerm.actions.includes(action)) {
                                    hasPermission = true;
                                }
                            }
                        }
                        
                        const checkMark = hasPermission ? '<span class="check-yes">✓</span>' : '<span class="check-no">-</span>';
                        const partitionClass = isFirstAction ? 'cell-partition' : '';
                        dataRows += `<td class="check-cell ${partitionClass}">${checkMark}</td>`;
                    });
                });
                
                dataRows += '</tr>';
            });

            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Roles & Permissions Report</title>
                    <meta charset="UTF-8">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            padding: 20px;
                            min-height: 100vh;
                        }
                        .container {
                            max-width: 100%;
                            background: #fff;
                            border-radius: 12px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                            overflow: hidden;
                        }
                        .header {
                            background: linear-gradient(135deg, #000 0%, #333 100%);
                            color: #fff;
                            padding: 30px;
                            text-align: center;
                        }
                        .header h1 {
                            font-size: 28px;
                            margin-bottom: 10px;
                        }
                        .header .timestamp {
                            font-size: 14px;
                            opacity: 0.8;
                        }
                        .table-wrapper {
                            overflow-x: auto;
                            overflow-y: visible;
                            margin: 20px;
                            scroll-behavior: smooth;
                            -webkit-overflow-scrolling: touch;
                        }
                        table {
                            width: max-content;
                            border-collapse: separate;
                            border-spacing: 0;
                            font-size: 13px;
                        }
                        thead {
                            position: sticky;
                            top: 0;
                            z-index: 20;
                        }
                        th {
                            position: sticky;
                            top: 0;
                            background: #000;
                            color: #fff;
                            padding: 12px 8px;
                            font-weight: bold;
                            text-align: center;
                            border: 1px solid #333;
                            white-space: nowrap;
                        }
                        .sticky-col {
                            position: sticky;
                            background: #fff;
                            z-index: 10;
                        }
                        th.sticky-col {
                            z-index: 25;
                            background: #000;
                        }
                        .role-col { left: 0; min-width: 250px; max-width: 250px; text-align: left !important; }
                        .perm-col { left: 250px; min-width: 100px; }
                        
                        td.sticky-col {
                            box-shadow: 2px 0 5px rgba(0,0,0,0.1);
                        }
                        
                        .sort-btn, .filter-btn {
                            background: #ffd700;
                            color: #000;
                            border: none;
                            padding: 4px 8px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: bold;
                            transition: all 0.2s;
                        }
                        .sort-btn:hover, .filter-btn:hover {
                            background: #ffed4e;
                            transform: scale(1.1);
                        }
                        .filter-modal {
                            display: none;
                            position: fixed;
                            z-index: 1000;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(0,0,0,0.8);
                            align-items: center;
                            justify-content: center;
                        }
                        .filter-modal.active {
                            display: flex;
                        }
                        .filter-content {
                            background: #1a1a1a;
                            padding: 30px;
                            border-radius: 12px;
                            max-width: 500px;
                            max-height: 80vh;
                            overflow-y: auto;
                            box-shadow: 0 10px 40px rgba(255,215,0,0.3);
                        }
                        .filter-content h3 {
                            color: #ffd700;
                            margin-bottom: 20px;
                            font-size: 20px;
                        }
                        .filter-options {
                            display: flex;
                            flex-direction: column;
                            gap: 10px;
                            margin-bottom: 20px;
                        }
                        .filter-option {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            padding: 10px;
                            background: #2a2a2a;
                            border-radius: 6px;
                            cursor: pointer;
                            transition: all 0.2s;
                        }
                        .filter-option:hover {
                            background: #3a3a3a;
                        }
                        .filter-option input[type="checkbox"] {
                            width: 18px;
                            height: 18px;
                            cursor: pointer;
                            accent-color: #ffd700;
                        }
                        .filter-option label {
                            color: #fff;
                            cursor: pointer;
                            flex: 1;
                        }
                        .filter-buttons {
                            display: flex;
                            gap: 10px;
                            justify-content: flex-end;
                        }
                        .filter-buttons button {
                            padding: 10px 20px;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                            transition: all 0.2s;
                        }
                        .apply-filter {
                            background: #ffd700;
                            color: #000;
                        }
                        .apply-filter:hover {
                            background: #ffed4e;
                        }
                        .cancel-filter {
                            background: #555;
                            color: #fff;
                        }
                        .cancel-filter:hover {
                            background: #666;
                        }
                        .module-header {
                            background: #000 !important;
                            color: #ffd700 !important;
                            font-size: 13px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            padding: 15px 8px !important;
                            font-weight: 700;
                        }
                        .module-partition {
                            border-left: 5px solid #ffd700 !important;
                        }
                        .action-header {
                            background: #333 !important;
                            color: #ffd700 !important;
                            font-size: 12px;
                            font-weight: 600;
                            text-transform: lowercase;
                        }
                        .action-partition {
                            border-left: 5px solid #ffd700 !important;
                        }
                        td {
                            padding: 12px 8px;
                            border: 1px solid #e0e0e0;
                            text-align: center;
                            white-space: nowrap;
                        }
                        
                        .role-name {
                            font-weight: 600;
                            color: #000;
                            text-align: left !important;
                            padding-left: 15px !important;
                            background: #f9f9f9;
                            left: 0;
                        }
                        .dept-cell {
                            font-size: 13px;
                            color: #000;
                            font-weight: 600;
                            background: #fafafa;
                        }
                        .reports-cell {
                            font-size: 13px;
                            color: #000;
                            font-weight: 600;
                            background: #fafafa;
                        }
                        .perm-cell {
                            font-weight: 700;
                            color: #000;
                            background: #fff9e6;
                            left: 250px;
                        }
                        .check-cell {
                            background: #fff;
                            min-width: 50px;
                        }
                        .cell-partition {
                            border-left: 5px solid #ffd700 !important;
                        }
                        .check-yes {
                            color: #00c851;
                            font-size: 20px;
                            font-weight: bold;
                        }
                        .check-no {
                            color: #ddd;
                            font-size: 16px;
                        }
                        tr:hover td:not(.sticky-col) {
                            background: #f0f7ff;
                        }
                        .data-row.hidden {
                            display: none;
                        }
                        @media print {
                            body { background: #fff; padding: 0; }
                            .container { box-shadow: none; }
                            @page { size: landscape; }
                        }
                    </style>
                    <script>
                        let sortAscending = true;
                        let sortPermAscending = true;
                        let sortDeptAscending = true;
                        let sortReportsAscending = true;
                        let selectedRoles = [];

                        function sortTable() {
                            const table = document.querySelector('tbody');
                            const rows = Array.from(table.querySelectorAll('.data-row'));
                            
                            rows.sort((a, b) => {
                                const aText = a.querySelector('.role-name').textContent.toLowerCase();
                                const bText = b.querySelector('.role-name').textContent.toLowerCase();
                                
                                if (sortAscending) {
                                    return aText.localeCompare(bText);
                                } else {
                                    return bText.localeCompare(aText);
                                }
                            });
                            
                            sortAscending = !sortAscending;
                            rows.forEach(row => table.appendChild(row));
                        }

                        function sortByPermissions() {
                            const table = document.querySelector('tbody');
                            const rows = Array.from(table.querySelectorAll('.data-row'));
                            
                            rows.sort((a, b) => {
                                const aCount = parseInt(a.querySelector('.perm-cell').textContent);
                                const bCount = parseInt(b.querySelector('.perm-cell').textContent);
                                
                                if (sortPermAscending) {
                                    return aCount - bCount; // Low to High
                                } else {
                                    return bCount - aCount; // High to Low
                                }
                            });
                            
                            sortPermAscending = !sortPermAscending;
                            rows.forEach(row => table.appendChild(row));
                        }

                        function sortByDepartment() {
                            const table = document.querySelector('tbody');
                            const rows = Array.from(table.querySelectorAll('.data-row'));
                            
                            rows.sort((a, b) => {
                                const aText = a.querySelector('.dept-cell').textContent.toLowerCase();
                                const bText = b.querySelector('.dept-cell').textContent.toLowerCase();
                                
                                if (sortDeptAscending) {
                                    return aText.localeCompare(bText);
                                } else {
                                    return bText.localeCompare(aText);
                                }
                            });
                            
                            sortDeptAscending = !sortDeptAscending;
                            rows.forEach(row => table.appendChild(row));
                        }

                        function sortByReportsTo() {
                            const table = document.querySelector('tbody');
                            const rows = Array.from(table.querySelectorAll('.data-row'));
                            
                            rows.sort((a, b) => {
                                const aText = a.querySelector('.reports-cell').textContent.toLowerCase();
                                const bText = b.querySelector('.reports-cell').textContent.toLowerCase();
                                
                                if (sortReportsAscending) {
                                    return aText.localeCompare(bText);
                                } else {
                                    return bText.localeCompare(aText);
                                }
                            });
                            
                            sortReportsAscending = !sortReportsAscending;
                            rows.forEach(row => table.appendChild(row));
                        }

                        function toggleFilter() {
                            const modal = document.getElementById('filterModal');
                            modal.classList.toggle('active');
                        }

                        function applyFilter() {
                            const checkboxes = document.querySelectorAll('.role-checkbox:checked');
                            selectedRoles = Array.from(checkboxes).map(cb => cb.value);
                            
                            const rows = document.querySelectorAll('.data-row');
                            if (selectedRoles.length === 0) {
                                rows.forEach(row => row.classList.remove('hidden'));
                            } else {
                                rows.forEach(row => {
                                    const roleName = row.querySelector('.role-name').getAttribute('data-role');
                                    if (selectedRoles.includes(roleName)) {
                                        row.classList.remove('hidden');
                                    } else {
                                        row.classList.add('hidden');
                                    }
                                });
                            }
                            
                            toggleFilter();
                        }

                        function clearFilter() {
                            const checkboxes = document.querySelectorAll('.role-checkbox');
                            checkboxes.forEach(cb => cb.checked = false);
                            selectedRoles = [];
                            
                            const rows = document.querySelectorAll('.data-row');
                            rows.forEach(row => row.classList.remove('hidden'));
                            
                            toggleFilter();
                        }
                    </script>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📊 ROLES & PERMISSIONS REPORT</h1>
                            <div class="timestamp">Generated: ${new Date().toLocaleDateString('en-US', { 
                                weekday: 'long',
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</div>
                        </div>
                        
                        <!-- Filter Modal -->
                        <div id="filterModal" class="filter-modal">
                            <div class="filter-content">
                                <h3>� Filter Roles</h3>
                                <div class="filter-options">
                                    ${reportRoles.map(role => `
                                        <div class="filter-option">
                                            <input type="checkbox" class="role-checkbox" value="${role.name.toLowerCase()}" id="role-${role.name.replace(/\s+/g, '-').toLowerCase()}">
                                            <label for="role-${role.name.replace(/\s+/g, '-').toLowerCase()}">${role.name}</label>
                                        </div>
                                    `).join('')}
                                </div>
                                <div class="filter-buttons">
                                    <button class="cancel-filter" onclick="clearFilter()">Clear All</button>
                                    <button class="apply-filter" onclick="applyFilter()">Apply Filter</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    ${headerRow1}
                                    ${headerRow2}
                                </thead>
                                <tbody>
                                    ${dataRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </body>
                </html>
            `;
        } catch (error) {
            console.error('Error generating HTML:', error);
            return '<html><body><h1>Error generating report</h1><p>' + error.message + '</p></body></html>';
        }
    };

    // Generate comprehensive CSV data - COMPARISON FORMAT
    const generateComprehensiveCSVData = () => {
        try {
            // Get all unique permission modules across all roles
            const allPermissionModules = new Set();
            roles.forEach(role => {
                if (role.permissions && Array.isArray(role.permissions)) {
                    role.permissions.forEach(perm => {
                        if (perm.page && perm.page !== '*') {
                            allPermissionModules.add(perm.page);
                        }
                    });
                }
            });
            
            const sortedModules = Array.from(allPermissionModules).sort();
            
            // Create header row with role names
            let csv = 'Permission Module,Permission Action';
            roles.forEach(role => {
                csv += `,"${role.name}"`;
            });
            csv += '\n';
            
            // Add department row
            csv += 'Department,';
            roles.forEach(role => {
                const dept = departments.find(d => (d.id || d._id) === role.department_id);
                csv += `,"${dept?.name || 'Not assigned'}"`;
            });
            csv += '\n';
            
            // Add reports to row
            csv += 'Reports To,';
            roles.forEach(role => {
                const reportingIds = role.reporting_ids || (role.reporting_id ? [role.reporting_id] : []);
                const reportingRoles = reportingIds
                    .map(rid => roles.find(r => (r.id || r._id) === rid))
                    .filter(r => r)
                    .map(r => r.name);
                csv += `,"${reportingRoles.length > 0 ? reportingRoles.join('; ') : 'Top Level'}"`;
            });
            csv += '\n\n';
            
            // Check for super admin
            csv += 'SUPER ADMIN,All Permissions';
            roles.forEach(role => {
                const isSuperAdmin = role.permissions && role.permissions.some(p => p.page === '*');
                csv += `,"${isSuperAdmin ? 'YES ✓' : 'NO'}"`;
            });
            csv += '\n\n';
            
            // For each permission module, show which roles have it
            sortedModules.forEach(module => {
                // Get all possible actions for this module
                const actionsForModule = new Set();
                roles.forEach(role => {
                    if (role.permissions && Array.isArray(role.permissions)) {
                        const modulePerm = role.permissions.find(p => p.page === module);
                        if (modulePerm && modulePerm.actions) {
                            modulePerm.actions.forEach(action => actionsForModule.add(action));
                        }
                    }
                });
                
                const sortedActions = Array.from(actionsForModule).sort();
                
                // Create rows for each action
                sortedActions.forEach((action, idx) => {
                    if (idx === 0) {
                        csv += `"${module}","${action}"`;
                    } else {
                        csv += `"","${action}"`;
                    }
                    
                    // For each role, check if they have this permission
                    roles.forEach(role => {
                        const isSuperAdmin = role.permissions && role.permissions.some(p => p.page === '*');
                        if (isSuperAdmin) {
                            csv += ',"YES ✓"';
                        } else if (role.permissions && Array.isArray(role.permissions)) {
                            const modulePerm = role.permissions.find(p => p.page === module);
                            if (modulePerm && modulePerm.actions && modulePerm.actions.includes(action)) {
                                csv += ',"YES ✓"';
                            } else {
                                csv += ',""';
                            }
                        } else {
                            csv += ',""';
                        }
                    });
                    csv += '\n';
                });
            });
            
            return csv;
        } catch (error) {
            console.error('Error generating CSV:', error);
            return '';
        }
    };

    const generatePrintableHTML = () => {
        try {
            const rolesList = roles.map(role => {
                const dept = departments.find(d => (d.id || d._id) === role.department_id);
                
                // Handle multiple reporting roles (backward compatible)
                let reportingRoleNames = 'None';
                const reportingIds = role.reporting_ids || (role.reporting_id ? [role.reporting_id] : []);
                if (reportingIds.length > 0) {
                    const reportingRolesList = reportingIds
                        .map(rid => roles.find(r => (r.id || r._id) === rid))
                        .filter(r => r)
                        .map(r => r.name);
                    reportingRoleNames = reportingRolesList.length > 0 ? reportingRolesList.join(', ') : 'None';
                }
                
                // Handle permissions properly
                let permissionList = 'None';
                if (role.permissions && Array.isArray(role.permissions)) {
                    if (role.permissions.some(p => p.page === '*' || p === '*')) {
                        permissionList = 'Super Admin - All Permissions';
                    } else {
                        const permStrings = role.permissions.map(perm => {
                            if (typeof perm === 'string') {
                                return perm;
                            } else if (typeof perm === 'object' && perm.page && perm.actions) {
                                return `${perm.page}: ${perm.actions.join(', ')}`;
                            }
                            return 'Unknown permission';
                        });
                        // Use HTML line breaks for separate lines in PDF
                        permissionList = permStrings.join('<br/>') || 'None';
                    }
                }

                return `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${role.name || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${dept?.name || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${reportingRoleNames}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${permissionList}</td>
                    </tr>
                `;
            }).join('');

            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Roles & Permissions Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1 { color: #333; text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 12px; text-align: left; }
                        td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
                        .generated-date { text-align: center; color: #666; margin-top: 20px; }
                        @media print {
                            body { margin: 0; }
                            .generated-date { page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Roles & Permissions Report</h1>
                    <table>
                        <thead>
                            <tr>
                                <th>Role Name</th>
                                <th>Department</th>
                                <th>Reporting To</th>
                                <th>Permissions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rolesList}
                        </tbody>
                    </table>
                    <div class="generated-date">
                        Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
                    </div>
                </body>
                </html>
            `;
        } catch (error) {
            console.error('Error generating printable HTML:', error);
            return '<html><body><h1>Error generating report</h1></body></html>';
        }
    };

    const generateCSVData = () => {
        try {
            const headers = ['Role Name', 'Department', 'Reporting To', 'Permissions'];
            
            const rows = roles.map(role => {
                const dept = departments.find(d => (d.id || d._id) === role.department_id);
                
                // Handle multiple reporting roles (backward compatible)
                let reportingRoleNames = 'None';
                const reportingIds = role.reporting_ids || (role.reporting_id ? [role.reporting_id] : []);
                if (reportingIds.length > 0) {
                    const reportingRolesList = reportingIds
                        .map(rid => roles.find(r => (r.id || r._id) === rid))
                        .filter(r => r)
                        .map(r => r.name);
                    reportingRoleNames = reportingRolesList.length > 0 ? reportingRolesList.join(', ') : 'None';
                }
                
                // Handle permissions properly
                let permissionList = 'None';
                if (role.permissions && Array.isArray(role.permissions)) {
                    if (role.permissions.some(p => p.page === '*' || p === '*')) {
                        permissionList = 'Super Admin - All Permissions';
                    } else {
                        const permStrings = role.permissions.map(perm => {
                            if (typeof perm === 'string') {
                                return perm;
                            } else if (typeof perm === 'object' && perm.page && perm.actions) {
                                return `${perm.page}: ${perm.actions.join(', ')}`;
                            }
                            return 'Unknown permission';
                        });
                        // Use line breaks for separate lines in CSV
                        permissionList = permStrings.join('\n') || 'None';
                    }
                }

                return [
                    role.name || 'N/A',
                    dept?.name || 'N/A',
                    reportingRoleNames,
                    permissionList
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            });

            return [headers.join(','), ...rows].join('\n');
        } catch (error) {
            console.error('Error generating CSV data:', error);
            return 'Error generating CSV data';
        }
    };

    const populateHierarchicalOptions = (items, idField = 'id', nameField = 'name', level = 0, editingId = null) => {
        const options = [];
        items.forEach(item => {
            const itemId = item[idField] || item._id;
            if (itemId === editingId) return;
            const prefix = '  '.repeat(level) + (level > 0 ? '↳ ' : '');
            options.push(
                <option key={itemId} value={itemId}>
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
        const dept = departments.find(d => (d.id || d._id) === departmentId);
        return dept ? dept.name : '-';
    };

    const getPermissionsCount = (permissions) => {
        if (!permissions || !Array.isArray(permissions)) return 0;
        return permissions.reduce((count, perm) => {
            if (perm.page === '*') {
                // Super Admin - count ALL permissions properly
                let total = 0;
                Object.values(allPermissions).forEach(actions => {
                    if (actions === '*' || (Array.isArray(actions) && actions.includes('*'))) {
                        // Skip the SuperAdmin entry itself
                        return;
                    }
                    if (typeof actions === 'object' && !Array.isArray(actions)) {
                        // Nested module (Leads CRM) - count all sub-sections
                        Object.values(actions).forEach(sectionActions => {
                            if (Array.isArray(sectionActions)) {
                                total += sectionActions.length;
                            }
                        });
                    } else if (Array.isArray(actions)) {
                        // Simple module - count actions
                        total += actions.length;
                    }
                });
                return total;
            }
            
            // For regular roles - check if this is a nested permission (Leads CRM)
            // Nested permissions are stored like "leads.create_lead" or "leads.pl_odd_leads"
            if (perm.page && perm.page.includes('.')) {
                // This is a nested permission - count the actions in it
                return count + (perm.actions?.length || 0);
            }
            
            // For simple permissions, just count the actions
            return count + (perm.actions?.length || 0);
        }, 0);
    };

    // Check if a role has super admin permissions (all permissions)
    const isSuperAdmin = (role) => {
        if (!role.permissions || !Array.isArray(role.permissions)) return false;
        return role.permissions.some(perm => perm.page === '*' || perm.page === 'SuperAdmin');
    };

    // Check if a role has subordinates
    const hasSubordinates = (roleId) => {
        return roles.some(r => {
            const reportingIds = r.reporting_ids || (r.reporting_id ? [r.reporting_id] : []);
            return reportingIds.includes(roleId);
        });
    };

    // Get all subordinates of a role recursively
    // IMPORTANT: Exclude Manager roles - they should only appear as team heads
    const getSubordinates = (roleId, visited = new Set()) => {
        if (visited.has(roleId)) return [];
        visited.add(roleId);
        
        const directSubordinates = roles.filter(r => {
            const reportingIds = r.reporting_ids || (r.reporting_id ? [r.reporting_id] : []);
            const reportsToThisRole = reportingIds.includes(roleId);
            const isManager = r.name.toLowerCase().includes('manager');
            
            // Exclude Manager roles from subordinates list
            return reportsToThisRole && !isManager;
        });
        
        const allSubordinates = [...directSubordinates];
        directSubordinates.forEach(sub => {
            allSubordinates.push(...getSubordinates(sub.id || sub._id, visited));
        });
        
        return allSubordinates;
    };

    // Smart role grouping logic - Only create sections for roles WITH subordinates
    const organizeRolesHierarchy = () => {
        const organized = {
            superAdminRoles: [],
            teamGroups: [],
            standaloneRoles: []
        };
        
        // First, identify super admin roles (those with * permissions)
        organized.superAdminRoles = roles.filter(role => isSuperAdmin(role));
        
        // Get roles that are NOT super admin
        const nonSuperAdminRoles = roles.filter(role => !isSuperAdmin(role));
        
        // Find ALL roles that have subordinates (Manager or not) - they get their own section
        const rolesWithSubordinates = nonSuperAdminRoles.filter(role => {
            const roleId = role.id || role._id;
            return hasSubordinates(roleId);
        });
        
        // Create team groups ONLY for roles with subordinates
        rolesWithSubordinates.forEach(head => {
            const headId = head.id || head._id;
            organized.teamGroups.push({
                head: head,
                members: getSubordinates(headId)
            });
        });
        
        // Get all subordinates from all team groups to exclude them
        const allSubordinateIds = new Set();
        organized.teamGroups.forEach(team => {
            team.members.forEach(member => {
                allSubordinateIds.add(member.id || member._id);
            });
        });
        
        // Standalone roles = roles that:
        // 1. Are not super admin
        // 2. Don't have subordinates (not a team head)
        // 3. Are not subordinates of anyone else
        organized.standaloneRoles = nonSuperAdminRoles.filter(role => {
            const roleId = role.id || role._id;
            const hasSubordinatesFlag = hasSubordinates(roleId);
            const isSubordinate = allSubordinateIds.has(roleId);
            
            return !hasSubordinatesFlag && !isSubordinate;
        });
        
        // Sort team groups: Managers first, then others alphabetically
        organized.teamGroups.sort((a, b) => {
            const aIsManager = a.head.name.toLowerCase().includes('manager');
            const bIsManager = b.head.name.toLowerCase().includes('manager');
            
            if (aIsManager && !bIsManager) return -1;
            if (!aIsManager && bIsManager) return 1;
            return a.head.name.localeCompare(b.head.name);
        });
        
        return organized;
    };

    // Render the new hierarchical structure
    const renderHierarchicalRoles = () => {
        const rows = [];
        const hierarchy = organizeRolesHierarchy();
        
        // 1. Render Super Admin roles first
        hierarchy.superAdminRoles.forEach(role => {
            rows.push(renderRoleRow(role, 0, true));
        });
        
        // 2. Render standalone roles under super admin
        hierarchy.standaloneRoles.forEach(role => {
            rows.push(renderRoleRow(role, 1, false));
        });
        
        // 3. Render team groups with separation
        hierarchy.teamGroups.forEach((team, idx) => {
            // Add visual separation line before each team
            if (idx > 0 || hierarchy.standaloneRoles.length > 0) {
                rows.push(
                    <tr key={`separator-${team.head.id || team.head._id}`} style={{
                        height: '2px',
                        background: '#000000'
                    }}>
                        <td colSpan="5" style={{ 
                            padding: 0,
                            borderTop: '2px solid #ffffff',
                            borderBottom: 'none'
                        }}></td>
                    </tr>
                );
            }
            
            // Render team head (Manager/Leader)
            rows.push(renderRoleRow(team.head, 0, true));
            
            // Render team members
            team.members.forEach(member => {
                rows.push(renderRoleRow(member, 1, false));
            });
        });
        
        return rows;
    };

    // Render a single role row
    const renderRoleRow = (role, indentLevel, isHead) => {
        const roleId = role.id || role._id;
        const hasDirectReports = hasSubordinates(roleId);
        
        // Get reporting role names
        const reportingIds = role.reporting_ids || (role.reporting_id ? [role.reporting_id] : []);
        const reportingRoleNames = reportingIds
            .map(rid => {
                const reportingRole = roles.find(r => (r.id || r._id) === rid);
                return reportingRole ? reportingRole.name : null;
            })
            .filter(name => name);
        
        const isTopLevel = reportingRoleNames.length === 0 || isSuperAdmin(role);
        
        return (
            <tr 
                key={roleId}
                style={{
                    background: isHead ? '#0a0a0a' : '#000000',
                    borderLeft: isHead ? '6px solid #ffffff' : 'none',
                    borderBottom: '1px solid #222222',
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#0a0a0a'}
                onMouseLeave={(e) => e.currentTarget.style.background = isHead ? '#0a0a0a' : '#000000'}
            >
                {/* Role Name */}
                <td style={{ 
                    padding: isHead ? '20px 15px' : '16px 15px', 
                    paddingLeft: indentLevel > 0 ? `${15 + (indentLevel * 50)}px` : '15px',
                    borderRight: '1px solid #1a1a1a'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: isHead ? '12px' : '10px',
                            height: isHead ? '12px' : '10px',
                            background: '#ffffff',
                            borderRadius: '50%'
                        }}></div>
                        <span style={{
                            color: '#ffffff',
                            fontWeight: isHead ? '700' : '500',
                            fontSize: isHead ? '1.05rem' : '0.95rem'
                        }}>
                            {role.name}
                        </span>
                    </div>
                </td>
                
                {/* Department */}
                <td style={{ padding: '16px 15px', borderRight: '1px solid #1a1a1a' }}>
                    {role.department_id ? (
                        <span style={{
                            display: 'inline-block',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            background: '#000000',
                            color: '#ffffff',
                            border: '2px solid #555555'
                        }}>
                            {getDepartmentName(role.department_id)}
                        </span>
                    ) : (
                        <span style={{ color: '#666666' }}>-</span>
                    )}
                </td>
                
                {/* Reports To */}
                <td style={{ padding: '16px 15px', borderRight: '1px solid #1a1a1a' }}>
                    {isTopLevel ? (
                        <span style={{ color: '#666666', fontSize: '0.85rem' }}>Top Level</span>
                    ) : reportingRoleNames.length > 0 ? (
                        reportingRoleNames.length > 1 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                    <span style={{ color: '#ffffff', fontWeight: '500' }}>{reportingRoleNames[0]}</span>
                                </div>
                                {reportingRoleNames.slice(1).map((name, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cccccc' }}>
                                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                        </svg>
                                        <span>{name}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#888888' }}>(Secondary)</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                </svg>
                                <span style={{ color: '#ffffff', fontWeight: '500' }}>{reportingRoleNames[0]}</span>
                            </div>
                        )
                    ) : (
                        <span style={{ color: '#666666' }}>-</span>
                    )}
                </td>
                
                {/* Permissions */}
                <td style={{ padding: '16px 15px', borderRight: '1px solid #1a1a1a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span style={{ color: '#ffffff', fontWeight: '500' }}>
                            {getPermissionsCount(role.permissions)}
                        </span>
                    </div>
                </td>
                
                {/* Actions */}
                <td style={{ padding: '16px 15px' }}>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button
                            onClick={() => openModal(role)}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                border: '2px solid #ffffff',
                                background: '#000000',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.color = '#000000';
                                e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#000000';
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title="Edit"
                        >
                            <Edit className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => showDeleteConfirmation(role)}
                            disabled={hasDirectReports}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                border: hasDirectReports ? '2px solid #333333' : '2px solid #666666',
                                background: '#000000',
                                cursor: hasDirectReports ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: hasDirectReports ? '#333333' : '#666666',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (!hasDirectReports) {
                                    e.currentTarget.style.background = '#ffffff';
                                    e.currentTarget.style.borderColor = '#ffffff';
                                    e.currentTarget.style.color = '#000000';
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!hasDirectReports) {
                                    e.currentTarget.style.background = '#000000';
                                    e.currentTarget.style.borderColor = '#666666';
                                    e.currentTarget.style.color = '#666666';
                                    e.currentTarget.style.transform = 'scale(1)';
                                }
                            }}
                            title={hasDirectReports ? 'Cannot delete - has direct reports' : 'Delete'}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    // Group roles by team name for team-based UI (LEGACY - keeping for backward compatibility)
    const groupRolesByTeam = (rolesList) => {
        const teams = {};
        
        rolesList.forEach(role => {
            // Extract team name from role name (e.g., "Team Winners Manager" -> "Team Winners")
            const teamMatch = role.name.match(/^(Team\s+\w+)/i);
            const teamName = teamMatch ? teamMatch[1] : 'Other';
            
            if (!teams[teamName]) {
                teams[teamName] = {
                    name: teamName,
                    roles: []
                };
            }
            teams[teamName].roles.push(role);
        });
        
        // Sort roles within each team: Manager first, then Leader, then Consultant
        Object.values(teams).forEach(team => {
            team.roles.sort((a, b) => {
                const getTypeOrder = (name) => {
                    if (name.includes('Manager')) return 1;
                    if (name.includes('Leader')) return 2;
                    if (name.includes('Consultant')) return 3;
                    return 4;
                };
                return getTypeOrder(a.name) - getTypeOrder(b.name);
            });
        });
        
        return teams;
    };

    // Team-based grouped rendering function
    const renderTeamGroupedRoles = () => {
        const rows = [];
        const teams = groupRolesByTeam(roles);
        
        Object.values(teams).forEach((team) => {
            // Team Header Row
            const teamInitial = team.name.split(' ').map(word => word[0]).join('').toUpperCase();
            rows.push(
                <tr key={`team-header-${team.name}`} style={{
                    background: '#000000',
                    borderTop: '4px solid #ffffff',
                    borderBottom: '4px solid #ffffff'
                }}>
                    <td colSpan="5" style={{ padding: '24px 15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: '#ffffff',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '900',
                                fontSize: '1.2rem',
                                color: '#000000'
                            }}>
                                {teamInitial}
                            </div>
                            <span style={{
                                fontWeight: '800',
                                fontSize: '1.2rem',
                                letterSpacing: '2px',
                                color: '#ffffff'
                            }}>
                                {team.name.toUpperCase()}
                            </span>
                        </div>
                    </td>
                </tr>
            );
            
            // Render roles in this team
            team.roles.forEach((role) => {
                const isManager = role.name.includes('Manager');
                const isLeader = role.name.includes('Leader');
                const hasDirectReports = roles.some(r => {
                    const reportingIds = r.reporting_ids || (r.reporting_id ? [r.reporting_id] : []);
                    return reportingIds.includes(role.id || role._id);
                });
                
                // Get reporting role names
                const reportingIds = role.reporting_ids || (role.reporting_id ? [role.reporting_id] : []);
                const reportingRoleNames = reportingIds
                    .map(rid => {
                        const reportingRole = roles.find(r => (r.id || r._id) === rid);
                        return reportingRole ? reportingRole.name : null;
                    })
                    .filter(name => name);
                
                const isTopLevel = reportingRoleNames.length === 0;
                
                rows.push(
                    <tr 
                        key={role.id || role._id}
                        className={isManager ? 'manager-row' : 'subordinate-row'}
                        style={{
                            background: isManager ? '#0a0a0a' : '#000000',
                            borderLeft: isManager ? '6px solid #ffffff' : 'none',
                            borderBottom: '1px solid #222222',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#0a0a0a'}
                        onMouseLeave={(e) => e.currentTarget.style.background = isManager ? '#0a0a0a' : '#000000'}
                    >
                        {/* Role Name */}
                        <td style={{ padding: isManager ? '20px 15px' : '16px 15px', paddingLeft: isManager ? '15px' : '50px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: isManager ? '12px' : '10px',
                                    height: isManager ? '12px' : '10px',
                                    background: '#ffffff',
                                    borderRadius: '50%'
                                }}></div>
                                <span style={{
                                    color: '#ffffff',
                                    fontWeight: isManager ? '700' : '500',
                                    fontSize: isManager ? '1.05rem' : '0.95rem'
                                }}>
                                    {role.name}
                                </span>
                            </div>
                        </td>
                        
                        {/* Department */}
                        <td style={{ padding: '16px 15px' }}>
                            {role.department_id ? (
                                <span style={{
                                    display: 'inline-block',
                                    padding: '6px 14px',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    background: '#000000',
                                    color: '#ffffff',
                                    border: '2px solid #555555'
                                }}>
                                    {getDepartmentName(role.department_id)}
                                </span>
                            ) : (
                                <span style={{ color: '#666666' }}>-</span>
                            )}
                        </td>
                        
                        {/* Reports To */}
                        <td style={{ padding: '16px 15px' }}>
                            {isTopLevel ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                    <span style={{ color: '#ffffff', fontWeight: '500' }}>Super Admin</span>
                                </div>
                            ) : reportingRoleNames.length > 0 ? (
                                reportingRoleNames.length > 1 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                            </svg>
                                            <span style={{ color: '#ffffff', fontWeight: '500' }}>{reportingRoleNames[0]}</span>
                                        </div>
                                        {reportingRoleNames.slice(1).map((name, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cccccc' }}>
                                                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                                </svg>
                                                <span>{name}</span>
                                                <span style={{ fontSize: '0.75rem', color: '#888888' }}>(Secondary)</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                        </svg>
                                        <span style={{ color: '#ffffff', fontWeight: '500' }}>{reportingRoleNames[0]}</span>
                                    </div>
                                )
                            ) : (
                                <span style={{ color: '#666666' }}>-</span>
                            )}
                        </td>
                        
                        {/* Permissions */}
                        <td style={{ padding: '16px 15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span style={{ color: '#ffffff', fontWeight: '500' }}>
                                    {getPermissionsCount(role.permissions)}
                                </span>
                            </div>
                        </td>
                        
                        {/* Actions */}
                        <td style={{ padding: '16px 15px' }}>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => openModal(role)}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '6px',
                                        border: '2px solid #ffffff',
                                        background: '#000000',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#ffffff';
                                        e.currentTarget.style.color = '#000000';
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#000000';
                                        e.currentTarget.style.color = '#ffffff';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                    title="Edit"
                                >
                                    <Edit className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => showDeleteConfirmation(role)}
                                    disabled={hasDirectReports}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '6px',
                                        border: hasDirectReports ? '2px solid #333333' : '2px solid #666666',
                                        background: '#000000',
                                        cursor: hasDirectReports ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: hasDirectReports ? '#333333' : '#666666',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!hasDirectReports) {
                                            e.currentTarget.style.background = '#ffffff';
                                            e.currentTarget.style.borderColor = '#ffffff';
                                            e.currentTarget.style.color = '#000000';
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!hasDirectReports) {
                                            e.currentTarget.style.background = '#000000';
                                            e.currentTarget.style.borderColor = '#666666';
                                            e.currentTarget.style.color = '#666666';
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }
                                    }}
                                    title={hasDirectReports ? 'Cannot delete - has direct reports' : 'Delete'}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </td>
                    </tr>
                );
            });
        });
        
        return rows;
    };

    const renderRoleTableRows = (nodes, level = 0, parentName = null) => {
        const rows = [];
        
        nodes.forEach((node, index) => {
            // Check if has direct reports
            const hasDirectReports = roles.some(r => {
                const reportingIds = r.reporting_ids || (r.reporting_id ? [r.reporting_id] : []);
                return reportingIds.includes(node.id || node._id);
            });
            
            // Get reporting role names (support multiple)
            const reportingIds = node.reporting_ids || (node.reporting_id ? [node.reporting_id] : []);
            const reportingRoleNames = reportingIds
                .map(rid => {
                    const reportingRole = roles.find(r => (r.id || r._id) === rid);
                    return reportingRole ? reportingRole.name : null;
                })
                .filter(name => name);
            
            const hasMultipleManagers = reportingRoleNames.length > 1;
            const isTopLevel = reportingRoleNames.length === 0;
            const hasChildren = node.children && node.children.length > 0;
            
            // Add section header for top-level roles (managers)
            if (isTopLevel && level === 0) {
                rows.push(
                    <tr key={`header-${node.id || node._id}`} className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-t-2 border-indigo-500/50">
                        <td colSpan="5" className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/30 border-2 border-indigo-400">
                                    <Users className="h-5 w-5 text-indigo-300" />
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-lg font-bold text-white">{node.name}</span>
                                        <span className="bg-yellow-500/20 text-yellow-300 text-xs font-semibold px-3 py-1 rounded-full border border-yellow-500/50">
                                            ⭐ TOP LEVEL
                                        </span>
                                        {hasChildren && (
                                            <span className="bg-indigo-500/30 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full">
                                                {node.children.length} {node.children.length === 1 ? 'Report' : 'Reports'}
                                            </span>
                                        )}
                                    </div>
                                    {node.department_id && (
                                        <div className="mt-1 flex items-center space-x-2">
                                            <span className="text-xs text-gray-400">Department:</span>
                                            <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-xs">
                                                {getDepartmentName(node.department_id)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1"></div>
                                <div className="flex items-center space-x-4">
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400">Permissions</div>
                                        <div className="text-sm font-semibold text-white">
                                            {getPermissionsCount(node.permissions)} permissions
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => openModal(node)}
                                            className="bg-gray-700/50 hover:bg-gray-600 text-white p-2 rounded-lg transition-all hover:scale-105"
                                            title="Edit role"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => showDeleteConfirmation(node)}
                                            disabled={hasDirectReports}
                                            className={`p-2 rounded-lg transition-all ${
                                                hasDirectReports 
                                                    ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed opacity-50' 
                                                    : 'bg-gray-700/50 hover:bg-red-600 text-white hover:scale-105'
                                            }`}
                                            title={hasDirectReports ? 'Cannot delete - has direct reports' : 'Delete role'}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                );
            }
            
            // Regular row for non-top-level roles
            if (!isTopLevel || level > 0) {
                rows.push(
                    <tr 
                        key={node.id || node._id}
                        className={`transition-colors duration-200 border-b border-white/5 ${
                            level === 1 
                                ? 'bg-gray-800/60 hover:bg-gray-700/70' 
                                : level === 2
                                ? 'bg-gray-800/40 hover:bg-gray-700/50'
                                : 'bg-gray-800/20 hover:bg-gray-700/30'
                        }`}
                    >
                        {/* Role Name */}
                        <td className="px-6 py-4">
                            <div className="flex items-center">
                                {/* Hierarchy connector */}
                                {level > 0 && (
                                    <div className="flex items-center mr-2">
                                        <div className="flex flex-col items-center" style={{ width: `${(level - 1) * 24}px` }}>
                                            {level > 1 && (
                                                <span className="text-gray-600">│</span>
                                            )}
                                        </div>
                                        <span className="text-indigo-400 text-lg mr-2">
                                            {index === node.parent?.children?.length - 1 ? '└' : '├'}─
                                        </span>
                                    </div>
                                )}
                                
                                {/* Role Icon and Name */}
                                <div className="flex items-center space-x-3">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                                        level === 1 
                                            ? 'bg-blue-500/20 border border-blue-400/50' 
                                            : 'bg-gray-600/30 border border-gray-500/50'
                                    }`}>
                                        <Users className={`h-4 w-4 ${level === 1 ? 'text-blue-300' : 'text-gray-400'}`} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-medium ${level === 1 ? 'text-white text-base' : 'text-gray-200 text-sm'}`}>
                                                {node.name}
                                            </span>
                                            {hasChildren && (
                                                <span className="bg-gray-700 text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                                                    +{node.children.length}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                        
                        {/* Department */}
                        <td className="px-6 py-4">
                            {node.department_id ? (
                                <span className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-md text-xs inline-block">
                                    {getDepartmentName(node.department_id)}
                                </span>
                            ) : (
                                <span className="text-gray-500 text-xs">-</span>
                            )}
                        </td>
                        
                        {/* Reports To */}
                        <td className="px-6 py-4">
                            {reportingRoleNames.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    {reportingRoleNames.map((name, idx) => (
                                        <div key={idx} className="flex items-center space-x-2">
                                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                            </svg>
                                            <span className={`font-medium text-sm ${
                                                hasMultipleManagers && idx > 0
                                                    ? 'text-orange-300'
                                                    : 'text-green-300'
                                            }`}>
                                                {name}
                                            </span>
                                            {hasMultipleManagers && idx > 0 && (
                                                <span className="text-xs text-orange-400">(Secondary)</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-gray-500 text-xs">-</span>
                            )}
                        </td>
                        
                        {/* Permissions */}
                        <td className="px-6 py-4">
                            <span className="text-gray-300 text-sm">
                                {getPermissionsCount(node.permissions) > 0 ? (
                                    <span className="flex items-center space-x-2">
                                        <Shield className="h-4 w-4 text-indigo-400" />
                                        <span>{getPermissionsCount(node.permissions)}</span>
                                    </span>
                                ) : (
                                    <span className="text-gray-500 text-xs">None</span>
                                )}
                            </span>
                        </td>
                        
                        {/* Actions */}
                        <td className="px-6 py-4">
                            <div className="flex items-center justify-center space-x-2">
                                <button
                                    onClick={() => openModal(node)}
                                    className="text-gray-400 hover:text-white hover:bg-gray-700 p-2 rounded-lg transition-all"
                                    title="Edit role"
                                >
                                    <Edit className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => showDeleteConfirmation(node)}
                                    disabled={hasDirectReports}
                                    className={`p-2 rounded-lg transition-all ${
                                        hasDirectReports 
                                            ? 'text-gray-600 cursor-not-allowed opacity-50' 
                                            : 'text-gray-400 hover:text-red-400 hover:bg-gray-700'
                                    }`}
                                    title={hasDirectReports ? 'Cannot delete - has direct reports' : 'Delete role'}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </td>
                    </tr>
                );
            }
            
            // Always show children rows recursively
            if (hasChildren) {
                rows.push(...renderRoleTableRows(node.children, level + 1, node.name));
            }
        });
        
        return rows;
    };

    const renderRoleTree = (nodes, isChild = false) => {
        return nodes.map(node => {
            // Check both old and new format for direct reports
            const hasDirectReports = roles.some(r => {
                const reportingIds = r.reporting_ids || (r.reporting_id ? [r.reporting_id] : []);
                return reportingIds.includes(node.id || node._id);
            });
            
            // Get reporting role names (support multiple)
            const reportingIds = node.reporting_ids || (node.reporting_id ? [node.reporting_id] : []);
            const reportingRoleNames = reportingIds
                .map(rid => {
                    const reportingRole = roles.find(r => (r.id || r._id) === rid);
                    return reportingRole ? reportingRole.name : null;
                })
                .filter(name => name);
            
            // Check if this role has multiple reporting relationships
            const hasMultipleManagers = reportingRoleNames.length > 1;
            
            return (
                <div key={node.id || node._id} className={`tree-item my-2 ${isChild ? 'child-item' : ''}`}>
                    <div className="item-content bg-gray-900/50 hover:bg-gray-800/70 transition-colors duration-200 rounded-lg p-4 grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-2 flex items-center">
                            <span 
                                className={`toggle-icon cursor-pointer user-select-none inline-flex items-center justify-center w-6 h-6 text-gray-400 transition-transform duration-300 ${
                                    node.children && node.children.length > 0 ? 'hover:text-gray-200' : 'invisible'
                                } ${collapsedNodes.has(node.id || node._id) ? 'rotate-[-90deg]' : ''}`}
                                onClick={() => node.children && node.children.length > 0 && toggleCollapse(node.id || node._id)}
                            >
                                <ChevronDown className="h-4 w-4" />
                            </span>
                            <Users className="h-5 w-5 text-indigo-400 ml-2 mr-3" />
                            <span className="font-medium text-white">{node.name}</span>
                            {node.children && node.children.length > 0 && (
                                <span className="ml-2 bg-gray-700 text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                                    {node.children.length}
                                </span>
                            )}
                            {hasDirectReports && (
                                <span className="ml-2 bg-amber-500/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-500/30" title="Has direct reports - cannot be deleted">
                                    Manager
                                </span>
                            )}
                        </div>
                        <div className="col-span-2 text-sm">
                            {node.department_id ? (
                                <span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md text-xs">
                                    {getDepartmentName(node.department_id)}
                                </span>
                            ) : (
                                <span className="text-gray-400">-</span>
                            )}
                        </div>
                        <div className="col-span-3 text-sm">
                            {reportingRoleNames.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {reportingRoleNames.map((name, idx) => (
                                        <span 
                                            key={idx}
                                            className={`px-2 py-1 rounded-md text-xs border inline-flex items-center ${
                                                hasMultipleManagers && idx > 0
                                                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                                                    : 'bg-green-500/20 text-green-300 border-green-500/30'
                                            }`}
                                            title={idx === 0 ? 'Primary reporting' : 'Additional reporting'}
                                        >
                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                            </svg>
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-yellow-500 font-semibold text-xs flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                    Top Level
                                </span>
                            )}
                        </div>
                        <div className="col-span-3 text-sm text-gray-400">
                            {getPermissionsCount(node.permissions) > 0 ? 
                                `${getPermissionsCount(node.permissions)} permissions` : 
                                'No permissions'
                            }
                        </div>
                        <div className="col-span-2 flex items-center justify-end space-x-3">
                            <Edit 
                                className="h-5 w-5 text-gray-400 hover:text-white hover:scale-110 transition-all cursor-pointer"
                                onClick={() => openModal(node)}
                            />
                            <Trash2 
                                className={`h-5 w-5 transition-all cursor-pointer ${
                                    hasDirectReports 
                                        ? 'text-gray-600 cursor-not-allowed opacity-50' 
                                        : 'text-gray-400 hover:text-red-400 hover:scale-110'
                                }`}
                                onClick={() => showDeleteConfirmation(node)}
                                title={hasDirectReports ? 'Cannot delete - has direct reports' : 'Delete role'}
                            />
                        </div>
                    </div>
                    {node.children && node.children.length > 0 && (
                        <div 
                            className={`children-container ml-7 pl-6 border-l-2 border-indigo-500/50 transition-all duration-400 bg-white/[0.02] rounded-lg mt-2 ${
                                collapsedNodes.has(node.id || node._id) 
                                    ? 'max-h-0 opacity-0 mt-0 pt-0 pb-0 overflow-hidden' 
                                    : 'max-h-none opacity-100 pt-2 pb-4'
                            }`}
                        >
                            {renderRoleTree(node.children, true)}
                        </div>
                    )}
                </div>
            );
        });
    };

    const treeData = buildTree(roles);

    const totalPermissions = Object.values(allPermissions).flat().length;
    const selectedPermissions = Object.values(formData.permissions).flat().length;
    const allSelected = selectedPermissions === totalPermissions;
    const someSelected = selectedPermissions > 0 && selectedPermissions < totalPermissions;

    return (
        <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            background: '#000000',
            border: '1px solid #333333',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '2rem',
            color: '#ffffff',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                marginBottom: '2rem'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    {/* Export Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                            onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Download Report button clicked!');
                                try {
                                    await exportToHTML();
                                } catch (err) {
                                    console.error('Button click error:', err);
                                    message.error('Error: ' + err.message);
                                }
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: '#ffffff',
                                fontWeight: '700',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                            }}
                            title="Download comprehensive interactive HTML report - Opens in new tab with all permissions and fixed columns"
                            type="button"
                        >
                            <Download className="h-5 w-5" />
                            <span>📊 Download Report</span>
                        </button>
                    </div>
                    
                    {/* Add Role Button */}
                    <button 
                        onClick={() => openModal()}
                        style={{
                            background: '#ffffff',
                            color: '#000000',
                            fontWeight: '600',
                            padding: '0.625rem 1.5rem',
                            borderRadius: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.background = '#f0f0f0';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.background = '#ffffff';
                        }}
                    >
                        <Plus className="h-5 w-5" />
                        <span>Add New Role</span>
                    </button>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-blue-400 text-sm font-medium">Total Roles</div>
                            <div className="text-2xl font-bold text-white mt-1">{roles.length}</div>
                        </div>
                        <div className="bg-blue-500/20 p-3 rounded-lg">
                            <Users className="h-6 w-6 text-blue-400" />
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-purple-400 text-sm font-medium">Top Level Roles</div>
                            <div className="text-2xl font-bold text-white mt-1">
                                {roles.filter(r => !r.reporting_id && (!r.reporting_ids || r.reporting_ids.length === 0)).length}
                            </div>
                        </div>
                        <div className="bg-purple-500/20 p-3 rounded-lg">
                            <Shield className="h-6 w-6 text-purple-400" />
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-green-400 text-sm font-medium">Departments</div>
                            <div className="text-2xl font-bold text-white mt-1">{departments.length}</div>
                        </div>
                        <div className="bg-green-500/20 p-3 rounded-lg">
                            <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Role Table */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
            ) : (
                <div style={{
                    position: 'relative',
                    border: '2px solid #ffffff',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#000000',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', fontSize: '0.95rem', borderCollapse: 'collapse' }}>
                            <thead style={{
                                background: '#000000',
                                borderBottom: '3px solid #ffffff',
                                position: 'sticky',
                                top: 0,
                                zIndex: 10
                            }}>
                                <tr>
                                    <th scope="col" style={{
                                        padding: '18px 15px',
                                        textAlign: 'left',
                                        fontWeight: '700',
                                        fontSize: '0.95rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        color: '#ffffff',
                                        borderRight: '1px solid #333333',
                                        width: '30%'
                                    }}>
                                        ROLE NAME
                                    </th>
                                    <th scope="col" style={{
                                        padding: '18px 15px',
                                        textAlign: 'left',
                                        fontWeight: '700',
                                        fontSize: '0.95rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        color: '#ffffff',
                                        borderRight: '1px solid #333333',
                                        width: '20%'
                                    }}>
                                        DEPARTMENT
                                    </th>
                                    <th scope="col" style={{
                                        padding: '18px 15px',
                                        textAlign: 'left',
                                        fontWeight: '700',
                                        fontSize: '0.95rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        color: '#ffffff',
                                        borderRight: '1px solid #333333',
                                        width: '25%'
                                    }}>
                                        REPORTS TO
                                    </th>
                                    <th scope="col" style={{
                                        padding: '18px 15px',
                                        textAlign: 'left',
                                        fontWeight: '700',
                                        fontSize: '0.95rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        color: '#ffffff',
                                        borderRight: '1px solid #333333',
                                        width: '12%'
                                    }}>
                                        PERMISSIONS
                                    </th>
                                    <th scope="col" style={{
                                        padding: '18px 15px',
                                        textAlign: 'left',
                                        fontWeight: '700',
                                        fontSize: '0.95rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        color: '#ffffff',
                                        width: '13%'
                                    }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderHierarchicalRoles()}
                            </tbody>
                        </table>
                    </div>
                    {roles && roles.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '4rem 0',
                            color: '#999999'
                        }}>
                            <div style={{
                                background: '#1a1a1a',
                                borderRadius: '50%',
                                width: '80px',
                                height: '80px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem',
                                border: '2px solid #333333'
                            }}>
                                <Users className="h-10 w-10" style={{ opacity: 0.5, color: '#666666' }} />
                            </div>
                            <p style={{
                                fontSize: '1.125rem',
                                fontWeight: '500',
                                marginBottom: '0.5rem',
                                color: '#cccccc'
                            }}>
                                No roles found
                            </p>
                            <p style={{
                                fontSize: '0.875rem',
                                color: '#666666'
                            }}>
                                Click "Add New Role" to create your first role
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Role Form Modal */}
            {isModalVisible && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-white/10 p-8 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold text-white mb-6">
                            {editingRole ? 'Edit Role' : 'Add Role'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Role Name</label>
                                    <input 
                                        type="text" 
                                        required 
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        placeholder="Enter role name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Department</label>
                                    <div className="relative department-dropdown-container">
                                        {/* Department Dropdown Button */}
                                        <button
                                            type="button"
                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center"
                                            onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                                        >
                                            <span className="text-left">
                                                {(() => {
                                                    if (formData.department_id === null) {
                                                        return "No Department";
                                                    }
                                                    const selectedDept = departments.find(dept => 
                                                        dept._id === formData.department_id || 
                                                        dept.id === formData.department_id
                                                    );
                                                    return selectedDept ? selectedDept.name : "Select Department";
                                                })()}
                                            </span>
                                            <svg
                                                className={`w-5 h-5 transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {/* Department Dropdown Menu */}
                                        {showDepartmentDropdown && (
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
                                                            value={departmentSearch}
                                                            onChange={(e) => setDepartmentSearch(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Options List */}
                                                <div className="overflow-y-auto max-h-60">
                                                    {/* No Department Option */}
                                                    <div
                                                        className={`px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                                                            formData.department_id === null 
                                                                ? 'bg-yellow-200 text-black font-medium' 
                                                                : 'text-gray-800 hover:bg-blue-50'
                                                        }`}
                                                        onClick={() => {
                                                            setFormData({...formData, department_id: null});
                                                            setShowDepartmentDropdown(false);
                                                            setDepartmentSearch('');
                                                            setExpandedDepartments(new Set());
                                                        }}
                                                    >
                                                        <div className="flex items-center">
                                                            <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                            </svg>
                                                            No Department
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">No department assignment</div>
                                                    </div>

                                                    {/* Department Tree */}
                                                    {buildDepartmentTree().map(dept => renderDepartmentTreeItem(dept))}

                                                    {/* No Results Message */}
                                                    {buildDepartmentTree().length === 0 && (
                                                        <div className="px-4 py-6 text-center text-gray-500">
                                                            <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                            </svg>
                                                            <div className="font-medium text-gray-600">
                                                                {departments.length === 0 
                                                                    ? 'No departments created yet' 
                                                                    : departmentSearch 
                                                                        ? `No departments found matching "${departmentSearch}"` 
                                                                        : 'No departments available'
                                                                }
                                                            </div>
                                                            {departments.length === 0 ? (
                                                                <div className="text-xs mt-2 text-gray-400">
                                                                    Create your first department to organize roles
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs mt-2 text-gray-400">
                                                                    Total departments: {departments.length} | Available: {buildDepartmentTree().length}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Multiple Reporting Roles Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Reporting Roles</label>
                                <div className="space-y-2">
                                    {/* Display selected reporting roles */}
                                    {(formData.reporting_ids || []).map((reportingId, index) => {
                                        const selectedRole = roles.find(r => (r._id || r.id) === reportingId);
                                        return (
                                            <div key={index} className="flex items-center gap-2">
                                                <div className="flex-1 relative reporting-role-dropdown">
                                                    {/* Custom Searchable Dropdown */}
                                                    <div className="relative">
                                                        {/* Dropdown Button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (openDropdownIndex === index) {
                                                                    setOpenDropdownIndex(null);
                                                                    setDropdownSearchTerms({...dropdownSearchTerms, [index]: ''});
                                                                } else {
                                                                    setOpenDropdownIndex(index);
                                                                    setDropdownSearchTerms({...dropdownSearchTerms, [index]: ''});
                                                                }
                                                            }}
                                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                                                        >
                                                            <span>{selectedRole?.name || 'Select Reporting Role'}</span>
                                                            <ChevronDown className={`h-4 w-4 transition-transform ${openDropdownIndex === index ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {/* Dropdown Menu */}
                                                        {openDropdownIndex === index && (
                                                            <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
                                                                {/* Search Input */}
                                                                <div className="p-2 border-b border-gray-600 sticky top-0 bg-gray-800">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="🔍 Search roles..."
                                                                        value={dropdownSearchTerms[index] || ''}
                                                                        onChange={(e) => {
                                                                            setDropdownSearchTerms({...dropdownSearchTerms, [index]: e.target.value});
                                                                        }}
                                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        autoFocus
                                                                    />
                                                                </div>

                                                                {/* Options List */}
                                                                <div className="overflow-y-auto max-h-64">
                                                                    {(() => {
                                                                        // Filter roles
                                                                        const filteredRoles = roles.filter(r => {
                                                                            const roleId = r._id || r.id;
                                                                            const editingId = editingRole?._id || editingRole?.id;
                                                                            // Don't show current role being edited or already selected roles
                                                                            return roleId !== editingId && 
                                                                                   (!(formData.reporting_ids || []).includes(roleId) || roleId === reportingId);
                                                                        });

                                                                        // Separate Super Admin from other roles
                                                                        const superAdminRole = filteredRoles.find(r => 
                                                                            r.name.toLowerCase().includes('super admin') || 
                                                                            r.name.toLowerCase() === 'super admin'
                                                                        );
                                                                        
                                                                        const otherRoles = filteredRoles.filter(r => 
                                                                            !(r.name.toLowerCase().includes('super admin') || 
                                                                              r.name.toLowerCase() === 'super admin')
                                                                        );

                                                                        // Sort other roles alphabetically
                                                                        otherRoles.sort((a, b) => a.name.localeCompare(b.name));

                                                                        // Combine: Super Admin first, then sorted others
                                                                        const sortedRoles = superAdminRole 
                                                                            ? [superAdminRole, ...otherRoles] 
                                                                            : otherRoles;

                                                                        // Apply search filter
                                                                        const searchTerm = dropdownSearchTerms[index] || '';
                                                                        const finalRoles = searchTerm
                                                                            ? sortedRoles.filter(r => 
                                                                                r.name.toLowerCase().includes(searchTerm.toLowerCase())
                                                                              )
                                                                            : sortedRoles;

                                                                        if (finalRoles.length === 0) {
                                                                            return (
                                                                                <div className="px-4 py-3 text-gray-400 text-sm text-center">
                                                                                    No roles found
                                                                                </div>
                                                                            );
                                                                        }

                                                                        return finalRoles.map((role) => {
                                                                            const roleId = role._id || role.id;
                                                                            const isSuperAdmin = role.name.toLowerCase().includes('super admin') || 
                                                                                               role.name.toLowerCase() === 'super admin';
                                                                            const isSelected = roleId === reportingId;
                                                                            
                                                                            return (
                                                                                <button
                                                                                    key={roleId}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const newReportingIds = [...(formData.reporting_ids || [])];
                                                                                        newReportingIds[index] = roleId;
                                                                                        setFormData({ ...formData, reporting_ids: newReportingIds });
                                                                                        setOpenDropdownIndex(null);
                                                                                        setDropdownSearchTerms({...dropdownSearchTerms, [index]: ''});
                                                                                    }}
                                                                                    className={`w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors flex items-center ${
                                                                                        isSelected ? 'bg-blue-600 text-white' : 'text-gray-200'
                                                                                    } ${isSuperAdmin ? 'font-semibold' : ''}`}
                                                                                >
                                                                                    {isSuperAdmin && <span className="mr-2">⭐</span>}
                                                                                    {role.name}
                                                                                    {isSelected && <span className="ml-auto">✓</span>}
                                                                                </button>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newReportingIds = (formData.reporting_ids || []).filter((_, i) => i !== index);
                                                        setFormData({ ...formData, reporting_ids: newReportingIds });
                                                    }}
                                                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                    title="Remove this reporting role"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Add new reporting role button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newReportingIds = [...(formData.reporting_ids || []), ''];
                                            setFormData({ ...formData, reporting_ids: newReportingIds });
                                        }}
                                        className="w-full border-2 border-dashed border-gray-600 rounded-lg px-3 py-3 text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span className="text-xl">+</span>
                                        <span>Add Reporting Role</span>
                                    </button>
                                    
                                    {/* Show message if no reporting roles */}
                                    {(!formData.reporting_ids || formData.reporting_ids.length === 0) && (
                                        <div className="text-xs text-gray-500 text-center py-2">
                                            This role doesn't report to anyone
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-4">Permissions</label>
                                
                                {/* SuperAdmin Option - Special Treatment */}
                                <div className={`border-2 rounded-lg overflow-hidden mb-4 transition-all duration-300 ${
                                    formData.permissions.SuperAdmin ? 
                                    'border-yellow-500 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 shadow-lg shadow-yellow-500/20' : 
                                    'border-gray-600 hover:border-yellow-500/50'
                                }`}>
                                    <div className="p-4">
                                        <label className="flex items-center cursor-pointer group">
                                            <div className="relative">
                                                <input 
                                                    type="checkbox" 
                                                    className="h-6 w-6 rounded mr-4 accent-yellow-500 transition-all"
                                                    checked={!!formData.permissions.SuperAdmin}
                                                    onChange={(e) => handlePermissionChange('SuperAdmin', '*', e.target.checked)}
                                                />
                                                {formData.permissions.SuperAdmin && (
                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                                                )}
                                            </div>
                                            <div className="flex items-center">
                                                <Shield className={`h-6 w-6 mr-3 transition-colors ${
                                                    formData.permissions.SuperAdmin ? 'text-yellow-400' : 'text-gray-400 group-hover:text-yellow-400'
                                                }`} />
                                                <div>
                                                    <span className={`text-lg font-bold transition-colors ${
                                                        formData.permissions.SuperAdmin ? 'text-yellow-400' : 'text-white group-hover:text-yellow-400'
                                                    }`}>
                                                        Super Administrator
                                                    </span>
                                                    {formData.permissions.SuperAdmin && (
                                                        <span className="ml-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                                                            ACTIVE
                                                        </span>
                                                    )}
                                                    <p className={`text-sm mt-1 transition-colors ${
                                                        formData.permissions.SuperAdmin ? 'text-yellow-300' : 'text-gray-400'
                                                    }`}>
                                                        Complete system access with all permissions (page: *, actions: *)
                                                    </p>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Regular Permissions - Hidden when SuperAdmin is selected */}
                                {!formData.permissions.SuperAdmin && (
                                <div className="space-y-4">{/* Add transition class */}
                                    <div className="flex items-center text-lg font-semibold text-white mb-4">
                                       
                                    </div>
                                    
                                    {Object.entries(allPermissions).filter(([module]) => module !== 'SuperAdmin').map(([module, actions]) => {
                                        // Check if this is a nested module (Leads CRM)
                                        const isNestedModule = typeof actions === 'object' && !Array.isArray(actions);
                                        
                                        if (isNestedModule) {
                                            // Handle nested permissions (Leads CRM)
                                            const sections = Object.entries(actions);
                                            const totalPermissions = sections.reduce((sum, [_, sectionActions]) => sum + sectionActions.length, 0);
                                            const selectedPermissions = sections.reduce((sum, [section, _]) => {
                                                const sectionPerms = formData.permissions[`${module}.${section}`] || [];
                                                return sum + sectionPerms.length;
                                            }, 0);
                                            
                                            return (
                                                <div key={module} className="border-2 border-indigo-600 rounded-lg overflow-hidden hover:border-indigo-400 transition-colors">
                                                    <div 
                                                        className="bg-gradient-to-r from-indigo-700 to-indigo-600 p-3 cursor-pointer flex justify-between items-center hover:from-indigo-600 hover:to-indigo-500 transition-colors"
                                                        onClick={() => togglePermissionCollapse(module)}
                                                    >
                                                        <label className="font-bold flex items-center cursor-pointer text-lg">
                                                            <span className="text-white">🎯 {module}</span>
                                                            {selectedPermissions > 0 && (
                                                                <span className="ml-2 bg-yellow-400 text-indigo-900 text-xs font-bold px-2 py-1 rounded-full">
                                                                    {selectedPermissions}/{totalPermissions}
                                                                </span>
                                                            )}
                                                        </label>
                                                        <ChevronDown 
                                                            className={`h-5 w-5 transition-transform text-white ${
                                                                collapsedPermissions.has(module) ? 'rotate-180' : ''
                                                            }`} 
                                                        />
                                                    </div>
                                                    <div 
                                                        className={`transition-all duration-300 overflow-hidden ${
                                                            collapsedPermissions.has(module) ? 'max-h-0' : 'max-h-[800px]'
                                                        }`}
                                                    >
                                                        <div className="p-4 bg-gray-800/50 space-y-3">
                                                            {sections.map(([section, sectionActions]) => {
                                                                const sectionKey = `${module}.${section}`;
                                                                const sectionPermissions = formData.permissions[sectionKey] || [];
                                                                const allSectionSelected = sectionActions.length > 0 && 
                                                                                          sectionActions.length === sectionPermissions.length && 
                                                                                          sectionActions.every(action => sectionPermissions.includes(action));
                                                                const someSectionSelected = sectionPermissions.length > 0 && !allSectionSelected;
                                                                
                                                                return (
                                                                    <div key={section} className="border border-gray-600 rounded-lg overflow-hidden bg-gray-900/30">
                                                                        <div className="bg-gray-700/70 p-2.5 flex items-center justify-between">
                                                                            <label className="font-semibold flex items-center cursor-pointer text-sm">
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    className="h-4 w-4 rounded mr-2 accent-green-500"
                                                                                    checked={allSectionSelected}
                                                                                    ref={input => {
                                                                                        if (input) input.indeterminate = someSectionSelected;
                                                                                    }}
                                                                                    onChange={(e) => handleModuleToggle(sectionKey, e.target.checked)}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                />
                                                                                <span className="text-gray-200">📌 {section}</span>
                                                                                {sectionPermissions.length > 0 && (
                                                                                    <span className="ml-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                                                        {sectionPermissions.length}
                                                                                    </span>
                                                                                )}
                                                                            </label>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                                                                            {sectionActions.map(action => (
                                                                                <label key={action} className="flex items-center text-xs hover:bg-gray-700/50 p-2 rounded transition-colors">
                                                                                    <input 
                                                                                        type="checkbox" 
                                                                                        className="h-3.5 w-3.5 rounded mr-2 accent-green-500"
                                                                                        checked={sectionPermissions.includes(action)}
                                                                                        onChange={(e) => handlePermissionChange(sectionKey, action, e.target.checked)}
                                                                                    />
                                                                                    <span className="text-gray-300" title={permissionDescriptions[action] || action}>
                                                                                        {action === 'show' ? '👁️ Show' : 
                                                                                         action === 'own' ? '👤 Own' : 
                                                                                         action === 'junior' ? '🔸 Junior' : 
                                                                                         action === 'all' ? '🔑 All' : 
                                                                                         action === 'add' ? '➕ Add' :
                                                                                         action === 'edit' ? '✏️ Edit' :
                                                                                         action === 'assign' ? '👥 Assign' :
                                                                                         action === 'download_obligation' ? '📥 Download' :
                                                                                         action === 'status_update' ? '🔄 Status' :
                                                                                         action === 'settings' ? '⚙️ Settings' :
                                                                                         action === 'delete' ? '🗑️ Delete' :
                                                                                         action === 'reassignment_popup' ? '🔄 Reassignment' : action}
                                                                                    </span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            // Handle regular flat permissions
                                            const modulePermissions = formData.permissions[module] || [];
                                            const allModuleSelected = actions.length > 0 && actions.length === modulePermissions.length && 
                                                                     actions.every(action => modulePermissions.includes(action));
                                            const someModuleSelected = modulePermissions.length > 0 && !allModuleSelected;
                                            
                                            return (
                                                <div key={module} className="border border-gray-600 rounded-lg overflow-hidden hover:border-indigo-500/50 transition-colors">
                                                    <div 
                                                        className="bg-gray-700 p-3 cursor-pointer flex justify-between items-center hover:bg-gray-600 transition-colors"
                                                        onClick={() => togglePermissionCollapse(module)}
                                                    >
                                                        <label className="font-semibold flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="h-5 w-5 rounded mr-3 accent-indigo-500"
                                                                checked={allModuleSelected}
                                                                ref={input => {
                                                                    if (input) input.indeterminate = someModuleSelected;
                                                                }}
                                                                onChange={(e) => handleModuleToggle(module, e.target.checked)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <span className="text-white">{module}</span>
                                                            {modulePermissions.length > 0 && (
                                                                <span className="ml-2 bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                                                    {modulePermissions.length}
                                                                </span>
                                                            )}
                                                        </label>
                                                        <ChevronDown 
                                                            className={`h-5 w-5 transition-transform text-gray-400 ${
                                                                collapsedPermissions.has(module) ? 'rotate-180' : ''
                                                            }`} 
                                                        />
                                                    </div>
                                                    <div 
                                                        className={`transition-all duration-300 overflow-hidden ${
                                                            collapsedPermissions.has(module) ? 'max-h-0' : 'max-h-96'
                                                        }`}
                                                    >
                                                        <div className="p-4 bg-gray-800/50 grid grid-cols-2 md:grid-cols-3 gap-4">
                                                            {actions.map(action => (
                                                                <label key={action} className="flex items-center text-sm hover:bg-gray-700/50 p-2 rounded transition-colors">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="h-4 w-4 rounded mr-2 accent-indigo-500"
                                                                        checked={modulePermissions.includes(action)}
                                                                        onChange={(e) => handlePermissionChange(module, action, e.target.checked)}
                                                                    />
                                                                    <span className="text-gray-300" title={permissionDescriptions[action] || action}>
                                                                        {action === 'show' ? '👁️ Show' : 
                                                                         action === 'own' ? '👤 Own' : 
                                                                         action === 'junior' ? '🔸 Junior' : 
                                                                         action === 'all' ? '🔑 All' : 
                                                                         action === 'settings' ? '⚙️ Settings' : 
                                                                         action === 'delete' ? '🗑️ Delete' : 
                                                                         action === 'add' ? '➕ Add' :
                                                                         action === 'edit' ? '✏️ Edit' :
                                                                         action === 'post' ? '📝 Post' :
                                                                         action === 'channel' ? '📺 Channel' :
                                                                         action === 'password' ? '🔑 Password' :
                                                                         action === 'role' ? '👥 Role' :
                                                                         action === 'manage' ? '⚙️ Manage' :
                                                                         action === 'send' ? '📤 Send' : action}
                                                                    </span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                                )}

                                {/* SuperAdmin Active Message */}
                                {formData.permissions.SuperAdmin && (
                                    <div className="mt-6 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg">
                                        <div className="flex items-center">
                                            <Shield className="h-6 w-6 text-yellow-400 mr-3" />
                                            <div>
                                                <p className="text-yellow-400 font-semibold">Super Administrator Access Enabled</p>
                                                <p className="text-yellow-300 text-sm mt-1">
                                                    This role has complete system access (page: *, actions: *). Individual permissions are not needed.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end space-x-4 mt-8">
                                <button 
                                    type="button" 
                                    onClick={closeModal}
                                    className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
                                >
                                    Save
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
                            This will permanently delete the role "{roleToDelete?.name}". Subordinate roles will need to be reassigned.
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

export default RoleSettings;
