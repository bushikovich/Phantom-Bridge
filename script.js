let dirHandle = null;
let penDevice = null;
let isDrawing = false;

let outLogs = '';

function checkAPISupport(apiName) {
  const errorDiv = document.getElementById('error');
  switch (apiName) {
    case 'fileSystem':
      if (!window.showDirectoryPicker) {
        errorDiv.textContent = 'File System Access API not supported';
        errorDiv.classList.add('show');
        return false;
        }
      break;
    case 'webserial':
      if (!navigator.serial) {
        errorDiv.textContent = 'WebSerial API not supported';
        errorDiv.classList.add('show');
        return false;
        }
      break;
    case 'PEPointerEvent':
      if (!window.PointerEvent) {
        errorDiv.textContent = 'PinterEvent API not supported';
        errorDiv.classList.add('show');
        return false;
      }
    break;
  }
  return true;
}

async function foundPrevDir(currentDirHandle){
  // If there is no root directory handle to search from, we can't find a parent.
  if (!dirHandle) return null;

  // If currentDirHandle is the root, its parent is the root (or null depending on desired behavior).
  try {
    if (await dirHandle.isSameEntry(currentDirHandle)) return dirHandle;
  } catch (e) {
    // isSameEntry may not be supported; fall through to recursive search
  }

  // Recursively traverse the directory tree looking for a directory whose child is currentDirHandle
  async function recurse(parent) {
    for await (const entry of parent.values()) {
      if (entry.kind !== 'directory') continue;
      try {
        if (await entry.isSameEntry(currentDirHandle)) {
          // parent contains the target directory
          return parent;
        }
      } catch (e) {
        // ignore and continue recursion
      }
      // Recurse into child
      const res = await recurse(entry);
      if (res) return res;
    }
    return null;
  }

  return await recurse(dirHandle);

}

async function printDir(currentDirHandle){
  const fileList = document.getElementById('fileList');
  if (!fileList) return; // nothing to show on pages without a file list

  fileList.innerHTML = '';
  //back button
  const back = document.createElement('li');
  back.textContent = '.. (Back)';
  back.onclick = async () => { printDir(await foundPrevDir(currentDirHandle)); }
  fileList.appendChild(back);

  for await (const entry of currentDirHandle.values()) {
    const li = document.createElement('li');
      li.textContent = entry.name;
      li.onclick = () => 
        {if(entry.kind==='directory'){
          printDir(entry, currentDirHandle);
        }
        else
          downloadFile(entry);}
      fileList.appendChild(li);
  }
}

