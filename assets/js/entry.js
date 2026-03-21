/**
 * TrialTrack — Entry Module
 * Data entry flow logic for field workers
 * Parameter-focused workflow: Must complete ALL blocks for a parameter before moving to next
 */

const entry = (() => {
  // State
  let currentField = null;
  let currentRound = null;
  let currentParameter = null; // 1-6
  let currentBlock = null;
  let entriesCache = {}; // { plotNumber: entryObject }
  let completedParamBlocks = new Set(); // "param1_block2" format

  /**
   * Initialize the entry module
   * @param {Object} field - The assigned field object
   */
  async function init(field) {
    console.log('[Entry] Initializing with field:', field);
    console.log('[Entry] Field growth_params:', field?.growth_params);
    console.log('[Entry] Field yield_params:', field?.yield_params);
    console.log('[Entry] Field growth_param_count:', field?.growth_param_count);
    console.log('[Entry] Field yield_param_count:', field?.yield_param_count);
    
    currentField = field;
    
    // Log what parameters will be used
    const growthLabels = getGrowthParamLabels();
    const yieldLabels = getYieldParamLabels();
    console.log('[Entry] Using growth labels:', growthLabels);
    console.log('[Entry] Using yield labels:', yieldLabels);
    
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

    // Get all entries for current round
    entriesCache = {};
    completedParamBlocks = new Set();
    
    if (currentRound) {
      const entriesResult = await api.getEntriesForRound(currentRound.id);
      if (!entriesResult.error && entriesResult.data) {
        // Cache entries by plot number
        entriesResult.data.forEach(e => {
          entriesCache[e.plot_number] = e;
        });
        
        // Calculate which param+block combinations are complete
        updateCompletedParamBlocks();
      }
    }
  }

  /**
   * Update the set of completed parameter+block combinations
   */
  function updateCompletedParamBlocks() {
    completedParamBlocks = new Set();
    
    for (let param = 1; param <= 6; param++) {
      for (let block = 1; block <= 5; block++) {
        const plots = utils.getPlotsForBlock(block);
        const allComplete = plots.every(plot => {
          const entry = entriesCache[plot.plot];
          return entry && entry[`p${param}`] !== null && entry[`p${param}`] !== undefined;
        });
        
        if (allComplete) {
          completedParamBlocks.add(`p${param}_b${block}`);
        }
      }
    }
  }

  /**
   * Check if the current round is fully complete (all param-block combinations)
   * @returns {boolean}
   */
  function isRoundComplete() {
    // A round is complete when all param-block combinations are done
    const counts = getParameterCounts();
    const totalCombinations = counts.total * CONFIG.BLOCKS_PER_FIELD;
    return completedParamBlocks.size === totalCombinations;
  }

  /**
   * Get the current round window status
   * @returns {Object} - Window status
   */
  function getWindowStatus() {
    const isComplete = isRoundComplete();
    return utils.getNextRoundWindow(currentField, currentRound, isComplete);
  }

  /**
   * Check if data entry is currently allowed
   * @returns {boolean}
   */
  function canEnter() {
    const isComplete = isRoundComplete();
    return utils.canEnterData(currentField, currentRound, isComplete);
  }

  /**
   * Get overall progress stats
   * @returns {Object} - { entered, total, percentage }
   */
  function getProgress() {
    // Total = params × blocks = param-block combinations
    const counts = getParameterCounts();
    const total = counts.total * CONFIG.BLOCKS_PER_FIELD;
    const entered = completedParamBlocks.size;
    const percentage = Math.round((entered / total) * 100);
    return { entered, total, percentage };
  }

  /**
   * Get progress for a specific parameter
   * @param {number} paramNum - Parameter number (1-6)
   * @returns {Object} - { completed, total, percentage, isComplete }
   */
  function getParameterProgress(paramNum) {
    let completed = 0;
    for (let block = 1; block <= 5; block++) {
      if (completedParamBlocks.has(`p${paramNum}_b${block}`)) {
        completed++;
      }
    }
    return { 
      completed, 
      total: 5, 
      percentage: Math.round((completed / 5) * 100),
      isComplete: completed === 5
    };
  }

  /**
   * Check if a parameter is fully complete (all 5 blocks)
   * @param {number} paramNum
   * @returns {boolean}
   */
  function isParameterComplete(paramNum) {
    return getParameterProgress(paramNum).isComplete;
  }

  /**
   * Get the first incomplete parameter (for auto-selection)
   * @returns {number|null} - Parameter number or null if all complete
   */
  function getFirstIncompleteParameter() {
    const counts = getParameterCounts();
    for (let p = 1; p <= counts.total; p++) {
      if (!isParameterComplete(p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Get the next incomplete block for a parameter
   * @param {number} paramNum
   * @returns {number|null} - Block number (1-5) or null if all complete
   */
  function getNextIncompleteBlock(paramNum) {
    for (let b = 1; b <= 5; b++) {
      if (!completedParamBlocks.has(`p${paramNum}_b${b}`)) {
        return b;
      }
    }
    return null;
  }

  /**
   * Check if user can select a different parameter
   * Now always returns true - users can freely switch between parameters
   * @returns {boolean}
   */
  function canChangeParameter() {
    return true; // Allow free parameter selection
  }

  /**
   * Check if a parameter+block combination is complete
   * @param {number} paramNum
   * @param {number} blockNum
   * @returns {boolean}
   */
  function isParamBlockComplete(paramNum, blockNum) {
    return completedParamBlocks.has(`p${paramNum}_b${blockNum}`);
  }

  /**
   * Set the current parameter
   * @param {number} paramNumber - Parameter number (1-6)
   * @returns {boolean} - Always true now (no locking)
   */
  function selectParameter(paramNumber) {
    // Allow selecting any parameter freely
    currentParameter = paramNumber;
    currentBlock = null;
    return true;
  }

  /**
   * Set the current block
   * @param {number} blockNumber - Block number (1-5)
   */
  function selectBlock(blockNumber) {
    currentBlock = blockNumber;
  }

  /**
   * Get existing values for current parameter in current block
   * @returns {Array} - Array of { plot, treatment, value, entryId }
   */
  function getBlockParameterData() {
    if (!currentBlock || !currentParameter) return [];
    
    const plots = utils.getPlotsForBlock(currentBlock);
    return plots.map(plot => {
      const entry = entriesCache[plot.plot];
      const paramKey = `p${currentParameter}`;
      return {
        plot: plot.plot,
        treatment: plot.treatment,
        value: entry ? entry[paramKey] : null,
        entryId: entry ? entry.id : null,
        hasEntry: !!entry
      };
    });
  }

  /**
   * Get parameter labels for the current field
   * Combines growth_params and yield_params
   * @returns {Array<string>}
   */
  function getParameterLabels() {
    if (!currentField) {
      return [...CONFIG.DEFAULT_GROWTH_PARAMS, ...CONFIG.DEFAULT_YIELD_PARAMS];
    }
    
    const growthParams = currentField.growth_params || CONFIG.DEFAULT_GROWTH_PARAMS;
    const yieldParams = currentField.yield_params || CONFIG.DEFAULT_YIELD_PARAMS;
    
    return [...growthParams, ...yieldParams];
  }
  
  /**
   * Get growth parameter labels only
   * @returns {Array<string>}
   */
  function getGrowthParamLabels() {
    if (!currentField) return CONFIG.DEFAULT_GROWTH_PARAMS;
    return currentField.growth_params || CONFIG.DEFAULT_GROWTH_PARAMS;
  }
  
  /**
   * Get yield parameter labels only
   * @returns {Array<string>}
   */
  function getYieldParamLabels() {
    if (!currentField) return CONFIG.DEFAULT_YIELD_PARAMS;
    return currentField.yield_params || CONFIG.DEFAULT_YIELD_PARAMS;
  }
  
  /**
   * Get parameter count configuration
   * @returns {Object} - { growth, yield, total }
   */
  function getParameterCounts() {
    const growth = currentField?.growth_param_count || CONFIG.DEFAULT_GROWTH_PARAM_COUNT;
    const yieldCount = currentField?.yield_param_count || CONFIG.DEFAULT_YIELD_PARAM_COUNT;
    return {
      growth,
      yield: yieldCount,
      total: growth + yieldCount
    };
  }
  
  /**
   * Check if a parameter number is a growth parameter
   * @param {number} paramNum - Parameter number (1-based)
   * @returns {boolean}
   */
  function isGrowthParam(paramNum) {
    const counts = getParameterCounts();
    return paramNum <= counts.growth;
  }

  /**
   * Get current parameter label
   * @returns {string}
   */
  function getCurrentParameterLabel() {
    if (!currentParameter) return '';
    const labels = getParameterLabels();
    return labels[currentParameter - 1];
  }

  /**
   * Get current context for progress indicator
   * @returns {Object}
   */
  function getCurrentContext() {
    const labels = getParameterLabels();
    const paramProgress = currentParameter ? getParameterProgress(currentParameter) : null;
    const overallProgress = getProgress();
    
    return {
      parameter: currentParameter,
      parameterLabel: currentParameter ? labels[currentParameter - 1] : null,
      block: currentBlock,
      parameterProgress: paramProgress,
      overallProgress: overallProgress,
      totalParams: 6,
      totalBlocks: 5,
      completedParams: [1,2,3,4,5,6].filter(p => isParameterComplete(p)).length
    };
  }

  /**
   * Save parameter data for all plots in current block
   * @param {Array} plotValues - Array of { plot, value }
   * @param {string} username - Who is entering
   * @returns {Promise<Object>} - { success, error, savedCount }
   */
  async function saveBlockParameter(plotValues, username) {
    if (!currentField || !currentBlock || !currentParameter) {
      return { success: false, error: 'No block or parameter selected.', savedCount: 0 };
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
          return { success: false, error: `Failed to create round: ${roundResult.error}`, savedCount: 0 };
        }

        currentRound = roundResult.data[0] || newRound;
        roundId = currentRound.id;
        roundNumber = currentRound.round_number;
      }

      const paramKey = `p${currentParameter}`;
      let savedCount = 0;
      let errors = [];

      // Process each plot value
      for (const pv of plotValues) {
        const plotInfo = utils.getPlotInfo(pv.plot);
        if (!plotInfo) continue;

        const existingEntry = entriesCache[pv.plot];
        const paramValue = pv.value !== '' && pv.value !== null ? parseFloat(pv.value) : null;

        if (existingEntry) {
          // Update existing entry with new parameter value
          const updateData = {
            [paramKey]: paramValue,
            entered_by: utils.sanitize(username)
          };

          const result = await api.updateEntry(existingEntry.id, updateData);
          if (result.error) {
            errors.push(`Plot ${pv.plot}: ${result.error}`);
          } else {
            // Update cache
            entriesCache[pv.plot] = { ...existingEntry, ...updateData };
            savedCount++;
          }
        } else {
          // Create new entry with just this parameter
          const entryData = {
            id: utils.generateUUID(),
            round_id: roundId,
            field_id: currentField.id,
            block_id: null,
            plot_id: null,
            plot_number: pv.plot,
            block_number: plotInfo.block,
            treatment: plotInfo.treatment,
            p1: currentParameter === 1 ? paramValue : null,
            p2: currentParameter === 2 ? paramValue : null,
            p3: currentParameter === 3 ? paramValue : null,
            p4: currentParameter === 4 ? paramValue : null,
            p5: currentParameter === 5 ? paramValue : null,
            p6: currentParameter === 6 ? paramValue : null,
            notes: null,
            entered_by: utils.sanitize(username)
          };

          const result = await api.saveEntry(entryData);
          if (result.error) {
            errors.push(`Plot ${pv.plot}: ${result.error}`);
          } else {
            // Add to cache
            entriesCache[pv.plot] = entryData;
            savedCount++;
          }
        }
      }

      // Update completed status
      updateCompletedParamBlocks();

      if (errors.length > 0) {
        return { success: false, error: errors.join('; '), savedCount };
      }

      return { success: true, error: null, savedCount };

    } catch (error) {
      console.error('Error saving block parameter:', error);
      return { success: false, error: 'Failed to save data. Please try again.', savedCount: 0 };
    }
  }

  /**
   * Reset selection state
   */
  function resetSelection() {
    currentParameter = null;
    currentBlock = null;
  }

  /**
   * Get current state
   */
  function getState() {
    return {
      field: currentField,
      round: currentRound,
      parameter: currentParameter,
      block: currentBlock,
      completedParamBlocks: Array.from(completedParamBlocks)
    };
  }

  // Public API
  return {
    init,
    refreshRoundStatus,
    getWindowStatus,
    canEnter,
    isRoundComplete,
    getProgress,
    getParameterProgress,
    isParameterComplete,
    getFirstIncompleteParameter,
    getNextIncompleteBlock,
    canChangeParameter,
    isParamBlockComplete,
    selectParameter,
    selectBlock,
    getBlockParameterData,
    getParameterLabels,
    getGrowthParamLabels,
    getYieldParamLabels,
    getParameterCounts,
    isGrowthParam,
    getCurrentParameterLabel,
    getCurrentContext,
    saveBlockParameter,
    resetSelection,
    getState
  };
})();

// Freeze entry object
Object.freeze(entry);

