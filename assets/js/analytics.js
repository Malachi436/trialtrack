/**
 * TrialTrack — Analytics Module
 * Analytics page logic for charts and data visualization
 */

const analytics = (() => {
  // State
  let currentFieldId = null;
  let currentParam = 'p1';
  let currentRoundFilter = 'current'; // 'current', 'all', or specific round number
  let fields = [];
  let rounds = [];
  let entries = [];
  let plots = [];

  /**
   * Initialize analytics
   * @param {string|null} fieldId - Initial field ID
   */
  async function init(fieldId = null) {
    await loadData();
    
    if (fieldId && fields.find(f => f.id === fieldId)) {
      currentFieldId = fieldId;
    } else if (fields.length > 0) {
      currentFieldId = fields[0].id;
    }
    
    return { fields, currentFieldId };
  }

  /**
   * Load all data
   */
  async function loadData() {
    // Load fields
    const fieldsResult = await api.getFields();
    if (!fieldsResult.error) {
      fields = fieldsResult.data || [];
    }

    // Load data for all fields
    for (const field of fields) {
      // Load rounds
      const roundsResult = await api.getRoundsForField(field.id);
      if (!roundsResult.error && roundsResult.data) {
        rounds = rounds.concat(roundsResult.data.map(r => ({ ...r, field_id: field.id })));
      }

      // Load entries
      const entriesResult = await api.getEntriesForField(field.id);
      if (!entriesResult.error && entriesResult.data) {
        entries = entries.concat(entriesResult.data.map(e => ({ ...e, field_id: field.id })));
      }

      // Load plots
      const plotsResult = await api.getPlotsForField(field.id);
      if (!plotsResult.error && plotsResult.data) {
        plots = plots.concat(plotsResult.data.map(p => ({ ...p, field_id: field.id })));
      }
    }
  }

  /**
   * Set current field
   */
  function setField(fieldId) {
    currentFieldId = fieldId;
  }

  /**
   * Set current parameter
   */
  function setParam(param) {
    currentParam = param;
  }

  /**
   * Set round filter
   * @param {string|number} filter - 'current', 'all', or specific round number
   */
  function setRoundFilter(filter) {
    currentRoundFilter = filter;
  }

  /**
   * Get current round filter
   */
  function getRoundFilter() {
    return currentRoundFilter;
  }

  /**
   * Get current field
   */
  function getCurrentField() {
    return fields.find(f => f.id === currentFieldId) || null;
  }

  /**
   * Get the target round based on filter
   */
  function getTargetRound() {
    const fieldRounds = rounds.filter(r => r.field_id === currentFieldId);
    
    if (currentRoundFilter === 'current') {
      return fieldRounds.sort((a, b) => b.round_number - a.round_number)[0];
    } else if (currentRoundFilter === 'all') {
      return null; // All rounds
    } else {
      return fieldRounds.find(r => r.round_number === parseInt(currentRoundFilter));
    }
  }

  /**
   * Get treatment bar chart data
   */
  function getTreatmentBarData() {
    const fieldRounds = rounds.filter(r => r.field_id === currentFieldId);
    let targetEntries;
    
    if (currentRoundFilter === 'all') {
      // Average across all rounds
      targetEntries = entries.filter(e => e.field_id === currentFieldId);
    } else {
      const targetRound = getTargetRound();
      if (!targetRound) {
        return CONFIG.TREATMENT_ORDER.map(t => ({
          treatment: t,
          value: 0,
          label: CONFIG.TREATMENTS[t]
        }));
      }
      targetEntries = entries.filter(e => e.round_id === targetRound.id);
    }

    const values = {};

    CONFIG.TREATMENT_ORDER.forEach(t => {
      const treatmentEntries = targetEntries.filter(e => e.treatment === t);
      const paramValues = treatmentEntries
        .map(e => e[currentParam])
        .filter(v => v !== null && v !== undefined);
      values[t] = utils.average(paramValues) || 0;
    });

    return CONFIG.TREATMENT_ORDER.map(t => ({
      treatment: t,
      value: values[t],
      label: CONFIG.TREATMENTS[t]
    }));
  }

  /**
   * Get trend line chart data
   */
  function getTrendData() {
    const fieldRounds = rounds
      .filter(r => r.field_id === currentFieldId)
      .sort((a, b) => a.round_number - b.round_number);

    if (fieldRounds.length === 0) {
      return { rounds: [], treatments: {} };
    }

    const treatments = {};
    CONFIG.TREATMENT_ORDER.forEach(t => {
      treatments[t] = [];
    });

    fieldRounds.forEach(round => {
      const roundEntries = entries.filter(e => e.round_id === round.id);
      
      CONFIG.TREATMENT_ORDER.forEach(t => {
        const treatmentEntries = roundEntries.filter(e => e.treatment === t);
        const paramValues = treatmentEntries
          .map(e => e[currentParam])
          .filter(v => v !== null && v !== undefined);
        treatments[t].push(utils.average(paramValues) || null);
      });
    });

    return {
      rounds: fieldRounds.map(r => r.round_number),
      treatments
    };
  }

  /**
   * Get progress over time data - shows completion percentage per round
   */
  function getProgressOverTimeData() {
    const fieldRounds = rounds
      .filter(r => r.field_id === currentFieldId)
      .sort((a, b) => a.round_number - b.round_number);

    if (fieldRounds.length === 0) {
      return { rounds: [], progress: [] };
    }

    const progress = fieldRounds.map(round => {
      const roundEntries = entries.filter(e => e.round_id === round.id);
      const uniquePlots = new Set(roundEntries.map(e => e.plot_number));
      const percentage = Math.round((uniquePlots.size / CONFIG.TOTAL_PLOTS) * 100);
      return {
        roundNumber: round.round_number,
        completedPlots: uniquePlots.size,
        totalPlots: CONFIG.TOTAL_PLOTS,
        percentage,
        date: round.recorded_date
      };
    });

    return {
      rounds: fieldRounds.map(r => `R${r.round_number}`),
      progress
    };
  }

  /**
   * Get completion donut data
   */
  function getCompletionData() {
    const fieldRounds = rounds.filter(r => r.field_id === currentFieldId);
    let targetRound;
    
    if (currentRoundFilter === 'all' || currentRoundFilter === 'current') {
      targetRound = fieldRounds.sort((a, b) => b.round_number - a.round_number)[0];
    } else {
      targetRound = fieldRounds.find(r => r.round_number === parseInt(currentRoundFilter));
    }

    if (!targetRound) {
      return { entered: 0, total: CONFIG.TOTAL_PLOTS, roundNumber: null };
    }

    const roundEntries = entries.filter(e => e.round_id === targetRound.id);
    const enteredPlots = new Set(roundEntries.map(e => e.plot_number));

    return {
      entered: enteredPlots.size,
      total: CONFIG.TOTAL_PLOTS,
      roundNumber: targetRound.round_number
    };
  }

  /**
   * Get block comparison data
   */
  function getBlockData() {
    const fieldRounds = rounds.filter(r => r.field_id === currentFieldId);
    let targetEntries;
    
    if (currentRoundFilter === 'all') {
      targetEntries = entries.filter(e => e.field_id === currentFieldId);
    } else {
      const targetRound = getTargetRound();
      if (!targetRound) return [];
      targetEntries = entries.filter(e => e.round_id === targetRound.id);
    }

    const data = [];

    for (let block = 1; block <= CONFIG.BLOCKS_PER_FIELD; block++) {
      const blockEntries = targetEntries.filter(e => e.block_number === block);
      const treatments = {};

      CONFIG.TREATMENT_ORDER.forEach(t => {
        const treatmentEntries = blockEntries.filter(e => e.treatment === t);
        const paramValues = treatmentEntries
          .map(e => e[currentParam])
          .filter(v => v !== null && v !== undefined);
        treatments[t] = utils.average(paramValues) || 0;
      });

      data.push({ block, treatments });
    }

    return data;
  }

  /**
   * Get heatmap data
   */
  function getHeatmapData() {
    const fieldRounds = rounds
      .filter(r => r.field_id === currentFieldId)
      .sort((a, b) => a.round_number - b.round_number);

    const roundsData = fieldRounds.map(round => {
      const roundEntries = entries.filter(e => e.round_id === round.id);
      const entriesByPlot = {};
      
      roundEntries.forEach(e => {
        entriesByPlot[e.plot_number] = e[currentParam];
      });

      return {
        number: round.round_number,
        entries: entriesByPlot
      };
    });

    return {
      plots: Array.from({ length: CONFIG.TOTAL_PLOTS }, (_, i) => i + 1),
      rounds: roundsData
    };
  }

  /**
   * Get available rounds for current field
   */
  function getAvailableRounds() {
    return rounds
      .filter(r => r.field_id === currentFieldId)
      .sort((a, b) => a.round_number - b.round_number);
  }

  /**
   * Get parameter labels for current field
   */
  function getParamLabels() {
    const field = getCurrentField();
    if (!field) return CONFIG.DEFAULT_PARAMETERS;
    
    return [
      field.param1 || 'Parameter 1',
      field.param2 || 'Parameter 2',
      field.param3 || 'Parameter 3',
      field.param4 || 'Parameter 4',
      field.param5 || 'Parameter 5',
      field.param6 || 'Parameter 6'
    ];
  }

  /**
   * Refresh data
   */
  async function refresh() {
    fields = [];
    rounds = [];
    entries = [];
    plots = [];
    await loadData();
  }

  // Public API
  return {
    init,
    setField,
    setParam,
    setRoundFilter,
    getRoundFilter,
    getCurrentField,
    getTreatmentBarData,
    getTrendData,
    getProgressOverTimeData,
    getCompletionData,
    getBlockData,
    getHeatmapData,
    getAvailableRounds,
    getParamLabels,
    refresh
  };
})();

// Freeze analytics object
Object.freeze(analytics);
