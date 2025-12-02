import { dataService } from '../data.js';

export async function renderDashboard(container, pi) {
    container.innerHTML = '<div class="loading-spinner">Loading Dashboard...</div>';

    const [developers, availabilities] = await Promise.all([
        dataService.getDevelopers(pi),
        dataService.getAvailabilities(pi)
    ]);

    // Filter and Sort
    developers.sort((a, b) => (a.key || '').localeCompare(b.key || ''));

    // Get unique sprints from availabilities
    const sprintsMap = new Map(); // name -> { start, end, days: [] }

    availabilities.forEach(row => {
        if (!sprintsMap.has(row.sprint)) {
            sprintsMap.set(row.sprint, { name: row.sprint, rows: [] });
        }
        sprintsMap.get(row.sprint).rows.push(row);
    });

    // Sort sprints by date of first entry
    const sprints = Array.from(sprintsMap.values()).sort((a, b) => {
        const dateA = a.rows[0]?.date || '';
        const dateB = b.rows[0]?.date || '';
        return dateA.localeCompare(dateB);
    });

    // Helper to calculate capacity for a dev in a sprint
    const getSprintCapacity = (sprintName, devKey) => {
        const sprintData = sprintsMap.get(sprintName);
        if (!sprintData) return 0;

        return sprintData.rows.reduce((sum, row) => {
            const val = row[devKey];
            // Default to 1 if undefined to match the Availabilities page UI default
            return sum + (typeof val === 'number' ? val : 1);
        }, 0);
    };

    // Helper to get Dev Attributes
    const getDevAttrs = (dev) => {
        const dailyHours = parseFloat(dev.dailyHours) || 8;
        const load = parseFloat(dev.load) || 90;
        const developRatio = parseFloat(dev.developRatio) || 0;
        const maintainRatio = parseFloat(dev.maintainRatio) || 0;
        const velocity = parseFloat(dev.velocity) || 0;

        const devH = (dailyHours * (load / 100) * (developRatio / 100));
        const maintainH = (dailyHours * (load / 100) * (maintainRatio / 100));
        const dailySP = (devH / 8) * velocity;

        return { devH, maintainH, dailySP };
    };

    // Generate Tables
    const tables = [
        { title: "SP Load", field: "dailySP" },
        { title: "Dev h", field: "devH" },
        { title: "Maintain h", field: "maintainH" }
    ];

    // Teams for Filter
    const teams = ['All', ...new Set(developers.map(d => d.team).filter(Boolean))];

    // Sprints for Filter
    const sprintNames = ['All', ...sprints.map(s => s.name)];

    const render = (filterTeam, filterSprint) => {
        let html = `
            <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
                <label for="team-filter">Team:</label>
                <select id="team-filter" style="width: auto; padding: 0.5rem;">
                    ${teams.map(t => `<option value="${t}" ${t === filterTeam ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                
                <label for="sprint-filter">Sprint:</label>
                <select id="sprint-filter" style="width: auto; padding: 0.5rem;">
                    ${sprintNames.map(s => `<option value="${s}" ${s === filterSprint ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div class="dashboard-grid" style="display: block;">
        `;

        const filteredDevs = filterTeam === 'All' ? developers : developers.filter(d => d.team === filterTeam);
        const filteredSprints = filterSprint === 'All' ? sprints : sprints.filter(s => s.name === filterSprint);

        tables.forEach(tableConfig => {
            html += `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3>${tableConfig.title}</h3>
                        <button class="btn btn-sm btn-secondary btn-export-dashboard" data-field="${tableConfig.field}" data-title="${tableConfig.title}">Export CSV</button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Sprint</th>
                                    ${filteredDevs.map(d => `<th>${d.key}</th>`).join('')}
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderTableBody(filteredSprints, filteredDevs, tableConfig.field, getSprintCapacity, getDevAttrs)}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

        // Re-attach listeners
        document.getElementById('team-filter').addEventListener('change', (e) => {
            render(e.target.value, filterSprint);
        });

        document.getElementById('sprint-filter').addEventListener('change', (e) => {
            render(filterTeam, e.target.value);
        });

        document.querySelectorAll('.btn-export-dashboard').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.field;
                const title = btn.dataset.title;
                exportDashboardTable(title, field, filteredSprints, filteredDevs, getSprintCapacity, getDevAttrs);
            });
        });
    };

    render('All', 'All');
}

function renderTableBody(sprints, developers, attrField, getSprintCapacity, getDevAttrs) {
    const format = (n) => attrField === 'dailySP' ? n.toFixed(1) : Math.round(n);

    let rowsHtml = '';

    // Totals per dev
    const devTotals = {};
    const devTotalsNoIP = {};
    developers.forEach(d => {
        devTotals[d.key] = 0;
        devTotalsNoIP[d.key] = 0;
    });

    // Sprints Rows
    sprints.forEach((sprint, index) => {
        // Check name contains "IP" or is 6th.
        const isIpSprint = sprint.name.includes('IP');

        let rowHtml = `<tr><td>${sprint.name}</td>`;
        let rowTotal = 0;

        developers.forEach(dev => {
            const capacityDays = getSprintCapacity(sprint.name, dev.key);
            const attrs = getDevAttrs(dev);
            const val = capacityDays * attrs[attrField];

            devTotals[dev.key] += val;
            if (!isIpSprint) devTotalsNoIP[dev.key] += val;

            if (!dev.specialCase) {
                rowTotal += val;
            }

            const style = dev.specialCase ? 'color: var(--danger); font-weight: bold;' : '';
            rowHtml += `<td style="${style}">${format(val)}</td>`;
        });

        rowHtml += `<td><strong>${format(rowTotal)}</strong></td></tr>`;
        rowsHtml += rowHtml;
    });

    // Total Row
    let totalRow = `<tr style="background: rgba(59, 130, 246, 0.1); font-weight: bold;"><td>Total</td>`;
    let grandTotal = 0;
    developers.forEach(dev => {
        const style = dev.specialCase ? 'color: var(--danger);' : '';
        totalRow += `<td style="${style}">${format(devTotals[dev.key])}</td>`;
        if (!dev.specialCase) {
            grandTotal += devTotals[dev.key];
        }
    });
    totalRow += `<td>${format(grandTotal)}</td></tr>`;

    // Ohne IP Row
    let noIpRow = `<tr style="background: rgba(16, 185, 129, 0.1); font-weight: bold;"><td>Ohne IP</td>`;
    let grandTotalNoIP = 0;
    developers.forEach(dev => {
        const style = dev.specialCase ? 'color: var(--danger);' : '';
        noIpRow += `<td style="${style}">${format(devTotalsNoIP[dev.key])}</td>`;
        if (!dev.specialCase) {
            grandTotalNoIP += devTotalsNoIP[dev.key];
        }
    });
    noIpRow += `<td>${format(grandTotalNoIP)}</td></tr>`;

    return rowsHtml + totalRow + noIpRow;
}

function exportDashboardTable(title, field, sprints, developers, getSprintCapacity, getDevAttrs) {
    const format = (n) => field === 'dailySP' ? n.toFixed(1) : Math.round(n);

    // Prepare Data
    const csvData = [];

    // Header
    const header = ['Sprint', ...developers.map(d => d.key), 'Total'];

    // Rows
    const devTotals = {};
    const devTotalsNoIP = {};
    developers.forEach(d => {
        devTotals[d.key] = 0;
        devTotalsNoIP[d.key] = 0;
    });

    sprints.forEach(sprint => {
        const isIpSprint = sprint.name.includes('IP');
        const row = { 'Sprint': sprint.name };
        let rowTotal = 0;

        developers.forEach(dev => {
            const capacityDays = getSprintCapacity(sprint.name, dev.key);
            const attrs = getDevAttrs(dev);
            const val = capacityDays * attrs[field];

            devTotals[dev.key] += val;
            if (!isIpSprint) devTotalsNoIP[dev.key] += val;

            if (!dev.specialCase) rowTotal += val;

            row[dev.key] = format(val);
        });
        row['Total'] = format(rowTotal);
        csvData.push(row);
    });

    // Total Row
    const totalRow = { 'Sprint': 'Total' };
    let grandTotal = 0;
    developers.forEach(dev => {
        totalRow[dev.key] = format(devTotals[dev.key]);
        if (!dev.specialCase) grandTotal += devTotals[dev.key];
    });
    totalRow['Total'] = format(grandTotal);
    csvData.push(totalRow);

    // Ohne IP Row
    const noIpRow = { 'Sprint': 'Ohne IP' };
    let grandTotalNoIP = 0;
    developers.forEach(dev => {
        noIpRow[dev.key] = format(devTotalsNoIP[dev.key]);
        if (!dev.specialCase) grandTotalNoIP += devTotalsNoIP[dev.key];
    });
    noIpRow['Total'] = format(grandTotalNoIP);
    csvData.push(noIpRow);

    // Generate CSV
    const csv = Papa.unparse({
        fields: header,
        data: csvData
    });

    // Download
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `dashboard_${title.replace(/\s+/g, '_').toLowerCase()}_${timestamp}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
