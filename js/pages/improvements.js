import { dataService } from '../data.js';

export async function renderImprovements(container) {
    container.innerHTML = `
        <div class="improvements-page">
            <div class="actions-bar" style="margin-bottom: 2rem;">
                <button id="btn-add-idea" class="btn btn-primary">
                    <span>+</span> Add Idea
                </button>
            </div>

            <div class="card">
                <div class="table-container">
                    <table id="improvements-table">
                        <thead>
                            <tr>
                                <th style="width: 50px;"></th> <!-- Delete -->
                                <th style="width: 140px;">Status</th>
                                <th style="width: 100px;">Priority</th>
                                <th>Idea</th>
                                <th style="width: 150px;">Reporter</th>
                                <th>Details</th>
                                <th style="width: 150px;">Date</th>
                            </tr>
                        </thead>
                        <tbody id="improvements-body">
                            <tr><td colspan="7" class="loading-spinner">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Modal for Creation Only -->
        <div id="idea-modal" class="modal">
            <div class="modal-content card">
                <span class="close-modal">&times;</span>
                <h2>Submit New Idea</h2>
                <form id="idea-form">
                    <div class="form-group">
                        <label for="idea-input">Idea <small>(max 50 chars)</small></label>
                        <input type="text" id="idea-input" maxlength="50" required placeholder="Enter your idea...">
                    </div>

                    <div class="form-group">
                        <label for="priority-input">Priority</label>
                        <select id="priority-input">
                            <option value="Low" selected>Low</option>
                            <option value="High">High</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="reporter-input">Reporter <small>(max 20 chars)</small></label>
                        <input type="text" id="reporter-input" maxlength="20" required placeholder="Your name">
                    </div>

                    <div class="form-group">
                        <label for="details-input">Details <small>(max 300 chars, optional)</small></label>
                        <textarea id="details-input" maxlength="300" rows="4" placeholder="More details..."></textarea>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary close-modal-btn">Cancel</button>
                        <button type="submit" class="btn btn-primary">Submit</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Modal Event Listeners
    const modal = document.getElementById('idea-modal');
    const btnAdd = document.getElementById('btn-add-idea');
    const closeSpans = document.querySelectorAll('.close-modal, .close-modal-btn');
    const form = document.getElementById('idea-form');

    btnAdd.onclick = () => {
        form.reset();
        modal.style.display = "flex";
        document.getElementById('idea-input').focus();
    }

    const closeModal = () => {
        modal.style.display = "none";
        form.reset();
    }

    closeSpans.forEach(span => span.onclick = closeModal);

    window.onclick = (event) => {
        if (event.target == modal) {
            closeModal();
        }
    }

    form.onsubmit = async (e) => {
        e.preventDefault();

        const idea = document.getElementById('idea-input').value;
        const priority = document.getElementById('priority-input').value;
        const reporter = document.getElementById('reporter-input').value;
        const details = document.getElementById('details-input').value;

        const newImprovement = {
            idea,
            priority,
            reporter,
            status: 'Backlog', // Default for new
            details,
            date: new Date().toISOString()
        };

        try {
            await dataService.saveImprovement(newImprovement);
            closeModal();
            await loadImprovements(); // Refresh table
        } catch (err) {
            console.error("Error saving improvement:", err);
            alert("Failed to save improvement.");
        }
    };

    // Table Event Listeners (Inline Editing)
    const table = document.getElementById('improvements-table');

    table.addEventListener('change', async (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            const row = e.target.closest('tr');
            const id = row.dataset.id;
            if (!id) return;

            const updatedItem = {
                id: id,
                status: row.querySelector('.input-status').value,
                priority: row.querySelector('.input-priority').value,
                idea: row.querySelector('.input-idea').value,
                reporter: row.querySelector('.input-reporter').value,
                details: row.querySelector('.input-details').value,
                date: row.dataset.date // Keep original date
            };

            try {
                await dataService.saveImprovement(updatedItem);

                // Visual feedback (optional, e.g. flash green)
                e.target.style.borderColor = 'var(--success)';
                setTimeout(() => {
                    e.target.style.borderColor = 'var(--border)';
                }, 1000);

            } catch (err) {
                console.error("Error saving change:", err);
                e.target.style.borderColor = 'var(--danger)';
                alert("Failed to save change");
            }
        }
    });

    table.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const row = e.target.closest('tr');
            const id = row.dataset.id;
            if (confirm("Are you sure you want to delete this idea?")) {
                try {
                    await dataService.deleteImprovement(id);
                    row.remove();
                } catch (err) {
                    console.error("Error deleting:", err);
                    alert("Failed to delete.");
                }
            }
        }
    });

    await loadImprovements();
}

async function loadImprovements() {
    const tbody = document.getElementById('improvements-body');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-spinner">Loading...</td></tr>';

    try {
        const data = await dataService.getImprovements();

        const statusOrder = { 'In Progress': 1, 'Backlog': 2, 'Done': 3, 'Dismissed': 4 };
        const priorityOrder = { 'High': 1, 'Low': 2 };

        data.sort((a, b) => {
            const sA = statusOrder[a.status] || 99;
            const sB = statusOrder[b.status] || 99;
            if (sA !== sB) return sA - sB;

            const pA = priorityOrder[a.priority] || 99;
            const pB = priorityOrder[b.priority] || 99;
            if (pA !== pB) return pA - pB;

            return new Date(b.date) - new Date(a.date);
        });

        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No improvements submitted yet.</td></tr>';
            return;
        }

        data.forEach(item => {
            tbody.appendChild(renderRow(item));
        });

    } catch (err) {
        console.error("Error loading improvements:", err);
        tbody.innerHTML = '<tr><td colspan="7" style="color: var(--danger); text-align:center;">Error loading data.</td></tr>';
    }
}

function renderRow(item) {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;
    tr.dataset.date = item.date;

    const dateObj = new Date(item.date);
    const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    tr.innerHTML = `
        <td>
            <button class="btn btn-secondary btn-sm btn-delete" style="color: var(--danger); border-color: var(--danger); padding: 0.2rem 0.5rem;">&times;</button>
        </td>
        <td>
            <select class="input-status" style="width: 100%; padding: 0.4rem; background: transparent; border: 1px solid transparent; color: inherit;">
                <option value="Backlog" ${item.status === 'Backlog' ? 'selected' : ''}>Backlog</option>
                <option value="In Progress" ${item.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Done" ${item.status === 'Done' ? 'selected' : ''}>Done</option>
                <option value="Dismissed" ${item.status === 'Dismissed' ? 'selected' : ''}>Dismissed</option>
            </select>
        </td>
        <td>
            <select class="input-priority" style="width: 100%; padding: 0.4rem; background: transparent; border: 1px solid transparent; color: inherit;">
                <option value="Low" ${item.priority === 'Low' ? 'selected' : ''}>Low</option>
                <option value="High" ${item.priority === 'High' ? 'selected' : ''}>High</option>
            </select>
        </td>
        <td>
            <input type="text" class="input-idea" value="${escapeHtml(item.idea)}" maxlength="50" style="width: 100%; padding: 0.4rem; background: transparent; border: 1px solid transparent; color: inherit;">
        </td>
        <td>
            <input type="text" class="input-reporter" value="${escapeHtml(item.reporter)}" maxlength="20" style="width: 100%; padding: 0.4rem; background: transparent; border: 1px solid transparent; color: inherit;">
        </td>
        <td>
            <input type="text" class="input-details" value="${escapeHtml(item.details || '')}" maxlength="300" style="width: 100%; padding: 0.4rem; background: transparent; border: 1px solid transparent; color: inherit;">
        </td>
        <td><small>${dateStr}</small></td>
    `;

    // Add focus styles via JS or CSS? CSS is better but inline styles here for simplicity
    const inputs = tr.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.onfocus = () => {
            input.style.background = 'rgba(0, 0, 0, 0.2)';
            input.style.borderColor = 'var(--accent)';
        };
        input.onblur = () => {
            input.style.background = 'transparent';
            input.style.borderColor = 'transparent';
        };
    });

    return tr;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
