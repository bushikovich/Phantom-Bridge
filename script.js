// Global variables
let dirHandle = null; // Handle for USB directory access
let penDevice = null; // Handle for pen tablet device
let isDrawing = false; // Tracks drawing state on canvas
let penLog = ''; // Pen-specific logs for tablet debugging
let generalLog = ''; // General logs for all operations
let features = {
  pressure: false,
  tilt: false,
  buttons: false,
  gestures: false
}; // Tracks supported pen tablet features

// Override console methods to capture logs in UI
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

function appendToGeneralLog(type, ...args) {
  const timestamp = new Date().toISOString();
  const message = `${timestamp} [${type.toUpperCase()}]: ${args.join(' ')}\n`;
  generalLog += message;
  const logElement = document.getElementById('generalLog');
  if (logElement) logElement.value = generalLog;
}

console.log = (...args) => {
  originalConsoleLog(...args);
  appendToGeneralLog('log', ...args);
};

console.warn = (...args) => {
  originalConsoleWarn(...args);
  appendToGeneralLog('warn', ...args);
};

console.error = (...args) => {
  originalConsoleError(...args);
  appendToGeneralLog('error', ...args);
};

// Check if a specific web API is supported
function checkAPISupport(apiName) {
  const errorDiv = document.getElementById('error');
  let supported = true;
  let message = '';
  switch (apiName) {
    case 'fileSystem':
      if (!window.showDirectoryPicker) {
        supported = false;
        message = 'File System Access API is not supported in this browser.';
      }
      break;
    case 'webhid':
      if (!navigator.hid) {
        supported = false;
        message = 'WebHID API is not supported in this browser.';
      }
      break;
    case 'webusb':
      if (!navigator.usb) {
        supported = false;
        message = 'WebUSB API is not supported in this browser.';
      }
      break;
    case 'webserial':
      if (!navigator.serial) {
        supported = false;
        message = 'WebSerial API is not supported in this browser.';
      }
      break;
  }
  if (!supported) {
    console.error(`API Support Error: ${message}`);
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
  }
  return supported;
}

