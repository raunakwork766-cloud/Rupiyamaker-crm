// This is a utility file to ensure LeadCRM properly filters leads with file_sent_to_login=true

// Method to filter leads in LeadCRM component - to be imported in LeadCRM.jsx
export const filterLoginLeads = (leads) => {
  if (!Array.isArray(leads) || leads.length === 0) {
    return [];
  }
  
  // Filter to only include leads that have file_sent_to_login=true
  return leads.filter(lead => lead.file_sent_to_login === true);
};

// Use this filter after fetching leads in the LeadCRM component:
// 
// const response = await fetch(`${apiBaseUrl}/leads?user_id=${userId}`...);
// let fetchedLeads = await response.json();
// 
// // Filter leads for login department
// if (fetchedLeads && Array.isArray(fetchedLeads)) {
//   fetchedLeads = filterLoginLeads(fetchedLeads);
// }
