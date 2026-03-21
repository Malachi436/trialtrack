/**
 * TrialTrack — Configuration
 * Supabase credentials, constants, and fixed mappings
 */

const CONFIG = {
  // Supabase credentials
  SUPABASE_URL: 'https://cvbrgyaxagrnwipxhocs.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YnJneWF4YWdybndpcHhob2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MzU5ODAsImV4cCI6MjA4OTAxMTk4MH0.SdEX5vhBsSup5hgwIrrZ-oOloX2O1yRwCuVry5_bhnY',
  
  // API settings
  REQUEST_TIMEOUT_MS: 10000,
  DEBOUNCE_MS: 300,
  MAX_CONCURRENT_REQUESTS: 10,
  CACHE_DURATION_MS: 300,
  
  // Auth settings
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  SESSION_KEY: 'trialtrack_session',
  LOGIN_ATTEMPTS_KEY: 'trialtrack_login_attempts',
  LOCKOUT_KEY: 'trialtrack_lockout_until',
  
  // Role definitions
  ROLES: {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    USER: 'user',
    VIEWER: 'viewer'
  },
  
  // Role hierarchy (higher number = more permissions)
  ROLE_HIERARCHY: {
    superadmin: 4,
    admin: 3,
    viewer: 2,
    user: 1
  },
  
  // Treatment codes and full names
  TREATMENTS: {
    I: 'Inorganic Only',
    B: 'Biochar Only',
    O: 'Organic Only',
    OI: 'Organic + Inorganic',
    BO: 'Biochar + Organic',
    BI: 'Biochar + Inorganic'
  },
  
  // Treatment order within each block
  TREATMENT_ORDER: ['I', 'B', 'OI', 'BO', 'O', 'BI'],
  
  // Fixed plot layout - 5 blocks × 6 plots each = 30 plots per field
  // This matches the physical farm design and cannot be changed
  PLOT_LAYOUT: [
    // Block 1: Plots 1-6
    { block: 1, plot: 1, treatment: 'I' },
    { block: 1, plot: 2, treatment: 'B' },
    { block: 1, plot: 3, treatment: 'OI' },
    { block: 1, plot: 4, treatment: 'BO' },
    { block: 1, plot: 5, treatment: 'O' },
    { block: 1, plot: 6, treatment: 'BI' },
    // Block 2: Plots 7-12
    { block: 2, plot: 7, treatment: 'I' },
    { block: 2, plot: 8, treatment: 'B' },
    { block: 2, plot: 9, treatment: 'OI' },
    { block: 2, plot: 10, treatment: 'BO' },
    { block: 2, plot: 11, treatment: 'O' },
    { block: 2, plot: 12, treatment: 'BI' },
    // Block 3: Plots 13-18
    { block: 3, plot: 13, treatment: 'I' },
    { block: 3, plot: 14, treatment: 'B' },
    { block: 3, plot: 15, treatment: 'OI' },
    { block: 3, plot: 16, treatment: 'BO' },
    { block: 3, plot: 17, treatment: 'O' },
    { block: 3, plot: 18, treatment: 'BI' },
    // Block 4: Plots 19-24
    { block: 4, plot: 19, treatment: 'I' },
    { block: 4, plot: 20, treatment: 'B' },
    { block: 4, plot: 21, treatment: 'OI' },
    { block: 4, plot: 22, treatment: 'BO' },
    { block: 4, plot: 23, treatment: 'O' },
    { block: 4, plot: 24, treatment: 'BI' },
    // Block 5: Plots 25-30
    { block: 5, plot: 25, treatment: 'I' },
    { block: 5, plot: 26, treatment: 'B' },
    { block: 5, plot: 27, treatment: 'OI' },
    { block: 5, plot: 28, treatment: 'BO' },
    { block: 5, plot: 29, treatment: 'O' },
    { block: 5, plot: 30, treatment: 'BI' }
  ],
  
  // Number of blocks and plots
  BLOCKS_PER_FIELD: 5,
  PLOTS_PER_BLOCK: 6,
  TOTAL_PLOTS: 30,
  
  // Default measurement settings
  DEFAULT_INTERVAL_DAYS: 14,
  DEFAULT_WINDOW_DAYS: 3,
  
  // Parameter configuration
  MAX_GROWTH_PARAMS: 10,
  MAX_YIELD_PARAMS: 10,
  DEFAULT_GROWTH_PARAM_COUNT: 3,
  DEFAULT_YIELD_PARAM_COUNT: 3,
  
  // Default parameter names
  DEFAULT_GROWTH_PARAMS: ['Height', 'Leaf Count', 'Stem Diameter'],
  DEFAULT_YIELD_PARAMS: ['Fruit Weight', 'Fruit Count', 'Total Yield'],
  
  // Legacy parameter names (for backward compatibility)
  DEFAULT_PARAMETERS: [
    'Parameter 1',
    'Parameter 2',
    'Parameter 3',
    'Parameter 4',
    'Parameter 5',
    'Parameter 6'
  ],
  
  // Soil analysis configuration
  DEFAULT_SOIL_FIELDS: ['pH', 'Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)', 'Organic Matter'],
  SOIL_ANALYSIS_STATUS: {
    NONE: 'none',
    PENDING: 'pending',
    COMPLETE: 'complete'
  },
  
  // Page routes
  ROUTES: {
    LOGIN: 'index.html',
    DASHBOARD: 'dashboard.html',
    FIELD_WORKER: 'field-worker.html',
    ANALYTICS: 'analytics.html',
    ADMIN: 'admin.html'
  },
  
  // Role-based default redirects after login
  ROLE_REDIRECTS: {
    superadmin: 'dashboard.html',
    admin: 'dashboard.html',
    viewer: 'analytics.html',
    user: 'field-worker.html'
  }
};

// Freeze the config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.ROLES);
Object.freeze(CONFIG.ROLE_HIERARCHY);
Object.freeze(CONFIG.TREATMENTS);
Object.freeze(CONFIG.TREATMENT_ORDER);
Object.freeze(CONFIG.PLOT_LAYOUT);
Object.freeze(CONFIG.DEFAULT_PARAMETERS);
Object.freeze(CONFIG.DEFAULT_GROWTH_PARAMS);
Object.freeze(CONFIG.DEFAULT_YIELD_PARAMS);
Object.freeze(CONFIG.DEFAULT_SOIL_FIELDS);
Object.freeze(CONFIG.SOIL_ANALYSIS_STATUS);
Object.freeze(CONFIG.ROUTES);
Object.freeze(CONFIG.ROLE_REDIRECTS);
