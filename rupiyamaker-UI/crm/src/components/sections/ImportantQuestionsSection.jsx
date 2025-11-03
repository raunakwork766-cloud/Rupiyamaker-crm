import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { hasPermission, getUserPermissions } from '../../utils/permissions';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

export default function ImportantQuestionsSection({ leadData, onUpdate, currentUserRole, canEdit = true }) {
    const [questions, setQuestions] = useState([]);
    const [questionResponses, setQuestionResponses] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false); // Dropdown closed by default

    // Get user permissions
    const userPermissions = currentUserRole?.permissions || getUserPermissions();
    const userDepartment = localStorage.getItem('userDepartment') || 'sales';
    const userId = currentUserRole?._id || localStorage.getItem('userId');

    useEffect(() => {
        fetchImportantQuestions();
        
        // Properly load responses from leadData
        if (leadData?.question_responses) {
            console.log('Loading question responses from leadData:', leadData.question_responses);
            
            // Create a clean object with boolean values
            const cleanedResponses = {};
            Object.keys(leadData.question_responses).forEach(key => {
                const value = leadData.question_responses[key];
                cleanedResponses[key] = value === true || 
                                       value === 'true' || 
                                       value === 'yes' || 
                                       value === 'Yes';
            });
            
            setQuestionResponses(cleanedResponses);
        } else if (leadData?.importantquestion) {
            // Handle importantquestion format
            const convertedResponses = {};
            Object.keys(leadData.importantquestion).forEach(key => {
                const value = leadData.importantquestion[key];
                convertedResponses[key] = value === true || 
                                         value === 'true' || 
                                         value === 'yes' || 
                                         value === 'Yes';
            });
            setQuestionResponses(convertedResponses);
        } else if (leadData?.dynamic_fields?.important_questions) {
            // Convert legacy format to new format if needed
            const legacyResponses = leadData.dynamic_fields.important_questions;
            const convertedResponses = {};
            
            // Convert string values to boolean for checkbox use
            Object.keys(legacyResponses).forEach(key => {
                const value = legacyResponses[key];
                convertedResponses[key] = value === true || 
                                         value === 'true' || 
                                         value === 'yes' || 
                                         value === 'Yes';
            });
            
            console.log('Converted legacy responses:', convertedResponses);
            setQuestionResponses(convertedResponses);
        }
    }, [leadData]);

    const fetchImportantQuestions = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE_URL}/lead-login/important-questions?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setQuestions(data.questions || []);
            } else {
                setError('Failed to fetch important questions');
            }
        } catch (error) {
            console.error('Error fetching important questions:', error);
            setError('Error fetching important questions');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuestionResponse = async (questionId, checked) => {
        console.log(`Updating question ${questionId} to ${checked}`);
        
        // Update local state with new response immediately (optimistic update)
        const newResponses = {
            ...questionResponses,
            [questionId]: checked
        };
        setQuestionResponses(newResponses);
        
        // Immediately update parent component without API call for instant UI feedback
        if (onUpdate) {
            onUpdate({
                question_responses: newResponses,
                importantquestion: newResponses,
                important_questions_validated: false // Will be set to true only after successful API validation
            });
        }

        // Make sure leadData exists before proceeding with API call
        if (!leadData) {
            console.error("Cannot update question: leadData is undefined");
            return;
        }

        // Debounce API calls to avoid excessive requests
        if (window.importantQuestionsTimeout) {
            clearTimeout(window.importantQuestionsTimeout);
        }

        window.importantQuestionsTimeout = setTimeout(async () => {
            try {
                // Check if all mandatory questions are answered for validation
                const mandatoryQuestions = questions.filter(q => q.mandatory);
                const allMandatoryAnswered = mandatoryQuestions.every(q => newResponses[q.id] === true);
                console.log('All mandatory questions answered:', allMandatoryAnswered);
                
                const userName = localStorage.getItem('userName') || 'Unknown User';
                const activityData = {
                    activity_type: 'question_validation',
                    description: allMandatoryAnswered ? 
                        'Important questions automatically validated' :
                        'Important questions updated',
                    created_by: userName,
                    user_id: userId,
                    created_at: new Date().toISOString(),
                    details: {
                        questions_validated: Object.keys(newResponses).length,
                        question_ids: Object.keys(newResponses),
                        auto_validated: allMandatoryAnswered
                    }
                };
                
                // Create payload with responses
                const payload = {
                    responses: newResponses,
                    activity: activityData
                };
                
                let apiResponse;
                
                // If all mandatory questions are answered, send validation request
                if (allMandatoryAnswered) {
                    console.log('Sending validation request to API');
                    apiResponse = await fetch(`${API_BASE_URL}/lead-login/validate-questions/${leadData._id}?user_id=${userId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (apiResponse.ok) {
                        console.log('Questions validated successfully');
                        // Update parent with validation status
                        if (onUpdate) {
                            onUpdate({
                                question_responses: newResponses,
                                importantquestion: newResponses,
                                important_questions_validated: true
                            });
                        }
                    } else {
                        console.error('Failed to validate questions');
                        const errorData = await apiResponse.json();
                        console.error('Error details:', errorData);
                    }
                } else {
                    // Update responses without validation
                    console.log('Updating question responses without validation');
                    
                    apiResponse = await fetch(`${API_BASE_URL}/leads/${leadData._id}?user_id=${userId}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            question_responses: newResponses,
                            importantquestion: newResponses, // Also update in the importantquestion field for backward compatibility
                            updated_by: userId
                        })
                    });
                    
                    if (!apiResponse.ok) {
                        console.error('Failed to update question responses');
                        const errorData = await apiResponse.json();
                        console.error('Error details:', errorData);
                    }
                }
            } catch (error) {
                console.error('Error updating question responses:', error);
            }
        }, 500); // 500ms debounce delay
    };

    const areAllMandatoryQuestionsAnswered = () => {
        if (questions.length === 0) return false;
        const mandatoryQuestions = questions.filter(q => q.mandatory);
        if (mandatoryQuestions.length === 0) return true;
        return mandatoryQuestions.every(q => questionResponses[q.id] === true);
    };

    const shouldShowSendButton = () => {
        return (
            userDepartment === 'sales' &&
            leadData?.sub_status === 'FILE COMPLETED' &&
            !leadData?.file_sent_to_login &&
            questions.length > 0 &&
            areAllMandatoryQuestionsAnswered()
        );
    };

    const handleSendToLoginDepartment = async () => {
        if (!shouldShowSendButton()) return;

        setIsSending(true);
        try {
            const response = await fetch(`${API_BASE_URL}/lead-login/send-to-login-department/${leadData._id}?user_id=${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                alert('File sent to login department successfully!');
                if (onUpdate) {
                    onUpdate({
                        file_sent_to_login: true,
                        login_department_sent_date: new Date().toISOString()
                    });
                }
            } else {
                const errorData = await response.json();
                alert(`Failed to send file: ${errorData.detail || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error sending file to login department:', error);
            alert('Error sending file to login department');
        } finally {
            setIsSending(false);
        }
    };

    const completionStats = () => {
        if (questions.length === 0) return { completed: 0, total: 0, percentage: 0 };
        const completed = questions.filter(q => questionResponses[q.id] === true).length;
        const total = questions.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { completed, total, percentage };
    };

    const stats = completionStats();

    if (isLoading) {
        return (
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-2" />
                    <span className="text-gray-300">Loading important questions...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            {/* Progress and Send Button Section */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    {questions.length > 0 && (
                        <span className="text-sm bg-blue-100 text-[#03b0f5] px-2 py-1 rounded">
                            {stats.completed}/{stats.total} completed ({stats.percentage}%)
                        </span>
                    )}
                </div>
                {shouldShowSendButton() && (
                    <button
                        onClick={handleSendToLoginDepartment}
                        disabled={isSending}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center font-medium transition-colors"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 mr-2" />
                                Send File to Login Department
                            </>
                        )}
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded-lg">
                    <div className="flex items-center text-red-700">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        {error}
                    </div>
                </div>
            )}

            {questions.length === 0 ? (
                <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No important questions configured yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-[#03b0f5] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${stats.percentage}%` }}
                        ></div>
                    </div>

                    {/* Questions List - Direct display, no nested dropdowns */}
                    <div className="space-y-3">
                        {questions.map((question) => (
                            <div
                                key={question.id}
                                className={`p-4 rounded-lg border transition-colors ${questionResponses[question.id]
                                        ? 'bg-green-100 border-green-400'
                                        : 'bg-gray-100 border-gray-300'
                                    }`}
                            >
                                <label className="flex items-start cursor-pointer gap-3">
                                    <input
                                        type="checkbox"
                                        checked={!!questionResponses[question.id]}
                                        onChange={(e) => canEdit && handleQuestionResponse(question.id, e.target.checked)}
                                        disabled={!canEdit}
                                        className="mt-0.5 w-4 h-4 text-[#03b0f5] bg-white border-gray-400 rounded focus:ring-[#03b0f5] focus:ring-2 accent-[#03b0f5] flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start gap-2">
                                            <span className="text-black font-medium leading-5 whitespace-pre-wrap" style={{ whiteSpace: 'pre-wrap' }}>
                                                {question.question}
                                            </span>
                                            {question.mandatory && (
                                                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded flex-shrink-0">
                                                    Required
                                                </span>
                                            )}
                                        </div>
                                        {question.description && (
                                            <p className="text-gray-600 text-sm mt-1 leading-5 whitespace-pre-wrap" style={{ whiteSpace: 'pre-wrap' }}>
                                                {question.description}
                                            </p>
                                        )}
                                    </div>
                                    {questionResponses[question.id] && (
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    )}
                                </label>
                            </div>
                        ))}
                    </div>

                    {/* Status Message */}
                    {questions.length > 0 && (
                        <div className="mt-4 p-3 rounded-lg border border-gray-300 bg-gray-100">
                            {areAllMandatoryQuestionsAnswered() ? (
                                <div className="flex items-center text-green-700">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    All mandatory questions completed!
                                    {leadData?.sub_status === 'FILE COMPLETED' && !leadData?.file_sent_to_login && (
                                        <span className="ml-2 text-purple-700">
                                            Ready to send to login department.
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center text-yellow-700">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Please complete all mandatory questions before proceeding.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}