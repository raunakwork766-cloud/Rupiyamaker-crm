import { useEffect } from 'react';
import { NAVBAR_PAGE_SEARCH_EVENT } from '../utils/navbarPageSearch';

/**
 * Listen for navbar search input and update page-level search state.
 * @param {(query: string) => void} onSearch
 */
export default function useNavbarPageSearch(onSearch) {
  useEffect(() => {
    if (typeof onSearch !== 'function') return undefined;

    const handler = (event) => {
      onSearch(event.detail?.query ?? '');
    };

    window.addEventListener(NAVBAR_PAGE_SEARCH_EVENT, handler);
    return () => window.removeEventListener(NAVBAR_PAGE_SEARCH_EVENT, handler);
  }, [onSearch]);
}
