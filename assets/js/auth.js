/**
 * TrialTrack — Authentication Module
 * Login, logout, session management, role guards, and rate limiting
 * 
 * TODO: Upgrade to bcrypt hashing in v2
 */

const auth = {
  /**
   * Get current session from sessionStorage
   * @returns {Object|null} - Session object or null
   */
  getSession() {
    try {
      const sessionData = sessionStorage.getItem(CONFIG.SESSION_KEY);
      if (!sessionData) return null;
      const session = JSON.parse(sessionData);
      // Validate session structure
      if (!session.id || !session.username || !session.role) {
        this.clearSession();
        return null;
      }
      return session;
    } catch (e) {
      console.error('Error reading session:', e);
      this.clearSession();
      return null;
    }
  },

  /**
   * Set session in sessionStorage
   * @param {Object} user - User object from database
   */
  setSession(user) {
    const session = {
      id: user.id,
      username: user.username,
      role: user.role,
      field_id: user.field_id || null,
      created_at: new Date().toISOString()
    };
    sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
  },

  /**
   * Clear session from sessionStorage
   */
  clearSession() {
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
  },

  /**
   * Check if user is logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.getSession() !== null;
  },

  /**
   * Check if current user has one of the specified roles
   * @param {Array<string>|string} allowedRoles - Allowed roles
   * @returns {boolean}
   */
  hasRole(allowedRoles) {
    const session = this.getSession();
    if (!session) return false;
    
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return roles.includes(session.role);
  },

  /**
   * Check if current user has at least the minimum role level
   * @param {string} minRole - Minimum required role
   * @returns {boolean}
   */
  hasMinimumRole(minRole) {
    const session = this.getSession();
    if (!session) return false;
    
    const userLevel = CONFIG.ROLE_HIERARCHY[session.role] || 0;
    const requiredLevel = CONFIG.ROLE_HIERARCHY[minRole] || 0;
    
    return userLevel >= requiredLevel;
  },

  /**
   * Require specific roles - redirects if not authorized
   * @param {Array<string>|string} allowedRoles - Allowed roles
   * @param {string} redirectTo - Page to redirect to (default: login)
   * @returns {Object|null} - Session if authorized, null otherwise
   */
  requireRole(allowedRoles, redirectTo = null) {
    const session = this.getSession();
    
    // Not logged in - redirect to login
    if (!session) {
      window.location.href = CONFIG.ROUTES.LOGIN;
      return null;
    }
    
    // Check if user has required role
    if (!this.hasRole(allowedRoles)) {
      // Redirect to appropriate page based on role
      const redirect = redirectTo || CONFIG.ROLE_REDIRECTS[session.role] || CONFIG.ROUTES.LOGIN;
      window.location.href = redirect;
      return null;
    }
    
    return session;
  },

  /**
   * Get login attempt count
   * @returns {number}
   */
  getLoginAttempts() {
    try {
      return parseInt(sessionStorage.getItem(CONFIG.LOGIN_ATTEMPTS_KEY) || '0', 10);
    } catch {
      return 0;
    }
  },

  /**
   * Increment login attempt count
   */
  incrementLoginAttempts() {
    const attempts = this.getLoginAttempts() + 1;
    sessionStorage.setItem(CONFIG.LOGIN_ATTEMPTS_KEY, attempts.toString());
  },

  /**
   * Reset login attempts
   */
  resetLoginAttempts() {
    sessionStorage.removeItem(CONFIG.LOGIN_ATTEMPTS_KEY);
    sessionStorage.removeItem(CONFIG.LOCKOUT_KEY);
  },

  /**
   * Check if login is locked out
   * @returns {Object} - { locked: boolean, remainingMs: number }
   */
  isLockedOut() {
    try {
      const lockoutUntil = sessionStorage.getItem(CONFIG.LOCKOUT_KEY);
      if (!lockoutUntil) return { locked: false, remainingMs: 0 };
      
      const lockoutTime = parseInt(lockoutUntil, 10);
      const now = Date.now();
      
      if (now >= lockoutTime) {
        // Lockout expired
        this.resetLoginAttempts();
        return { locked: false, remainingMs: 0 };
      }
      
      return { locked: true, remainingMs: lockoutTime - now };
    } catch {
      return { locked: false, remainingMs: 0 };
    }
  },

  /**
   * Set lockout
   */
  setLockout() {
    const lockoutUntil = Date.now() + CONFIG.LOCKOUT_DURATION_MS;
    sessionStorage.setItem(CONFIG.LOCKOUT_KEY, lockoutUntil.toString());
  },

  /**
   * Format lockout remaining time as human-readable string
   * @param {number} ms - Remaining milliseconds
   * @returns {string}
   */
  formatLockoutTime(ms) {
    const minutes = Math.ceil(ms / 60000);
    if (minutes <= 1) return 'less than a minute';
    return `${minutes} minutes`;
  },

  /**
   * Attempt to log in
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} - { success: boolean, error?: string, user?: Object }
   */
  async login(username, password) {
    // Check lockout first
    const lockout = this.isLockedOut();
    if (lockout.locked) {
      return {
        success: false,
        error: `Too many failed attempts. Please try again in ${this.formatLockoutTime(lockout.remainingMs)}.`
      };
    }

    // Sanitize inputs
    const sanitizedUsername = utils.sanitize(username);
    const sanitizedPassword = utils.sanitize(password);

    // Validate inputs
    if (!sanitizedUsername || !sanitizedPassword) {
      return { success: false, error: 'Please enter both username and password.' };
    }

    try {
      // Fetch user from database
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(sanitizedUsername)}&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Network error');
      }

      const users = await response.json();

      // Check if user exists
      if (!users || users.length === 0) {
        this.handleFailedLogin();
        return { success: false, error: 'Invalid username or password.' };
      }

      const user = users[0];

      // Check password (plain text comparison for v1)
      // TODO: Upgrade to bcrypt.compare() in v2
      if (user.password !== sanitizedPassword) {
        this.handleFailedLogin();
        return { success: false, error: 'Invalid username or password.' };
      }

      // Success! Reset attempts and set session
      this.resetLoginAttempts();
      this.setSession(user);

      // Log successful login attempt to database (fire and forget)
      this.logLoginAttempt(sanitizedUsername, true).catch(() => {});

      return { success: true, user };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Connection error. Please check your internet and try again.' };
    }
  },

  /**
   * Handle failed login attempt
   */
  handleFailedLogin() {
    this.incrementLoginAttempts();
    const attempts = this.getLoginAttempts();
    
    // Check if should lock out
    if (attempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
      this.setLockout();
    }

    // Log failed attempt to database (fire and forget)
    // Note: We don't have username here for privacy
    this.logLoginAttempt('unknown', false).catch(() => {});
  },

  /**
   * Log login attempt to database
   * @param {string} username - Username
   * @param {boolean} success - Whether login was successful
   */
  async logLoginAttempt(username, success) {
    try {
      await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/login_attempts`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          username: utils.sanitize(username),
          success,
          attempted_at: new Date().toISOString()
        })
      });
    } catch (e) {
      // Silently fail - logging is best effort
      console.warn('Failed to log login attempt:', e);
    }
  },

  /**
   * Log out current user
   */
  logout() {
    this.clearSession();
    window.location.href = CONFIG.ROUTES.LOGIN;
  },

  /**
   * Get redirect URL based on user role
   * @param {Object} session - Session object
   * @returns {string} - Redirect URL
   */
  getRedirectUrl(session) {
    if (!session || !session.role) {
      return CONFIG.ROUTES.LOGIN;
    }
    return CONFIG.ROLE_REDIRECTS[session.role] || CONFIG.ROUTES.LOGIN;
  },

  /**
   * Initialize auth check on page load
   * Call this at the top of every protected page
   * @param {Array<string>|string|null} allowedRoles - Roles allowed to access page, null for any logged-in user
   * @returns {Object|null} - Session if authorized
   */
  init(allowedRoles = null) {
    const session = this.getSession();
    
    // Not logged in
    if (!session) {
      window.location.href = CONFIG.ROUTES.LOGIN;
      return null;
    }
    
    // If specific roles required, check them
    if (allowedRoles) {
      return this.requireRole(allowedRoles);
    }
    
    return session;
  }
};

// Freeze auth object
Object.freeze(auth);
