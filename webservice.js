const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

function writeCodeToFile(code, fileName) {
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, code);
    return filePath;
}

function cleanupFiles(...filePaths) {
    filePaths.forEach(filePath => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
}

app.post('/compile', (req, res) => {
    const { code, language, userInput } = req.body;
    if (!code || !language) {
        return res.status(400).json({ error: 'Missing code or language parameter' });
    }

    let compileCmd = '';
    let runCmd = '';
    let sourceFile = '';
    let execFile = '';

    switch (language.toLowerCase()) {
        case 'c':
            sourceFile = writeCodeToFile(code, `temp_${Date.now()}.c`);
            execFile = "a.out";
            compileCmd = `gcc ${sourceFile} -o ${execFile}`;
            runCmd = `./${execFile}`;
            break;
        case 'cpp':
        case 'c++':
            sourceFile = writeCodeToFile(code, `temp_${Date.now()}.cpp`);
            execFile = "a.out";
            compileCmd = `g++ ${sourceFile} -o ${execFile}`;
            runCmd = `./${execFile}`;
            break;
        case 'java': {
            const regex = /public\s+class\s+([A-Za-z_]\w*)/;
            const match = code.match(regex);
            if (!match) {
                return res.status(400).json({ error: 'Could not determine public class name from Java code.' });
            }
            const className = match[1];
            const fileName = `${className}.java`;
            sourceFile = writeCodeToFile(code, fileName);
            compileCmd = `javac ${sourceFile}`;
            runCmd = `java ${className}`;
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

        exec(`echo "${userInput}" | ${runCmd}`, (runErr, runStdout, runStderr) => {
            cleanupFiles(sourceFile, execFile);
            if (runErr) {
                return res.json({ error: runStderr });
            }
            return res.json({ output: runStdout });
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
