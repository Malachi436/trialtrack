/**
 * TrialTrack — Utility Functions
 * Date helpers, sanitization, treatment maps, and common utilities
 */

const utils = {
  /**
   * Sanitize user input to prevent XSS and injection attacks
   * @param {any} input - Input to sanitize
   * @returns {any} - Sanitized input
   */
  sanitize(input) {
    if (typeof input !== 'string') return input;
    return input
      .trim()
      .replace(/[<>'"]/g, '') // Strip HTML/script injection characters
      .substring(0, 500);      // Max length to prevent overflow
  },

  /**
   * Sanitize object - sanitize all string values in an object
   * @param {Object} obj - Object to sanitize
   * @returns {Object} - Sanitized object
   */
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = this.sanitize(value);
    }
    return sanitized;
  },

  /**
   * Format date as DD/MM/YYYY
   * @param {Date|string} date - Date to format
   * @returns {string} - Formatted date
   */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  },

  /**
   * Format date as YYYY-MM-DD (for inputs)
   * @param {Date|string} date - Date to format
   * @returns {string} - Formatted date
   */
  formatDateISO(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  },

  /**
   * Format date as relative time (e.g., "2 hours ago")
   * @param {Date|string} date - Date to format
   * @returns {string} - Relative time string
   */
  formatRelativeTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();
    const diffMs = now - d;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return this.formatDate(d);
  },

  /**
   * Get the full treatment label from code
   * @param {string} code - Treatment code (I, B, O, OI, BO, BI)
   * @returns {string} - Full treatment name
   */
  getTreatmentLabel(code) {
    return CONFIG.TREATMENTS[code] || code;
  },

  /**
   * Get treatment chip CSS class
   * @param {string} code - Treatment code
   * @returns {string} - CSS class name
   */
  getTreatmentChipClass(code) {
    return `chip-treatment-${code}`;
  },

  /**
   * Get plot info from plot number
   * @param {number} plotNumber - Plot number (1-30)
   * @returns {Object|null} - Plot info with block and treatment
   */
  getPlotInfo(plotNumber) {
    return CONFIG.PLOT_LAYOUT.find(p => p.plot === plotNumber) || null;
  },

  /**
   * Get all plots for a block
   * @param {number} blockNumber - Block number (1-5)
   * @returns {Array} - Array of plot info objects
   */
  getPlotsForBlock(blockNumber) {
    return CONFIG.PLOT_LAYOUT.filter(p => p.block === blockNumber);
  },

  /**
   * Calculate the next round window based on last round date and field settings
   * @param {Object} field - Field object with interval and window settings
   * @param {Object|null} latestRound - Latest round object or null
   * @returns {Object} - Window info with earliest, latest, isOpen, daysUntil
   */
  getNextRoundWindow(field, latestRound) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const plantingDate = new Date(field.planting_date);
    plantingDate.setHours(0, 0, 0, 0);
    
    // If no rounds yet, Round 1 can be entered any time after planting
    if (!latestRound) {
      const canStart = today >= plantingDate;
      return {
        roundNumber: 1,
        earliest: plantingDate,
        latest: null, // No end date for first round
        isOpen: canStart,
        daysUntil: canStart ? 0 : Math.ceil((plantingDate - today) / (1000 * 60 * 60 * 24)),
        isPast: false
      };
    }
    
    const lastDate = new Date(latestRound.recorded_date);
    lastDate.setHours(0, 0, 0, 0);
    
    const interval = field.measurement_interval_days || CONFIG.DEFAULT_INTERVAL_DAYS;
    const windowDays = field.window_days || CONFIG.DEFAULT_WINDOW_DAYS;
    
    // Calculate window: [lastDate + interval - window, lastDate + interval + window]
    const earliest = new Date(lastDate);
    earliest.setDate(earliest.getDate() + interval - windowDays);
    
    const latest = new Date(lastDate);
    latest.setDate(latest.getDate() + interval + windowDays);
    
    const isOpen = today >= earliest && today <= latest;
    const isPast = today > latest;
    const daysUntil = today < earliest ? Math.ceil((earliest - today) / (1000 * 60 * 60 * 24)) : 0;
    
    return {
      roundNumber: latestRound.round_number + 1,
      earliest,
      latest,
      isOpen,
      daysUntil,
      isPast
    };
  },

  /**
   * Check if data entry is allowed for a field
   * @param {Object} field - Field object
   * @param {Object|null} latestRound - Latest round object
   * @returns {boolean} - True if entry is allowed
   */
  canEnterData(field, latestRound) {
    const window = this.getNextRoundWindow(field, latestRound);
    return window.isOpen;
  },

  /**
   * Debounce a function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} - Debounced function
   */
  debounce(func, wait = CONFIG.DEBOUNCE_MS) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Generate a UUID v4
   * @returns {string} - UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Format a number with specified decimal places
   * @param {number} num - Number to format
   * @param {number} decimals - Decimal places (default 2)
   * @returns {string} - Formatted number
   */
  formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '';
    return Number(num).toFixed(decimals);
  },

  /**
   * Calculate average of an array of numbers
   * @param {Array<number>} numbers - Array of numbers
   * @returns {number|null} - Average or null if empty
   */
  average(numbers) {
    const valid = numbers.filter(n => n !== null && n !== undefined && !isNaN(n));
    if (valid.length === 0) return null;
    return valid.reduce((sum, n) => sum + Number(n), 0) / valid.length;
  },

  /**
   * Group an array by a key
   * @param {Array} array - Array to group
   * @param {string|Function} key - Key to group by
   * @returns {Object} - Grouped object
   */
  groupBy(array, key) {
    return array.reduce((result, item) => {
      const groupKey = typeof key === 'function' ? key(item) : item[key];
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    }, {});
  },

  /**
   * Get user initials from username
   * @param {string} username - Username
   * @returns {string} - Initials (max 2 characters)
   */
  getInitials(username) {
    if (!username) return '?';
    const parts = username.split(/[\s._-]+/);
    if (parts.length === 1) {
      return username.substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  },

  /**
   * Sleep for a specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Promise that resolves after sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Escape HTML special characters (for safe display)
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Parse query string parameters
   * @param {string} queryString - Query string (without ?)
   * @returns {Object} - Parsed parameters
   */
  parseQueryString(queryString) {
    if (!queryString) return {};
    return Object.fromEntries(
      queryString.split('&').map(param => {
        const [key, value] = param.split('=');
        return [decodeURIComponent(key), decodeURIComponent(value || '')];
      })
    );
  },

  /**
   * Build query string from object
   * @param {Object} params - Parameters object
   * @returns {string} - Query string (without ?)
   */
  buildQueryString(params) {
    return Object.entries(params)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }
};

// Freeze utils object
Object.freeze(utils);
