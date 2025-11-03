// Direct database update API for statusType workaround
export const directStatusUpdateAPI = {
    updateStatusType: async (statusId, statusType) => {
        try {
            const response = await fetch('/api/api/direct-status-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    statusId: statusId,
                    statusType: statusType
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Direct status update failed:', error);
            throw error;
        }
    }
};