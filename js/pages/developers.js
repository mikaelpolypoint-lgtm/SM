import { dataService } from '../data.js';

export async function renderDevelopers(container, pi, queryParams = {}) {
    container.innerHTML = '<div class="loading-spinner">Loading Developers...</div>';

    await dataService.ensureDefaults(pi);

    const developers = await dataService.getDevelopers(pi);

    // Sort by Team then Name
    developers.sort((a, b) => (a.team || '').localeCompare(b.team || '') || (a.name || '').localeCompare(b.name || ''));

    // Teams for Filter
    const teams = ['All', ...new Set(developers.map(d => d.team).filter(Boolean))];

    const render = (filterTeam) => {
        // Update URL
        const params = new URLSearchParams();
        if (filterTeam !== 'All') params.set('team', filterTeam);

        const newHash = `#${pi}/developers${params.toString() ? '?' + params.toString() : ''}`;
        if (window.location.hash !== newHash) {
            history.replaceState(null, null, newHash);
        }

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

                        <button id="save-changes-btn" class="btn btn-success" style="display: none;">Save Changes</button>
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
                                <th>Work %</th>
                                <th>Cost/h</th>
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
        document.getElementById('save-changes-btn').addEventListener('click', () => saveAllChanges(pi));

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

            if (e.target.classList.contains('sprint-teams-btn')) {
                const key = e.target.dataset.key;
                const dev = developers.find(d => d.key === key);
                if (dev) openSprintTeamsModal(dev, pi, teams);
            }
        });
    };

    const initialTeam = queryParams.team || 'All';
    render(initialTeam);
}

function renderRow(dev) {
    // Calculations
    const dailyHours = parseFloat(dev.dailyHours) || 8;
    const workRatio = parseFloat(dev.workRatio) || 100;
    const internalCost = parseFloat(dev.internalCost) || 100;
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
            <td>
                <div style="display: flex; gap: 0.2rem;">
                    <button class="btn btn-secondary delete-btn" style="padding: 0.2rem 0.5rem; color: var(--danger); border-color: var(--danger);" data-key="${dev.key}">×</button>
                    <button class="btn btn-secondary sprint-teams-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" data-key="${dev.key}">Sprints</button>
                </div>
            </td>
            <td>
                <select name="team" class="dev-input">
                    <option value="Neon" ${dev.team === 'Neon' ? 'selected' : ''}>Neon</option>
                    <option value="Hydrogen 1" ${dev.team === 'Hydrogen 1' ? 'selected' : ''}>Hydrogen 1</option>
                    <option value="Zn2C" ${dev.team === 'Zn2C' ? 'selected' : ''}>Zn2C</option>
                    <option value="Tungsten" ${dev.team === 'Tungsten' ? 'selected' : ''}>Tungsten</option>
                    <option value="UI" ${dev.team === 'UI' ? 'selected' : ''}>UI</option>
                    <option value="TMGT" ${dev.team === 'TMGT' ? 'selected' : ''}>TMGT</option>
                    <option value="Admin" ${dev.team === 'Admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td><input type="text" name="key" value="${dev.key || ''}" maxlength="3" class="dev-input" style="width: 50px;"></td>
            <td><input type="checkbox" name="specialCase" ${dev.specialCase ? 'checked' : ''} class="dev-input"></td>
            <td><input type="number" name="dailyHours" value="${dev.dailyHours || 8}" class="dev-input" style="width: 60px;"></td>
            <td><input type="number" name="workRatio" value="${dev.workRatio || 100}" class="dev-input" style="width: 60px;"></td>
            <td><input type="number" name="internalCost" value="${dev.internalCost || 100}" class="dev-input" style="width: 60px;"></td>
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
        dailyHours: 8, workRatio: 100, internalCost: 100, load: 90, manageRatio: 0, developRatio: 80, maintainRatio: 20, velocity: 1
    };

    const trHtml = renderRow(newDev);
    tbody.insertAdjacentHTML('beforeend', trHtml);

    // Mark as modified
    const newRow = tbody.lastElementChild;
    newRow.classList.add('modified');
    document.getElementById('save-changes-btn').style.display = 'inline-block';
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
        workRatio: row.querySelector('input[name="workRatio"]').value,
        internalCost: row.querySelector('input[name="internalCost"]').value,
        load: row.querySelector('input[name="load"]').value,
        manageRatio: row.querySelector('input[name="manageRatio"]').value,
        developRatio: row.querySelector('input[name="developRatio"]').value,
        maintainRatio: row.querySelector('input[name="maintainRatio"]').value,
        velocity: row.querySelector('input[name="velocity"]').value,
        sprintTeams: JSON.parse(row.dataset.sprintTeams || '{}') // Preserve sprintTeams
    };

    // await dataService.saveDeveloper(pi, dev); // Removed auto-save

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
    row.querySelector('.sprint-teams-btn').dataset.key = key;
    row.dataset.key = key;
    row.dataset.sprintTeams = JSON.stringify(dev.sprintTeams || {});

    // Mark as modified
    row.classList.add('modified');
    document.getElementById('save-changes-btn').style.display = 'inline-block';
}

