const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

const app = express();
const PORT_HTTP = 3000;  // HTTP Port
const PORT_HTTPS = 3443; // HTTPS Port
const STATIC_IP = '0.0.0.0'; // Listen on all interfaces

app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all origins

// Allow large request payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const isWindows = process.platform === 'win32';

// Utility to write code to a temporary file
function writeCodeToFile(code, fileName) {
    const filePath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(filePath, code);
    return filePath;
}

// Cleanup temp files
function cleanupFiles(...filePaths) {
    filePaths.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    });
}
const corsOptions = {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  };
  
app.use(cors(corsOptions));
  
app.post('/compile', (req, res) => {
    const { code, language, userInput } = req.body;
    console.log('Received request:', req.body);
    
    if (!code || !language) {
        return res.status(400).json({ error: 'Missing code or language parameter' });
    }

    let compileCmd = '';
    let runCmd = '';
    let sourceFile = '';
    let execFile = `exec_${Date.now()}`;

    switch (language.toLowerCase()) {
        case 'c':
            sourceFile = writeCodeToFile(code, `temp_${Date.now()}.c`);
            compileCmd = `gcc ${sourceFile} -o ${execFile}`;
            runCmd = isWindows ? `${execFile}.exe` : `./${execFile}`;
            break;

        case 'cpp':
        case 'c++':
            sourceFile = writeCodeToFile(code, `temp_${Date.now()}.cpp`);
            compileCmd = `g++ ${sourceFile} -o ${execFile}`;
            runCmd = isWindows ? `${execFile}.exe` : `./${execFile}`;
            break;

        case 'java': {
            const regex = /public\s+class\s+([A-Za-z_]\w*)/;
            const match = code.match(regex);
            if (!match) {
                return res.status(400).json({ error: 'Could not determine public class name from Java code.' });
            }
            const className = match[1];
            sourceFile = writeCodeToFile(code, `${className}.java`);
            compileCmd = `javac ${sourceFile}`;
            runCmd = `java -cp ${path.dirname(sourceFile)} ${className}`;
            break;
        }

        default:
            return res.status(400).json({ error: 'Unsupported language' });
    }

    exec(compileCmd, (compileErr, stdout, stderr) => {
        if (compileErr) {
            cleanupFiles(sourceFile, execFile);
            return res.json({ error: stderr });
        }

        const childProcess = spawn(runCmd, [], { shell: true });
        childProcess.stdin.write(userInput + '\n');
        childProcess.stdin.end();

        let output = '';
        let errorOutput = '';

        childProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        childProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        childProcess.on('close', (code) => {
            cleanupFiles(sourceFile, execFile);
            if (code !== 0) {
                return res.json({ error: errorOutput || `Process exited with code ${code}` });
            }
            return res.json({ output });
        });
    });
});

app.get('/', (req, res) => {
    res.send('Welcome to AndroCompile server!');
});

// Start HTTP server
http.createServer(app).listen(PORT_HTTP, STATIC_IP, () => {
    console.log(`✅ HTTP Server running at http://${STATIC_IP}:${PORT_HTTP}`);
});

// SSL Configuration
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
};

// Start HTTPS server
https.createServer(sslOptions, app).listen(PORT_HTTPS, STATIC_IP, () => {
    console.log(`✅ HTTPS Server running at https://${STATIC_IP}:${PORT_HTTPS}`);
});
