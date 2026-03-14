/**
 * TrialTrack — Entry Module
 * Data entry flow logic for field workers
 */

const entry = (() => {
  // State
  let currentField = null;
  let currentRound = null;
  let currentBlock = null;
  let currentPlot = null;
  let enteredPlots = new Set();
  let existingEntry = null;

  /**
   * Initialize the entry module
   * @param {Object} field - The assigned field object
   */
  async function init(field) {
    currentField = field;
    await refreshRoundStatus();
  }

  /**
   * Refresh round status and entries
   */
  async function refreshRoundStatus() {
    if (!currentField) return;

    // Get latest round
    const roundResult = await api.getLatestRound(currentField.id);
    if (!roundResult.error) {
      currentRound = roundResult.data;
    }

    // Get entries for current round
    if (currentRound) {
      const entriesResult = await api.getEntriesForRound(currentRound.id);
      if (!entriesResult.error && entriesResult.data) {
        enteredPlots = new Set(entriesResult.data.map(e => e.plot_number));
      }
    } else {
      enteredPlots = new Set();
    }
  }

  /**
   * Get the current round window status
   * @returns {Object} - Window status
   */
  function getWindowStatus() {
    return utils.getNextRoundWindow(currentField, currentRound);
  }

  /**
   * Check if data entry is currently allowed
   * @returns {boolean}
   */
  function canEnter() {
    return utils.canEnterData(currentField, currentRound);
  }

  /**
   * Get progress stats
   * @returns {Object} - { entered, total, percentage }
   */
  function getProgress() {
    const total = CONFIG.TOTAL_PLOTS;
    const entered = enteredPlots.size;
    const percentage = Math.round((entered / total) * 100);
    return { entered, total, percentage };
  }

  /**
   * Set the current block
   * @param {number} blockNumber - Block number (1-5)
   */
  function selectBlock(blockNumber) {
    currentBlock = blockNumber;
    currentPlot = null;
    existingEntry = null;
  }

  /**
   * Set the current plot
   * @param {number} plotNumber - Plot number (1-30)
   */
  async function selectPlot(plotNumber) {
    currentPlot = plotNumber;
    existingEntry = null;

    // Check if this plot already has an entry this round
    if (currentRound) {
      const result = await api.getEntryByRoundAndPlot(currentRound.id, plotNumber);
      if (!result.error && result.data) {
        existingEntry = result.data;
      }
    }
  }

  /**
   * Get plots for the current block
   * @returns {Array} - Plot info array with entered status
   */
  function getPlotsForCurrentBlock() {
    if (!currentBlock) return [];
    
    return utils.getPlotsForBlock(currentBlock).map(plot => ({
      ...plot,
      entered: enteredPlots.has(plot.plot)
    }));
  }

  /**
   * Check if a plot has already been entered
   * @param {number} plotNumber
   * @returns {boolean}
   */
  function isPlotEntered(plotNumber) {
    return enteredPlots.has(plotNumber);
  }

  /**
   * Get the existing entry for current plot (if any)
   * @returns {Object|null}
   */
  function getExistingEntry() {
    return existingEntry;
  }

  /**
   * Get current plot info
   * @returns {Object|null}
   */
  function getCurrentPlotInfo() {
    if (!currentPlot) return null;
    return utils.getPlotInfo(currentPlot);
  }

  /**
   * Get parameter labels for the current field
   * @returns {Array<string>}
   */
  function getParameterLabels() {
    if (!currentField) return CONFIG.DEFAULT_PARAMETERS;
    return [
      currentField.param1 || 'Parameter 1',
      currentField.param2 || 'Parameter 2',
      currentField.param3 || 'Parameter 3',
      currentField.param4 || 'Parameter 4',
      currentField.param5 || 'Parameter 5',
      currentField.param6 || 'Parameter 6'
    ];
  }

  /**
   * Save entry data
   * @param {Object} data - { p1-p6, notes }
   * @param {string} username - Who is entering
   * @returns {Promise<Object>} - { success, error, isUpdate }
   */
  async function saveEntry(data, username) {
    if (!currentField || !currentPlot) {
      return { success: false, error: 'No plot selected.', isUpdate: false };
    }

    const plotInfo = utils.getPlotInfo(currentPlot);
    if (!plotInfo) {
      return { success: false, error: 'Invalid plot.', isUpdate: false };
    }

    try {
      // Get or create round
      let roundId;
      let roundNumber;

      if (currentRound) {
        roundId = currentRound.id;
        roundNumber = currentRound.round_number;
      } else {
        // Create new round (Round 1)
        const windowStatus = getWindowStatus();
        const newRound = {
          id: utils.generateUUID(),
          field_id: currentField.id,
          round_number: windowStatus.roundNumber,
          recorded_date: new Date().toISOString().split('T')[0]
        };

        const roundResult = await api.createRound(newRound);
        if (roundResult.error) {
          return { success: false, error: `Failed to create round: ${roundResult.error}`, isUpdate: false };
        }

        currentRound = roundResult.data[0] || newRound;
        roundId = currentRound.id;
        roundNumber = currentRound.round_number;
      }

      // Prepare entry data
      const entryData = {
        round_id: roundId,
        field_id: currentField.id,
        block_id: null, // We'll need to look this up
        plot_id: null,  // We'll need to look this up
        plot_number: currentPlot,
        block_number: plotInfo.block,
        treatment: plotInfo.treatment,
        p1: parseFloat(data.p1) || null,
        p2: parseFloat(data.p2) || null,
        p3: parseFloat(data.p3) || null,
        p4: parseFloat(data.p4) || null,
        p5: parseFloat(data.p5) || null,
        p6: parseFloat(data.p6) || null,
        notes: utils.sanitize(data.notes) || null,
        entered_by: utils.sanitize(username)
      };

      // Check for existing entry
      if (existingEntry) {
        // Update existing entry
        const result = await api.updateEntry(existingEntry.id, entryData);
        if (result.error) {
          return { success: false, error: result.error, isUpdate: true };
        }
        return { success: true, error: null, isUpdate: true };
      } else {
        // Save new entry
        entryData.id = utils.generateUUID();
        const result = await api.saveEntry(entryData);
        if (result.error) {
          // Check for duplicate constraint
          if (result.error.includes('duplicate') || result.error.includes('unique')) {
            // Try to update instead
            const existingResult = await api.getEntryByRoundAndPlot(roundId, currentPlot);
            if (!existingResult.error && existingResult.data) {
              existingEntry = existingResult.data;
              const updateResult = await api.updateEntry(existingEntry.id, entryData);
              if (updateResult.error) {
                return { success: false, error: updateResult.error, isUpdate: true };
              }
              return { success: true, error: null, isUpdate: true };
            }
          }
          return { success: false, error: result.error, isUpdate: false };
        }
        
        // Mark plot as entered
        enteredPlots.add(currentPlot);
        return { success: true, error: null, isUpdate: false };
      }

    } catch (error) {
      console.error('Error saving entry:', error);
      return { success: false, error: 'Failed to save entry. Please try again.', isUpdate: false };
    }
  }

  /**
   * Reset selection state
   */
  function resetSelection() {
    currentBlock = null;
    currentPlot = null;
    existingEntry = null;
  }

  /**
   * Get current state
   */
  function getState() {
    return {
      field: currentField,
      round: currentRound,
      block: currentBlock,
      plot: currentPlot,
      existingEntry,
      enteredPlots: Array.from(enteredPlots)
    };
  }

  // Public API
  return {
    init,
    refreshRoundStatus,
    getWindowStatus,
    canEnter,
    getProgress,
    selectBlock,
    selectPlot,
    getPlotsForCurrentBlock,
    isPlotEntered,
    getExistingEntry,
    getCurrentPlotInfo,
    getParameterLabels,
    saveEntry,
    resetSelection,
    getState
  };
})();

// Freeze entry object
Object.freeze(entry);
