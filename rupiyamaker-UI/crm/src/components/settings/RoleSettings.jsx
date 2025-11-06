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
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
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

    const buildTree = (items, parentIdField = 'reporting_id') => {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }
        
        const map = new Map(items.map((item, i) => [item.id || item._id, i]));
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
            
            setFormData({
                name: role.name || '',
                description: role.description || '',
                department_id: role.department_id || null,
                reporting_id: role.reporting_id || null,
                permissions: permissionsObj
            });
        } else {
            setFormData({
                name: '',
                description: '',
                department_id: null,
                reporting_id: null,
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
        setFormData({ name: '', description: '', department_id: null, reporting_id: null, permissions: {} });
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
    const exportToPDF = () => {
        try {
            console.log('Exporting to PDF...');
            console.log('Roles data:', roles);
            console.log('Departments data:', departments);
            
            if (!roles || roles.length === 0) {
                message.warning('No roles data available to export');
                return;
            }
            
            // Create HTML content for printing
            const printContent = generatePrintableHTML();
            
            // Validate generated content
            if (!printContent || printContent.includes('Error generating report')) {
                message.error('Failed to generate PDF content');
                return;
            }
            
            // Open a new window and print
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                message.error('Unable to open print window. Please check if pop-ups are blocked.');
                return;
            }
            
            printWindow.document.write(printContent);
            printWindow.document.close();
            
            // Wait for content to load then print
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 1000);
            };
            
            message.success('PDF export window opened. Please use your browser\'s print dialog to save as PDF.');
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            message.error('Failed to export to PDF: ' + error.message);
        }
    };

    const exportToExcel = () => {
        try {
            console.log('Exporting to Excel...');
            console.log('Roles data:', roles);
            console.log('Departments data:', departments);
            
            if (!roles || roles.length === 0) {
                message.warning('No roles data available to export');
                return;
            }
            
            // Prepare data for CSV format (can be opened in Excel)
            const csvData = generateCSVData();
            
            if (!csvData) {
                message.error('Failed to generate CSV data');
                return;
            }
            
            // Create blob and download
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `roles_permissions_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the URL object
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
            
            message.success('Roles data exported to CSV successfully!');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            message.error('Failed to export to Excel: ' + error.message);
        }
    };

    const generatePrintableHTML = () => {
        try {
            const rolesList = roles.map(role => {
                const dept = departments.find(d => (d.id || d._id) === role.department_id);
                const reportingRole = roles.find(r => (r.id || r._id) === role.reporting_id);
                
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
                        <td style="border: 1px solid #ddd; padding: 8px;">${reportingRole?.name || 'None'}</td>
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
                const reportingRole = roles.find(r => (r.id || r._id) === role.reporting_id);
                
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
                    reportingRole?.name || 'None',
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
            if (perm.page === '*') return Object.values(allPermissions).flat().length;
            return count + (perm.actions?.length || 0);
        }, 0);
    };

    const renderRoleTree = (nodes, isChild = false) => {
        return nodes.map(node => {
            const hasDirectReports = roles.some(r => r.reporting_id === (node.id || node._id));
            
            return (
                <div key={node.id || node._id} className={`tree-item my-2 ${isChild ? 'child-item' : ''}`}>
                    <div className="item-content bg-gray-900/50 hover:bg-gray-800/70 transition-colors duration-200 rounded-lg p-4 grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-3 flex items-center">
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
                                <span className="ml-3 bg-gray-700 text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                                    {node.children.length}
                                </span>
                            )}
                            {hasDirectReports && (
                                <span className="ml-2 bg-amber-500/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-500/30" title="Has direct reports - cannot be deleted">
                                    Protected
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
                        <div className="col-span-5 text-sm text-gray-400">
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
                            className={`children-container ml-7 pl-6 border-l border-indigo-600/50 transition-all duration-400 bg-white/[0.02] rounded-lg mt-2 ${
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
    const departmentTree = buildTree(departments, 'parent_id');
    const roleTree = buildTree(roles);

    const totalPermissions = Object.values(allPermissions).flat().length;
    const selectedPermissions = Object.values(formData.permissions).flat().length;
    const allSelected = selectedPermissions === totalPermissions;
    const someSelected = selectedPermissions > 0 && selectedPermissions < totalPermissions;

    return (
        <div className="max-w-7xl mx-auto bg-gray-900/90 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl p-6 text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6 px-2">
                <h1 className="text-3xl font-bold text-white">Roles & Permissions</h1>
                <div className="flex items-center space-x-3">
                    {/* Export Buttons */}
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('PDF button clicked');
                                exportToPDF();
                            }}
                            className="bg-gradient-to-r from-red-500 to-red-600 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transform hover:scale-105 transition-transform"
                            title="Export to PDF"
                            type="button"
                        >
                            <Download className="h-4 w-4" />
                            <span>PDF</span>
                        </button>
                    </div>
                    
                    {/* Add Role Button */}
                    <button 
                        onClick={() => openModal()}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-2 px-5 rounded-lg flex items-center space-x-2 transform hover:scale-105 transition-transform"
                    >
                        <Plus className="h-5 w-5" />
                        <span>Add Role</span>
                    </button>
                </div>
            </div>

            {/* Column Headers */}
            <div className="item-content text-gray-400 uppercase text-xs font-semibold tracking-wide mb-2 px-4 grid grid-cols-12 gap-4">
                <div className="col-span-3">Role Name</div>
                <div className="col-span-2">Department</div>
                <div className="col-span-5">Permissions</div>
                <div className="col-span-2 text-center">Actions</div>
            </div>

            {/* Scroll hint */}
            {!loading && treeData && treeData.length > 5 && (
                <div className="text-xs text-gray-500 mb-4 px-4">
                    Showing {treeData.length} roles - scroll to view all
                </div>
            )}

            {/* Role Tree */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                </div>
            ) : (
                <div className="relative">
                    <div className="h-[calc(100vh-160px)] overflow-hidden space-y-2 border border-white/10 rounded-lg p-4 bg-gray-800/30">
                        <div className="h-full overflow-y-auto pr-2" style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor: '#4f46e5 #374151'
                        }}>
                            {renderRoleTree(treeData)}
                        </div>
                    </div>
                    {/* Scroll indicator */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-900/90 to-transparent pointer-events-none rounded-b-lg"></div>
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
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Reporting Role</label>
                                <div className="relative reporting-dropdown-container">
                                    {/* Reporting Role Dropdown Button */}
                                    <button
                                        type="button"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center"
                                        onClick={() => setShowReportingDropdown(!showReportingDropdown)}
                                    >
                                        <span className="text-left">
                                            {(() => {
                                                if (formData.reporting_id === null) {
                                                    return "No Reporting Role";
                                                }
                                                const selectedRole = roles.find(role => 
                                                    role._id === formData.reporting_id || 
                                                    role.id === formData.reporting_id
                                                );
                                                return selectedRole ? selectedRole.name : "Select Reporting Role";
                                            })()}
                                        </span>
                                        <svg
                                            className={`w-5 h-5 transition-transform ${showReportingDropdown ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {/* Reporting Role Dropdown Menu */}
                                    {showReportingDropdown && (
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
                                                        placeholder="Search roles..."
                                                        value={reportingSearch}
                                                        onChange={(e) => setReportingSearch(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>

                                            {/* Options List */}
                                            <div className="overflow-y-auto max-h-60">
                                                {/* No Reporting Role Option */}
                                                <div
                                                    className="px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors text-black hover:bg-blue-200"
                                                    style={{
                                                        backgroundColor: formData.reporting_id === null ? '#FFFF00' : '',
                                                        color: '#000000',
                                                        fontWeight: formData.reporting_id === null ? 'bold' : 'normal'
                                                    }}
                                                    onClick={() => {
                                                        setFormData({...formData, reporting_id: null});
                                                        setShowReportingDropdown(false);
                                                        setReportingSearch('');
                                                        setExpandedReportingRoles(new Set());
                                                    }}
                                                >
                                                    <div className="flex items-center">
                                                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                        </svg>
                                                        No Reporting Role
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">No reporting relationship</div>
                                                </div>

                                                {/* Role Tree */}
                                                {buildReportingRoleTree().map(role => renderReportingRoleTreeItem(role))}

                                                {/* No Results Message */}
                                                {buildReportingRoleTree().length === 0 && (
                                                    <div className="px-4 py-6 text-center text-gray-500">
                                                        <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        <div className="font-medium text-gray-600">
                                                            {roles.length === 0 
                                                                ? 'No roles created yet' 
                                                                : reportingSearch 
                                                                    ? `No roles found matching "${reportingSearch}"` 
                                                                    : 'No roles available'
                                                            }
                                                        </div>
                                                        {roles.length === 0 ? (
                                                            <div className="text-xs mt-2 text-gray-400">
                                                                Create your first role to establish reporting relationships
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs mt-2 text-gray-400">
                                                                Total roles: {roles.length} | Available for reporting: {buildReportingRoleTree().length}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
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
