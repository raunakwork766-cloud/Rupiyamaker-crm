export const NAVBAR_PAGE_SEARCH_EVENT = 'navbar-page-search';

export function dispatchNavbarPageSearch(query = '') {
  window.dispatchEvent(
    new CustomEvent(NAVBAR_PAGE_SEARCH_EVENT, {
      detail: { query: query ?? '' },
    })
  );
}

export function getNavbarSearchPlaceholder(pathname = '') {
  const path = (pathname || '').toLowerCase();

  if (path.includes('/feed') || path === '/') return 'Search posts, authors...';
  if (path.includes('/task')) return 'Search tasks, subject, notes...';
  if (path.includes('/ticket')) return 'Search tickets, subject, description...';
  if (path.includes('/leave')) return 'Search leave requests, employees...';
  if (path.includes('/attendance')) return 'Search employee, team, ID...';
  if (path.includes('/employees')) return 'Search employees, department, role...';
  if (path.includes('/warning')) return 'Search warnings, employees, types...';
  if (path.includes('/interview-panel')) return 'Search candidates, mobile, role...';
  if (path.includes('/lead-crm') || path.includes('/leads')) return 'Search leads (space = multiple terms)...';
  if (path.includes('/login-crm') || path.includes('/login')) return 'Search login leads...';
  if (path.includes('/setting')) return 'Search settings...';
  if (path.includes('/report')) return 'Search reports...';
  if (path.includes('/notification')) return 'Search announcements...';
  if (path.includes('/dashboard')) return 'Search dashboard...';
  if (path.includes('/transfer-requests')) return 'Search transfer requests...';

  return 'Search this page...';
}
