/**
 * TrialTrack — Dashboard Module
 * Dashboard page logic for admin/superadmin view
 */

const dashboard = (() => {
  // State
  let currentFieldId = null;
  let fields = [];
  let users = [];
  let rounds = [];
  let entries = [];

  /**
   * Initialize the dashboard
   */
  async function init() {
    await loadInitialData();
    return { fields, users, rounds, entries };
  }

  /**
   * Load all initial data
   */
  async function loadInitialData() {
    // Load fields
    const fieldsResult = await api.getFields();
    if (!fieldsResult.error) {
      fields = fieldsResult.data || [];
    }

    // Load users
    const usersResult = await api.getUsers();
    if (!usersResult.error) {
      users = usersResult.data || [];
    }

    // Load recent entries
    const entriesResult = await api.getRecentEntries(50);
    if (!entriesResult.error) {
      entries = entriesResult.data || [];
    }

    // Load all rounds
    for (const field of fields) {
      const roundsResult = await api.getRoundsForField(field.id);
      if (!roundsResult.error && roundsResult.data) {
        rounds = rounds.concat(roundsResult.data);
      }
    }
  }

  /**
   * Set current field
   * @param {string} fieldId
   */
  function setCurrentField(fieldId) {
    currentFieldId = fieldId;
  }

  /**
   * Get current field
   * @returns {Object|null}
   */
  function getCurrentField() {
    return fields.find(f => f.id === currentFieldId) || null;
  }

  /**
   * Get KPI statistics
   * @returns {Object}
   */
  function getKPIs() {
    const totalFields = fields.length;
    const totalEntries = entries.length;
    
    // Active rounds (rounds created in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeRounds = rounds.filter(r => 
      new Date(r.created_at) >= thirtyDaysAgo
    ).length;

    // Completion percentage (current round across all fields)
    let totalPlots = 0;
    let enteredPlots = 0;

    for (const field of fields) {
      const latestRound = rounds
        .filter(r => r.field_id === field.id)
        .sort((a, b) => b.round_number - a.round_number)[0];

      if (latestRound) {
        totalPlots += CONFIG.TOTAL_PLOTS;
        const roundEntries = entries.filter(e => e.round_id === latestRound.id);
        enteredPlots += new Set(roundEntries.map(e => e.plot_number)).size;
      }
    }

    const completionPercent = totalPlots > 0 
      ? Math.round((enteredPlots / totalPlots) * 100) 
      : 0;

    return {
      totalFields,
      activeRounds,
      totalEntries,
      completionPercent
    };
  }

  /**
   * Get field cards data
   * @returns {Array}
   */
  function getFieldCards() {
    return fields.map(field => {
      const fieldRounds = rounds
        .filter(r => r.field_id === field.id)
        .sort((a, b) => b.round_number - a.round_number);
      
      const latestRound = fieldRounds[0] || null;
      const roundEntries = latestRound 
        ? entries.filter(e => e.round_id === latestRound.id)
        : [];
      
      const enteredPlots = new Set(roundEntries.map(e => e.plot_number)).size;
      const progressPercent = Math.round((enteredPlots / CONFIG.TOTAL_PLOTS) * 100);
      
      const lastEntry = entries
        .filter(e => e.field_id === field.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

      return {
        ...field,
        latestRound,
        roundCount: fieldRounds.length,
        enteredPlots,
        progressPercent,
        lastEntry
      };
    });
  }

  /**
   * Get recent activity
   * @param {number} limit
   * @returns {Array}
   */
  function getRecentActivity(limit = 10) {
    return entries
      .slice(0, limit)
      .map(entry => {
        const field = fields.find(f => f.id === entry.field_id);
        const round = rounds.find(r => r.id === entry.round_id);
        
        return {
          ...entry,
          fieldName: field?.name || 'Unknown Field',
          roundNumber: round?.round_number || '?'
        };
      });
  }

  /**
   * Get treatment statistics for current round
   * @returns {Array}
   */
  function getTreatmentStats() {
    const stats = {};
    
    // Initialize all treatments
    CONFIG.TREATMENT_ORDER.forEach(t => {
      stats[t] = { count: 0, p1: [], p2: [], p3: [], p4: [], p5: [], p6: [] };
    });

    // Get entries from latest rounds
    for (const field of fields) {
      const latestRound = rounds
        .filter(r => r.field_id === field.id)
        .sort((a, b) => b.round_number - a.round_number)[0];

      if (latestRound) {
        const roundEntries = entries.filter(e => e.round_id === latestRound.id);
        
        for (const entry of roundEntries) {
          if (stats[entry.treatment]) {
            stats[entry.treatment].count++;
            if (entry.p1 !== null) stats[entry.treatment].p1.push(entry.p1);
            if (entry.p2 !== null) stats[entry.treatment].p2.push(entry.p2);
            if (entry.p3 !== null) stats[entry.treatment].p3.push(entry.p3);
            if (entry.p4 !== null) stats[entry.treatment].p4.push(entry.p4);
            if (entry.p5 !== null) stats[entry.treatment].p5.push(entry.p5);
            if (entry.p6 !== null) stats[entry.treatment].p6.push(entry.p6);
          }
        }
      }
    }

    // Calculate averages
    return CONFIG.TREATMENT_ORDER.map(treatment => {
      const data = stats[treatment];
      return {
        treatment,
        label: CONFIG.TREATMENTS[treatment],
        count: data.count,
        avgP1: utils.average(data.p1),
        avgP2: utils.average(data.p2),
        avgP3: utils.average(data.p3),
        avgP4: utils.average(data.p4),
        avgP5: utils.average(data.p5),
        avgP6: utils.average(data.p6)
      };
    });
  }

  /**
   * Refresh data
   */
  async function refresh() {
    fields = [];
    users = [];
    rounds = [];
    entries = [];
    await loadInitialData();
  }

  // Public API
  return {
    init,
    setCurrentField,
    getCurrentField,
    getKPIs,
    getFieldCards,
    getRecentActivity,
    getTreatmentStats,
    refresh
  };
})();

// Freeze dashboard object
Object.freeze(dashboard);
