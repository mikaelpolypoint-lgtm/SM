import { dataService } from '../data.js';

export async function renderDevelopers(container, pi) {
    container.innerHTML = '<div class="loading-spinner">Loading Developers...</div>';

    await dataService.ensureDefaults(pi);

    const developers = await dataService.getDevelopers(pi);

    // Sort by Team then Name
    developers.sort((a, b) => (a.team || '').localeCompare(b.team || '') || (a.name || '').localeCompare(b.name || ''));

    // Teams for Filter
    const teams = ['All', ...new Set(developers.map(d => d.team).filter(Boolean))];

    const render = (filterTeam) => {
        const filteredDevs = filterTeam === 'All' ? developers : developers.filter(d => d.team === filterTeam);

        const html = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>Team Members</h3>
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <label for="dev-team-filter">Filter:</label>
                        <select id="dev-team-filter" style="width: auto; padding: 0.4rem;">
                            ${teams.map(t => `<option value="${t}" ${t === filterTeam ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                        <input type="file" id="dev-import-file" accept=".json" style="display: none;">
                        <input type="file" id="dev-import-csv" accept=".csv" style="display: none;">
                        
                        <div class="dropdown" style="display: inline-block; position: relative;">
                            <button class="btn btn-secondary" id="export-menu-btn">Export ▼</button>
                            <div id="export-menu" style="display: none; position: absolute; background: var(--bg-card); border: 1px solid var(--border); padding: 0.5rem; z-index: 100;">
                                <button id="dev-export-json" class="btn btn-sm" style="display: block; width: 100%; margin-bottom: 0.5rem;">JSON</button>
                                <button id="dev-export-csv" class="btn btn-sm" style="display: block; width: 100%;">CSV</button>
                            </div>
                        </div>

                        <div class="dropdown" style="display: inline-block; position: relative;">
                            <button class="btn btn-secondary" id="import-menu-btn">Import ▼</button>
                            <div id="import-menu" style="display: none; position: absolute; background: var(--bg-card); border: 1px solid var(--border); padding: 0.5rem; z-index: 100;">
                                <button id="dev-import-json-btn" class="btn btn-sm" style="display: block; width: 100%; margin-bottom: 0.5rem;">JSON</button>
                                <button id="dev-import-csv-btn" class="btn btn-sm" style="display: block; width: 100%;">CSV</button>
                            </div>
                        </div>

                        <button id="add-dev-btn" class="btn btn-primary">+ Add Developer</button>
                    </div>
                </div>
                <div class="table-container">
                    <table id="dev-table">
                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Team</th>
                                <th>Key (3)</th>
                                <th>Specialcase</th>
                                <th>Daily Hours</th>
                                <th>Load %</th>
                                <th>Manage %</th>
                                <th>Develop %</th>
                                <th>Maintain %</th>
                                <th>Velocity</th>
                                <!-- Calculated -->
                                <th>Dev Daily</th>
                                <th>Maintain Daily</th>
                                <th>Manage Daily</th>
                                <th>Daily SP</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredDevs.map(dev => renderRow(dev)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Event Listeners
        document.getElementById('add-dev-btn').addEventListener('click', () => addNewRow(pi));

        document.getElementById('dev-team-filter').addEventListener('change', (e) => {
            render(e.target.value);
        });

        // Menus
        const toggleMenu = (id) => {
            const menu = document.getElementById(id);
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        };
        document.getElementById('export-menu-btn').addEventListener('click', () => toggleMenu('export-menu'));
        document.getElementById('import-menu-btn').addEventListener('click', () => toggleMenu('import-menu'));

        // Export
        document.getElementById('dev-export-json').addEventListener('click', () => { exportDevelopers(developers); toggleMenu('export-menu'); });
        document.getElementById('dev-export-csv').addEventListener('click', () => { exportDevelopersCSV(developers); toggleMenu('export-menu'); });

        // Import
        document.getElementById('dev-import-json-btn').addEventListener('click', () => { document.getElementById('dev-import-file').click(); toggleMenu('import-menu'); });
        document.getElementById('dev-import-csv-btn').addEventListener('click', () => { document.getElementById('dev-import-csv').click(); toggleMenu('import-menu'); });

        document.getElementById('dev-import-file').addEventListener('change', (e) => importDevelopers(e, pi, container));
        document.getElementById('dev-import-csv').addEventListener('change', (e) => importDevelopersCSV(e, pi, container));

        // Delegate events for inputs
        const table = document.getElementById('dev-table');
        table.addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                handleInputChange(e.target, pi);
            }
        });

        table.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const key = e.target.dataset.key;
                if (confirm(`Delete developer ${key}?`)) {
                    dataService.deleteDeveloper(pi, key).then(() => renderDevelopers(container, pi));
                }
            }
        });
    };

    render('All');
}

function renderRow(dev) {
    // Calculations
    const dailyHours = parseFloat(dev.dailyHours) || 8;
    const load = parseFloat(dev.load) || 90;
    const manageRatio = parseFloat(dev.manageRatio) || 0;
    const developRatio = parseFloat(dev.developRatio) || 0;
    const maintainRatio = parseFloat(dev.maintainRatio) || 0;
    const velocity = parseFloat(dev.velocity) || 0;

    const devH = (dailyHours * (load / 100) * (developRatio / 100)).toFixed(2);
    const maintainH = (dailyHours * (load / 100) * (maintainRatio / 100)).toFixed(2);
    const manageH = (dailyHours * (load / 100) * (manageRatio / 100)).toFixed(2);
    const dailySP = (parseFloat(devH) / 8 * velocity).toFixed(2);

    return `
        <tr data-key="${dev.key || ''}">
            <td><button class="btn btn-secondary delete-btn" style="padding: 0.2rem 0.5rem; color: var(--danger); border-color: var(--danger);" data-key="${dev.key}">×</button></td>
            <td>
                <select name="team" class="dev-input">
                    <option value="Neon" ${dev.team === 'Neon' ? 'selected' : ''}>Neon</option>
                    <option value="Hydrogen 1" ${dev.team === 'Hydrogen 1' ? 'selected' : ''}>Hydrogen 1</option>
                    <option value="Zn2C" ${dev.team === 'Zn2C' ? 'selected' : ''}>Zn2C</option>
                    <option value="Tungsten" ${dev.team === 'Tungsten' ? 'selected' : ''}>Tungsten</option>
                </select>
            </td>
            <td><input type="text" name="key" value="${dev.key || ''}" maxlength="3" class="dev-input" style="width: 50px;"></td>
            <td><input type="checkbox" name="specialCase" ${dev.specialCase ? 'checked' : ''} class="dev-input"></td>
            <td><input type="number" name="dailyHours" value="${dev.dailyHours || 8}" class="dev-input" style="width: 60px;"></td>
            <td><input type="number" name="load" value="${dev.load || 90}" class="dev-input" style="width: 60px;"></td>
            <td><input type="number" name="manageRatio" value="${dev.manageRatio || 0}" class="dev-input" style="width: 60px;"></td>
            <td><input type="number" name="developRatio" value="${dev.developRatio || 0}" class="dev-input" style="width: 60px;"></td>
            <td><input type="number" name="maintainRatio" value="${dev.maintainRatio || 0}" class="dev-input" style="width: 60px;"></td>
            <td><input type="number" name="velocity" value="${dev.velocity || 0}" step="0.1" class="dev-input" style="width: 60px;"></td>
            
            <!-- Calculated (Read Only) -->
            <td class="calc-val">${devH}</td>
            <td class="calc-val">${maintainH}</td>
            <td class="calc-val">${manageH}</td>
            <td class="calc-val">${dailySP}</td>
        </tr>
    `;
}

function addNewRow(pi) {
    const tbody = document.querySelector('#dev-table tbody');
    const newDev = {
        team: 'Neon', key: '', specialCase: false,
        dailyHours: 8, load: 90, manageRatio: 0, developRatio: 80, maintainRatio: 20, velocity: 1
    };
    // We don't save yet, just append UI. User must fill Key to save.
    // Actually, let's save a temp one or just render.
    // For simplicity, we just append the HTML.
    const tr = document.createElement('tr');
    tr.innerHTML = renderRow(newDev).replace('<tr', '<div').replace('</tr>', '</div>'); // Hacky, better to use a proper create element or re-render
    // Re-rendering is safer
    // But we need to save the current state first if we re-render?
    // Let's just append the HTML string to innerHTML
    tbody.insertAdjacentHTML('beforeend', renderRow(newDev));
}

async function handleInputChange(input, pi) {
    const row = input.closest('tr');
    const keyInput = row.querySelector('input[name="key"]');
    const key = keyInput.value;

    if (!key || key.length !== 3) return; // Don't save if key is invalid

    const dev = {
        key: key,
        team: row.querySelector('select[name="team"]').value,
        specialCase: row.querySelector('input[name="specialCase"]').checked,
        dailyHours: row.querySelector('input[name="dailyHours"]').value,
        load: row.querySelector('input[name="load"]').value,
        manageRatio: row.querySelector('input[name="manageRatio"]').value,
        developRatio: row.querySelector('input[name="developRatio"]').value,
        maintainRatio: row.querySelector('input[name="maintainRatio"]').value,
        velocity: row.querySelector('input[name="velocity"]').value,
    };

    await dataService.saveDeveloper(pi, dev);

    // Update calculated columns locally without full re-render
    const newHtml = renderRow(dev);
    // Parse the new HTML to get the calculated values
    const temp = document.createElement('table');
    temp.innerHTML = newHtml;
    const newCells = temp.querySelectorAll('.calc-val');
    const currentCells = row.querySelectorAll('.calc-val');

    currentCells.forEach((cell, i) => {
        cell.textContent = newCells[i].textContent;
    });

    // Update the delete button key
    row.querySelector('.delete-btn').dataset.key = key;
    row.dataset.key = key;
}

function exportDevelopers(developers) {
    const dataStr = JSON.stringify(developers, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = 'developers_export.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function exportDevelopersCSV(developers) {
    // Select only relevant fields
    const fields = ['team', 'key', 'specialCase', 'dailyHours', 'load', 'manageRatio', 'developRatio', 'maintainRatio', 'velocity'];
    const csv = Papa.unparse({
        fields: fields,
        data: developers.map(d => {
            const row = {};
            fields.forEach(f => row[f] = d[f]);
            return row;
        })
    });

    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'developers_export.csv');
    linkElement.click();
}

function importDevelopers(e, pi, container) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (event) {
        try {
            const importedDevs = JSON.parse(event.target.result);
            if (!Array.isArray(importedDevs)) throw new Error("Invalid format: Expected an array");

            if (confirm(`Import ${importedDevs.length} developers? This will update/add developers to the current PI.`)) {
                for (const dev of importedDevs) {
                    // Force PI to match current context
                    dev.pi = pi;
                    await dataService.saveDeveloper(pi, dev);
                }

                alert('Import successful!');
                renderDevelopers(container, pi);
            }
        } catch (err) {
            console.error(err);
            alert('Error importing: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function importDevelopersCSV(e, pi, container) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function (results) {
            const importedDevs = results.data;
            if (confirm(`Import ${importedDevs.length} developers from CSV?`)) {
                try {
                    for (const dev of importedDevs) {
                        // Validate required fields
                        if (!dev.key || dev.key.length !== 3) continue;

                        dev.pi = pi;
                        await dataService.saveDeveloper(pi, dev);
                    }
                    alert('Import successful!');
                    renderDevelopers(container, pi);
                } catch (err) {
                    console.error(err);
                    alert('Error importing CSV: ' + err.message);
                }
            }
        }
    });
}
