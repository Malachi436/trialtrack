    // ============================================
    // FIELD ROUNDS & ENTRIES DETAIL
    // ============================================

    let currentFieldForRounds = null;
    let currentRoundForEntries = null;

    // Open field detail modal and show rounds
    window.viewFieldRounds = async function(fieldId) {
      currentFieldForRounds = admin.getFieldById(fieldId);
      if (!currentFieldForRounds) return;
      
      elements.fieldDetailTitle.textContent = utils.escapeHtml(currentFieldForRounds.name) + ' - Rounds';
      elements.roundEntriesPanel.classList.add('hidden');
      elements.fieldRoundsContent.innerHTML = '<div class="flex items-center justify-center p-6"><span class="spinner"></span> Loading rounds...</div>';
      openModal(elements.fieldDetailModal);
      
      // Load rounds
      const result = await admin.getFieldRounds(fieldId);
      if (result.error) {
        elements.fieldRoundsContent.innerHTML = '<p class="text-danger">Failed to load rounds.</p>';
        return;
      }
      
      const rounds = result.data || [];
      if (rounds.length === 0) {
        elements.fieldRoundsContent.innerHTML = '<p class="text-secondary">No rounds have been created for this field yet.</p>';
        return;
      }
      
      // Get entry counts for each round
      const roundStats = {};
      for (const round of rounds) {
        const entriesResult = await admin.getRoundEntries(round.id);
        roundStats[round.id] = {
          count: entriesResult.data ? entriesResult.data.length : 0,
          agents: {}
        };
        // Count entries per agent
        if (entriesResult.data) {
          entriesResult.data.forEach(entry => {
            const agent = entry.entered_by || 'Unknown';
            roundStats[round.id].agents[agent] = (roundStats[round.id].agents[agent] || 0) + 1;
          });
        }
      }
      
      renderRoundsTable(rounds, roundStats, fieldId);
    };

    function renderRoundsTable(rounds, roundStats, fieldId) {
      const totalPlots = 30;
      
      let html = '<div class="table-container"><table class="table"><thead><tr><th>Round #</th><th>Recorded Date</th><th>Plots Entered</th><th>% Complete</th><th>Actions</th></tr></thead><tbody>';
      
      rounds.forEach(round => {
        const stats = roundStats[round.id] || { count: 0, agents: {} };
        const percent = Math.round((stats.count / totalPlots) * 100);
        const agentsList = Object.keys(stats.agents).length > 0 
          ? Object.entries(stats.agents).map(([agent, cnt]) => agent + ' (' + cnt + ')').join(', ')
          : 'None';
        html += '<tr><td><strong>Round ' + round.round_number + '</strong></td><td>' + utils.formatDate(round.recorded_date) + '</td><td>' + stats.count + ' of ' + totalPlots + '</td><td><div class="flex items-center gap-2"><div class="progress-bar" style="width: 60px; height: 8px;"><div class="progress-fill" style="width: ' + percent + '%"></div></div><span>' + percent + '%</span></div></td><td><button class="btn btn-ghost btn-sm" onclick="viewRoundEntries(\'' + round.id + '\', ' + round.round_number + ', \'' + fieldId + '\')">View Entries</button></td></tr>';
      });
      
      html += '</tbody></table></div>';
      elements.fieldRoundsContent.innerHTML = html;
    }

    // View round entries detail
    window.viewRoundEntries = async function(roundId, roundNumber, fieldId) {
      currentRoundForEntries = { id: roundId, number: roundNumber, fieldId: fieldId };
      
      const field = admin.getFieldById(fieldId);
      if (!field) return;
      
      elements.roundEntriesTitle.textContent = 'Round ' + roundNumber + ' - Entries Detail';
      elements.roundEntriesSubtitle.textContent = field ? utils.escapeHtml(field.name) : '';
      elements.roundEntriesContent.innerHTML = '<div class="flex items-center justify-center p-6"><span class="spinner"></span> Loading entries...</div>';
      elements.roundEntriesPanel.classList.remove('hidden');
      
      // Load entries
      const entriesResult = await admin.getRoundEntries(roundId);
      if (entriesResult.error) {
        elements.roundEntriesContent.innerHTML = '<p class="text-danger">Failed to load entries.</p>';
        return;
      }
      
      const entries = entriesResult.data || [];
      renderRoundEntriesTable(entries, field);
    };

    function renderRoundEntriesTable(entries, field) {
      // Build entries map by plot_number
      const entriesMap = {};
      entries.forEach(entry => {
        entriesMap[entry.plot_number] = entry;
      });
      
      // Get parameter labels (P1-P6 from growth_params + yield_params)
      const growthParams = field.growth_params || CONFIG.DEFAULT_GROWTH_PARAMS;
      const yieldParams = field.yield_params || CONFIG.DEFAULT_YIELD_PARAMS;
      const allParams = [...growthParams, ...yieldParams];
      const totalParams = (field.growth_param_count || 3) + (field.yield_param_count || 3);
      const paramLabels = allParams.slice(0, totalParams);
      
      // Build table header
      const headerCells = ['Plot #', 'Block', 'Treatment', 'Entered By', 'Date & Time'];
      paramLabels.forEach((label, i) => headerCells.push('P' + (i + 1)));
      
      // Get plot layout from CONFIG
      const plotLayout = CONFIG.PLOT_LAYOUT;
      
      // Build rows for all 30 plots
      let rows = '';
      plotLayout.forEach(layout => {
        const plotNum = layout.plot;
        const blockNum = layout.block;
        const treatment = layout.treatment;
        const entry = entriesMap[plotNum];
        
        const treatmentClass = 't-' + treatment;
        
        if (entry) {
          // Entry exists
          const enteredBy = entry.entered_by || '—';
          const dateTime = entry.created_at ? formatDateTime(entry.created_at) : '—';
          
          let paramCells = '';
          paramLabels.forEach((_, i) => {
            const paramKey = 'p' + (i + 1); // Fix: use p1, p2... not param1, param2...
            const value = entry[paramKey];
            paramCells += '<td>' + (value !== null && value !== undefined ? value : '—') + '</td>';
          });
          
          rows += '<tr><td><strong>' + plotNum + '</strong></td><td>' + blockNum + '</td><td><span class="treatment-chip ' + treatmentClass + '">' + treatment + '</span></td><td><span class="badge badge-muted">' + utils.escapeHtml(enteredBy) + '</span></td><td class="text-muted">' + dateTime + '</td>' + paramCells + '</tr>';
        } else {
          // Entry not recorded
          let emptyCells = '';
          paramLabels.forEach(() => { emptyCells += '<td class="text-muted">—</td>'; });
          rows += '<tr class="entry-not-recorded"><td><strong>' + plotNum + '</strong></td><td>' + blockNum + '</td><td><span class="treatment-chip ' + treatmentClass + '">' + treatment + '</span></td><td colspan="2"><span class="text-muted">Not recorded</span></td>' + emptyCells + '</tr>';
        }
      });
      
      // Calculate per-agent summary
      const agentCounts = {};
      entries.forEach(entry => {
        const agent = entry.entered_by || 'Unknown';
        agentCounts[agent] = (agentCounts[agent] || 0) + 1;
      });
      
      const summaryParts = Object.entries(agentCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([agent, count]) => utils.escapeHtml(agent) + ' (' + count + ' plots)');
      const summaryText = summaryParts.join(', ');
      
      const enteredCount = entries.length;
      const totalPlots = 30;
      
      let headerHtml = '<tr>';
      headerCells.forEach(h => { headerHtml += '<th>' + utils.escapeHtml(h) + '</th>'; });
      headerHtml += '</tr>';
      
      elements.roundEntriesContent.innerHTML = '<p class="text-sm text-secondary mb-3">' + enteredCount + ' of ' + totalPlots + ' plots recorded</p>' +
        '<div class="table-container" style="max-height: 400px; overflow-y: auto;">' +
        '<table class="table"><thead>' + headerHtml + '</thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="mt-4 p-3" style="background: var(--color-surface-secondary); border-radius: var(--radius-md);">' +
        '<p class="text-sm"><strong>Summary:</strong> Entered by ' + (summaryText || 'No entries yet') + '</p></div>';
      
      // Render action log
      renderActionLog(entries);
    }

    function renderActionLog(entries) {
      const container = document.getElementById('roundActionLog');
      if (!container) return;
      
      const entryCount = entries.length;
      
      // Sort entries chronologically (oldest first)
      const sortedEntries = [...entries].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        return dateA - dateB;
      });
      
      let html = '<div style="border-top: 1px solid var(--color-border); margin-top: var(--space-6); padding-top: var(--space-4);">';
      html += '<div class="flex items-center justify-between mb-3">';
      html += '<h4 class="text-md font-semibold">ACTION LOG</h4>';
      html += '<span class="badge badge-muted">' + entryCount + ' ' + (entryCount === 1 ? 'entry' : 'entries') + '</span>';
      html += '</div>';
      html += '<div style="max-height: 300px; overflow-y: auto;">';
      
      if (sortedEntries.length === 0) {
        html += '<p class="text-muted text-sm" style="padding: 12px 0;">No log entries yet.</p>';
      } else {
        sortedEntries.forEach((entry, index) => {
          const username = utils.escapeHtml(entry.entered_by || 'Unknown');
          const plotNum = entry.plot_number;
          const treatment = entry.treatment || 'I';
          const treatmentName = CONFIG.TREATMENTS[treatment] || treatment;
          const dateTime = entry.created_at ? formatDateTime(entry.created_at) : '—';
          
          // Avatar: first 2 letters of username, uppercase
          const initials = username.length >= 2 
            ? username.substring(0, 2).toUpperCase() 
            : username.toUpperCase().padEnd(2, '?');
          
          // Avatar background color based on treatment
          const avatarBgClass = 't-' + treatment;
          
          const isLast = index === sortedEntries.length - 1;
          html += '<div class="flex items-center gap-2" style="padding: 8px 0; ' + (isLast ? '' : 'border-bottom: 1px solid var(--color-border);') + '">';
          html += '<div style="width: 28px; height: 28px; border-radius: 50%; background: var(--color-' + avatarBgClass + ', var(--color-primary)); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: white; flex-shrink: 0;">' + initials + '</div>';
          html += '<span style="font-size: 13px; color: var(--color-text-secondary);">' + username + ' recorded Plot ' + plotNum + ' (' + treatmentName + ')</span>';
          html += '<span style="color: var(--color-text-muted); margin-left: auto; white-space: nowrap; font-size: 12px;">' + dateTime + '</span>';
          html += '</div>';
        });
      }
      
      html += '</div></div>';
      container.innerHTML = html;
    }

    function formatDateTime(isoString) {
      const date = new Date(isoString);
      const day = date.getDate();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return day + ' ' + month + ', ' + hours + ':' + minutes;
    }

    function closeRoundEntries() {
      elements.roundEntriesPanel.classList.add('hidden');
      currentRoundForEntries = null;
    }

    function closeFieldDetail() {
      closeModal(elements.fieldDetailModal);
      currentFieldForRounds = null;
      closeRoundEntries();
    }
