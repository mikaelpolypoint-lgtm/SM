import { renderDashboard } from './pages/dashboard.js';
import { renderDevelopers } from './pages/developers.js';
import { renderAvailabilities } from './pages/availabilities.js';
import { renderDetails } from './pages/details.js';
import { renderImprovements } from './pages/improvements.js';
import { renderChanges } from './pages/changes.js';

const routes = {
    'dashboard': renderDashboard,
    'developers': renderDevelopers,
    'availabilities': renderAvailabilities,
    'details': renderDetails,
    'improvements': renderImprovements,
    'changes': renderChanges
};

const DEFAULT_PI = '26.1';
const DEFAULT_PAGE = 'dashboard';

function init() {
    window.addEventListener('hashchange', handleRoute);
    document.getElementById('pi-select').addEventListener('change', handlePiChange);

    // Initial route
    handleRoute();
}

function handleRoute() {
    const hash = window.location.hash.slice(1); // Remove #

    // Check for global pages first
    if (hash === 'improvements') {
        renderImprovements(document.getElementById('page-container'));
        document.getElementById('page-title').textContent = 'Improvements';
        updateSidebar(null, 'improvements');
        return;
    }

    let [pi, page] = hash.split('/');

    if (!pi || !page) {
        // Redirect to default
        window.location.hash = `${DEFAULT_PI}/${DEFAULT_PAGE}`;
        return;
    }

    // Validate page
    if (!routes[page]) {
        page = DEFAULT_PAGE;
    }

    // Update UI State
    updateSidebar(pi, page);

    // Render
    const container = document.getElementById('page-container');
    const title = document.getElementById('page-title');

    title.textContent = `${pi} ${capitalize(page)}`;

    // Execute Render Function
    routes[page](container, pi);
}

function handlePiChange(e) {
    const newPi = e.target.value;
    const hash = window.location.hash.slice(1);

    // If on a global page, go to default page of new PI? Or stay?
    // Usually switching PI implies going to dashboard of that PI.
    if (hash === 'improvements') {
        window.location.hash = `${newPi}/${DEFAULT_PAGE}`;
        return;
    }

    const [_, page] = hash.split('/');
    window.location.hash = `${newPi}/${page || DEFAULT_PAGE}`;
}

function updateSidebar(pi, page) {
    // Update PI Selector
    const piSelect = document.getElementById('pi-select');
    if (pi && piSelect.value !== pi) {
        piSelect.value = pi;
    }

    // Update Nav Links
    document.querySelectorAll('.nav-link').forEach(link => {
        const pageName = link.dataset.page;

        // Handle Global Links
        if (pageName === 'improvements') {
            link.classList.toggle('active', pageName === page);
            link.href = '#improvements'; // Ensure it stays global
            return;
        }

        link.classList.toggle('active', pageName === page);
        // Update href to include current PI if we have one, else default
        const currentPi = pi || piSelect.value || DEFAULT_PI;
        link.href = `#${currentPi}/${pageName}`;
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Start
init();
