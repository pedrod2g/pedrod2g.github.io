(function($) {
  "use strict"; // Start of use strict

  // Smooth scrolling using jQuery easing
  $('a.js-scroll-trigger[href*="#"]:not([href="#"])').click(function() {
    if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
      if (target.length) {
        $('html, body').animate({
          scrollTop: (target.offset().top)
        }, 1000, "easeInOutExpo");
        return false;
      }
    }
  });

  // Closes responsive menu when a scroll trigger link is clicked
  $('.js-scroll-trigger').click(function() {
    $('.navbar-collapse').collapse('hide');
  });

  // Activate scrollspy to add active class to navbar items on scroll
  $('body').scrollspy({
    target: '#mainNav'
  });

  // Toggle a blurred/bordered background on the fixed nav once scrolled
  var $mainNav = $('#mainNav');
  function toggleNavScrolled() {
    $mainNav.toggleClass('nav-scrolled', $(window).scrollTop() > 50);
  }
  $(window).on('scroll', toggleNavScrolled);
  toggleNavScrolled();

  // Keep the footer copyright year current without a build step
  var $footerYear = $('#footerYear');
  if ($footerYear.length) {
    $footerYear.text(new Date().getFullYear());
  }

})(jQuery); // End of use strict
