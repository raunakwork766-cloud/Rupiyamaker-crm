import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { Send, User, RefreshCcw, AlertCircle } from 'lucide-react';
import hrmsService from '../../services/hrmsService';
import { getISTTimestamp } from '../../utils/dateUtils';

const EmployeeRemarks = ({ employeeId }) => {
    const [comment, setComment] = useState('');
    const [comments, setComments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentUser, setCurrentUser] = useState({
        name: '',
        id: '',
        avatar: null,
    });

    // Get current user information when component mounts
    useEffect(() => {
        const userId = localStorage.getItem('userId');
        const firstName = localStorage.getItem('firstName') || '';
        const lastName = localStorage.getItem('lastName') || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'User';
        
        setCurrentUser({
            name: fullName,
            id: userId,
            avatar: null,
        });
    }, []);

    // Load remarks from API when component mounts or employeeId changes
    useEffect(() => {
        if (employeeId) {
            fetchRemarks();
        }
    }, [employeeId]);

    // Function to fetch remarks from the API
    const fetchRemarks = async () => {
        if (!employeeId) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await hrmsService.getEmployeeRemarks(employeeId);
            setComments(response.data || []);
        } catch (error) {
            console.error('Error fetching remarks:', error);
            setError('Failed to load remarks');
            // Initialize with empty array if API doesn't exist yet
            setComments([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePost = async () => {
        if (!comment.trim() || !employeeId) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const remarkData = {
                remark: comment,
                remark_type: 'general'
            };
            
            await hrmsService.createEmployeeRemark(employeeId, remarkData);
            setComment('');
            message.success('Remark added successfully');
            
            // Refresh remarks list after adding a new one
            await fetchRemarks();
            
        } catch (error) {
            console.error('Error adding remark:', error);
            // Fallback: Add to local state if API doesn't exist
            const localRemark = {
                id: Date.now().toString(),
                remark: comment,
                created_by_name: currentUser.name,
                created_at: getISTTimestamp(),
                remark_type: 'general'
            };
            setComments(prev => [localRemark, ...prev]);
            setComment('');
            message.success('Remark added successfully');
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (time) =>
        new Intl.DateTimeFormat('default', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Kolkata',
        }).format(new Date(time));

    return (
        <div className="w-full p-4 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold" style={{ color: '#c8d0e0' }}>Remarks</h3>
                <button 
                    onClick={fetchRemarks} 
                    className="flex items-center text-sm"
                    style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer' }}
                    disabled={isLoading}
                >
                    <RefreshCcw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>
            
            {error && (
                <div className="p-3 rounded-lg flex items-start" style={{ background: '#1a0a0a', color: '#f87171', border: '1px solid #7f1d1d' }}>
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
            
            <div className="flex items-center rounded px-3 py-2" style={{ border: '1px solid #2a2a3a', background: '#1a1a24' }}>
                <div className="w-10 h-10 rounded-full mr-3 flex items-center justify-center flex-shrink-0" style={{ background: '#1e3a5f', border: '1px solid #3b82f6', color: '#93c5fd' }}>
                    {currentUser.avatar ? (
                        <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                        <User className="w-5 h-5" />
                    )}
                </div>

                <input
                    type="text"
                    placeholder={`Write a remark as ${currentUser.name}...`}
                    className="flex-1 outline-none border-none text-sm bg-transparent"
                    style={{ color: '#c8d0e0' }}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePost()}
                    disabled={isLoading}
                />

                <button 
                    onClick={handlePost} 
                    disabled={isLoading || !comment.trim()}
                    style={{ background: 'none', border: 'none', cursor: !comment.trim() ? 'not-allowed' : 'pointer', opacity: !comment.trim() ? 0.5 : 1 }}
                >
                    <Send className="w-5 h-5" style={{ color: isLoading ? '#4a5570' : '#60a5fa' }} />
                </button>
            </div>

            {isLoading && comments.length === 0 && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#3b82f6' }}></div>
                </div>
            )}

            {!isLoading && comments.length === 0 && (
                <div className="text-center py-8" style={{ color: '#6b7a99' }}>
                    <User className="w-12 h-12 mx-auto mb-2 opacity-25" />
                    <p>No remarks yet. Be the first to add one!</p>
                </div>
            )}

            <div className="space-y-3">
                {comments.map((note) => (
                    <div key={note.id || note._id} className="flex items-start gap-3">
                        <div className="flex flex-col items-center min-w-[50px]">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#1e3a5f', border: '1px solid #3b82f6', color: '#93c5fd' }}>
                                <User className="w-4 h-4" />
                            </div>
                            <span className="text-xs mt-1 font-medium" style={{ color: '#6b7a99' }}>
                                {note.created_by_name || note.creator_name || 'User'}
                            </span>
                        </div>

                        <div className="rounded-lg p-3 flex-1" style={{ background: '#000', border: '1px solid #1f1f27' }}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs" style={{ color: '#4a5570' }}>{formatTime(note.created_at)}</span>
                            </div>
                            <p className="text-sm" style={{ color: '#c8d0e0' }}>{note.remark || note.content}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EmployeeRemarks;
