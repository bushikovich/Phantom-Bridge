const colorBackground = "rgba(255, 255, 255, 1.0)";	// a "tan-ish" color
const selectedColor = "lightgreen";

var penCanvas = document.getElementById("penCanvas");
var reportElem = document.getElementById("reportElement");
var context = penCanvas.getContext("2d");
var supportsPointerEvents = window.PointerEvent;
var inStroke = false;
var posLast = { x: 0, y: 0 };
var isDrawing = false;
var reportData = true;
var useTilt = false;

// var primaryColorButton = document.getElementById("colorButton31");
// var secondaryColorButton = document.getElementById("colorButton52");

//var buttonProps = new Map();

var EPenButton =
    {
        tip: 0x1,		// left mouse, touch contact, pen contact
        barrel: 0x2,		// right mouse, pen barrel button
        middle: 0x4,		// middle mouse
        eraser: 0x20		// pen eraser button
    };

/////////////////////////////////////////////////////////////////////////

var penData = document.getElementById("penData");
penData.textContent += (supportsPointerEvents ? " [Your browser supports PointerEvents]" : " [Your browser does not support PointerEvents]");

/////////////////////////////////////////////////////////////////////////
// Initialize page elements
//
function initPage() {
    setCanvasProps();
    // initButton("colorButton11", "red");
    // initButton("colorButton12", "red");
    // initButton("colorButton21", "green");
    // initButton("colorButton22", "green");
    // initButton("colorButton31", "blue");
    // initButton("colorButton32", "blue");
    // initButton("colorButton41", "white");
    // initButton("colorButton42", "white");
    // initButton("colorButton51", "black");
    // initButton("colorButton52", "black");
    // initButton("colorButton61", "gray");
    // initButton("colorButton62", "gray");
}

/////////////////////////////////////////////////////////////////////////

// function initButton(buttonId_I, backgroundColor_I) {
//     var button = document.getElementById(buttonId_I);
//     button.style.backgroundColor = backgroundColor_I;
//     buttonProps.set(buttonId_I, backgroundColor_I);
//     if (button == primaryColorButton || button == secondaryColorButton)
//     {
//         button.style.borderColor = selectedColor;
//     }
//     button.onclick = function () { 
//             //alert(button.id + " background: " + buttonProps.get(button.id));
//         switch(button.id)
//         {
//             case "colorButton11":
//             case "colorButton21":
//             case "colorButton31":
//             case "colorButton41":
//             case "colorButton51":
//             case "colorButton61":
//                 primaryColorButton.style.borderColor = "black";
//                 primaryColorButton = button;
//                 primaryColorButton.style.borderColor = selectedColor;
//                 break;
//             case "colorButton12":
//             case "colorButton22":
//             case "colorButton32":
//             case "colorButton42":
//             case "colorButton52":
//             case "colorButton62":
//                 secondaryColorButton.style.borderColor = "black";
//                 secondaryColorButton = button;
//                 secondaryColorButton.style.borderColor = selectedColor;
//                 break;
//             default:
//                 // no change of color
//                 alert(button.id + " not found!");
//         }
//     };
// }

/////////////////////////////////////////////////////////////////////////
// Init canvas properties.
// Sets canvas width to expand to browser window.
// Canvas cleared to restore background color.
//
function setCanvasProps() {
    //canvas.width = canvas.offsetWidth;
    //canvas.height = 250;
    if (penCanvas.width < window.innerWidth) {
        penCanvas.width = window.innerWidth - 20;
    }
    clearCanvas();	// ensures background saved with drawn image
}

/////////////////////////////////////////////////////////////////////////
// Sets a flag to enable/disable showing of device data
//
// function logPointer() {
//     var reportDataVal = document.querySelector('input[value="reportData"]');
//     reportData = reportDataVal.checked;		
// }

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
// Saves the image on the drawing canvas and then downloads a png.
//
// function saveCanvas() {
//     // IE and Edge
//     if (isMSBrowser()) {
//         window.navigator.msSaveBlob(penCanvas.msToBlob(), "scribble.png");
//     }
//     else {
//         var link = document.getElementById('link');
//         link.setAttribute('download', 'Scribble.png');
//         link.setAttribute('href', penCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
//         link.click();
//     }
// }

/////////////////////////////////////////////////////////////////////////
// Returns true if running on IE or Edge
//
function isMSBrowser() {
    return true;//(document.documentMode || /Edge/.test(navigator.userAgent));
}

/////////////////////////////////////////////////////////////////////////
// Clears the data report field.
//
function clearReport() {
    reportElem.innerHTML = "";
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

        if (reportData) {
            outStr = evt.pointerType + " , " + evt.type + " : "
        }

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
                        // Uncomment for a "vaseline" (smeary) effect:
                        //context.shadowColor = "blue";
                        //context.shadowBlur = context.lineWidth / 2;
                    }
                    else {
                        context.lineWidth = pressure * 10;
                    }
                    break;
                case "mouse":
                    // A mouse was used
                    //pressure = 2;
                    //context.lineWidth = pressure;
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
                    outStr += "WARNING: unhandled event: " + evt.type;
                    console.log("WARNING: unhandled event: " + evt.type);
                    break;
            }

            // Reporting data will cause drawing lag, resulting in flat lines.
            // IE11 barfs on Number.parseFloat(xxxx).toFixed(3)
            if (reportData) {
                outStr +=
                    "X:" + parseFloat(screenPos.x).toFixed(3) + ", " +
                    "Y:" + parseFloat(screenPos.y).toFixed(3) + ", " +
                    "P:" + parseFloat(pressure).toFixed(3) + ", " +
                    "Tx:" + parseFloat(tilt.x).toFixed(3) + ", " +
                    "Ty:" + parseFloat(tilt.y).toFixed(3) + ", " +
                    "R:" + parseFloat(rotate).toFixed(3) + ", " +
                    "B:" + buttons + '<br>';

                setTimeout(function () { delayedInnerHTMLFunc(outStr) }, 100);
            }
        }
    }

    /////////////////////////////////////////////////////////////////////////
    // Show the device data in output element.
    //
    delayedInnerHTMLFunc = function (str) {
        console.log(str);
        penData.textContent = str;
    }

    /////////////////////////////////////////////////////////////////////////
    // These event handlers are set up once when the page is loaded.
    // Note that there are two alternate sets of handlers depending on whether
    // PointerEvents are handled.
    //
    if (supportsPointerEvents) {
        // if Pointer Events are supported, only listen to pointer events
        for (var idx = 0; idx < pointerEvents.length; idx++) {
            penCanvas.addEventListener(pointerEvents[idx], pointerEventDraw, false);
        }
    }
    else {
        // traditional mouse/touch/pen event handlers
        for (var idx = 0; idx < events.length; idx++) {
            penCanvas.addEventListener(events[idx], eventDraw, false);
        }
    }
}, true);  // end window.addEventListener