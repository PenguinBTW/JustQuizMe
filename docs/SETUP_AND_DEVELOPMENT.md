# Setup, Development & Deployment Guide

This guide details local environment setup, testing routines, question file mounting, and production deployment options for **JustQuizMe**.

---

## 1. Prerequisites & Execution Dependencies

### Core Platform
- **Node.js**: `v18.0.0` or higher (`v20+` LTS recommended).
- **Package Manager**: `npm` (bundled with Node.js).
- **Operating System**: Windows 10/11, macOS, or Linux.

---

### Code Execution Dependencies (Computer Science)

| Language / Engine | Required Dependency | Dependency Details & Fallback Mechanism |
| :--- | :--- | :--- |
| **OCR Exam Reference Language (Pseudocode)** | **None** *(Built-in)* | Powered by a custom AST transpiler and Node's native `vm` execution sandbox (`ocr-pseudo.js`). Does **not** require Python, external compilers, or any npm packages. Fully self-contained. |
| **Little Man Computer (LMC)** | **None** *(Built-in)* | Pure JavaScript 100-mailbox Von Neumann CPU emulator (`lmc-runner.js`). Evaluates assembly opcodes, input queues, and register state with zero external tooling. |
| **C# (.NET)** | **.NET SDK** (`dotnet`) | Requires [.NET 8.0, 9.0, or 10.0 SDK](https://dotnet.microsoft.com/download) installed on your system PATH to run compiled unit test suites. Structural syntax checks and exam mark schemes evaluate automatically via AST even if `.NET` is absent. |

#### C# Sandboxing Modes & Recommended Setup

The C# execution harness automatically detects your operating environment and selects the most secure available sandbox mode:

1. **WSL2 + Bubblewrap Container Sandbox (Recommended for Windows)**:
   - Provides true OS-level Linux namespace isolation (`--unshare-all`).
   - Read-only system filesystem (`--ro-bind /usr`, `--ro-bind /lib`, `--ro-bind /bin`).
   - Network access is entirely unshared and disabled (no outbound sockets or internet access).
   - Runs non-root inside an ephemeral scratch directory in `/tmp` that is destroyed immediately upon completion.
   - **Strongly recommended** for production environments or executing student-submitted code.

2. **Host Process Sandbox (Fallback for Windows/macOS/Linux)**:
   - If WSL2 is not installed or configured, code executes locally via `dotnet run` inside `server/services/runners/csharp/`.
   - Protected by pre-compilation AST security analysis (`security.js`) blocking `System.Diagnostics.Process`, reflection abuse, socket connections, and directory traversal.
   - 5,000 ms hard process watchdog timer that kills child process trees if execution hangs.
   - Pre-injected OCR A-Level stub types (`Node`, `LinkedList`, `Board`, `Building`, `Character`, `Treasure`, `Video`) so student method snippets compile without missing type errors.

---

### 🛠️ Setting Up the Recommended WSL2 + Bubblewrap C# Sandbox

To enable the recommended high-isolation container sandbox on Windows:

#### Step 1: Install WSL2 and Ubuntu
If WSL2 is not yet installed on your Windows machine, open an Administrator PowerShell and run:
```powershell
wsl --install -d Ubuntu
```
*(Restart your computer if prompted by Windows).*

#### Step 2: Install Bubblewrap and the .NET SDK inside WSL
Open your Ubuntu terminal (run `wsl` in terminal) and install the necessary Linux tools:
```bash
# Update Ubuntu package lists
sudo apt update

# Install Bubblewrap sandboxing utility
sudo apt install -y bubblewrap

# Install .NET 8.0 SDK (or .NET 9.0)
sudo apt install -y dotnet-sdk-8.0
```

#### Step 3: Initialize the Base C# Sandbox Image
Run the following commands in your WSL shell to create the pre-compiled template:
```bash
# Create base sandbox template directory
mkdir -p ~/.csharp_sandbox_base
cd ~/.csharp_sandbox_base

# Initialize console template with pre-built artifacts
dotnet new console -n sandbox --framework net8.0
dotnet build
```