async function chooseUSB() {
  if (!checkAPISupport('fileSystem')) return;
  try {
    collectLogs('Starting USB connection...');
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    collectLogs('USB directory selected:', dirHandle.name);
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
    printDir(dirHandle);
    collectLogs('USB files listed successfully');
    errorDiv.textContent = 'USB connected: ' + dirHandle.name;
    errorDiv.classList.add('show');
  } catch (err) {
    collectError('USB Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    document.getElementById('error').textContent = 'USB error: ' + err.name + ' - ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

async function uploadFile(event) {
  if (!checkAPISupport('fileSystem')) return;
  const input = event.target;
  const file = input.files[0];
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = '';
  errorDiv.classList.remove('show');

  collectLogs('Starting upload... File:', file ? file.name : 'none');
  if (!file) {
  errorDiv.textContent = 'Select a file to upload';
    errorDiv.classList.add('show');
    return;
  }
  if (!dirHandle) {
  errorDiv.textContent = 'Connect a USB device first';
    errorDiv.classList.add('show');
    return;
  }

  try {
    collectLogs('Creating file handle for:', file.name);
    const fileHandle = await dirHandle.getFileHandle(file.name, { create: true });
    collectLogs('File handle created');
    const writable = await fileHandle.createWritable();
    collectLogs('Writable stream created');
    await writable.write(file);
    await writable.close();
    collectLogs('File uploaded successfully:', file.name);
    errorDiv.textContent = 'File uploaded: ' + file.name;
    errorDiv.classList.add('show');
    printDir(dirHandle);
  } catch (err) {
    collectError('Upload error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    errorDiv.textContent = 'Upload error: ' + err.name + ' - ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

async function downloadFile(entry) {
  if (!checkAPISupport('fileSystem')) return;
  if (entry.kind !== 'file') return;
  try {
    collectLogs('Starting download for:', entry.name);
    const file = await entry.getFile();
    collectLogs('File retrieved:', file.name, file.size);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = entry.name;
    a.click();
    URL.revokeObjectURL(a.href);
    collectLogs('File downloaded successfully:', entry.name);
  } catch (err) {
    collectError('Download error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    document.getElementById('error').textContent = 'Download error: ' + err.name + ' - ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

// Collect logs: accepts multiple arguments (strings or objects) and appends them to outLogs
function collectLogs(...lines) {
  try {
    // Convert each line to a string safely
    const body = lines.map(l => {
      if (typeof l === 'string') return l;
      try { return JSON.stringify(l); } catch (e) { return String(l); }
    }).join(' ');
    outLogs += body + '\n';
    // Also output to console.lof for developer visibility
    try { console.log(...lines); } catch (e) { /* ignore */ }
  } catch (err) {
    console.error('collectLogs error', err);
    const eDiv = document.getElementById('error');
    if (eDiv) {
      eDiv.textContent = 'collectLogs error: ' + err.message;
      eDiv.classList.add('show');
    }
  }
}

// Collect an error message: similar to collectLogs but tagged as ERROR and logs to console.error
function collectError(...lines) {
  try {
    const body = lines.map(l => {
      if (typeof l === 'string') return l;
      try { return JSON.stringify(l); } catch (e) { return String(l); }
    }).join(' ');
    outLogs += body + '\n';
    // Also output to console.error for developer visibility
    try { console.error(...lines); } catch (e) { /* ignore */ }
    const eDiv = document.getElementById('error');
    if (eDiv) {
      eDiv.textContent = body;
      eDiv.classList.add('show');
    }
  } catch (err) {
    console.error('collectError error', err);
  }
}

async function saveLogs(){
  const now = new Date().toISOString();
  const filename = `itopia-logs-${now.replace(/[:.]/g,'-')}.txt`;
  await saveLogsToFile(outLogs, filename);
  const eDiv = document.getElementById('error');
  if (eDiv) { 
    eDiv.textContent = 'Logs saved: ' + filename; 
    eDiv.classList.add('show'); 
  }
}

// Save logs using File System Access API when possible, otherwise fallback to download
async function saveLogsToFile(text, filename) {
  // Try File System Access API
  try {
    if (window.showSaveFilePicker) {
      const opts = {
        suggestedName: filename,
        types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt'] } }]
      };
      const handle = await window.showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return;
    }
  } catch (e) {
    console.warn('File System Access API save failed, falling back to download:', e.message);
  }

  // Fallback: create blob and trigger download
  try {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    collectError('Fallback save failed:', e);
    throw e;
  }
}

async function gotoWacom() {
  if (!checkAPISupport('PEPointerEvent')) return;
  window.location.href = "pentablet.html";
}

async function gotoUSB() {
  if (!checkAPISupport('fileSystem')) return;
  window.location.href = "usb.html";
}

async function gotoArduino() {
  if (!checkAPISupport('webserial')) return;
  window.location.href = "arduino.html";
}

// Transmit message from textbox to Arduino via serial port
let arduinoReader = null;
let arduinoTextDecoder = null;
let arduinoStreamInitialized = false;
let gPort = null;

function getSelectedBaudRate() {
  const el = document.getElementById('baudRate');
  const val = el ? parseInt(el.value, 10) : NaN;
  return Number.isFinite(val) ? val : 9600;
}

async function transmitArduinoMessage() {
  const errorDiv = document.getElementById('error');
  const messageInput = document.getElementById('arduinoMessage');
  const message = messageInput.value;
  if (!message) {
    errorDiv.textContent = 'Write message to transmit';
    errorDiv.classList.add('show');
    return;
  }
  try {
    // Ensure port is already connected by user action
    if (!gPort || !gPort.readable) {
      errorDiv.textContent = 'Please connect to the Arduino first (use Connect Arduino)';
      errorDiv.classList.add('show');
      return;
    }
    // Encode message as UTF-8 and send
    const encoder = new TextEncoder();
    const data = encoder.encode(message + "\n");
    const writer = gPort.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
    errorDiv.textContent = 'Message sent to Arduino';
    errorDiv.classList.add('show');
    collectLogs('Sent to Arduino:', message);

    // Read response from Arduino (single line)
    const arduinoReceivedDiv = document.getElementById('arduinoReceived');
    try {
      const { value, done } = await arduinoReader.read();
      if (!done && value) {
        arduinoReceivedDiv.textContent = 'Received from Arduino: ' + value;
        collectLogs('Received from Arduino: ', value);
      } else {
        arduinoReceivedDiv.textContent = 'No response received from Arduino.';
      }
    } catch (err) {
    arduinoReceivedDiv.textContent = 'Error receiving response: ' + err.message;
    }
  } catch (err) {
    collectError('Transmit Serial Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    errorDiv.textContent = 'Arduino transmit error: ' + err.name + ' - ' + err.message;
    errorDiv.classList.add('show');
  }
}

// Connect to Arduino: request port, open with selected baud rate and initialize reader
async function connectArduinoPort() {
  const status = document.getElementById('arduinoStatus');
  try {
    if (!('serial' in navigator)) {
      status.textContent = 'WebSerial API not supported';
      return;
    }
    gPort = await navigator.serial.requestPort({});
    const baud = getSelectedBaudRate();
    await gPort.open({ baudRate: baud });

    // Initialize reader
    arduinoTextDecoder = new TextDecoderStream();
    gPort.readable.pipeTo(arduinoTextDecoder.writable);
    arduinoReader = arduinoTextDecoder.readable.getReader();
    arduinoStreamInitialized = true;

    status.textContent = `Connected (baud ${baud})`;
    collectLogs('Arduino connected at', baud);
  } catch (err) {
    collectError('Connect Arduino Error:', err);
    status.textContent = 'Connection error: ' + (err.message || err.name);
  }
}

// Disconnect/close Arduino port and cleanup reader/streams
async function disconnectArduinoPort() {
  const status = document.getElementById('arduinoStatus');
  try {
    // Cancel any pending read and release reader lock
    if (arduinoReader) {
      try {
        await arduinoReader.cancel();
      } catch (e) {
        console.warn('arduinoReader.cancel() failed:', e);
      }
      try { arduinoReader.releaseLock(); } catch (e) { /* ignore */ }
      arduinoReader = null;
    }

    // Clear decoder/flags
    arduinoTextDecoder = null;
    arduinoStreamInitialized = false;

    // Close the port if open
    if (gPort) {
      try {
        await gPort.close();
      } catch (e) {
        console.warn('gPort.close() failed:', e);
      }
      gPort = null;
    }

    if (status) status.textContent = 'Disconnected';
    collectLogs('Arduino disconnected');
  } catch (err) {
    collectError('Disconnect Arduino Error:', err);
    if (status) status.textContent = 'Disconnect error: ' + (err.message || err.name);
  }
}

// Ensure we close serial connection when page is unloaded or hidden
window.addEventListener('beforeunload', () => { disconnectArduinoPort(); });
window.addEventListener('pagehide', () => { disconnectArduinoPort(); });

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  collectLogs('Itopia loaded');
  collectLogs('File System API support:', !!window.showDirectoryPicker);
  collectLogs('PointerEvent API support:', !!window.PointerEvent);
  collectLogs('WebSerial API support:', !!navigator.serial);
  if (!checkAPISupport('fileSystem') || !checkAPISupport('PEPointerEvent') || !checkAPISupport('webserial')) {
    console.warn('Some APIs not supported');
  }
});
