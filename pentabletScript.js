const colorBackground = "rgba(255, 255, 255, 1.0)";	// a "white color
const selectedColor = "lightgreen";

var penCanvas = document.getElementById("penCanvas");
var context = penCanvas.getContext("2d");
var inStroke = false;
var posLast = { x: 0, y: 0 };
var isDrawing = false;
var useTilt = false;

let outLogs = '';

var EPenButton =
    {
        tip: 0x1,		// left mouse, touch contact, pen contact
        barrel: 0x2,		// right mouse, pen barrel button
        middle: 0x4,		// middle mouse
        eraser: 0x20		// pen eraser button
    };

/////////////////////////////////////////////////////////////////////////
// Initialize page elements
//
function initPage() {
    setCanvasProps();
}

/////////////////////////////////////////////////////////////////////////
// Init canvas properties.
// Sets canvas width to expand to browser window.
// Canvas cleared to restore background color.
//
function setCanvasProps() {
    if (penCanvas.width < window.innerWidth) {
        penCanvas.width = window.innerWidth - 20;
    }
    clearCanvas();	// ensures background saved with drawn image
}

/////////////////////////////////////////////////////////////////////////
// Sets a flag to enable/disable use of the pen tilt property.
//
function setTilt() {
    var useTiltVal = document.querySelector('input[value="useTilt"]');
    useTilt = useTiltVal.checked;
}

/////////////////////////////////////////////////////////////////////////
// Clears the drawing canvas.
//
function clearCanvas() {
    context.fillStyle = colorBackground;
    context.fillRect(0, 0, penCanvas.width, penCanvas.height);
}

