(function() {

  // el: bg image to scroll
  var bgEl;

  // int: remember last offset so we only reposition on scroll
  var lastOffset = 0;

  // method called on page load to init all behaviour
  function load() {
    initElements();
    update();
  }

  // find all DOM elements
  function initElements() {
    bgEl = document.querySelector('.Background');
  }

  function update() {
    updateScroll();
    requestAnimationFrame(update);
  }

  function updateScroll() {
    var newOffset = window.pageYOffset || 0;
    if (newOffset !== lastOffset) {
      var offsetMultiplier = 0.4;
      var offset = Math.round(newOffset * offsetMultiplier);
      bgEl.style.transform = 'translate3d(0, ' + offset + 'px, 0)';
      lastOffset = newOffset;
    }
  }

  // init
  document.addEventListener('DOMContentLoaded', load);
})();
