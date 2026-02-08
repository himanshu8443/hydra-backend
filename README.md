# Hydra Game Launcher Self-Hosted Backend

A private backend server for Hydra Launcher with premium features.

## 🚀 Hosting the Backend

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Fill in your **Appwrite** credentials (Endpoint, Project ID, API Key)
   - Set `HYDRA_OFFICIAL_API=https://hydra-api-us-east-1.losbroxas.org`

3. **Database Setup**
   - Run the setup script to create database structure:
   ```bash
   node scripts/setup-appwrite.js
   ```

4. **Start Server**
   ```bash
   npm start
   ```
   Server runs on `http://localhost:3001` by default.

---

## 🛠️ Patcher Tool (Client)

To use this backend, you must patch your Hydra client using the included tool.

### How to Patch
1. Go to `tools/patcher`
2. Run `patch-hydra.bat`
3. Follow the prompts to patch your installed Hydra client.

### How to Restore
1. Go to `tools/patcher`
2. Run `restore-hydra.bat`
3. This will revert Hydra to the official server.
