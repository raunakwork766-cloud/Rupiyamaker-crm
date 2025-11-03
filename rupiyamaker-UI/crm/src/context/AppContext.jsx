import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

// Actions for state management
const ACTIONS = {
  SET_USER: 'SET_USER',
  SET_AUTHENTICATED: 'SET_AUTHENTICATED',
  SET_LOADING: 'SET_LOADING',
  SET_SELECTED_LABEL: 'SET_SELECTED_LABEL',
  UPDATE_FEEDS: 'UPDATE_FEEDS',
  ADD_FEED: 'ADD_FEED',
  UPDATE_FEED: 'UPDATE_FEED',
  DELETE_FEED: 'DELETE_FEED',
  ADD_COMMENT: 'ADD_COMMENT',
  UPDATE_COMMENT: 'UPDATE_COMMENT',
  DELETE_COMMENT: 'DELETE_COMMENT',
  SET_TASKS: 'SET_TASKS',
  ADD_TASK: 'ADD_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  DELETE_TASK: 'DELETE_TASK',
  SET_LEADS: 'SET_LEADS',
  ADD_LEAD: 'ADD_LEAD',
  UPDATE_LEAD: 'UPDATE_LEAD',
  DELETE_LEAD: 'DELETE_LEAD',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_NOTIFICATION: 'SET_NOTIFICATION',
  CLEAR_NOTIFICATION: 'CLEAR_NOTIFICATION'
};

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  selectedLabel: 'Feed',
  feeds: [],
  tasks: [],
  leads: [],
  error: null,
  notification: null,
  // Cache for API responses to prevent unnecessary re-fetches
  cache: {
    feeds: { data: [], lastFetch: null },
    tasks: { data: [], lastFetch: null },
    leads: { data: [], lastFetch: null }
  }
};

