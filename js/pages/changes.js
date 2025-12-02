import { dataService } from '../data.js';

export async function renderChanges(container, pi) {
    container.innerHTML = `
        <div class="card">
            <h3>Compare Availabilities</h3>
            <p class="text-secondary" style="margin-bottom: 1rem;">
                Upload an Availabilities export file (CSV) to see the difference between the current system data and the file.
                <br>
                <strong>Calculation:</strong> Current System Data - Uploaded File Data
            </p>
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap;">
                <input type="file" id="changes-upload" accept=".csv" class="form-control" style="display: none;">
                <button id="btn-upload-changes" class="btn btn-primary">Upload & Compare CSV</button>
            </div>
            
            <div id="changes-results" style="display: none;">
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem;">
                    <label for="changes-team-filter">Team:</label>
                    <select id="changes-team-filter" style="padding: 0.4rem;"></select>
                    
                    <label for="changes-sprint-filter">Sprint:</label>
                    <select id="changes-sprint-filter" style="padding: 0.4rem;"></select>

                    <label for="changes-weekday-filter">Weekday:</label>
                    <select id="changes-weekday-filter" style="padding: 0.4rem;"></select>

                    <label for="changes-kw-filter">KW:</label>
                    <select id="changes-kw-filter" style="padding: 0.4rem;"></select>
                </div>

                <div class="table-container" style="max-height: 70vh;">
                    <table id="changes-table">
                        <thead style="position: sticky; top: 0; z-index: 10;">
                            <tr id="changes-header-row">
                                <!-- Headers will be injected here -->
                            </tr>
                        </thead>
                        <tbody id="changes-body">
                            <!-- Rows will be injected here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    const btnUpload = document.getElementById('btn-upload-changes');
    const fileInput = document.getElementById('changes-upload');

    btnUpload.onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        container.querySelector('.card').insertAdjacentHTML('beforeend', '<div id="loading-changes" class="loading-spinner">Processing...</div>');

        try {
            await processFile(file, pi);
        } catch (err) {
            console.error(err);
            alert("Error processing file: " + err.message);
        } finally {
            const spinner = document.getElementById('loading-changes');
            if (spinner) spinner.remove();
        }
    };
}

async function processFile(file, pi) {
    // 1. Fetch current data
    const [developers, currentAvailabilities] = await Promise.all([
        dataService.getDevelopers(pi),
        dataService.getAvailabilities(pi)
    ]);

    // Sort developers for consistent column order
    developers.sort((a, b) => (a.key || '').localeCompare(b.key || ''));

    // 2. Parse CSV
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const csvData = results.data;
            setupFiltersAndRender(developers, currentAvailabilities, csvData);
        },
        error: (err) => {
            throw new Error("CSV Parse Error: " + err.message);
        }
    });
}

function setupFiltersAndRender(developers, currentAvailabilities, csvData) {
    const resultsDiv = document.getElementById('changes-results');
    resultsDiv.style.display = 'block';

    // Extract Filter Options
    const teams = ['All', ...new Set(developers.map(d => d.team).filter(Boolean))];
    const sprintNames = ['All', ...new Set(currentAvailabilities.map(a => a.sprint).filter(Boolean))].sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return a.localeCompare(b);
    });

    const getWeekday = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
    const weekdays = ['All', ...new Set(currentAvailabilities.map(a => getWeekday(a.date)))];
    const weekOrder = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
    weekdays.sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return (weekOrder[a] || 99) - (weekOrder[b] || 99);
    });

    const getISOWeek = (dateStr) => {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };
    const kws = ['All', ...new Set(currentAvailabilities.map(a => getISOWeek(a.date)))].sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return a - b;
    });

    // Populate Selects
    const populateSelect = (id, options) => {
        const select = document.getElementById(id);
        select.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
    };

    populateSelect('changes-team-filter', teams);
    populateSelect('changes-sprint-filter', sprintNames);
    populateSelect('changes-weekday-filter', weekdays);
    populateSelect('changes-kw-filter', kws);

    // Render Function
    const render = () => {
        const filterTeam = document.getElementById('changes-team-filter').value;
        const filterSprint = document.getElementById('changes-sprint-filter').value;
        const filterWeekday = document.getElementById('changes-weekday-filter').value;
        const filterKw = document.getElementById('changes-kw-filter').value;

        renderComparisonTable(developers, currentAvailabilities, csvData, filterTeam, filterSprint, filterWeekday, filterKw);
    };

    // Listeners
    document.getElementById('changes-team-filter').onchange = render;
    document.getElementById('changes-sprint-filter').onchange = render;
    document.getElementById('changes-weekday-filter').onchange = render;
    document.getElementById('changes-kw-filter').onchange = render;

    // Initial Render
    render();
}

function renderComparisonTable(developers, currentAvailabilities, csvData, filterTeam, filterSprint, filterWeekday, filterKw) {
    const headerRow = document.getElementById('changes-header-row');
    const tbody = document.getElementById('changes-body');

    // Filter Developers
    const filteredDevs = filterTeam === 'All' ? developers : developers.filter(d => d.team === filterTeam);

    // Filter Rows
    const getWeekday = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
    const getISOWeek = (dateStr) => {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };

    const filteredRows = currentAvailabilities.filter(r => {
        const matchSprint = filterSprint === 'All' || r.sprint === filterSprint;
        const matchWeekday = filterWeekday === 'All' || getWeekday(r.date) === filterWeekday;
        const matchKw = filterKw === 'All' || getISOWeek(r.date) == filterKw;
        return matchSprint && matchWeekday && matchKw;
    });

    // Sort rows by date
    filteredRows.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 1. Build Header
    headerRow.innerHTML = `
        <th>Date</th>
        <th>Weekday</th>
        <th>KW</th>
        <th>Sprint</th>
        ${filteredDevs.map(d => `<th>${d.key}</th>`).join('')}
    `;

    // Helper to parse CSV date (DD.MM.YYYY or YYYY-MM-DD)
    const normalizeDate = (d) => {
        if (!d) return null;
        if (d.includes('.')) {
            const [day, month, year] = d.split('.');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return d;
    };

    // Helper to parse value
    const parseVal = (val) => {
        if (val === undefined || val === null || val === '') return 0;
        const s = val.toString().trim();
        if (s === '1') return 1;
        if (s.includes('0.5')) return 0.5;
        return 0;
    };

    const rowsHtml = filteredRows.map(dbRow => {
        // Find matching row in CSV
        const csvRow = csvData.find(r => {
            const rDate = r['Date'] || r['Datum'] || Object.values(r)[0];
            return normalizeDate(rDate) === dbRow.date;
        });

        const dateObj = new Date(dbRow.date);
        const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getFullYear()).slice(-2)}`;
        const weekday = getWeekday(dbRow.date);
        const kw = getISOWeek(dbRow.date);

        const cells = filteredDevs.map(dev => {
            const dbVal = dbRow[dev.key] !== undefined ? dbRow[dev.key] : 1;

            let csvVal = 1;
            if (csvRow) {
                const csvKey = Object.keys(csvRow).find(k => k.trim().substring(0, 3).toUpperCase() === dev.key.toUpperCase());
                if (csvKey) {
                    csvVal = parseVal(csvRow[csvKey]);
                }
            } else {
                csvVal = dbVal; // No CSV data for this date, assume no change
            }

            const diff = dbVal - csvVal;

            let style = '';
            let content = diff;

            if (diff !== 0) {
                if (diff > 0) {
                    style = 'color: var(--success); font-weight: bold;';
                    content = `+${diff}`;
                } else {
                    style = 'color: var(--danger); font-weight: bold;';
                }
            } else {
                style = 'color: var(--text-secondary); opacity: 0.3;';
                content = '0';
            }

            return `<td style="text-align: center; ${style}">${content}</td>`;
        }).join('');

        return `
            <tr>
                <td>${dateStr}</td>
                <td>${weekday}</td>
                <td>${kw}</td>
                <td>${dbRow.sprint}</td>
                ${cells}
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}
