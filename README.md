# Capacity POLYPOINT

A modern capacity planning tool for Scrum teams.

## Features
- **Dashboard**: View calculated capacities (SP Load, Dev h, Maintain h) per sprint.
- **Developers**: Manage team members and their attributes.
- **Availabilities**: Manage daily availability and import from CSV.
- **Multi-PI Support**: Switch between Program Increments (e.g., 26.1, 26.2).

## How to Run

### Option 1: Local Testing (No Setup)
1. Open the `capacity_polypoint` folder.
2. Double click `index.html` to open it in your browser.
   *Note: Some features like CSV import might require a local server due to browser security policies.*

### Option 2: Local Server (Recommended)
Run the following command in your terminal inside the `capacity_polypoint` folder:
```bash
python3 -m http.server
```
Then open [http://localhost:8000](http://localhost:8000) in your browser.

## Firebase Setup (Optional)
To sync data across users, you need to set up Firebase:

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Add a Web App to get your configuration.
4. Enable **Firestore Database** in "Test Mode" (or set up rules for public access since no login is required).
5. Open `js/firebase-config.js` and replace the placeholder config with your actual Firebase config.
6. Deploy to Firebase Hosting:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   firebase deploy
   ```

## Data Import
- Go to the **Availabilities** page.
- Click **Import CSV**.
- The CSV should have headers: `Date`, `Sprint`, `PI`, and columns for each developer key (e.g., `ABC`, `XYZ`).
 
## Update
