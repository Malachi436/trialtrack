/**
 * TrialTrack — Export Module
 * CSV/Excel export functionality
 */

const exportModule = (() => {
  /**
   * Convert data to CSV string
   * @param {Array} headers - Column headers
   * @param {Array} rows - Data rows
   * @returns {string} - CSV string
   */
  function toCSV(headers, rows) {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerRow = headers.map(escapeCSV).join(',');
    const dataRows = rows.map(row => row.map(escapeCSV).join(','));
    
    return [headerRow, ...dataRows].join('\n');
  }

  /**
   * Download a file
   * @param {string} content - File content
   * @param {string} filename - File name
   * @param {string} mimeType - MIME type
   */
  function download(content, filename, mimeType = 'text/csv') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Export raw data as CSV
   * @param {string} fieldId - Field ID (optional, exports all if null)
   */
  async function exportRawData(fieldId = null) {
    try {
      let entries = [];
      
      if (fieldId) {
        const result = await api.getEntriesForField(fieldId);
        if (result.error) throw new Error(result.error);
        entries = result.data || [];
      } else {
        const result = await api.getRecentEntries(10000);
        if (result.error) throw new Error(result.error);
        entries = result.data || [];
      }

      // Get field info
      const fieldsResult = await api.getFields();
      const fields = fieldsResult.data || [];
      const fieldsMap = new Map(fields.map(f => [f.id, f]));

      const headers = [
        'Field', 'Block', 'Plot', 'Treatment', 'Round', 'Date',
        'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'Notes', 'Entered By', 'Created At'
      ];

      const rows = entries.map(e => {
        const field = fieldsMap.get(e.field_id);
        return [
          field?.name || '',
          e.block_number,
          e.plot_number,
          e.treatment,
          '', // Round number - would need to look up
          utils.formatDate(e.created_at),
          utils.formatNumber(e.p1) || '',
          utils.formatNumber(e.p2) || '',
          utils.formatNumber(e.p3) || '',
          utils.formatNumber(e.p4) || '',
          utils.formatNumber(e.p5) || '',
          utils.formatNumber(e.p6) || '',
          e.notes || '',
          e.entered_by || '',
          utils.formatDate(e.created_at)
        ];
      });

      const csv = toCSV(headers, rows);
      const fieldName = fieldId ? (fieldsMap.get(fieldId)?.name || 'field') : 'all';
      const date = new Date().toISOString().split('T')[0];
      
      download(csv, `trialtrack_${fieldName}_raw_${date}.csv`);

    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  /**
   * Export summary data as CSV
   * @param {string} fieldId - Field ID
   */
  async function exportSummary(fieldId = null) {
    try {
      if (!fieldId) {
        const fieldsResult = await api.getFields();
        const fields = fieldsResult.data || [];
        if (fields.length > 0) {
          fieldId = fields[0].id;
        }
      }

      if (!fieldId) {
        throw new Error('No field to export');
      }

      // Get rounds and entries
      const roundsResult = await api.getRoundsForField(fieldId);
      const rounds = roundsResult.data || [];

      const entriesResult = await api.getEntriesForField(fieldId);
      const entries = entriesResult.data || [];

      const fieldResult = await api.getField(fieldId);
      const field = fieldResult.data;

      // Build summary by round and treatment
      const headers = [
        'Round', 'Treatment',
        'Avg P1', 'Avg P2', 'Avg P3', 'Avg P4', 'Avg P5', 'Avg P6',
        'Entries'
      ];

      const rows = [];

      rounds.sort((a, b) => a.round_number - b.round_number).forEach(round => {
        const roundEntries = entries.filter(e => e.round_id === round.id);

        CONFIG.TREATMENT_ORDER.forEach(treatment => {
          const treatmentEntries = roundEntries.filter(e => e.treatment === treatment);
          
          if (treatmentEntries.length > 0) {
            rows.push([
              round.round_number,
              treatment,
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p1).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p2).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p3).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p4).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p5).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p6).filter(v => v != null))) || '',
              treatmentEntries.length
            ]);
          }
        });
      });

      const csv = toCSV(headers, rows);
      const fieldName = field?.name || 'field';
      const date = new Date().toISOString().split('T')[0];
      
      download(csv, `trialtrack_${fieldName}_summary_${date}.csv`);

    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  /**
   * Export block summary as CSV
   * @param {string} fieldId - Field ID
   */
  async function exportBlockSummary(fieldId) {
    try {
      const entriesResult = await api.getEntriesForField(fieldId);
      const entries = entriesResult.data || [];

      const fieldResult = await api.getField(fieldId);
      const field = fieldResult.data;

      const headers = ['Block', 'Treatment', 'Avg P1', 'Avg P2', 'Avg P3', 'Avg P4', 'Avg P5', 'Avg P6', 'Entries'];
      const rows = [];

      for (let block = 1; block <= CONFIG.BLOCKS_PER_FIELD; block++) {
        const blockEntries = entries.filter(e => e.block_number === block);

        CONFIG.TREATMENT_ORDER.forEach(treatment => {
          const treatmentEntries = blockEntries.filter(e => e.treatment === treatment);
          
          if (treatmentEntries.length > 0) {
            rows.push([
              block,
              treatment,
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p1).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p2).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p3).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p4).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p5).filter(v => v != null))) || '',
              utils.formatNumber(utils.average(treatmentEntries.map(e => e.p6).filter(v => v != null))) || '',
              treatmentEntries.length
            ]);
          }
        });
      }

      const csv = toCSV(headers, rows);
      const fieldName = field?.name || 'field';
      const date = new Date().toISOString().split('T')[0];
      
      download(csv, `trialtrack_${fieldName}_blocks_${date}.csv`);

    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  /**
   * Export current round data as CSV
   * @param {string} fieldId - Field ID
   */
  async function exportCurrentRound(fieldId) {
    try {
      const roundsResult = await api.getRoundsForField(fieldId);
      const rounds = roundsResult.data || [];
      const latestRound = rounds.sort((a, b) => b.round_number - a.round_number)[0];

      if (!latestRound) {
        throw new Error('No rounds found');
      }

      const entriesResult = await api.getEntriesForRound(latestRound.id);
      const entries = entriesResult.data || [];

      const fieldResult = await api.getField(fieldId);
      const field = fieldResult.data;

      const headers = [
        'Plot', 'Block', 'Treatment',
        'P1', 'P2', 'P3', 'P4', 'P5', 'P6',
        'Notes', 'Entered By'
      ];

      const rows = entries.map(e => [
        e.plot_number,
        e.block_number,
        e.treatment,
        utils.formatNumber(e.p1) || '',
        utils.formatNumber(e.p2) || '',
        utils.formatNumber(e.p3) || '',
        utils.formatNumber(e.p4) || '',
        utils.formatNumber(e.p5) || '',
        utils.formatNumber(e.p6) || '',
        e.notes || '',
        e.entered_by || ''
      ]);

      const csv = toCSV(headers, rows);
      const fieldName = field?.name || 'field';
      const date = new Date().toISOString().split('T')[0];
      
      download(csv, `trialtrack_${fieldName}_round${latestRound.round_number}_${date}.csv`);

    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  // Public API
  return {
    toCSV,
    download,
    exportRawData,
    exportSummary,
    exportBlockSummary,
    exportCurrentRound
  };
})();

// Freeze export module
Object.freeze(exportModule);