#### Step 4: Verification
JustQuizMe will automatically detect your setup! When you launch the server:
- The backend checks for `~/.csharp_sandbox_base` and `wsl bwrap --version`.
- When present, the server routes all C# test executions into the Bubblewrap container namespace automatically.
- No config file changes or manual flags are needed.

---

## 2. Quickstart Installation

1. **Clone or Download the Repository:**
   ```bash
   git clone https://github.com/your-username/justquizme.git
   cd justquizme/main
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```
   *(Note: The server uses minimal dependencies: `express` for HTTP routing.)*

3. **Launch the Gateway:**
   - **Windows:** Double-click `Start-JustQuizMe.bat` (or execute `Start-JustQuizMe.ps1` in PowerShell).
   - **Terminal (macOS/Linux/Windows):**
     ```bash
     npm start
     # or
     node server/index.js
     ```

4. **Access the Portal:**
   Open your browser to:
   - **Master Launchpad:** [http://localhost:3000/](http://localhost:3000/)
   - **Computer Science:** [http://localhost:3000/cs](http://localhost:3000/cs)
   - **Mathematics:** [http://localhost:3000/maths](http://localhost:3000/maths)
   - **Physics:** [http://localhost:3000/physics](http://localhost:3000/physics)

---

## 3. Configuration (`server/config.js`)

Server ports, filesystem paths, and time multipliers are controlled in `main/server/config.js`:

```javascript
module.exports = {
  PORT: process.env.PORT || 3000,
  ROOT_DIR,
  PUBLIC_DIR: path.join(ROOT_DIR, 'public'),
  DATA_DIR: path.join(ROOT_DIR, 'data'),

  SUBJECTS: {
    cs: {
      timeMultiplier: 1.07, // 1.07 minutes per mark (A-Level standard)
      questionsDir: path.join(ROOT_DIR, '..', 'Computer Science', 'questions'),
      dataDir: path.join(ROOT_DIR, 'data', 'cs')
    },
    maths: {
      timeMultiplier: 1.20, // 1.20 minutes per mark
      questionsDir: path.join(ROOT_DIR, '..', 'Maths', 'questions'),
      dataDir: path.join(ROOT_DIR, 'data', 'maths')
    },
    physics: {
      timeMultiplier: 1.07,
      questionsDir: path.join(ROOT_DIR, '..', 'Physics', 'Quiz system', 'questions'),
      dataDir: path.join(ROOT_DIR, 'data', 'physics')
    }
  }
};
```

---

## 4. Question Directory Layout

Questions are organized by subject and category:

```text
questions/
├── normal/            # Custom practice sets, synthetic quizzes (COMMITTED TO GIT)
│   ├── basic_algebra.json
│   └── binary_logic.json
│
└── past-paper/        # Official exam board papers (GITIGNORED for copyright compliance)
    ├── 2022_paper1.json
    └── images/        # Cropped technical diagrams (GITIGNORED)
        └── 22p1_q3.png
```

To mount personal past papers locally:
1. Place official exam JSON files into `{Subject}/questions/past-paper/`.
2. Place diagram crops into `{Subject}/questions/past-paper/images/{quizFolder}/`.
3. The server will automatically index and serve them on the next page refresh.

---

## 5. Development Workflow & Hot Reloading

Because the frontend is built using **native ES modules (`type="module"`)**, there is no compilation step:
- Editing any file in `main/public/` is immediately reflected upon refreshing your browser.
- Editing server routes or services in `main/server/` requires restarting the Node process (or running with `node --watch server/index.js`).

---

## 6. Production Deployment

### Docker Deployment
Create a simple `Dockerfile` in the root:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY main/package*.json ./
RUN npm ci --only=production
COPY main/ .
EXPOSE 3000
CMD ["node", "server/index.js"]
```

Build and run:
```bash
docker build -t justquizme .
docker run -p 3000:3000 justquizme
```
