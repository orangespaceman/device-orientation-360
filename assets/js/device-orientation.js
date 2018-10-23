(function() {

  // assume device doesn't report orientation unless proven otherwise
  // this allows us to update styles and behaviour only if supported
  var hasDeviceOrientationInited = false;

  // els: elements to scroll:
  // for vertical scroll, some devices support `document.documentElement`
  // while others use `document.body` so to be safe we support both
  // for horizontal scroll, for consistency we use the main page wrapper el
  var scrollVerticalEl;
  var scrollVerticalElAlt;
  var scrollHorizontalEl;

  // the wrapper element surrounds all page content
  // we use this to calculate some positioning
  var wrapperEl;
  var wrapperHeight = 0;
  var wrapperWidth = 0;

  // height of the screen
  var screenHeight = 0;

  // the canvas element surrounds page content too
  // but extends beyond the visible border (to allow horizontal movement)
  // we use this to calculate some positioning too
  var canvasEl;
  var canvasWidth = 0;

  // device orientation - default to portrait
  var isLandscape = false;
  var isRotatedClockwise = false;

  // int: store previous values
  var lastTop;
  var lastLeft;

  // debounced function for listening to resize events
  var resizeDebounceFunction = debounce(handleOrientationChange, 10);

  // debug vars
  var debugAlphaEl;
  var debugBetaEl;
  var debugGammaEl;
  var debugTopEl;
  var debugLeftEl;
  var debugAlphaModifiedEl;
  var debugBetaModifiedEl;

  // method called on page load to init behaviour
  function load() {
    initElements();
    calculateCanvasDimensions();
    calculateDeviceOrientation();
    initScroll();
    initDebug();
  }

  // find all useful DOM elements
  function initElements() {
    scrollVerticalEl = document.documentElement;
    scrollVerticalElAlt = document.body;
    scrollHorizontalEl = document.querySelector('.Wrapper');
    wrapperEl = document.querySelector('.Wrapper');
    canvasEl = document.querySelector('.Wrapper-inner');
  }

  // gather canvas dimensions, to be used later in calculations
  function calculateCanvasDimensions() {
    wrapperHeight = wrapperEl.offsetHeight;
    wrapperWidth = wrapperEl.offsetWidth;
    canvasWidth = canvasEl.offsetWidth;
    screenHeight = document.documentElement.clientHeight;
  }

  // calculate whether the device is landscape or portrait
  function calculateDeviceOrientation(e) {
    isLandscape =
      document.documentElement.clientHeight < document.documentElement.clientWidth;
    isRotatedClockwise = window.orientation === -90;
  }

  // set initial scroll position
  function initScroll() {
    var top = 0;
    var left = 0;
    updateScrollPosition(top, left);
  }

  // update scroll position
  function updateScrollPosition(top, left) {
    scrollVerticalEl.scrollTop = top;
    scrollVerticalElAlt.scrollTop = top;
    scrollHorizontalEl.scrollLeft = left;
  }

  // further initialisation logic from first device orientation event
  //
  // browsers report that they support device orientation
  // even when they don't contain a giroscope,
  // so for the first device orientation event,
  // set up site to support them
  function initDeviceOrientation() {
    var body = document.querySelector('body');
    body.classList.add('has-deviceOrientation');
    hasDeviceOrientationInited = true;

    // with the addition of a new class on the body element,
    // styles may now be different for devices that support device orientation,
    // so re-evaluate dimensions
    calculateCanvasDimensions();

    window.addEventListener('resize', resizeDebounceFunction);

    // Disable scrolling by touch
    wrapperEl.ontouchmove = function (e) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // recalculate values based on major device rotation
  // (e.g. landscape to portrait or vice versa)
  function handleOrientationChange() {
    // allow time for the screen layout to readjust first
    setTimeout(function() {
      calculateCanvasDimensions();
      calculateDeviceOrientation();
    }, 500);
  }

  // update scroll position based on orientation change event
  function handleOrientationEvent(event) {
    if (!hasDeviceOrientationInited) {
      initDeviceOrientation();
    }

    // calculate orientation
    // need to switch beta/gamma if device is in landscape mode
    var alpha = calculateAlpha(event);
    var beta = calculateBeta(event);

    // calculate scroll position from orientation
    var top = calculateVerticalScroll(beta, event);
    var left = calculateHorizontalScroll(alpha, beta);

    // update scroll
    updateScrollPosition(top, left);

    // store last values
    lastTop = top;
    lastLeft = left;

    debug(event, top, left, alpha, beta);
  }

  // calculate alpha based on device orientation
  function calculateAlpha(event) {
    var alpha = event.alpha;
    if (isLandscape) {
      if (isRotatedClockwise) {
        alpha = normaliseAlphaClockwiseRotation(alpha, event.gamma);
      } else {
        alpha = normaliseAlphaAntiClockwiseRotation(alpha, event.gamma);
      }
    }
    return alpha;
  }

  // when device is rotated 90 degrees clockwise,
  // the device above the horizon returns an alpha value 180 less than
  // it returns below the horizon, so normalise this value to identical
  function normaliseAlphaClockwiseRotation(alpha, gamma) {
    if (gamma < 0) {
      alpha = alpha + 180;
      if (alpha > 360) {
        alpha = alpha - 360;
      }
    }
    return alpha;
  }

  // when device is rotated 90 degrees anti-clockwise,
  // the device above the horizon returns an alpha value 180 greater than
  // it returns below the horizon, so normalise this value to identical
  function normaliseAlphaAntiClockwiseRotation(alpha, gamma) {
    if (gamma > 0) {
      alpha = alpha - 180;
      if (alpha < 0) {
        alpha = alpha + 360;
      }
    }
    return alpha;
  }

  // calculate beta based on device orientation
  // and fix range values accordingly
  function calculateBeta(event) {
    if (isLandscape) {
      if (isRotatedClockwise) {
        return normaliseGammaClockwiseRotation(event.gamma);
      } else {
        return normaliseGammaAntiClockwiseRotation(event.gamma);
      }
    } else {
      return normaliseBeta(event.beta);
    }
  }

  // convert beta from [-180,180] to [0,360]
  // and make it increase consistently
  // rather than jump at the half-way point
  //
  // raw beta values start in the range:
  // 0    (face up)                    [--> 1 ]
  // 90   (horizontal)                 [--> 90 ]
  // 179  (almost face down)           [--> 179 ]
  // -179 (almost face down inverted)  [--> 181 new value]
  // -90  (horizontal inverted)        [--> 270 new value]
  // -1   (almost face up inverted)    [--> 359 new value]
  function normaliseBeta(beta) {
    if (beta < 0) { beta = 360 + beta; }
    if (beta > 270) { beta = 0; }
    return beta;
  }

  // convert gamma from [-90,90] to [0,180]
  // and make it increase consistently
  // rather than jump at the half-way point
  //
  // raw gamma values start in the range:
  // below the horizon, -90 (close to horizon) down to 0 (face up)
  // above the horizon, 90 (close to horizon) down to 0 (face down)
  //
  // -1   (face up)            [--> 179 new value]
  // -89  (just below horizon) [--> 91 new value]
  // 89   (just above horizon) [--> 89 ]
  // 1    (almost face down)   [--> 1 ]
  function normaliseGammaClockwiseRotation(gamma) {
    if (gamma < 0) { gamma = 180 - Math.abs(gamma); }
    return gamma;
  }

  // convert gamma from [-90,90] to [0,180]
  // and make it increase consistently
  // rather than jump at the half-way point
  //
  // raw gamma values start in the range:
  // below the horizon, 90 (close to horizon) down to 0 (face up)
  // above the horizon, -90 (close to horizon) down to 0 (face down)
  //
  // 1   (face up)              [--> 179 new value]
  // 89  (just below horizon)   [--> 91 new value]
  // -89   (just above horizon) [--> 89 new value]
  // -1    (almost face down)   [--> 1 new value]
  function normaliseGammaAntiClockwiseRotation(gamma) {
    if (gamma > 0) { gamma = 180 - gamma; }
    if (gamma < 0) { gamma = Math.abs(gamma); }
    return gamma;
  }

  // calculate new vertical scroll position
  // beta: degree in the range [-180,180]
  // convert beta value to a value within page height range
  function calculateVerticalScroll(beta, event) {
    var currentBeta = beta;
    var minBeta = 50;
    var maxBeta = 150;

    // lock to top when moving beyond max angle
    if (currentBeta > maxBeta) {
      if (!isLandscape) {
        currentBeta = maxBeta;
      } else {
        if (
          (isRotatedClockwise && event.gamma > 0) ||
          (!isRotatedClockwise && event.gamma < 0)
        ) {
          currentBeta = minBeta;
        } else {
          currentBeta = maxBeta;
        }
      }
    }

    // lock to bottom when moving below initial angle
    if (currentBeta < minBeta) {
      if (!isLandscape) {
        currentBeta = minBeta;
      } else {

        // phone is currently above horizon, lock to top
        if (Math.abs(event.beta) > 90) {
          currentBeta = maxBeta;

        // phone is currently below horizon, lock to bottom
        } else {
          currentBeta = minBeta;
        }
      }
    }

    // generate a value for the page scroll:
    // map the current beta from somewhere between its initial and max value
    // to somewhere between the top and bottom of the page
    var top = mapRange(currentBeta, minBeta, maxBeta, wrapperHeight - screenHeight, 0);

    // if the top value has changed from last time
    if (lastTop && top !== lastTop) {

      // if the top value has increased or decreased by more than this value,
      // smooth the transition to reduce the visible jump
      // the higher the number, the less likely that any adjustment is needed
      var movementLimit = 5;

      // adjustment value to apply to smooth the transition
      // the closer to 0, the quicker the transition
      // the closer to 1, the slower the transition
      var scrollAdjustment = 0.9;

      // if we are scrolling down the page at too high a rate, adjust
      if (!isLandscape && top > lastTop && top - movementLimit > lastTop) {
        top = top - ((top - lastTop) * scrollAdjustment);

      // if we are scrolling up the page at too high a rate, adjust
      } else if (!isLandscape && top < lastTop && top + movementLimit < lastTop) {
        top = top + ((lastTop - top) * scrollAdjustment);
      }
    }

    return Math.round(top);
  }

  // calculate new horizontal scroll position - based on alpha value
  // alpha: degree in the range [0,360]
  function calculateHorizontalScroll(alpha, beta) {

    // horrible hack to reduce gimble lock jump -
    // if near the horizon, default to last alpha
    if (!isLandscape && beta > 85 && beta < 95) { return lastLeft || 0; }

    var availableWidth = canvasWidth - wrapperWidth;
    var alphaMax = 360;
    var ratio = alpha / alphaMax;
    var left = availableWidth - Math.round(availableWidth * ratio);

    // if the left value has changed from last time
    if (lastLeft && left !== lastLeft) {

      // if the left value has increased or decreased by more than this value,
      // smooth the transition to reduce the visible jump
      // the higher the number, the less likely that any adjustment is needed
      var movementLimit = 10;

      // adjustment value to apply to smooth the transition
      // the closer to 0, the quicker the transition
      // the closer to 1, the slower the transition
      var scrollAdjustment = 0.8;

      // if we are scrolling down the page at too high a rate, adjust
      if (!isLandscape && left > lastLeft && left - movementLimit > lastLeft) {
        left = left - ((left - lastLeft) * scrollAdjustment);

      // if we are scrolling up the page at too high a rate, adjust
      } else if (!isLandscape && left < lastLeft && left + movementLimit < lastLeft) {
        left = left + ((lastLeft - left) * scrollAdjustment);
      }
    }

    return Math.round(left);
  }

  // map a value from one [min-max] range to another [min-max] range
  function mapRange(value, fromMin, fromMax, toMin, toMax) {
    return (value - fromMin) * (toMax - toMin) / (fromMax - fromMin) + toMin;
  }

  function initDebug() {
    debugAlphaEl = document.querySelector('.Debug-value--alpha');
    debugBetaEl = document.querySelector('.Debug-value--beta');
    debugGammaEl = document.querySelector('.Debug-value--gamma');
    debugTopEl = document.querySelector('.Debug-value--top');
    debugLeftEl = document.querySelector('.Debug-value--left');
    debugAlphaModifiedEl = document.querySelector('.Debug-value--alphaModified');
    debugBetaModifiedEl = document.querySelector('.Debug-value--betaModified');
  }

  function debug(event, top, left, alpha, beta) {
    debugAlphaEl.textContent = Math.round(event.alpha);
    debugBetaEl.textContent = Math.round(event.beta);
    debugGammaEl.textContent = Math.round(event.gamma);
    debugTopEl.textContent = top;
    debugLeftEl.textContent = left;
    debugAlphaModifiedEl.textContent = Math.round(alpha);
    debugBetaModifiedEl.textContent = Math.round(beta);
  }

  // https://davidwalsh.name/javascript-debounce-function
  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }

  // init listeners
  document.addEventListener('DOMContentLoaded', load);
  window.addEventListener('deviceorientation', handleOrientationEvent);
  window.addEventListener('orientationchange', handleOrientationChange);

})();
