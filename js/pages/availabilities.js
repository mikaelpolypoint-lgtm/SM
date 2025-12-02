import { dataService } from '../data.js';

export async function renderAvailabilities(container, pi) {
    container.innerHTML = '<div class="loading-spinner">Loading Availabilities...</div>';

    // Ensure defaults exist
    await dataService.initDefaultSprints(pi);

    const [developers, availabilities] = await Promise.all([
        dataService.getDevelopers(pi),
        dataService.getAvailabilities(pi)
    ]);

    // Sort availabilities by date
    availabilities.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Sort developers to match column order
    developers.sort((a, b) => (a.key || '').localeCompare(b.key || ''));

    // Teams for Filter
    const teams = ['All', ...new Set(developers.map(d => d.team).filter(Boolean))];

    // Sprints for Filter (extract from availabilities)
    const sprintNames = ['All', ...new Set(availabilities.map(a => a.sprint).filter(Boolean))];
    // Sort sprints naturally if possible, or rely on data order
    sprintNames.sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return a.localeCompare(b);
    });

    // Weekdays for Filter
    const weekdays = ['All', ...new Set(availabilities.map(a => getWeekday(a.date)))];
    // Sort weekdays (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
    const weekOrder = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
    weekdays.sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return (weekOrder[a] || 99) - (weekOrder[b] || 99);
    });

    // KWs for Filter
    const kws = ['All', ...new Set(availabilities.map(a => getISOWeek(a.date)))];
    kws.sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return a - b;
    });

    const render = (filterTeam, filterSprint, filterWeekday, filterKw) => {
        const filteredDevs = filterTeam === 'All' ? developers : developers.filter(d => d.team === filterTeam);

        // Filter rows
        const filteredRows = availabilities.filter(r => {
            const matchSprint = filterSprint === 'All' || r.sprint === filterSprint;
            const matchWeekday = filterWeekday === 'All' || getWeekday(r.date) === filterWeekday;
            const matchKw = filterKw === 'All' || getISOWeek(r.date) == filterKw; // loose equality for string/number mix
            return matchSprint && matchWeekday && matchKw;
        });

        const html = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                    <h3>Availabilities</h3>
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        <label for="avail-team-filter">Team:</label>
                        <select id="avail-team-filter" style="padding: 0.4rem;">
                            ${teams.map(t => `<option value="${t}" ${t === filterTeam ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                        
                        <label for="avail-sprint-filter">Sprint:</label>
                        <select id="avail-sprint-filter" style="padding: 0.4rem;">
                            ${sprintNames.map(s => `<option value="${s}" ${s === filterSprint ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>

                        <label for="avail-weekday-filter">Weekday:</label>
                        <select id="avail-weekday-filter" style="padding: 0.4rem;">
                            ${weekdays.map(w => `<option value="${w}" ${w === filterWeekday ? 'selected' : ''}>${w}</option>`).join('')}
                        </select>

                        <label for="avail-kw-filter">KW:</label>
                        <select id="avail-kw-filter" style="padding: 0.4rem;">
                            ${kws.map(k => `<option value="${k}" ${k == filterKw ? 'selected' : ''}>${k}</option>`).join('')}
                        </select>
                        
                        <input type="file" id="csv-upload" accept=".csv" style="display: none;">
                        <button id="import-btn" class="btn btn-secondary">Import CSV</button>
                        <button id="export-avail-btn" class="btn btn-secondary">Export CSV</button>
                        <button id="save-avail-btn" class="btn btn-primary">Save Changes</button>
                    </div>
                </div>
                <div class="table-container" style="max-height: 70vh;">
                    <table id="avail-table">
                        <thead style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th>Date</th>
                                <th>Weekday</th>
                                <th>KW</th>
                                <th>Sprint</th>
                                <th>PI</th>
                                ${filteredDevs.map(d => `<th class="avail-cell">${d.key}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredRows.map(row => renderRow(row, filteredDevs)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Listeners
        document.getElementById('import-btn').addEventListener('click', () => document.getElementById('csv-upload').click());
        document.getElementById('csv-upload').addEventListener('change', (e) => handleImport(e, pi, developers, availabilities));

        document.getElementById('export-avail-btn').addEventListener('click', () => exportAvailabilitiesCSV(availabilities, developers));

        document.getElementById('save-avail-btn').addEventListener('click', () => saveAll(pi, availabilities));

        document.getElementById('avail-team-filter').addEventListener('change', (e) => {
            render(e.target.value, filterSprint, filterWeekday, filterKw);
        });

        document.getElementById('avail-sprint-filter').addEventListener('change', (e) => {
            render(filterTeam, e.target.value, filterWeekday, filterKw);
        });

        document.getElementById('avail-weekday-filter').addEventListener('change', (e) => {
            render(filterTeam, filterSprint, e.target.value, filterKw);
        });

        document.getElementById('avail-kw-filter').addEventListener('change', (e) => {
            render(filterTeam, filterSprint, filterWeekday, e.target.value);
        });

        // Input change listener to update local object before save
        document.getElementById('avail-table').addEventListener('change', (e) => {
            if (e.target.classList.contains('avail-input')) {
                const date = e.target.dataset.date;
                const key = e.target.dataset.key;
                const val = parseFloat(e.target.value);

                const row = availabilities.find(r => r.date === date);
                if (row) {
                    row[key] = val; // Store directly as property
                }

                // Update color
                const cell = e.target.closest('td');
                cell.className = 'avail-cell'; // Reset
                if (val === 0) cell.classList.add('avail-0');
                else if (val === 0.5) cell.classList.add('avail-0-5');
                else if (val === 1) cell.classList.add('avail-1');
            }
        });
    };

    render('All', 'All', 'All', 'All');
}

function getWeekday(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getISOWeek(dateStr) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    // January 4 is always in week 1.
    const week1 = new Date(date.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear()).slice(-2);
    return `${d}.${m}.${y}`;
}

function renderRow(row, developers) {
    const weekday = getWeekday(row.date);
    const kw = getISOWeek(row.date);
    const formattedDate = formatDate(row.date);

    return `
        <tr>
            <td>${formattedDate}</td>
            <td>${weekday}</td>
            <td>${kw}</td>
            <td>${row.sprint}</td>
            <td>${row.pi}</td>
            ${developers.map(dev => {
        const val = row[dev.key] !== undefined ? row[dev.key] : 1; // Default to 1 if missing? Or 0? User said "raw availabilities... 1 or 0.5 or 0". Let's default to 1 (available) or empty.
        // Actually, if it's a new dev, maybe default to 1.
        let colorClass = 'avail-1'; // Default green
        if (val === 0) colorClass = 'avail-0';
        else if (val === 0.5) colorClass = 'avail-0-5';

        return `<td class="avail-cell ${colorClass}"><input type="number" class="avail-input" data-date="${row.date}" data-key="${dev.key}" value="${val}" step="0.5" min="0" max="1"></td>`;
    }).join('')}
        </tr>
    `;
}

function saveAll(pi, availabilities) {
    const btn = document.getElementById('save-avail-btn');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    dataService.saveAvailability(pi, availabilities).then(() => {
        alert('Saved successfully!');
    }).catch(e => {
        console.error(e);
        alert('Error saving: ' + e.message);
    }).finally(() => {
        btn.textContent = 'Save Changes';
        btn.disabled = false;
    });
}

function exportAvailabilitiesCSV(availabilities, developers) {
    console.log("Exporting CSV...", availabilities.length, "rows");

    const formatDateForExport = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}.${m}.${y}`;
    };

    const fields = ['Date', 'Sprint', 'PI', ...developers.map(d => d.key)];

    const data = availabilities.map(row => {
        const csvRow = {
            'Date': formatDateForExport(row.date),
            'Sprint': row.sprint,
            'PI': row.pi
        };
        developers.forEach(dev => {
            csvRow[dev.key] = row[dev.key] !== undefined ? row[dev.key] : 1;
        });
        return csvRow;
    });

    try {
        const csv = Papa.unparse({
            fields: fields,
            data: data
        });

        console.log("CSV generated, length:", csv.length);

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', url);
        linkElement.setAttribute('download', `availabilities_export_${timestamp}.csv`);
        linkElement.style.display = 'none';
        document.body.appendChild(linkElement);

        console.log("Clicking download link...");
        linkElement.click();

        document.body.removeChild(linkElement);

        // Delay revoke to allow download to start
        setTimeout(() => {
            URL.revokeObjectURL(url);
            console.log("Revoked Object URL");
        }, 100);
    } catch (err) {
        console.error("Error generating CSV:", err);
        alert("Failed to generate CSV export.");
    }
}

function handleImport(e, pi, developers, availabilities) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function (results) {
            const data = results.data;
            let updatedCount = 0;

            // Helper to parse value
            const parseVal = (val) => {
                if (!val) return 0;
                const s = val.toString().trim();
                if (s === '1') return 1;
                if (s.includes('0.5')) return 0.5;
                return 0;
            };

            // Helper to parse date (DD.MM.YYYY -> YYYY-MM-DD)
            const parseDate = (dateStr) => {
                if (!dateStr) return null;
                const parts = dateStr.split('.');
                if (parts.length === 3) {
                    // Pad with 0 if needed
                    const d = parts[0].padStart(2, '0');
                    const m = parts[1].padStart(2, '0');
                    const y = parts[2];
                    // Handle 2 digit year if needed? Import regex was \d{4}.
                    // If export uses 4 digits, we are good.
                    // If import file has 2 digits, we might need to fix parseDate.
                    // The regex in handleImport was /^\d{1,2}\.\d{1,2}\.\d{4}$/.
                    // So it expects 4 digit year.
                    return `${y}-${m}-${d}`;
                }
                return dateStr; // Fallback
            };

            data.forEach(csvRow => {
                // Find date column (DATUM, Datum, Date, or just the first column?)
                // User said "Column 1".
                // Let's try to find a key that looks like a date or is named DATUM
                let dateKey = Object.keys(csvRow).find(k => k.toUpperCase() === 'DATUM' || k.toUpperCase() === 'DATE');

                // If not found by name, assume first key if it looks like a date?
                // But header:true makes keys unpredictable order technically, but usually safe.
                if (!dateKey) {
                    // Fallback: check if any value looks like DD.MM.YYYY
                    dateKey = Object.keys(csvRow).find(k => /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(csvRow[k]));
                }

                if (!dateKey) return; // Skip if no date found

                const csvDate = parseDate(csvRow[dateKey]);
                if (!csvDate) return;

                // Find matching row in availabilities
                const targetRow = availabilities.find(r => r.date === csvDate);
                if (targetRow) {
                    updatedCount++;
                    // Update developers
                    developers.forEach(dev => {
                        // Check if dev key exists in CSV
                        // User said: "If the key has more than 3 letters... use only the first three letters"
                        // So we need to find a column in CSV that *starts with* the dev key (assuming dev key is 3 chars).
                        // Or rather, we check if any CSV key, when truncated to 3 chars, matches the dev key.

                        // Find a matching key in the CSV row
                        const csvKey = Object.keys(csvRow).find(k => k.trim().substring(0, 3).toUpperCase() === dev.key.toUpperCase());

                        if (csvKey && csvRow[csvKey] !== undefined) {
                            targetRow[dev.key] = parseVal(csvRow[csvKey]);
                        }
                    });
                }
            });

            if (updatedCount > 0) {
                if (confirm(`Updated ${updatedCount} days from CSV. Save changes?`)) {
                    await dataService.saveAvailability(pi, availabilities);
                    // Reload page to show changes
                    const container = document.getElementById('page-container');
                    renderAvailabilities(container, pi);
                }
            } else {
                alert('No matching dates found in CSV for this PI.');
            }
        }
    });
}
