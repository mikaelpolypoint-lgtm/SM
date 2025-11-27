import { renderDashboard } from './pages/dashboard.js';
import { renderDevelopers } from './pages/developers.js';
import { renderAvailabilities } from './pages/availabilities.js';
import { renderDetails } from './pages/details.js';

const routes = {
    'dashboard': renderDashboard,
    'developers': renderDevelopers,
    'availabilities': renderAvailabilities,
    'details': renderDetails
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
    const [_, page] = hash.split('/');

    window.location.hash = `${newPi}/${page || DEFAULT_PAGE}`;
}

function updateSidebar(pi, page) {
    // Update PI Selector
    const piSelect = document.getElementById('pi-select');
    if (piSelect.value !== pi) {
        piSelect.value = pi;
    }

    // Update Nav Links
    document.querySelectorAll('.nav-link').forEach(link => {
        const pageName = link.dataset.page;
        link.classList.toggle('active', pageName === page);
        // Update href to include current PI
        link.href = `#${pi}/${pageName}`;
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Start
init();
