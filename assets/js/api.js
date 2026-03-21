/**
 * TrialTrack — API Layer
 * Centralized Supabase fetch calls with error handling, timeouts, and caching
 * 
 * All functions return: { data: any, error: string|null }
 * Never throws uncaught exceptions - always returns error in response object
 */

const api = (() => {
  // Request cache for deduplication
  const requestCache = new Map();
  
  // Active request count for concurrency limiting
  let activeRequests = 0;
  const requestQueue = [];

  /**
   * Build Supabase REST API URL
   * @param {string} table - Table name
   * @param {string} query - Query string (without ?)
   * @returns {string} - Full URL
   */
  function buildUrl(table, query = '') {
    const base = `${CONFIG.SUPABASE_URL}/rest/v1/${table}`;
    return query ? `${base}?${query}` : base;
  }

  /**
   * Get standard headers for Supabase requests
   * @param {Object} extra - Additional headers
   * @returns {Object} - Headers object
   */
  function getHeaders(extra = {}) {
    return {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...extra
    };
  }

  /**
   * Execute a fetch request with timeout and error handling
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - { data, error }
   */
  async function request(url, options = {}) {
    // Check cache for duplicate requests
    const cacheKey = `${options.method || 'GET'}:${url}:${options.body || ''}`;
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION_MS) {
      return cached.response;
    }

    // Concurrency limiting
    if (activeRequests >= CONFIG.MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => requestQueue.push(resolve));
    }
    activeRequests++;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers: getHeaders(options.headers),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Request failed: ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          if (errorText) errorMessage = errorText;
        }
        
        return { data: null, error: errorMessage };
      }

      // Handle empty response (e.g., for DELETE operations)
      const contentType = response.headers.get('content-type');
      let data = null;
      
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        data = text ? JSON.parse(text) : null;
      }

      const result = { data, error: null };
      
      // Cache successful GET requests
      if (!options.method || options.method === 'GET') {
        requestCache.set(cacheKey, { response: result, timestamp: Date.now() });
      }

      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        return { data: null, error: 'Request timed out. Please try again.' };
      }
      
      console.error('API request error:', error);
      return { data: null, error: 'Network error. Please check your connection.' };
      
    } finally {
      activeRequests--;
      if (requestQueue.length > 0) {
        const next = requestQueue.shift();
        next();
      }
    }
  }

  /**
   * Clear the request cache
   */
  function clearCache() {
    requestCache.clear();
  }

  // ============================================
  // AUTH / USERS
  // ============================================

  /**
   * Get user by username
   * @param {string} username
   * @returns {Promise<Object>} - { data: user|null, error }
   */
  async function getUser(username) {
    const sanitized = utils.sanitize(username);
    const url = buildUrl('users', `username=eq.${encodeURIComponent(sanitized)}&select=*`);
    const result = await request(url);
    
    if (result.error) return result;
    return { data: result.data?.[0] || null, error: null };
  }

  /**
   * Create login attempt record
   * @param {string} username
   * @param {boolean} success
   * @returns {Promise<Object>}
   */
  async function createLoginAttempt(username, success) {
    const url = buildUrl('login_attempts');
    return request(url, {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        username: utils.sanitize(username),
        success,
        attempted_at: new Date().toISOString()
      })
    });
  }

  /**
   * Get login attempts for a user since a specific time
   * @param {string} username
   * @param {Date} since
   * @returns {Promise<Object>}
   */
  async function getLoginAttempts(username, since) {
    const sanitized = utils.sanitize(username);
    const sinceISO = since.toISOString();
    const url = buildUrl('login_attempts', 
      `username=eq.${encodeURIComponent(sanitized)}&attempted_at=gte.${encodeURIComponent(sinceISO)}&select=*`
    );
    return request(url);
  }

  /**
   * Get all users
   * @returns {Promise<Object>}
   */
  async function getUsers() {
    const url = buildUrl('users', 'select=id,username,role,field_id,created_at&order=created_at.desc');
    return request(url);
  }

  /**
   * Create a new user
   * @param {Object} userData - { username, password, role, field_id }
   * @returns {Promise<Object>}
   */
  async function createUser(userData) {
    const sanitized = utils.sanitizeObject(userData);
    const url = buildUrl('users');
    return request(url, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        ...sanitized,
        created_at: new Date().toISOString()
      })
    });
  }

  /**
   * Update an existing user
   * @param {string} userId
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  async function updateUser(userId, userData) {
    const sanitized = utils.sanitizeObject(userData);
    const url = buildUrl('users', `id=eq.${encodeURIComponent(userId)}`);
    return request(url, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(sanitized)
    });
  }

  /**
   * Delete a user
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async function deleteUser(userId) {
    const url = buildUrl('users', `id=eq.${encodeURIComponent(userId)}`);
    return request(url, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
  }

  // ============================================
  // FIELDS
  // ============================================

  /**
   * Get all fields
   * @returns {Promise<Object>}
   */
  async function getFields() {
    const url = buildUrl('fields', 'select=*&order=created_at.desc');
    return request(url);
  }

  /**
   * Get a single field by ID
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getField(fieldId) {
    const url = buildUrl('fields', `id=eq.${encodeURIComponent(fieldId)}&select=*`);
    console.log('[API] getField fetching:', url);
    const result = await request(url);
    
    console.log('[API] getField result:', result);
    if (!result.error && result.data) {
      console.log('[API] Field growth_params from DB:', result.data[0]?.growth_params);
      console.log('[API] Field yield_params from DB:', result.data[0]?.yield_params);
    }
    
    if (result.error) return result;
    return { data: result.data?.[0] || null, error: null };
  }

  /**
   * Create a new field
   * @param {Object} fieldData
   * @returns {Promise<Object>}
   */
  async function createField(fieldData) {
    console.log('[API] createField sending data:', fieldData);
    console.log('[API] growth_params type:', typeof fieldData.growth_params, fieldData.growth_params);
    console.log('[API] growth_params isArray:', Array.isArray(fieldData.growth_params));
    
    const sanitized = utils.sanitizeObject(fieldData);
    console.log('[API] After sanitize, growth_params:', sanitized.growth_params);
    
    const bodyData = {
      ...sanitized,
      created_at: new Date().toISOString()
    };
    console.log('[API] Body data to stringify:', bodyData);
    console.log('[API] JSON.stringify preview:', JSON.stringify(bodyData).substring(0, 500));
    
    const url = buildUrl('fields');
    return request(url, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(bodyData)
    });
  }

  /**
   * Update a field
   * @param {string} fieldId
   * @param {Object} fieldData
   * @returns {Promise<Object>}
   */
  async function updateField(fieldId, fieldData) {
    const sanitized = utils.sanitizeObject(fieldData);
    const url = buildUrl('fields', `id=eq.${encodeURIComponent(fieldId)}`);
    return request(url, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(sanitized)
    });
  }

  /**
   * Delete a field
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function deleteField(fieldId) {
    const url = buildUrl('fields', `id=eq.${encodeURIComponent(fieldId)}`);
    return request(url, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
  }

  /**
   * Get field settings (parameters, intervals, soil analysis config)
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getFieldSettings(fieldId) {
    const url = buildUrl('fields', 
      `id=eq.${encodeURIComponent(fieldId)}&select=id,name,measurement_interval_days,window_days,param1,param2,param3,param4,param5,param6,growth_param_count,yield_param_count,growth_params,yield_params,soil_analysis_fields,soil_before_status,soil_after_status`
    );
    const result = await request(url);
    
    if (result.error) return result;
    return { data: result.data?.[0] || null, error: null };
  }

  /**
   * Update field settings
   * @param {string} fieldId
   * @param {Object} settings
   * @returns {Promise<Object>}
   */
  async function updateFieldSettings(fieldId, settings) {
    return updateField(fieldId, settings);
  }

  // ============================================
  // BLOCKS & PLOTS
  // ============================================

  /**
   * Get all blocks for a field
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getBlocksForField(fieldId) {
    const url = buildUrl('blocks', 
      `field_id=eq.${encodeURIComponent(fieldId)}&select=*&order=block_number.asc`
    );
    return request(url);
  }

  /**
   * Get all plots for a field
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getPlotsForField(fieldId) {
    const url = buildUrl('plots', 
      `field_id=eq.${encodeURIComponent(fieldId)}&select=*&order=plot_number.asc`
    );
    return request(url);
  }

  /**
   * Seed field structure - creates all 5 blocks and 30 plots
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function seedFieldStructure(fieldId) {
    try {
      // Create 5 blocks
      const blocks = [];
      for (let i = 1; i <= CONFIG.BLOCKS_PER_FIELD; i++) {
        blocks.push({
          id: utils.generateUUID(),
          field_id: fieldId,
          block_number: i
        });
      }

      const blocksUrl = buildUrl('blocks');
      const blocksResult = await request(blocksUrl, {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(blocks)
      });

      if (blocksResult.error) {
        return { data: null, error: `Failed to create blocks: ${blocksResult.error}` };
      }

      // Create 30 plots using the fixed layout
      const plots = CONFIG.PLOT_LAYOUT.map(layout => {
        const block = blocksResult.data.find(b => b.block_number === layout.block);
        return {
          id: utils.generateUUID(),
          field_id: fieldId,
          block_id: block.id,
          plot_number: layout.plot,
          treatment: layout.treatment
        };
      });

      const plotsUrl = buildUrl('plots');
      const plotsResult = await request(plotsUrl, {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(plots)
      });

      if (plotsResult.error) {
        return { data: null, error: `Failed to create plots: ${plotsResult.error}` };
      }

      return { 
        data: { 
          blocks: blocksResult.data, 
          plots: plotsResult.data 
        }, 
        error: null 
      };

    } catch (error) {
      console.error('Error seeding field structure:', error);
      return { data: null, error: 'Failed to seed field structure.' };
    }
  }

  // ============================================
  // ROUNDS
  // ============================================

  /**
   * Get all rounds for a field
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getRoundsForField(fieldId) {
    const url = buildUrl('rounds', 
      `field_id=eq.${encodeURIComponent(fieldId)}&select=*&order=round_number.desc`
    );
    return request(url);
  }

  /**
   * Get the latest round for a field
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getLatestRound(fieldId) {
    const url = buildUrl('rounds', 
      `field_id=eq.${encodeURIComponent(fieldId)}&select=*&order=round_number.desc&limit=1`
    );
    const result = await request(url);
    
    if (result.error) return result;
    return { data: result.data?.[0] || null, error: null };
  }

  /**
   * Create a new round
   * @param {Object} roundData - { field_id, round_number, recorded_date }
   * @returns {Promise<Object>}
   */
  async function createRound(roundData) {
    const url = buildUrl('rounds');
    return request(url, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        ...roundData,
        created_at: new Date().toISOString()
      })
    });
  }

  /**
   * Delete a round (cascades to entries)
   * @param {string} roundId
   * @returns {Promise<Object>}
   */
  async function deleteRound(roundId) {
    // First delete all entries for this round
    const entriesUrl = buildUrl('entries', `round_id=eq.${encodeURIComponent(roundId)}`);
    await request(entriesUrl, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });

    // Then delete the round
    const roundUrl = buildUrl('rounds', `id=eq.${encodeURIComponent(roundId)}`);
    return request(roundUrl, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
  }

  /**
   * Force delete a field and all associated data (entries, rounds, plots, blocks)
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function forceDeleteField(fieldId) {
    // 1. Delete all entries for this field
    const entriesUrl = buildUrl('entries', `field_id=eq.${encodeURIComponent(fieldId)}`);
    const entriesResult = await request(entriesUrl, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
    if (entriesResult.error) {
      return { error: 'Failed to delete entries: ' + entriesResult.error };
    }

    // 2. Delete all rounds for this field
    const roundsUrl = buildUrl('rounds', `field_id=eq.${encodeURIComponent(fieldId)}`);
    const roundsResult = await request(roundsUrl, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
    if (roundsResult.error) {
      return { error: 'Failed to delete rounds: ' + roundsResult.error };
    }

    // 3. Delete all plots for this field
    const plotsUrl = buildUrl('plots', `field_id=eq.${encodeURIComponent(fieldId)}`);
    const plotsResult = await request(plotsUrl, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
    if (plotsResult.error) {
      return { error: 'Failed to delete plots: ' + plotsResult.error };
    }

    // 4. Delete all blocks for this field
    const blocksUrl = buildUrl('blocks', `field_id=eq.${encodeURIComponent(fieldId)}`);
    const blocksResult = await request(blocksUrl, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
    if (blocksResult.error) {
      return { error: 'Failed to delete blocks: ' + blocksResult.error };
    }

    // 5. Finally delete the field itself
    const fieldUrl = buildUrl('fields', `id=eq.${encodeURIComponent(fieldId)}`);
    return request(fieldUrl, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
  }

  // ============================================
  // ENTRIES
  // ============================================

  /**
   * Get all entries for a round
   * @param {string} roundId
   * @returns {Promise<Object>}
   */
  async function getEntriesForRound(roundId) {
    const url = buildUrl('entries', 
      `round_id=eq.${encodeURIComponent(roundId)}&select=*&order=plot_number.asc`
    );
    return request(url);
  }

  /**
   * Get all entries for a field (across all rounds)
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getEntriesForField(fieldId) {
    const url = buildUrl('entries', 
      `field_id=eq.${encodeURIComponent(fieldId)}&select=*&order=created_at.desc`
    );
    return request(url);
  }

  /**
   * Get entries for a specific treatment in a field
   * @param {string} fieldId
   * @param {string} treatment
   * @returns {Promise<Object>}
   */
  async function getEntriesByTreatment(fieldId, treatment) {
    const url = buildUrl('entries', 
      `field_id=eq.${encodeURIComponent(fieldId)}&treatment=eq.${encodeURIComponent(treatment)}&select=*&order=created_at.desc`
    );
    return request(url);
  }

  /**
   * Get entries with round info for analytics
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getEntriesForAnalytics(fieldId) {
    // Get all entries for the field
    const entriesResult = await getEntriesForField(fieldId);
    if (entriesResult.error) return entriesResult;

    // Get all rounds for the field
    const roundsResult = await getRoundsForField(fieldId);
    if (roundsResult.error) return roundsResult;

    // Join entries with round data
    const roundsMap = new Map(roundsResult.data.map(r => [r.id, r]));
    const entriesWithRounds = entriesResult.data.map(entry => ({
      ...entry,
      round: roundsMap.get(entry.round_id) || null
    }));

    return { data: entriesWithRounds, error: null };
  }

  /**
   * Save a new entry
   * @param {Object} entryData
   * @returns {Promise<Object>}
   */
  async function saveEntry(entryData) {
    const sanitized = utils.sanitizeObject(entryData);
    const url = buildUrl('entries');
    return request(url, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        ...sanitized,
        created_at: new Date().toISOString()
      })
    });
  }

  /**
   * Update an existing entry
   * @param {string} entryId
   * @param {Object} entryData
   * @returns {Promise<Object>}
   */
  async function updateEntry(entryId, entryData) {
    const sanitized = utils.sanitizeObject(entryData);
    const url = buildUrl('entries', `id=eq.${encodeURIComponent(entryId)}`);
    return request(url, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(sanitized)
    });
  }

  /**
   * Get entry by round and plot (to check for duplicates)
   * @param {string} roundId
   * @param {number} plotNumber
   * @returns {Promise<Object>}
   */
  async function getEntryByRoundAndPlot(roundId, plotNumber) {
    const url = buildUrl('entries', 
      `round_id=eq.${encodeURIComponent(roundId)}&plot_number=eq.${plotNumber}&select=*`
    );
    const result = await request(url);
    
    if (result.error) return result;
    return { data: result.data?.[0] || null, error: null };
  }

  /**
   * Get recent entries across all fields (for activity feed)
   * @param {number} limit - Number of entries to return
   * @returns {Promise<Object>}
   */
  async function getRecentEntries(limit = 10) {
    const url = buildUrl('entries', 
      `select=*&order=created_at.desc&limit=${limit}`
    );
    return request(url);
  }

  /**
   * Get entry count for a round
   * @param {string} roundId
   * @returns {Promise<Object>}
   */
  async function getEntryCountForRound(roundId) {
    const url = buildUrl('entries', 
      `round_id=eq.${encodeURIComponent(roundId)}&select=id`
    );
    const result = await request(url);
    
    if (result.error) return result;
    return { data: result.data?.length || 0, error: null };
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get total entry count
   * @returns {Promise<Object>}
   */
  async function getTotalEntryCount() {
    const url = buildUrl('entries', 'select=id');
    const result = await request(url);
    
    if (result.error) return result;
    return { data: result.data?.length || 0, error: null };
  }

  /**
   * Get field count
   * @returns {Promise<Object>}
   */
  async function getFieldCount() {
    const url = buildUrl('fields', 'select=id');
    const result = await request(url);
    
    if (result.error) return result;
    return { data: result.data?.length || 0, error: null };
  }

  /**
   * Get active rounds count (rounds with at least one entry in the last 30 days)
   * @returns {Promise<Object>}
   */
  async function getActiveRoundsCount() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const url = buildUrl('rounds', 
      `created_at=gte.${encodeURIComponent(thirtyDaysAgo.toISOString())}&select=id`
    );
    const result = await request(url);
    
    if (result.error) return result;
    return { data: result.data?.length || 0, error: null };
  }

  // ============================================
  // SOIL ANALYSIS
  // ============================================

  /**
   * Get soil analysis records for a field
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getSoilAnalysis(fieldId) {
    const url = buildUrl('soil_analysis', 
      `field_id=eq.${encodeURIComponent(fieldId)}&select=*&order=analysis_type.asc`
    );
    return request(url);
  }

  /**
   * Get soil analysis by type (before/after)
   * @param {string} fieldId
   * @param {string} analysisType - 'before' or 'after'
   * @returns {Promise<Object>}
   */
  async function getSoilAnalysisByType(fieldId, analysisType) {
    const url = buildUrl('soil_analysis', 
      `field_id=eq.${encodeURIComponent(fieldId)}&analysis_type=eq.${encodeURIComponent(analysisType)}&select=*`
    );
    const result = await request(url);
    
    if (result.error) return result;
    return { data: result.data?.[0] || null, error: null };
  }

  /**
   * Save soil analysis record
   * @param {Object} analysisData - { field_id, analysis_type, recorded_by, recorded_by_name, recorded_date, data }
   * @returns {Promise<Object>}
   */
  async function saveSoilAnalysis(analysisData) {
    const url = buildUrl('soil_analysis');
    return request(url, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        ...analysisData,
        created_at: new Date().toISOString()
      })
    });
  }

  /**
   * Update soil analysis status on field
   * @param {string} fieldId
   * @param {string} statusType - 'soil_before_status' or 'soil_after_status'
   * @param {string} status - 'none', 'pending', 'complete'
   * @returns {Promise<Object>}
   */
  async function updateSoilAnalysisStatus(fieldId, statusType, status) {
    return updateField(fieldId, { [statusType]: status });
  }

  // Return public API
  return {
    // Utils
    clearCache,
    
    // Auth / Users
    getUser,
    createLoginAttempt,
    getLoginAttempts,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    
    // Fields
    getFields,
    getField,
    createField,
    updateField,
    deleteField,
    forceDeleteField,
    getFieldSettings,
    updateFieldSettings,
    
    // Blocks & Plots
    getBlocksForField,
    getPlotsForField,
    seedFieldStructure,
    
    // Rounds
    getRoundsForField,
    getLatestRound,
    createRound,
    deleteRound,
    
    // Entries
    getEntriesForRound,
    getEntriesForField,
    getEntriesByTreatment,
    getEntriesForAnalytics,
    saveEntry,
    updateEntry,
    getEntryByRoundAndPlot,
    getRecentEntries,
    getEntryCountForRound,
    
    // Statistics
    getTotalEntryCount,
    getFieldCount,
    getActiveRoundsCount,
    
    // Soil Analysis
    getSoilAnalysis,
    getSoilAnalysisByType,
    saveSoilAnalysis,
    updateSoilAnalysisStatus
  };
})();

// Freeze api object
Object.freeze(api);
