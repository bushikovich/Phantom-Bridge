let dirHandle = null;
let penDevice = null;
let isDrawing = false;

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
    case 'webhid':
      if (!navigator.hid) {
  errorDiv.textContent = 'WebHID API not supported';
        errorDiv.classList.add('show');
        return false;
      }
      break;
    case 'webusb':
      if (!navigator.usb) {
  errorDiv.textContent = 'WebUSB API not supported';
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
    console.log('Starting USB connection...');
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    console.log('USB directory selected:', dirHandle.name);
    const fileList = document.getElementById('fileList');
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
    printDir(dirHandle);
    console.log('USB files listed successfully');
  errorDiv.textContent = 'USB connected: ' + dirHandle.name;
    errorDiv.classList.add('show');
  } catch (err) {
    console.error('USB Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
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

  console.log('Starting upload... File:', file ? file.name : 'none');
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
  errorDiv.textContent = 'Upload error: ' + err.name + ' - ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

async function downloadFile(entry) {
  if (!checkAPISupport('fileSystem')) return;
  if (entry.kind !== 'file') return;
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
  document.getElementById('error').textContent = 'Download error: ' + err.name + ' - ' + err.message;
    document.getElementById('error').classList.add('show');
  }
}

async function connectWacom() {
  if (!checkAPISupport('webhid')) return;
  try {
    console.log('Starting Wacom connection...');
    const devices = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x056a }] });
    penDevice = devices[0];
    if (!penDevice) {
  throw new Error('Wacom not found');
    }
    console.log('Wacom device found:', penDevice.productName);
    await penDevice.open();
    console.log('Wacom opened successfully');
    document.getElementById('penData').textContent = `Wacom: ${penDevice.productName} connected`;

    const canvas = document.getElementById('penCanvas');
    canvas.width = canvas.offsetWidth;
    canvas.height = 250;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
  throw new Error('Failed to initialize canvas');
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#333';

    canvas.addEventListener('mousedown', () => { isDrawing = true; });
    canvas.addEventListener('mouseup', () => { isDrawing = false; ctx.beginPath(); });
    canvas.addEventListener('mousemove', (e) => {
      if (isDrawing) {
        ctx.lineWidth = 2;
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);
      }
    });

    penDevice.addEventListener('inputreport', (e) => {
      try {
        const data = e.data;
        const pressure = data.getUint16(2, true) || 0;
        const tiltX = data.getInt16(6, true) || 0;
        const tiltY = data.getInt16(8, true) || 0;
        const x = data.getUint16(10, true) || 0;
        const y = data.getUint16(12, true) || 0;
        document.getElementById('penData').textContent = `Pressure: ${pressure}, Tilt X: ${tiltX}, Tilt Y: ${tiltY}, X: ${x}, Y: ${y}`;
        console.log(`Wacom Data - Pressure: ${pressure}, Tilt X: ${tiltX}, Tilt Y: ${tiltY}, X: ${x}, Y: ${y}`);

        if (isDrawing) {
          ctx.lineWidth = Math.max(1, pressure / 200);
          ctx.lineTo(x / 10, y / 10);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x / 10, y / 10);
        }
      } catch (err) {
        console.error('Wacom inputreport error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
  document.getElementById('error').textContent = 'Wacom processing error: ' + err.message;
        document.getElementById('error').classList.add('show');
      }
    });
  } catch (err) {
    console.error('Wacom Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
  document.getElementById('error').textContent = 'Wacom error: ' + err.name + ' - ' + err.message;
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

// Connect to a 3D printer and send test G-code
async function connectPrinter() {
  if (!checkAPISupport('webusb')) return;
  let device = null;
  let claimedInterface = null;
  try {
    // Log connection attempt
    console.log('Starting printer connection...');
    console.log('WebUSB API availability:', !!navigator.usb);

    // Request USB device (printer)
    device = await navigator.usb.requestDevice({ filters: [] });
    console.log('Printer device requested:', device.productName);

    // Log all device properties
    console.log('Device Properties:');
    Object.getOwnPropertyNames(device).forEach(prop => {
      try {
        const value = device[prop];
        console.log(`  ${prop}:`, typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : value);
      } catch (err) {
        console.warn(`Failed to access device property ${prop}:`, err.message);
      }
    });

    // Open the device
    await device.open();
    console.log('Printer opened successfully');

    // Select configuration (usually the first one)
    if (!device.configuration) {
      await device.selectConfiguration(1);
      console.log('Configuration selected:', device.configurationValue);
    }

    // Log available interfaces
    console.log('Available Interfaces:');
    device.configuration.interfaces.forEach(iface => {
      console.log(`  Interface ${iface.interfaceNumber}:`, JSON.stringify({
        classCode: iface.alternate.interfaceClass,
        subClassCode: iface.alternate.interfaceSubclass,
        protocolCode: iface.alternate.interfaceProtocol,
        endpoints: iface.alternate.endpoints
      }, null, 2));
    });

    // Try to claim a non-protected interface (prefer CDC, class code 0x02)
    let targetInterface = null;
    let outputEndpoint = null;
    for (const iface of device.configuration.interfaces) {
      const classCode = iface.alternate.interfaceClass;
      console.log(`Attempting to claim interface ${iface.interfaceNumber} (Class: 0x${classCode.toString(16)})`);
      if (classCode !== 0x03 && classCode !== 0x08 && classCode !== 0x01 && classCode !== 0x0B && classCode !== 0x0E) {
        // Avoid protected classes (HID, Mass Storage, Audio, Smart Card, Video)
        try {
          await device.claimInterface(iface.interfaceNumber);
          console.log(`Interface ${iface.interfaceNumber} claimed successfully`);
          targetInterface = iface;
          claimedInterface = iface.interfaceNumber;
          // Find output endpoint (direction: 'out')
          outputEndpoint = iface.alternate.endpoints.find(ep => ep.direction === 'out');
          if (outputEndpoint) {
            console.log(`Output endpoint found: ${outputEndpoint.endpointNumber}`);
            break;
          } else {
            console.warn(`No output endpoint in interface ${iface.interfaceNumber}`);
            await device.releaseInterface(iface.interfaceNumber);
            claimedInterface = null;
          }
        } catch (err) {
          console.warn(`Failed to claim interface ${iface.interfaceNumber}:`, err.message);
        }
      } else {
        console.warn(`Interface ${iface.interfaceNumber} is protected (Class: 0x${classCode.toString(16)})`);
      }
    }

    if (!targetInterface || !outputEndpoint) {
      throw new Error('No suitable interface or output endpoint found');
    }

    // Send test G-code (G28 to home all axes)
    const testGcode = 'G28\n'; // Home all axes
    const encoder = new TextEncoder();
    const data = encoder.encode(testGcode);
    console.log('Sending test G-code:', testGcode.trim());
    await device.transferOut(outputEndpoint.endpointNumber, data);
    console.log('Test G-code sent successfully');

    // Update UI with success
    document.getElementById('error').textContent = `Printer: ${device.productName} connected, G-code sent: ${testGcode.trim()}`;
    document.getElementById('error').classList.add('show');
  } catch (err) {
    console.error('Printer Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
    console.error('WebUSB API availability:', !!navigator.usb);
  document.getElementById('error').textContent = `Printer error: ${err.name} - ${err.message}`;
    document.getElementById('error').classList.add('show');
  } finally {
    // Clean up: release interface and close device
    if (device && device.opened && claimedInterface !== null) {
      try {
        await device.releaseInterface(claimedInterface);
        console.log(`Interface ${claimedInterface} released`);
      } catch (err) {
        console.warn(`Failed to release interface ${claimedInterface}:`, err.message);
  document.getElementById('error').textContent = `Interface close error: ${err.message}`;
        document.getElementById('error').classList.add('show');
      }
    }
    if (device && device.opened) {
      try {
        await device.close();
        console.log('Printer device closed');
      } catch (err) {
        console.warn('Failed to close device:', err.message);
  document.getElementById('error').textContent = `Printer close error: ${err.message}`;
        document.getElementById('error').classList.add('show');
      }
    }
  }
}

async function gotoWacom() {
  if (!checkAPISupport('webhid')) return;
  window.location.href = "pentable.html";
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

async function transmitArduinoMessage() {
  const errorDiv = document.getElementById('error');
  const messageInput = document.getElementById('arduinoMessage');
  const message = messageInput.value;
  if (!message) {
    errorDiv.textContent = 'Введіть повідомлення для передачі';
    errorDiv.classList.add('show');
    return;
  }
  if (!('serial' in navigator)) {
    errorDiv.textContent = 'WebSerial API не підтримується';
    errorDiv.classList.add('show');
    return;
  }
  try {
    // Request serial port if not already open
    if (!window.gPort) {
      window.gPort = await navigator.serial.requestPort({});
      await window.gPort.open({ baudRate: 9600 });
    }
    // Initialize persistent reader once
    if (!arduinoStreamInitialized) {
      arduinoTextDecoder = new TextDecoderStream();
      window.gPort.readable.pipeTo(arduinoTextDecoder.writable);
      arduinoReader = arduinoTextDecoder.readable.getReader();
      arduinoStreamInitialized = true;
    }
    // Encode message as UTF-8 and send
    const encoder = new TextEncoder();
    const data = encoder.encode(message + "\n");
    const writer = window.gPort.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
    errorDiv.textContent = 'Повідомлення надіслано на Arduino';
    errorDiv.classList.add('show');
    console.log('Sent to Arduino:', message);

    // Read response from Arduino (single line)
    const arduinoReceivedDiv = document.getElementById('arduinoReceived');
    try {
      const { value, done } = await arduinoReader.read();
      if (!done && value) {
        arduinoReceivedDiv.textContent = 'Received from Arduino: ' + value;
      } else {
        arduinoReceivedDiv.textContent = 'No response received from Arduino.';
      }
    } catch (err) {
  arduinoReceivedDiv.textContent = 'Error receiving response: ' + err.message;
    }
  } catch (err) {
    console.error('Transmit Serial Error - Name:', err.name, 'Message:', err.message, 'Stack:', err.stack);
  errorDiv.textContent = 'Arduino transmit error: ' + err.name + ' - ' + err.message;
    errorDiv.classList.add('show');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('PhantomBridge loaded');
  console.log('File System API support:', !!window.showDirectoryPicker);
  console.log('WebHID API support:', !!navigator.hid);
  console.log('WebUSB API support:', !!navigator.usb);
  console.log('WebSerial API support:', !!navigator.serial);
  if (!checkAPISupport('fileSystem') || !checkAPISupport('webhid') || !checkAPISupport('webusb') || !checkAPISupport('webserial')) {
    console.warn('Some APIs not supported');
  }
});