// Reducer function
const appReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_USER:
      return { ...state, user: action.payload };
    
    case ACTIONS.SET_AUTHENTICATED:
      return { ...state, isAuthenticated: action.payload };
    
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case ACTIONS.SET_SELECTED_LABEL:
      return { ...state, selectedLabel: action.payload };
    
    case ACTIONS.UPDATE_FEEDS:
      return { 
        ...state, 
        feeds: action.payload,
        cache: {
          ...state.cache,
          feeds: { data: action.payload, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.ADD_FEED:
      const newFeeds = [action.payload, ...state.feeds];
      return { 
        ...state, 
        feeds: newFeeds,
        cache: {
          ...state.cache,
          feeds: { data: newFeeds, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.UPDATE_FEED:
      const updatedFeeds = state.feeds.map(feed =>
        feed.id === action.payload.id ? { ...feed, ...action.payload } : feed
      );
      return { 
        ...state, 
        feeds: updatedFeeds,
        cache: {
          ...state.cache,
          feeds: { data: updatedFeeds, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.DELETE_FEED:
      const filteredFeeds = state.feeds.filter(feed => feed.id !== action.payload);
      return { 
        ...state, 
        feeds: filteredFeeds,
        cache: {
          ...state.cache,
          feeds: { data: filteredFeeds, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.ADD_COMMENT:
      const feedsWithNewComment = state.feeds.map(feed => {
        if (feed.id === action.payload.feedId) {
          const updatedComments = [...(feed.comments || []), action.payload.comment];
          return { ...feed, comments: updatedComments };
        }
        return feed;
      });
      return { 
        ...state, 
        feeds: feedsWithNewComment,
        cache: {
          ...state.cache,
          feeds: { data: feedsWithNewComment, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.UPDATE_COMMENT:
      const feedsWithUpdatedComment = state.feeds.map(feed => {
        if (feed.id === action.payload.feedId) {
          const updatedComments = feed.comments?.map(comment =>
            comment.id === action.payload.commentId 
              ? { ...comment, ...action.payload.updates }
              : comment
          );
          return { ...feed, comments: updatedComments };
        }
        return feed;
      });
      return { 
        ...state, 
        feeds: feedsWithUpdatedComment,
        cache: {
          ...state.cache,
          feeds: { data: feedsWithUpdatedComment, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.DELETE_COMMENT:
      const feedsWithDeletedComment = state.feeds.map(feed => {
        if (feed.id === action.payload.feedId) {
          const filteredComments = feed.comments?.filter(comment => 
            comment.id !== action.payload.commentId
          );
          return { ...feed, comments: filteredComments };
        }
        return feed;
      });
      return { 
        ...state, 
        feeds: feedsWithDeletedComment,
        cache: {
          ...state.cache,
          feeds: { data: feedsWithDeletedComment, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.SET_TASKS:
      return { 
        ...state, 
        tasks: action.payload,
        cache: {
          ...state.cache,
          tasks: { data: action.payload, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.ADD_TASK:
      const newTasks = [action.payload, ...state.tasks];
      return { 
        ...state, 
        tasks: newTasks,
        cache: {
          ...state.cache,
          tasks: { data: newTasks, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.UPDATE_TASK:
      const updatedTasks = state.tasks.map(task =>
        task.id === action.payload.id ? { ...task, ...action.payload } : task
      );
      return { 
        ...state, 
        tasks: updatedTasks,
        cache: {
          ...state.cache,
          tasks: { data: updatedTasks, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.DELETE_TASK:
      const filteredTasks = state.tasks.filter(task => task.id !== action.payload);
      return { 
        ...state, 
        tasks: filteredTasks,
        cache: {
          ...state.cache,
          tasks: { data: filteredTasks, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.SET_LEADS:
      return { 
        ...state, 
        leads: action.payload,
        cache: {
          ...state.cache,
          leads: { data: action.payload, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.ADD_LEAD:
      const newLeads = [action.payload, ...state.leads];
      return { 
        ...state, 
        leads: newLeads,
        cache: {
          ...state.cache,
          leads: { data: newLeads, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.UPDATE_LEAD:
      const updatedLeads = state.leads.map(lead =>
        lead.id === action.payload.id ? { ...lead, ...action.payload } : lead
      );
      return { 
        ...state, 
        leads: updatedLeads,
        cache: {
          ...state.cache,
          leads: { data: updatedLeads, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.DELETE_LEAD:
      const filteredLeads = state.leads.filter(lead => lead.id !== action.payload);
      return { 
        ...state, 
        leads: filteredLeads,
        cache: {
          ...state.cache,
          leads: { data: filteredLeads, lastFetch: Date.now() }
        }
      };
    
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    
    case ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    
    case ACTIONS.SET_NOTIFICATION:
      return { ...state, notification: action.payload };
    
    case ACTIONS.CLEAR_NOTIFICATION:
      return { ...state, notification: null };
    
    default:
      return state;
  }
};

// Create context
const AppContext = createContext();

// Custom hook to use the context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

// Provider component
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Memoized actions to prevent unnecessary re-renders
  const actions = useMemo(() => ({
    setUser: (user) => dispatch({ type: ACTIONS.SET_USER, payload: user }),
    setAuthenticated: (isAuth) => dispatch({ type: ACTIONS.SET_AUTHENTICATED, payload: isAuth }),
    setLoading: (loading) => dispatch({ type: ACTIONS.SET_LOADING, payload: loading }),
    setSelectedLabel: (label) => dispatch({ type: ACTIONS.SET_SELECTED_LABEL, payload: label }),
    
    // Feed actions
    updateFeeds: (feeds) => dispatch({ type: ACTIONS.UPDATE_FEEDS, payload: feeds }),
    addFeed: (feed) => dispatch({ type: ACTIONS.ADD_FEED, payload: feed }),
    updateFeed: (feed) => dispatch({ type: ACTIONS.UPDATE_FEED, payload: feed }),
    deleteFeed: (feedId) => dispatch({ type: ACTIONS.DELETE_FEED, payload: feedId }),
    
    // Comment actions
    addComment: (feedId, comment) => dispatch({ 
      type: ACTIONS.ADD_COMMENT, 
      payload: { feedId, comment } 
    }),
    updateComment: (feedId, commentId, updates) => dispatch({
      type: ACTIONS.UPDATE_COMMENT,
      payload: { feedId, commentId, updates }
    }),
    deleteComment: (feedId, commentId) => dispatch({
      type: ACTIONS.DELETE_COMMENT,
      payload: { feedId, commentId }
    }),
    
    // Task actions
    setTasks: (tasks) => dispatch({ type: ACTIONS.SET_TASKS, payload: tasks }),
    addTask: (task) => dispatch({ type: ACTIONS.ADD_TASK, payload: task }),
    updateTask: (task) => dispatch({ type: ACTIONS.UPDATE_TASK, payload: task }),
    deleteTask: (taskId) => dispatch({ type: ACTIONS.DELETE_TASK, payload: taskId }),
    
    // Lead actions
    setLeads: (leads) => dispatch({ type: ACTIONS.SET_LEADS, payload: leads }),
    addLead: (lead) => dispatch({ type: ACTIONS.ADD_LEAD, payload: lead }),
    updateLead: (lead) => dispatch({ type: ACTIONS.UPDATE_LEAD, payload: lead }),
    deleteLead: (leadId) => dispatch({ type: ACTIONS.DELETE_LEAD, payload: leadId }),
    
    // Error and notification actions
    setError: (error) => dispatch({ type: ACTIONS.SET_ERROR, payload: error }),
    clearError: () => dispatch({ type: ACTIONS.CLEAR_ERROR }),
    setNotification: (notification) => dispatch({ type: ACTIONS.SET_NOTIFICATION, payload: notification }),
    clearNotification: () => dispatch({ type: ACTIONS.CLEAR_NOTIFICATION })
  }), []);

  // Helper functions
  const helpers = useMemo(() => ({
    // Check if data is fresh (less than 5 minutes old)
    isDataFresh: (lastFetch, maxAge = 5 * 60 * 1000) => {
      return lastFetch && (Date.now() - lastFetch) < maxAge;
    },
    
    // Get cached data if fresh
    getCachedData: (dataType) => {
      const cacheEntry = state.cache[dataType];
      if (cacheEntry && helpers.isDataFresh(cacheEntry.lastFetch)) {
        return cacheEntry.data;
      }
      return null;
    }
  }), [state.cache]);

  const value = useMemo(() => ({
    ...state,
    actions,
    helpers
  }), [state, actions, helpers]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export { ACTIONS };
