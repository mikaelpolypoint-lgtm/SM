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
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                <input type="file" id="changes-upload" accept=".csv" class="form-control" style="display: none;">
                <button id="btn-upload-changes" class="btn btn-primary">Upload & Compare CSV</button>
            </div>
            
            <div id="changes-results" style="display: none;">
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
            renderComparisonTable(developers, currentAvailabilities, csvData);
        },
        error: (err) => {
            throw new Error("CSV Parse Error: " + err.message);
        }
    });
}

function renderComparisonTable(developers, currentAvailabilities, csvData) {
    const resultsDiv = document.getElementById('changes-results');
    const headerRow = document.getElementById('changes-header-row');
    const tbody = document.getElementById('changes-body');

    // Show results container
    resultsDiv.style.display = 'block';

    // 1. Build Header
    headerRow.innerHTML = `
        <th>Date</th>
        <th>Sprint</th>
        ${developers.map(d => `<th>${d.key}</th>`).join('')}
    `;

    // 2. Build Rows
    // We iterate over the CURRENT availabilities (DB) as the base, 
    // but we should probably include dates from CSV if they are missing in DB?
    // User said "comparses... uploaded file and data on availabilities page".
    // Usually we care about the dates in the System.

    // Sort current availabilities by date
    currentAvailabilities.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Helper to parse CSV date (DD.MM.YYYY or YYYY-MM-DD)
    const normalizeDate = (d) => {
        if (!d) return null;
        if (d.includes('.')) {
            const [day, month, year] = d.split('.');
            // Handle 2-digit year if necessary, but assuming 4 from export
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return d; // Assume YYYY-MM-DD
    };

    // Helper to parse value
    const parseVal = (val) => {
        if (val === undefined || val === null || val === '') return 0; // Treat missing as 0? Or 1?
        // In export, we might have 1, 0.5, 0.
        // If missing in CSV, what does it mean? 
        // Let's assume 0 if missing to be safe, or maybe 1 if it's "Availability"?
        // In the import logic, we defaulted to 0.
        const s = val.toString().trim();
        if (s === '1') return 1;
        if (s.includes('0.5')) return 0.5;
        return 0;
    };

    const rowsHtml = currentAvailabilities.map(dbRow => {
        // Find matching row in CSV
        // CSV might have 'Date' or 'Datum'
        const csvRow = csvData.find(r => {
            const rDate = r['Date'] || r['Datum'] || Object.values(r)[0]; // Fallback to first col?
            return normalizeDate(rDate) === dbRow.date;
        });

        const dateObj = new Date(dbRow.date);
        const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getFullYear()).slice(-2)}`;

        let hasChanges = false;

        const cells = developers.map(dev => {
            const dbVal = dbRow[dev.key] !== undefined ? dbRow[dev.key] : 1; // Default 1 in DB if missing (implied available)

            let csvVal = 1; // Default 1 if missing in CSV?
            if (csvRow) {
                // Find column for dev
                const csvKey = Object.keys(csvRow).find(k => k.trim().substring(0, 3).toUpperCase() === dev.key.toUpperCase());
                if (csvKey) {
                    csvVal = parseVal(csvRow[csvKey]);
                } else {
                    // Dev not in CSV? Assume 1 or 0? 
                    // If dev is not in CSV, maybe we shouldn't compare?
                    // Let's assume 1 (Available) to minimize noise if they just added a dev?
                    // Or 0?
                    // Let's stick to 1.
                }
            } else {
                // Date not in CSV
                // Treat as no change? or CSV=0?
                // If date is missing in CSV, maybe it's not in the export range.
                // Let's assume CSVVal = dbVal so diff is 0
                csvVal = dbVal;
            }

            const diff = dbVal - csvVal;

            let style = '';
            let content = diff;

            if (diff !== 0) {
                hasChanges = true;
                if (diff > 0) {
                    style = 'color: var(--success); font-weight: bold;'; // +1 (gained capacity)
                    content = `+${diff}`;
                } else {
                    style = 'color: var(--danger); font-weight: bold;'; // -1 (lost capacity)
                }
            } else {
                style = 'color: var(--text-secondary); opacity: 0.3;';
                content = '0';
            }

            return `<td style="text-align: center; ${style}">${content}</td>`;
        }).join('');

        // Only show rows with changes? Or all rows?
        // User said "Show me the the same table as in the availability page".
        // So show all rows.
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${dbRow.sprint}</td>
                ${cells}
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}
