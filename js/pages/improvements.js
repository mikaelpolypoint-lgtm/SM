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
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Idea</th>
                                <th>Reporter</th>
                                <th>Details</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="improvements-body">
                            <tr><td colspan="6" class="loading-spinner">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Modal -->
        <div id="idea-modal" class="modal">
            <div class="modal-content card">
                <span class="close-modal">&times;</span>
                <h2><span id="modal-title">Submit New Idea</span></h2>
                <form id="idea-form">
                    <input type="hidden" id="idea-id">
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

                    <div class="form-group" id="status-group" style="display:none;">
                        <label for="status-input">Status</label>
                        <select id="status-input">
                            <option value="Backlog">Backlog</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Done">Done</option>
                            <option value="Dismissed">Dismissed</option>
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
                        <button type="submit" class="btn btn-primary" id="btn-submit-form">Submit</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Event Listeners
    const modal = document.getElementById('idea-modal');
    const btnAdd = document.getElementById('btn-add-idea');
    const closeSpans = document.querySelectorAll('.close-modal, .close-modal-btn');
    const form = document.getElementById('idea-form');
    const modalTitle = document.getElementById('modal-title');
    const btnSubmit = document.getElementById('btn-submit-form');
    const statusGroup = document.getElementById('status-group');

    btnAdd.onclick = () => {
        form.reset();
        document.getElementById('idea-id').value = '';
        modalTitle.textContent = "Submit New Idea";
        btnSubmit.textContent = "Submit";
        statusGroup.style.display = 'none'; // Hide status for new
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

        const id = document.getElementById('idea-id').value;
        const idea = document.getElementById('idea-input').value;
        const priority = document.getElementById('priority-input').value;
        const reporter = document.getElementById('reporter-input').value;
        const details = document.getElementById('details-input').value;
        const status = document.getElementById('status-input').value;

        const improvement = {
            idea,
            priority,
            reporter,
            details,
            // If new, default to Backlog. If edit, use selected status.
            status: id ? status : 'Backlog',
            date: id ? undefined : new Date().toISOString() // Keep original date if edit? Or update? Usually keep creation date.
        };

        if (id) {
            improvement.id = id;
            // We need to preserve the original date if possible, but we don't have it here easily unless we stored it in hidden field.
            // Let's fetch it or store it in dataset when opening modal.
            // Simpler: store date in a hidden field too.
            improvement.date = document.getElementById('idea-date').value;
        } else {
            improvement.date = new Date().toISOString();
        }

        try {
            await dataService.saveImprovement(improvement);
            closeModal();
            await loadImprovements(); // Refresh table
        } catch (err) {
            console.error("Error saving improvement:", err);
            alert("Failed to save improvement.");
        }
    };

    // Load Data
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
            const tr = document.createElement('tr');

            const dateObj = new Date(item.date);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let statusColor = 'var(--text-secondary)';
            if (item.status === 'In Progress') statusColor = 'var(--accent)';
            if (item.status === 'Done') statusColor = 'var(--success)';
            if (item.status === 'Dismissed') statusColor = 'var(--danger)';

            let priorityColor = item.priority === 'High' ? 'var(--danger)' : 'var(--success)';

            tr.innerHTML = `
                <td><span style="color: ${statusColor}; font-weight: bold;">${item.status}</span></td>
                <td><span style="color: ${priorityColor};">${item.priority}</span></td>
                <td>${escapeHtml(item.idea)}</td>
                <td>${escapeHtml(item.reporter)}</td>
                <td><small>${escapeHtml(item.details || '')}</small></td>
                <td><small>${dateStr}</small></td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-edit" data-id="${item.id}">Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add Edit Listeners
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const item = data.find(i => i.id === id);
                if (item) openEditModal(item);
            };
        });

    } catch (err) {
        console.error("Error loading improvements:", err);
        tbody.innerHTML = '<tr><td colspan="7" style="color: var(--danger); text-align:center;">Error loading data.</td></tr>';
    }
}

function openEditModal(item) {
    const modal = document.getElementById('idea-modal');
    const modalTitle = document.getElementById('modal-title');
    const btnSubmit = document.getElementById('btn-submit-form');
    const statusGroup = document.getElementById('status-group');

    document.getElementById('idea-id').value = item.id;
    // Add hidden date field if not exists, or create it dynamically
    let dateInput = document.getElementById('idea-date');
    if (!dateInput) {
        dateInput = document.createElement('input');
        dateInput.type = 'hidden';
        dateInput.id = 'idea-date';
        document.getElementById('idea-form').appendChild(dateInput);
    }
    dateInput.value = item.date;

    document.getElementById('idea-input').value = item.idea;
    document.getElementById('priority-input').value = item.priority;
    document.getElementById('reporter-input').value = item.reporter;
    document.getElementById('details-input').value = item.details || '';
    document.getElementById('status-input').value = item.status;

    modalTitle.textContent = "Edit Idea";
    btnSubmit.textContent = "Update";
    statusGroup.style.display = 'block'; // Show status for edit

    modal.style.display = "flex";
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