async function saveAllChanges(pi) {
    const modifiedRows = document.querySelectorAll('#dev-table tr.modified');
    if (modifiedRows.length === 0) return;

    const btn = document.getElementById('save-changes-btn');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const promises = [];
        modifiedRows.forEach(row => {
            const keyInput = row.querySelector('input[name="key"]');
            const key = keyInput.value;
            if (!key || key.length !== 3) return; // Skip invalid

            const dev = {
                key: key,
                team: row.querySelector('select[name="team"]').value,
                specialCase: row.querySelector('input[name="specialCase"]').checked,
                dailyHours: row.querySelector('input[name="dailyHours"]').value,
                workRatio: row.querySelector('input[name="workRatio"]').value,
                internalCost: row.querySelector('input[name="internalCost"]').value,
                load: row.querySelector('input[name="load"]').value,
                manageRatio: row.querySelector('input[name="manageRatio"]').value,
                developRatio: row.querySelector('input[name="developRatio"]').value,
                maintainRatio: row.querySelector('input[name="maintainRatio"]').value,
                velocity: row.querySelector('input[name="velocity"]').value,
                sprintTeams: JSON.parse(row.dataset.sprintTeams || '{}')
            };
            promises.push(dataService.saveDeveloper(pi, dev));
        });

        await Promise.all(promises);

        // Cleanup
        modifiedRows.forEach(row => row.classList.remove('modified'));
        btn.style.display = 'none';
        alert('Changes saved successfully!');

    } catch (err) {
        console.error("Error saving changes:", err);
        alert("Failed to save some changes.");
    } finally {
        btn.textContent = 'Save Changes';
        btn.disabled = false;
    }
}

function exportDevelopers(developers) {
    const dataStr = JSON.stringify(developers, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    const exportFileDefaultName = `developers_export_${timestamp}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function exportDevelopersCSV(developers) {
    // Select only relevant fields
    const fields = ['team', 'key', 'specialCase', 'dailyHours', 'workRatio', 'internalCost', 'load', 'manageRatio', 'developRatio', 'maintainRatio', 'velocity'];
    const csv = Papa.unparse({
        fields: fields,
        data: developers.map(d => {
            const row = {};
            fields.forEach(f => row[f] = d[f]);
            return row;
        })
    });

    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `developers_export_${timestamp}.csv`);
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
async function openSprintTeamsModal(dev, pi, teams) {
    // Fetch sprints from availabilities to ensure we have the list
    const availabilities = await dataService.getAvailabilities(pi);
    const sprints = [...new Set(availabilities.map(a => a.sprint).filter(Boolean))].sort();

    if (sprints.length === 0) {
        alert("No sprints found. Please ensure availabilities are loaded.");
        return;
    }

    // Create Modal HTML
    const modalId = 'sprint-teams-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    const sprintTeams = dev.sprintTeams || {};

    const modalHtml = `
        <div id="${modalId}" class="modal" style="display: flex;">
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3>Manage Sprint Teams for ${dev.key}</h3>
                <p class="text-secondary" style="margin-bottom: 1rem;">Assign specific teams for each sprint. Default is <strong>${dev.team}</strong>.</p>
                
                <div style="max-height: 400px; overflow-y: auto;">
                    ${sprints.map(sprint => {
        const currentTeam = sprintTeams[sprint] || dev.team;
        return `
                            <div class="form-group" style="margin-bottom: 0.5rem;">
                                <label style="display: flex; justify-content: space-between; align-items: center;">
                                    ${sprint}
                                    <select class="sprint-team-select" data-sprint="${sprint}" style="width: 60%;">
                                        ${teams.map(t => `<option value="${t}" ${t === currentTeam ? 'selected' : ''}>${t}</option>`).join('')}
                                    </select>
                                </label>
                            </div>
                        `;
    }).join('')}
                </div>

                <div class="form-actions">
                    <button class="btn btn-secondary close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" id="save-sprint-teams-btn">Save Assignments</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById(modalId);

    // Close handlers
    const close = () => modal.remove();
    modal.querySelector('.close-modal').onclick = close;
    modal.querySelector('.close-modal-btn').onclick = close;
    window.onclick = (e) => { if (e.target === modal) close(); };

    // Save handler
    document.getElementById('save-sprint-teams-btn').onclick = () => {
        const newSprintTeams = {};
        modal.querySelectorAll('.sprint-team-select').forEach(select => {
            const sprint = select.dataset.sprint;
            const team = select.value;
            // Only save if different from default team to save space/complexity? 
            // Or save explicit assignment always? Explicit is safer.
            newSprintTeams[sprint] = team;
        });

        // Update dev object in memory (and DOM data attribute)
        dev.sprintTeams = newSprintTeams;

        // Find row and update data attribute and mark modified
        const row = document.querySelector(`tr[data-key="${dev.key}"]`);
        if (row) {
            row.dataset.sprintTeams = JSON.stringify(newSprintTeams);
            row.classList.add('modified');
            document.getElementById('save-changes-btn').style.display = 'inline-block';
        }

        close();
    };
}