/////////////////////////////////////////////////////////////////////////
// Upon a window load event, registers all events.
//
window.addEventListener('load', function () {
    // These events are handled for browsers that do not
    // handle PointerEvent.
    var events = [
        'MSPointerDown',
        'MSPointerUp',
        'MSPointerCancel',
        'MSPointerMove',
        'MSPointerOver',
        'MSPointerOut',
        'MSPointerEnter',
        'MSPointerLeave',
        'MSGotPointerCapture',
        'MSLostPointerCapture',
        'touchstart',
        'touchmove',
        'touchend',
        'touchenter',
        'touchleave',
        'touchcancel',
        'mouseover',
        'mousemove',
        'mouseout',
        'mouseenter',
        'mouseleave',
        'mousedown',
        'mouseup',
        'focus',
        'blur',
        'click',
        'webkitmouseforcewillbegin',
        'webkitmouseforcedown',
        'webkitmouseforceup',
        'webkitmouseforcechanged',
    ];

    // These events are for browsers that handle
    // HTML5 PointerEvent events.
    var pointerEvents = [
        'pointerdown',
        'pointerup',
        'pointercancel',
        'pointermove',
        'pointerover',
        'pointerout',
        'pointerenter',
        'pointerleave',
        'gotpointercapture',
        'lostpointercapture'
    ];

    /////////////////////////////////////////////////////////////////////////
    // Find point between two other points.
    //
    function midPointBetween(p1, p2) {
        return {
            x: p1.x + (p2.x - p1.x) / 2,
            y: p1.y + (p2.y - p1.y) / 2
        };
    }

    /////////////////////////////////////////////////////////////////////////
    // Handle drawing for HTML5 Pointer Events.
    //
    function pointerEventDraw(evt) {
        var outStr = "";
        var canvasRect = penCanvas.getBoundingClientRect();

        // Convert pointer event coordinates to canvas pixel coordinates.
        // Use clientX/Y so this works even if pointer events don't provide offsetX/Y
        // and account for CSS scaling: canvas.width/rect.width maps CSS pixels -> canvas pixels.
        var clientX = (typeof evt.clientX === 'number') ? evt.clientX : (evt.pageX - window.scrollX);
        var clientY = (typeof evt.clientY === 'number') ? evt.clientY : (evt.pageY - window.scrollY);

        // position in CSS pixels relative to the canvas top-left
        var cssX = clientX - canvasRect.left;
        var cssY = clientY - canvasRect.top;

        // scale to canvas internal pixel coordinates
        var pos = {
            x: (cssX * penCanvas.width) / canvasRect.width,
            y: (cssY * penCanvas.height) / canvasRect.height
        };

        // screenPos kept for reporting in CSS pixels
        var screenPos = {
            x: cssX,
            y: cssY
        };

        var pressure = evt.pressure;
        var buttons = evt.buttons;
        var tilt = { x: evt.tiltX, y: evt.tiltY };
        var rotate = evt.twist;
        var alt = { altitudeAngle: evt.altitudeAngle, azimuthAngle: evt.azimuthAngle };

        outStr = evt.pointerType + " , " + evt.type + " : "

        if (evt.pointerType) {
            switch (evt.pointerType) {
                case "touch":
                    // A touchscreen was used
                    pressure = 1.0;
                    context.strokeStyle = "red";
                    context.lineWidth = pressure;
                    break;
                case "pen":
                    // A pen was used
                    context.strokeStyle = "black";
                    if (useTilt) {
                        // Favor tilts in x direction.
                        context.lineWidth = pressure * 3 * Math.abs(tilt.x);
                    }
                    else {
                        context.lineWidth = pressure * 10;
                    }
                    break;
                case "mouse":
                    // A mouse was used
                    context.strokeStyle = "black";
                    if (buttons == EPenButton.barrel)
                    {
                        pressure = 0;
                        context.lineWidth = 0;
                    }

                    context.lineWidth = pressure;
                    break;
            }

            // If pen erase button is being used, then erase!
            if (buttons == EPenButton.eraser) {
                context.strokeStyle = colorBackground;
            }

            switch (evt.type) {
                case "pointerdown":
                    isDrawing = true;
                    posLast = pos;
                    break;

                case "pointerup":
                    isDrawing = false;
                    break;

                case "pointermove":
                    if (!isDrawing) {
                        return;
                    }

                    // If using eraser button, then erase with background color.
                    if (buttons == EPenButton.eraser) {
                        var eraserSize = 10;
                        context.fillStyle = colorBackground;
                        context.fillRect(pos.x, pos.y, eraserSize, eraserSize);
                        context.fill
                    }

                    // To maintain pressure setting per data point, need to turn
                    // each data point into a stroke.
                    // TODO - this code "works" but draws flat lines if stroke is very fast.
                    // Need a way to fill in more of a curve between each pair of points.
                    // Possibly fill in the gap with interpolated points when the distance
                    // between each pair of generated points is larger than some value.
                    // See https://codepen.io/kangax/pen/FdlHC?editors=1010 for sample code
                    // of how to determine distance between points.
                    else if (pressure > 0) {
                        context.beginPath();
                        context.lineCap = "round";
                        context.moveTo(posLast.x, posLast.y);

                        // Draws Bezier curve from context position to midPoint.
                        var midPoint = midPointBetween(posLast, pos);
                        context.quadraticCurveTo(posLast.x, posLast.y, midPoint.x, midPoint.y);

                        // This lineTo call eliminates gaps (but leaves flat lines if stroke
                        // is fast enough).
                        context.lineTo(pos.x, pos.y);
                        context.stroke();
                    }

                    posLast = pos;
                    break;

                case "pointerenter":
                    document.body.style.cursor = "crosshair";
                    break;

                case "pointerleave":
                    document.body.style.cursor = "default";
                    break;

                default:
                    collectLogs("WARNING: unhandled event: " + evt.type);
                    break;
            }

            outStr +=
                "X:" + parseFloat(screenPos.x).toFixed(3) + ", " +
                "Y:" + parseFloat(screenPos.y).toFixed(3) + ", " +
                "P:" + parseFloat(pressure).toFixed(3) + ", " +
                "Tx:" + parseFloat(tilt.x).toFixed(3) + ", " +
                "Ty:" + parseFloat(tilt.y).toFixed(3) + ", " +
                "R:" + parseFloat(rotate).toFixed(3) + ", " +
                "Alt:" + parseFloat(alt.altitudeAngle).toFixed(3) + ", " +
                "Az:" + parseFloat(alt.azimuthAngle).toFixed(3) + ", " +
                "B:" + buttons + '<br>';

            collectLogs(outStr);
        }
    }

    /////////////////////////////////////////////////////////////////////////
    // These event handlers are set up once when the page is loaded.
    // Note that there are two alternate sets of handlers depending on whether
    // PointerEvents are handled.
    for (var idx = 0; idx < pointerEvents.length; idx++) {
        penCanvas.addEventListener(pointerEvents[idx], pointerEventDraw, false);
    }
}, true);  // end window.addEventListener

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