// Connect to USB storage device
async function chooseUSB() {
  if (!checkAPISupport('fileSystem')) return;
  try {
    console.log('Starting USB connection...');
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    console.log('USB directory selected:', dirHandle.name);
    const fileList = document.getElementById('fileList');
    const errorDiv = document.getElementById('error');
    fileList.innerHTML = '';
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
    for await (const entry of dirHandle.values()) {
      console.log('Processing entry:', entry.name, 'Type:', entry.kind);
      if (entry.kind !== 'file') {
        console.warn('Skipping non-file entry:', entry.name);
        continue;
      }
      const li = document.createElement('li');
      li.textContent = entry.name;
      li.onclick = () => downloadFile(entry);
      fileList.appendChild(li);
    }
    console.log('USB files listed successfully');
    errorDiv.textContent = 'USB connected: ' + dirHandle.name;
    errorDiv.classList.add('show');
  } catch (err) {
    console.error('USB Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    document.getElementById('error').textContent = 'USB Error: ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

// Upload a file to the USB storage
async function uploadFile(event) {
  if (!checkAPISupport('fileSystem')) return;
  const input = event.target;
  const file = input.files[0];
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = '';
  errorDiv.classList.remove('show');

  console.log('Starting upload... File:', file ? file.name : 'none');
  if (!file) {
    console.warn('No file selected for upload');
    errorDiv.textContent = 'Choose a file to upload first';
    errorDiv.classList.add('show');
    return;
  }
  if (!dirHandle) {
    console.warn('No USB device connected');
    errorDiv.textContent = 'Please connect a USB device first';
    errorDiv.classList.add('show');
    return;
  }

  try {
    console.log('Creating file handle for:', file.name);
    const fileHandle = await dirHandle.getFileHandle(file.name, { create: true });
    console.log('File handle created');
    const writable = await fileHandle.createWritable();
    console.log('Writable stream created');
    await writable.write(file);
    await writable.close();
    console.log('File uploaded successfully:', file.name);
    errorDiv.textContent = 'File uploaded: ' + file.name;
    errorDiv.classList.add('show');
    chooseUSB();
  } catch (err) {
    console.error('Upload error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    errorDiv.textContent = 'Upload error: ' + err.message;
    errorDiv.classList.add('show');
  }
}

// Download a file from USB storage
async function downloadFile(entry) {
  if (!checkAPISupport('fileSystem')) return;
  if (entry.kind !== 'file') {
    console.warn('Skipping non-file entry during download:', entry.name);
    document.getElementById('error').textContent = `Error: ${entry.name} is not a file`;
    document.getElementById('error').classList.add('show');
    return;
  }
  try {
    console.log('Starting download for:', entry.name);
    const file = await entry.getFile();
    console.log('File retrieved:', file.name, file.size);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = entry.name;
    a.click();
    URL.revokeObjectURL(a.href);
    console.log('File downloaded successfully:', entry.name);
  } catch (err) {
    console.error('Download error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    document.getElementById('error').textContent = 'Download error: ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

// Process no pressure (pressure === 0)
function process_no_pressure(event, ctx) {
  ctx.setLineDash([5, 5]); // Dashed line for no pressure
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#333';
  ctx.globalAlpha = 0.5;
  console.log('Processing no pressure:', event.pointerType, 'X:', event.offsetX, 'Y:', event.offsetY, 'TiltX:', event.tiltX, 'TiltY:', event.tiltY);
}

// Process maximum pressure (pressure === 1)
function process_max_pressure(event, ctx) {
  ctx.setLineDash([]); // Solid line for max pressure
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#333';
  ctx.globalAlpha = 1.0;
  console.log('Processing max pressure:', event.pointerType, 'X:', event.offsetX, 'Y:', event.offsetY, 'TiltX:', event.tiltX, 'TiltY:', event.tiltY);
}

// Process intermediate pressure (0 < pressure < 1)
function process_pressure(event, ctx) {
  ctx.setLineDash([]); // Solid line for intermediate pressure
  ctx.lineWidth = Math.max(1, event.pressure * 5); // Scale line width
  ctx.strokeStyle = '#333';
  ctx.globalAlpha = Math.min(1.0, (Math.abs(event.tiltX) + Math.abs(event.tiltY)) / 90); // Transparency based on tilt
  console.log('Processing intermediate pressure:', event.pressure, 'X:', event.offsetX, 'Y:', event.offsetY, 'TiltX:', event.tiltX, 'TiltY:', event.tiltY);
}

// Connect to a pen tablet (Wacom, Huion, XP-Pen, Gaomon)
async function connectPenTablet() {
  if (!checkAPISupport('webhid')) return;
  try {
    console.log('Starting Pen Tablet connection...');
    const devices = await navigator.hid.requestDevice({
      filters: [
        // { vendorId: 0x056a }, // Wacom
        // { vendorId: 0x256c }, // Huion
        // { vendorId: 0x28bd }, // XP-Pen
        // { vendorId: 0x2daf }  // Gaomon
      ]
    });
    penDevice = devices[0];
    if (!penDevice) {
      console.error('No Pen Tablet found');
      throw new Error('Pen Tablet not found');
    }
    console.log('Pen Tablet found:', penDevice.productName, 'VendorID:', `0x${penDevice.vendorId.toString(16)}`);
    await penDevice.open();
    console.log('Pen Tablet opened successfully');
    document.getElementById('penData').textContent = `Pen Tablet: ${penDevice.productName} connected`;

    const canvas = document.getElementById('penCanvas');
    canvas.width = canvas.offsetWidth;
    canvas.height = 250;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to initialize canvas context');
      throw new Error('Failed to initialize canvas context');
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#333';

    // Pointer events for pressure and tilt
    canvas.addEventListener('pointerdown', (e) => {
     // if (e.pointerType !== 'pen') return; // Only handle pen events
      isDrawing = true;
      const logEntry = `Time: ${new Date().toISOString()}\nType: ${e.pointerType}\nEvent: pointerdown\nPressure: ${e.pressure}\nTiltX: ${e.tiltX}\nTiltY: ${e.tiltY}\nX: ${e.offsetX}\nY: ${e.offsetY}\nButtons: ${e.buttons}\n---\n`;
      penLog += logEntry;
      document.getElementById('penLog').value = penLog;
      document.getElementById('penData').textContent = `Pressure: ${e.pressure}, TiltX: ${e.tiltX}, TiltY: ${e.tiltY}, X: ${e.offsetX}, Y: ${e.offsetY}, Buttons: ${e.buttons}`;
      
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
      if (e.pressure === 0) {
        process_no_pressure(e, ctx);
      } else if (e.pressure === 1) {
        process_max_pressure(e, ctx);
      } else {
        process_pressure(e, ctx);
      }
      console.log('Pointer down:', e.pointerType, 'Pressure:', e.pressure, 'TiltX:', e.tiltX, 'TiltY:', e.tiltY, 'X:', e.offsetX, 'Y:', e.offsetY, 'Buttons:', e.buttons);
    });

    canvas.addEventListener('pointerup', (e) => {
      // if (e.pointerType !== 'pen') return;
      isDrawing = false;
      ctx.beginPath();
      const logEntry = `Time: ${new Date().toISOString()}\nType: ${e.pointerType}\nEvent: pointerup\nPressure: ${e.pressure}\nTiltX: ${e.tiltX}\nTiltY: ${e.tiltY}\nX: ${e.offsetX}\nY: ${e.offsetY}\nButtons: ${e.buttons}\n---\n`;
      penLog += logEntry;
      document.getElementById('penLog').value = penLog;
      document.getElementById('penData').textContent = `Pressure: ${e.pressure}, TiltX: ${e.tiltX}, TiltY: ${e.tiltY}, X: ${e.offsetX}, Y: ${e.offsetY}, Buttons: ${e.buttons}`;
      console.log('Pointer up:', e.pointerType, 'Pressure:', e.pressure, 'TiltX:', e.tiltX, 'TiltY:', e.tiltY, 'X:', e.offsetX, 'Y:', e.offsetY, 'Buttons:', e.buttons);
    });

    canvas.addEventListener('pointermove', (e) => {
      // if (e.pointerType !== 'pen' || !isDrawing) return;
      const logEntry = `Time: ${new Date().toISOString()}\nType: ${e.pointerType}\nEvent: pointermove\nPressure: ${e.pressure}\nTiltX: ${e.tiltX}\nTiltY: ${e.tiltY}\nX: ${e.offsetX}\nY: ${e.offsetY}\nButtons: ${e.buttons}\n---\n`;
      penLog += logEntry;
      document.getElementById('penLog').value = penLog;
      document.getElementById('penData').textContent = `Pressure: ${e.pressure}, TiltX: ${e.tiltX}, TiltY: ${e.tiltY}, X: ${e.offsetX}, Y: ${e.offsetY}, Buttons: ${e.buttons}`;
      
      if (e.pressure === 0) {
        process_no_pressure(e, ctx);
      } else if (e.pressure === 1) {
        process_max_pressure(e, ctx);
      } else {
        process_pressure(e, ctx);
      }
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
      console.log('Pointer move:', e.pointerType, 'Pressure:', e.pressure, 'TiltX:', e.tiltX, 'TiltY:', e.tiltY, 'X:', e.offsetX, 'Y:', e.offsetY, 'Buttons:', e.buttons);
      
      // Update supported features
      features.pressure = features.pressure || e.pressure > 0;
      features.tilt = features.tilt || e.tiltX !== 0 || e.tiltY !== 0;
      features.buttons = features.buttons || e.buttons !== 0;
      features.gestures = features.gestures || (e.pointerType === 'pen' && e.buttons !== -1);
      let featuresText = 'Supported Features:\n';
      for (let key in features) {
        featuresText += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${features[key] ? 'Yes' : 'No'}\n`;
      }
      document.getElementById('supportedFeatures').textContent = featuresText;
    });

    // WebHID inputreport for high-precision data
    penDevice.addEventListener('inputreport', (e) => {
      try {
        const data = e.data;
        const pressure = data.getUint16(2, true) / 65535; // Normalize to 0-1
        const tiltX = data.getInt16(6, true) || 0;
        const tiltY = data.getInt16(8, true) || 0;
        const x = data.getUint16(10, true) || 0;
        const y = data.getUint16(12, true) || 0;
        const buttons = data.getUint8(14) || 0;
        const logEntry = `Time: ${new Date().toISOString()}\nEvent: inputreport\nPressure: ${pressure.toFixed(2)}\nTiltX: ${tiltX}\nTiltY: ${tiltY}\nX: ${x}\nY: ${y}\nButtons: ${buttons}\n---\n`;
        penLog += logEntry;
        document.getElementById('penLog').value = penLog;
        document.getElementById('penData').textContent = `Pressure: ${pressure.toFixed(2)}, TiltX: ${tiltX}, TiltY: ${tiltY}, X: ${x}, Y: ${y}, Buttons: ${buttons}`;
        console.log(`Pen Tablet Data - Pressure: ${pressure.toFixed(2)}, TiltX: ${tiltX}, TiltY: ${tiltY}, X: ${x}, Y: ${y}, Buttons: ${buttons}`);

        if (isDrawing) {
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          const scaledX = (x / 65535) * canvasWidth;
          const scaledY = (y / 65535) * canvasHeight;
          if (pressure === 0) {
            process_no_pressure({ pressure, tiltX, tiltY, offsetX: scaledX, offsetY: scaledY }, ctx);
          } else if (pressure >= 1) {
            process_max_pressure({ pressure, tiltX, tiltY, offsetX: scaledX, offsetY: scaledY }, ctx);
          } else {
            process_pressure({ pressure, tiltX, tiltY, offsetX: scaledX, offsetY: scaledY }, ctx);
          }
          ctx.lineTo(scaledX, scaledY);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(scaledX, scaledY);
        }

        // Update supported features
        features.pressure = features.pressure || pressure > 0;
        features.tilt = features.tilt || tiltX !== 0 || tiltY !== 0;
        features.buttons = features.buttons || buttons !== 0;
        features.gestures = features.gestures || true; // inputreport implies gesture support
        let featuresText = 'Supported Features:\n';
        for (let key in features) {
          featuresText += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${features[key] ? 'Yes' : 'No'}\n`;
        }
        document.getElementById('supportedFeatures').textContent = featuresText;
      } catch (err) {
        console.error('Pen Tablet inputreport error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
        document.getElementById('error').textContent = 'Pen Tablet inputreport error: ' + err.message;
        document.getElementById('error').classList.add('show');
      }
    });
  } catch (err) {
    console.error('Pen Tablet Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    document.getElementById('error').textContent = 'Pen Tablet error: ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

// Copy pen tablet logs to clipboard
function copyPenLog() {
  const logText = document.getElementById('penLog');
  logText.select();
  document.execCommand('copy');
  console.log('Pen log copied to clipboard');
  document.getElementById('error').textContent = 'Pen log copied';
  document.getElementById('error').classList.add('show');
}

// Copy general logs to clipboard
function copyGeneralLog() {
  const logText = document.getElementById('generalLog');
  logText.select();
  document.execCommand('copy');
  console.log('General log copied to clipboard');
  document.getElementById('error').textContent = 'General log copied';
  document.getElementById('error').classList.add('show');
}

// Test pen tablet feature support
async function testPenSupport() {
  if (!checkAPISupport('webhid')) return;
  console.log('Starting pen tablet support test...');
  document.getElementById('supportedFeatures').textContent = 'Testing support... Move the stylus to detect features.';
  penLog = '';
  document.getElementById('penLog').value = '';
  features = { pressure: false, tilt: false, buttons: false, gestures: false };
}

// Clear the canvas
function clearCanvas() {
  const canvas = document.getElementById('penCanvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log('Canvas cleared');
    document.getElementById('error').textContent = 'Canvas cleared';
    document.getElementById('error').classList.add('show');
  } else {
    console.error('Canvas context not available');
    document.getElementById('error').textContent = 'Error: Unable to clear canvas';
    document.getElementById('error').classList.add('show');
  }
}

// Connect to a printer
async function connectPrinter() {
  if (!checkAPISupport('webusb')) return;
  try {
    console.log('Starting printer connection...');
    console.log('navigator.usb available:', !!navigator.usb);
    const device = await navigator.usb.requestDevice({ filters: [] });
    console.log('Printer device requested:', device.productName, 'VendorID:', device.vendorId);
    await device.open();
    console.log('Printer opened successfully');
    document.getElementById('error').textContent = `Printer: ${device.productName} connected`;
    document.getElementById('error').classList.add('show');
  } catch (err) {
    console.error('Printer Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    document.getElementById('error').textContent = 'Printer error: ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

// Connect to an Arduino
async function connectArduino() {
  if (!checkAPISupport('webserial')) return;
  try {
    console.log('Starting Arduino connection...');
    const port = await navigator.serial.requestPort({});
    console.log('Arduino port requested');
    await port.open({ baudRate: 9600 });
    console.log('Arduino opened successfully');
    document.getElementById('error').textContent = 'Arduino connected';
    document.getElementById('error').classList.add('show');
  } catch (err) {
    console.error('Arduino Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    document.getElementById('error').textContent = 'Arduino error: ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('PhantomBridge loaded');
  console.log('File System API support:', !!window.showDirectoryPicker);
  console.log('WebHID API support:', !!navigator.hid);
  console.log('WebUSB API support:', !!navigator.usb);
  console.log('WebSerial API support:', !!navigator.serial);
});