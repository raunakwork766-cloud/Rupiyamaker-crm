import React, { memo } from 'react';

const LeadCRM = memo(function LeadCRM({ user, selectedLoanType: initialLoanType, department = "leads" }) {
    return (
        <div className="min-h-screen bg-black text-white font-sans">
            <div className="relative z-10 px-6 py-8 space-y-10 bg-black">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white mb-4">Lead CRM</h1>
                    <p className="text-gray-400">Component temporarily simplified for debugging</p>
                    <p className="text-sm text-gray-500 mt-2">
                        User: {user?.name || 'Unknown'} | 
                        Loan Type: {initialLoanType || 'All'} | 
                        Department: {department}
                    </p>
                </div>
            </div>
        </div>
    );
});

export default LeadCRM;