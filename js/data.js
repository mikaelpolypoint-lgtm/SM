import { db } from './firebase-config.js';
import { collection, getDocs, setDoc, doc, query, where, deleteDoc, getDoc } from 'firebase/firestore';

const STORAGE_PREFIX = 'polypoint_';

export class DataService {
    constructor() {
        this.useLocalStorage = !db || db._app.options.apiKey === "YOUR_API_KEY";
        if (this.useLocalStorage) {
            console.log("Using LocalStorage for data (Firebase not configured)");
        }
    }

    // --- Developers ---

    async getDevelopers(pi) {
        if (this.useLocalStorage) {
            const data = localStorage.getItem(`${STORAGE_PREFIX}${pi}_developers`);
            return data ? JSON.parse(data) : [];
        } else {
            const q = query(collection(db, "developers"), where("pi", "==", pi));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data());
        }
    }

    async saveDeveloper(pi, developer) {
        // developer object must have a 'key' (3 letters)
        if (!developer.key) throw new Error("Developer key is required");

        developer.pi = pi;

        if (this.useLocalStorage) {
            let devs = await this.getDevelopers(pi);
            const index = devs.findIndex(d => d.key === developer.key);
            if (index >= 0) {
                devs[index] = developer;
            } else {
                devs.push(developer);
            }
            localStorage.setItem(`${STORAGE_PREFIX}${pi}_developers`, JSON.stringify(devs));
        } else {
            await setDoc(doc(db, "developers", `${pi}_${developer.key}`), developer);
        }
    }

    async deleteDeveloper(pi, key) {
        if (this.useLocalStorage) {
            let devs = await this.getDevelopers(pi);
            devs = devs.filter(d => d.key !== key);
            localStorage.setItem(`${STORAGE_PREFIX}${pi}_developers`, JSON.stringify(devs));
        } else {
            await deleteDoc(doc(db, "developers", `${pi}_${key}`));
        }
    }

    // --- Availabilities ---

    async getAvailabilities(pi) {
        if (this.useLocalStorage) {
            const data = localStorage.getItem(`${STORAGE_PREFIX}${pi}_availabilities`);
            return data ? JSON.parse(data) : [];
        } else {
            const q = query(collection(db, "availabilities"), where("pi", "==", pi));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data());
        }
    }

    async saveAvailability(pi, availabilityData) {
        // availabilityData is an array of objects (rows)
        // We'll store it as a single document or multiple? 
        // Given the "Import" nature, replacing the whole set for a PI might be easier, 
        // but editing individual cells requires granular updates.
        // Let's store each ROW (Date+Sprint) as a document.
        // ID: pi_date (e.g. 26.1_2025-12-04)

        if (this.useLocalStorage) {
            localStorage.setItem(`${STORAGE_PREFIX}${pi}_availabilities`, JSON.stringify(availabilityData));
        } else {
            // Batch write would be better, but for simplicity:
            for (const row of availabilityData) {
                const docId = `${pi}_${row.date}`; // Assuming date is unique per PI
                await setDoc(doc(db, "availabilities", docId), { ...row, pi });
            }
        }
    }

    // Helper to initialize default sprints for a PI if empty
    async initDefaultSprints(pi) {
        // Only if empty
        const current = await this.getAvailabilities(pi);
        if (current.length > 0) return;

        // Logic to generate dates based on PI rules (hardcoded for 26.1 as requested)
        if (pi === '26.1') {
            const sprints = [
                { name: '26.1-S1', start: '2025-12-04', end: '2025-12-17' },
                { name: '26.1-S2', start: '2025-12-18', end: '2026-01-14' },
                { name: '26.1-S3', start: '2026-01-15', end: '2026-01-28' },
                { name: '26.1-S4', start: '2026-01-29', end: '2026-02-18' },
                { name: '26.1-IP', start: '2026-02-19', end: '2026-03-04' }
            ];

            let rows = [];

            // Helper to iterate dates
            const getDates = (startDate, endDate) => {
                const dates = [];
                let currentDate = new Date(startDate);
                const stopDate = new Date(endDate);
                while (currentDate <= stopDate) {
                    // Skip weekends? User didn't specify, but usually capacity is working days.
                    // "Raw availabilities... 1 or 0.5 or 0".
                    // Let's include all days for now or just M-F? 
                    // Scrum usually M-F. Let's stick to M-F to be safe, or just all days.
                    // User said "Date" column.
                    // Let's just generate M-F for now to be helpful.
                    const day = currentDate.getDay();
                    if (day !== 0 && day !== 6) {
                        dates.push(new Date(currentDate));
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                return dates;
            };

            sprints.forEach(sprint => {
                const dates = getDates(sprint.start, sprint.end);
                dates.forEach(d => {
                    rows.push({
                        date: d.toISOString().split('T')[0],
                        sprint: sprint.name,
                        pi: pi
                        // Developer columns will be added dynamically
                    });
                });
            });

            await this.saveAvailability(pi, rows);
        }
    }

    async ensureDefaults(pi) {
        // Check if already initialized to prevent re-adding deleted devs
        if (this.useLocalStorage) {
            if (localStorage.getItem(`${STORAGE_PREFIX}${pi}_defaults_init`)) return;
        } else {
            try {
                const docSnap = await getDoc(doc(db, "metadata", `${pi}_defaults_init`));
                if (docSnap.exists()) return;
            } catch (e) {
                console.warn("Error checking defaults init", e);
            }
        }

        const DEFAULT_DEVELOPERS = [
            { team: 'Tungsten', key: 'JRE' }, { team: 'Tungsten', key: 'DKA' }, { team: 'Tungsten', key: 'LRU' },
            { team: 'Tungsten', key: 'RGA' }, { team: 'Tungsten', key: 'LOR' }, { team: 'Tungsten', key: 'OMO' },
            { team: 'Neon', key: 'BRO' }, { team: 'Neon', key: 'MPL' }, { team: 'Neon', key: 'LBU' },
            { team: 'Neon', key: 'RTH' }, { team: 'Neon', key: 'IWI' }, { team: 'Neon', key: 'STH' },
            { team: 'Hydrogen 1', key: 'TSC' }, { team: 'Hydrogen 1', key: 'GRO' },
            { team: 'Hydrogen 1', key: 'MBR' }, { team: 'Hydrogen 1', key: 'PSC' }, { team: 'Hydrogen 1', key: 'SFR' },
            { team: 'Hydrogen 1', key: 'DMA' }, { team: 'Hydrogen 1', key: 'VNA' }, { team: 'Hydrogen 1', key: 'RBU' },
            { team: 'Zn2C', key: 'JEI' }, { team: 'Zn2C', key: 'YHU' }, { team: 'Zn2C', key: 'PNI' },
            { team: 'Zn2C', key: 'VTS' }, { team: 'Zn2C', key: 'PSA' }, { team: 'Zn2C', key: 'MMA' },
            { team: 'Zn2C', key: 'LMA' }, { team: 'Zn2C', key: 'RSA' }, { team: 'Zn2C', key: 'NAC' }
        ];

        const currentDevs = await this.getDevelopers(pi);
        const currentMap = new Map(currentDevs.map(d => [d.key, d]));

        for (const def of DEFAULT_DEVELOPERS) {
            // If dev doesn't exist, OR if it's YHU (override request), save/update
            if (!currentMap.has(def.key) || def.key === 'YHU') {
                const newDev = {
                    ...def,
                    name: def.key, // Default name to Key
                    stack: 'Fullstack',
                    dailyHours: 8,
                    load: 90,
                    manageRatio: 0,
                    developRatio: 80,
                    maintainRatio: 20,
                    velocity: 1,
                    ...currentMap.get(def.key) // Keep existing values if any?
                };

                // If it is YHU, we specifically want to ensure the Team is correct (Zn2C) as per list
                // The user said "override the current YHU".
                if (def.key === 'YHU') {
                    newDev.team = def.team;
                    // Should we reset other values? "Override" usually means replace.
                    // But let's keep it safe and just ensure team and existence.
                }

                // If it didn't exist, we use the defaults above.
                // If it did exist (and we are here because it's YHU), we merged existing values.
                // But we want to ensure the *Team* is correct from the list.
                newDev.team = def.team;

                await this.saveDeveloper(pi, newDev);
            }
        }

        // Mark as initialized
        if (this.useLocalStorage) {
            localStorage.setItem(`${STORAGE_PREFIX}${pi}_defaults_init`, 'true');
        } else {
            try {
                await setDoc(doc(db, "metadata", `${pi}_defaults_init`), { initialized: true });
            } catch (e) {
                console.warn("Error setting defaults init", e);
            }
        }
    }
    // --- Improvements ---

    async getImprovements() {
        if (this.useLocalStorage) {
            const data = localStorage.getItem(`${STORAGE_PREFIX}improvements`);
            return data ? JSON.parse(data) : [];
        } else {
            const q = query(collection(db, "improvements"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data());
        }
    }

    async saveImprovement(improvement) {
        // improvement: { id, idea, priority, reporter, status, details, date }
        if (!improvement.idea) throw new Error("Idea is required");

        if (this.useLocalStorage) {
            let items = await this.getImprovements();

            if (improvement.id) {
                // Update
                const index = items.findIndex(i => i.id === improvement.id);
                if (index !== -1) {
                    items[index] = improvement;
                } else {
                    items.push(improvement);
                }
            } else {
                // Create
                improvement.id = `imp_${Date.now()}`;
                items.push(improvement);
            }

            localStorage.setItem(`${STORAGE_PREFIX}improvements`, JSON.stringify(items));
        } else {
            const docId = improvement.id || `imp_${Date.now()}`;
            // Ensure ID is in the object
            improvement.id = docId;
            await setDoc(doc(db, "improvements", docId), improvement);
        }
    }
}

export const dataService = new DataService();
