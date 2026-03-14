/**
 * TrialTrack — Admin Module
 * User management, field management, and admin panel logic
 */

const admin = (() => {
  // State
  let users = [];
  let fields = [];
  let currentTab = 'users'; // 'users' or 'fields'

  /**
   * Initialize admin module
   */
  async function init() {
    await loadData();
    return { users, fields };
  }

  /**
   * Load all data
   */
  async function loadData() {
    // Load users
    const usersResult = await api.getUsers();
    if (!usersResult.error) {
      users = usersResult.data || [];
    }

    // Load fields
    const fieldsResult = await api.getFields();
    if (!fieldsResult.error) {
      fields = fieldsResult.data || [];
    }
  }

  /**
   * Set current tab
   */
  function setTab(tab) {
    currentTab = tab;
  }

  /**
   * Get all users
   */
  function getUsers() {
    return users;
  }

  /**
   * Get all fields
   */
  function getFields() {
    return fields;
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  /**
   * Create a new user
   * @param {Object} userData - { username, password, role, field_id }
   * @returns {Promise<Object>}
   */
  async function createUser(userData) {
    // Validate
    if (!userData.username || userData.username.length < 3) {
      return { error: 'Username must be at least 3 characters.' };
    }
    if (!userData.password || userData.password.length < 6) {
      return { error: 'Password must be at least 6 characters.' };
    }
    if (userData.username.includes(' ')) {
      return { error: 'Username cannot contain spaces.' };
    }

    // Check for duplicate username
    if (users.find(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
      return { error: 'Username already exists.' };
    }

    const result = await api.createUser({
      username: userData.username,
      password: userData.password,
      role: userData.role || 'user',
      field_id: userData.field_id || null
    });

    if (!result.error) {
      await loadData();
    }

    return result;
  }

  /**
   * Update a user
   * @param {string} userId
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  async function updateUser(userId, userData) {
    // Validate username if provided
    if (userData.username !== undefined) {
      if (userData.username.length < 3) {
        return { error: 'Username must be at least 3 characters.' };
      }
      if (userData.username.includes(' ')) {
        return { error: 'Username cannot contain spaces.' };
      }
      // Check for duplicate
      const existing = users.find(u => 
        u.username.toLowerCase() === userData.username.toLowerCase() && u.id !== userId
      );
      if (existing) {
        return { error: 'Username already exists.' };
      }
    }

    // Validate password if provided
    if (userData.password !== undefined && userData.password !== '' && userData.password.length < 6) {
      return { error: 'Password must be at least 6 characters.' };
    }

    // Build update object (don't update password if empty)
    const updateData = { ...userData };
    if (updateData.password === '') {
      delete updateData.password;
    }

    const result = await api.updateUser(userId, updateData);

    if (!result.error) {
      await loadData();
    }

    return result;
  }

  /**
   * Delete a user
   * @param {string} userId
   * @param {string} currentUserId - Current logged-in user ID
   * @returns {Promise<Object>}
   */
  async function deleteUser(userId, currentUserId) {
    // Cannot delete yourself
    if (userId === currentUserId) {
      return { error: 'You cannot delete your own account.' };
    }

    // Check if this is the last superadmin
    const user = users.find(u => u.id === userId);
    if (user && user.role === 'superadmin') {
      const superadminCount = users.filter(u => u.role === 'superadmin').length;
      if (superadminCount <= 1) {
        return { error: 'Cannot delete the last superadmin account.' };
      }
    }

    const result = await api.deleteUser(userId);

    if (!result.error) {
      await loadData();
    }

    return result;
  }

  // ============================================
  // FIELD MANAGEMENT
  // ============================================

  /**
   * Create a new field
   * @param {Object} fieldData
   * @returns {Promise<Object>}
   */
  async function createField(fieldData) {
    // Validate
    if (!fieldData.name || fieldData.name.trim().length === 0) {
      return { error: 'Field name is required.' };
    }
    if (!fieldData.planting_date) {
      return { error: 'Planting date is required.' };
    }

    // Create field
    const field = {
      name: fieldData.name.trim(),
      location: fieldData.location?.trim() || null,
      planting_date: fieldData.planting_date,
      measurement_interval_days: fieldData.measurement_interval_days || CONFIG.DEFAULT_INTERVAL_DAYS,
      window_days: fieldData.window_days || CONFIG.DEFAULT_WINDOW_DAYS,
      param1: fieldData.param1 || 'Parameter 1',
      param2: fieldData.param2 || 'Parameter 2',
      param3: fieldData.param3 || 'Parameter 3',
      param4: fieldData.param4 || 'Parameter 4',
      param5: fieldData.param5 || 'Parameter 5',
      param6: fieldData.param6 || 'Parameter 6'
    };

    const result = await api.createField(field);

    if (!result.error && result.data) {
      const newField = result.data[0] || result.data;
      
      // Seed the field structure (blocks and plots)
      const seedResult = await api.seedFieldStructure(newField.id);
      if (seedResult.error) {
        console.error('Failed to seed field structure:', seedResult.error);
        // Still consider it a success - can retry seeding
      }
      
      await loadData();
    }

    return result;
  }

  /**
   * Update a field
   * @param {string} fieldId
   * @param {Object} fieldData
   * @returns {Promise<Object>}
   */
  async function updateField(fieldId, fieldData) {
    // Validate
    if (fieldData.name !== undefined && fieldData.name.trim().length === 0) {
      return { error: 'Field name is required.' };
    }

    // Check if planting date can be changed
    const field = fields.find(f => f.id === fieldId);
    if (field && fieldData.planting_date && fieldData.planting_date !== field.planting_date) {
      // Check if rounds exist
      const roundsResult = await api.getRoundsForField(fieldId);
      if (!roundsResult.error && roundsResult.data && roundsResult.data.length > 0) {
        return { error: 'Cannot change planting date after rounds have been created.' };
      }
    }

    const result = await api.updateField(fieldId, fieldData);

    if (!result.error) {
      await loadData();
    }

    return result;
  }

  /**
   * Delete a field
   * @param {string} fieldId
   * @param {boolean} force - Force delete even if entries exist
   * @returns {Promise<Object>}
   */
  async function deleteField(fieldId, force = false) {
    // Check if field has entries
    const entriesResult = await api.getEntriesForField(fieldId);
    const hasEntries = !entriesResult.error && entriesResult.data && entriesResult.data.length > 0;
    
    if (hasEntries && !force) {
      // Return info about entries so UI can show force delete option
      const roundsResult = await api.getRoundsForField(fieldId);
      const roundCount = roundsResult.data ? roundsResult.data.length : 0;
      const entryCount = entriesResult.data.length;
      return { 
        error: 'HAS_ENTRIES',
        entryCount,
        roundCount,
        message: `This field has ${entryCount} data entries across ${roundCount} round(s). Force delete will permanently remove ALL data.`
      };
    }

    // If force delete or no entries, proceed with deletion
    let result;
    if (hasEntries && force) {
      result = await api.forceDeleteField(fieldId);
    } else {
      // Delete plots and blocks first (cascade)
      result = await api.deleteField(fieldId);
    }

    if (!result.error) {
      await loadData();
    }

    return result;
  }

  /**
   * Get field details with blocks and plots
   * @param {string} fieldId
   * @returns {Promise<Object>}
   */
  async function getFieldDetails(fieldId) {
    const field = fields.find(f => f.id === fieldId);
    if (!field) {
      return { error: 'Field not found.' };
    }

    const blocksResult = await api.getBlocksForField(fieldId);
    const plotsResult = await api.getPlotsForField(fieldId);
    const roundsResult = await api.getRoundsForField(fieldId);

    return {
      field,
      blocks: blocksResult.data || [],
      plots: plotsResult.data || [],
      rounds: roundsResult.data || []
    };
  }

  /**
   * Refresh data
   */
  async function refresh() {
    await loadData();
  }

  // Public API
  return {
    init,
    setTab,
    getUsers,
    getFields,
    createUser,
    updateUser,
    deleteUser,
    createField,
    updateField,
    deleteField,
    getFieldDetails,
    refresh
  };
})();

// Freeze admin object
Object.freeze(admin);
