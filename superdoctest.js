const express = require('express');
const { spawn } = require('child_process');
 const path = require('path');

const app = express();
const port = 3000;

function runPythonScript(scriptPath, args, callback) {
    const pythonRoot = path.resolve(__dirname,'superdoc');
    const pythonProcess = spawn('python', ['-m',scriptPath],{
        cwd:pythonRoot
    });
    let data = '';
    pythonProcess.stdout.on('data', (chunk) => {
        data += chunk.toString(); // Collect data from Python script
    });
 
    pythonProcess.stderr.on('data', (error) => {
        console.error(`stderr: ${error}`);
    });
 
    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.log(`Python script exited with code ${code}`);
            callback(`Error: Script exited with code ${code}`, null);
        } else {
            console.log('Python script executed successfully');
            callback(null, data);
        }
    });
    console.log("Started python process");
}

runPythonScript('flask_api.app',(item,data)=>{console.log(data)});