const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile, exec } = require("child_process");
let axios;

try {
  axios = require("axios");
} catch (error) {
  console.error("⚠️ Axios module is missing! Run `npm install axios`.");
  process.exit(1);
}

let mainWindow;
let splashScreen;
let backendProcess;

// ✅ Function to Wait for Backend to Start
async function waitForBackend() {
  let retries = 20;
  while (retries > 0) {
    try {
      await axios.get("http://127.0.0.1:9090/health");
      console.log("✅ Backend is ready!");
      return;
    } catch (error) {
      console.log(`⏳ Waiting for backend... Retries left: ${retries}`);
      retries--;
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 sec
    }
  }
  console.error("❌ Backend did not start in time.");
}

// ✅ Function to Create Splash Screen
function createSplashScreen() {
  splashScreen = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false, // No title bar
    alwaysOnTop: true, // Keep it on top
    transparent: true, // Makes it stylish
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  splashScreen.loadURL(`file://${path.join(__dirname, "splash.html")}`);
}

// ✅ Function to Create Main Window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Initially hide
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  console.log("🖥️ Loading React Frontend...");
  const frontendDevURL = "http://localhost:3000";
  const frontendProdPath = `file://${path.join(__dirname, "frontend", "build", "index.html")}`;
  const frontendURL = process.env.NODE_ENV === "development" ? frontendDevURL : frontendProdPath;

  mainWindow.loadURL(frontendURL);

  mainWindow.once("ready-to-show", () => {
    splashScreen.close(); // Close splash screen
    mainWindow.show(); // Show main window
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (backendProcess) {
      console.log("🛑 Closing Backend...");
      backendProcess.kill();
    }
  });
}

// ✅ Function to Create a Desktop Shortcut
function createDesktopShortcut() {
  const shortcutPath = path.join(app.getPath("desktop"), "MyApp.lnk");
  const exePath = app.getPath("exe");

  if (!fs.existsSync(shortcutPath)) {
    console.log("🔗 Creating Desktop Shortcut...");
    shell.writeShortcutLink(shortcutPath, {
      target: exePath,
      cwd: path.dirname(exePath),
      args: "",
      description: "My Electron App",
      icon: exePath, // Uses the app icon
    });
    console.log("✅ Desktop Shortcut Created!");
  } else {
    console.log("🔗 Shortcut already exists.");
  }
}

// ✅ App Ready Event
app.whenReady().then(async () => {
  console.log("🚀 Backend starting...");

  // Show Splash Screen
  createSplashScreen();

  // Start Backend
  backendProcess = execFile(path.join(__dirname, "app.exe"), [], {
    windowsHide: true, // Hide the terminal window
    detached: true, // Runs in the background
  });

  backendProcess.unref();

  // Wait for Backend
  await waitForBackend();

  // Create Main Window
  createMainWindow();

  // Create Desktop Shortcut
  createDesktopShortcut();
});

// ✅ Handle App Close Event
app.on("window-all-closed", async () => {
  if (backendProcess) {
    console.log("🛑 Sending shutdown request to backend...");
    try {
      await axios.get("http://127.0.0.1:9090/shutdown"); // Ask backend to stop
      console.log("✅ Backend successfully shut down.");
    } catch (error) {
      console.error("❌ Failed to shutdown backend:", error);
    }

    backendProcess.kill("SIGTERM"); // Ensure backend is killed
  }

  if (process.platform !== "darwin") app.quit();
});

// ✅ Handle Process Exit
process.on("exit", () => {
  console.log("Shutting down backend...");
  exec("taskkill /F /IM app.exe"); // Windows
  // exec("pkill -f app.exe"); // macOS/Linux
});

// ✅ Handle Ctrl+C and Errors Gracefully
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.on("uncaughtException", (err) => {
  console.error("Uncaught error:", err);
  process.exit(1);
});
