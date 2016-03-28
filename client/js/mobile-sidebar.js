function MobileSideBar() {
  var that = this;
  var $window = $(window);

  var $wrapper = $("#wrapper");
  var $sidebarBackground = $("#sidebar-background");
  var $sidebarWrapper = $("#sidebar-wrapper");
  var $sidebarWrapperRight = $("#sidebar-wrapper-right");
  var $links = $sidebarWrapper.find("a");

  var $pageContentWrapper = $("#page-content-wrapper");
  var pages = $pageContentWrapper.find(">div");

  var toggledClass = "toggled";
  var leftClass = "left";
  var rightClass = "right";
  var noTransitionClass = "noTransition";
  var width = "width";
  var opacity = "opacity";
  var percent100 = "100%";
  var emptyString = "";
  var bsTransitionEnd = "bsTransitionEnd";

  function toggleSidebar(className) {
    if (className == undefined)
      className = leftClass;
    anim.restart();
    var isToggled = $wrapper.hasClass(toggledClass);
    var gotAnimation = !($sidebarBackground.css(opacity) == 0);
    if ($.support.transition && isToggled && gotAnimation)
      $sidebarBackground.css(width, percent100);
    if (isToggled)
      $wrapper.removeClass();
    else
      $wrapper.addClass(toggledClass + " " + className);
    if ($.support.transition && isToggled && gotAnimation)
      $sidebarBackground.one(bsTransitionEnd, function() {
        $sidebarBackground.css(width, emptyString);
      });
  }

  $("button.navbar-toggle").click(function(e) {
    e.preventDefault();
    if (!$(this).hasClass(leftClass))
      toggleSidebar(rightClass);
    else
      toggleSidebar();
  });

  $links.click(function() {
    if ($wrapper.hasClass(toggledClass)) toggleSidebar();
  });

  $sidebarBackground.click(function(e) {
    e.preventDefault();
    if ($wrapper.hasClass(toggledClass)) toggleSidebar();
  });

  $window.resize(function() {
    if ($wrapper.hasClass(toggledClass) && $window.width() > 768)
      toggleSidebar();
  });

  //animation
  var animateMenu = function() {
    var that = this;

    var sidemenuWidth = 200;
    var dragThreshold = 25;

    var touchstart = "touchstart";
    var touchmove = "touchmove";
    var touchend = "touchend";
    var transform = Modernizr.prefixed("transform");

    var moveListener = null;
    var endListener = null;
    var startMoveMenu = false;
    var startX = 0;

    var matrixRegExp = /([-+]?[\d\.]+)/g;

    var sidebarBackground = $sidebarBackground[0];
    var sidebarWrapper = $sidebarWrapper[0];
    var sidebarWrapperRight = $sidebarWrapperRight[0];

    function restart() {
      if (moveListener) {
        window.removeEventListener(touchmove, moveListener);
        window.removeEventListener(touchend, endListener);
      }
      moveListener = null;
      endListener = null;
      startMoveMenu = false;
      startX = 0;
      window.addEventListener(touchstart, touchStartListener);
    }

    function touchStartListener(e) {
      var winWidth = $window.width();
      if (winWidth > 768) return;
      var touches = e.touches;
      if (touches.length !== 1) return;
      var isToggled = $wrapper.hasClass(toggledClass);
      var touchX = touches[0].clientX;
      if (!isToggled) {
        if (touchX < 100) {
          startX = touchX;
          moveListener = openLeftMove;
          endListener = openLeftEnd;
        } else if (touchX > winWidth - 100) {
          startX = touchX;
          moveListener = openRightMove;
          endListener = openRightEnd;
        }
      } else if (isToggled) {
        if (touchX > 100 && $wrapper.hasClass(leftClass)) {
          startX = touchX;
          moveListener = closeLeftMove;
          endListener = closeLeftEnd;
        } else if (touchX < winWidth - 100 && $wrapper.hasClass(rightClass)) {
          startX = touchX;
          moveListener = closeRightMove;
          endListener = closeRightEnd;
        }
      }
      if (moveListener) {
        window.removeEventListener(touchstart, touchStartListener);
        window.addEventListener(touchmove, moveListener);
        window.addEventListener(touchend, endListener);
      }
    }

    function openLeftMove(e) {
      var touches = e.touches;
      if (touches.length < 1) return;
      var moveX = touches[0].clientX - startX;
      if (startMoveMenu) {
        if (moveX > sidemenuWidth)
          moveX = sidemenuWidth;
        sidebarBackground.style[opacity] = moveX / sidemenuWidth * 0.5;
        sidebarWrapper.style[transform] = "translateX(" + moveX + "px)";
      } else if (moveX >= dragThreshold) {
        startMoveMenu = true;
        $sidebarBackground.addClass(noTransitionClass).css(width, percent100);
        $sidebarWrapper.addClass(noTransitionClass);
      }
    }

    function openLeftEnd() {
      if (!startMoveMenu) {
        restart();
        return;
      }
      var runToggle = parseInt($sidebarWrapper.css(transform).match(matrixRegExp)[4], 10) >= sidemenuWidth / 2;
      $sidebarBackground.removeClass(noTransitionClass).css({
        width: emptyString,
        opacity: emptyString
      });
      $sidebarWrapper.removeClass(noTransitionClass).css(transform, emptyString);
      if (runToggle)
        toggleSidebar();
      restart();
    }

    function closeLeftMove(e) {
      var touches = e.touches;
      if (touches.length < 1) return;
      var moveX = touches[0].clientX - startX;
      if (startMoveMenu) {
        if (moveX > 0)
          moveX = 0;
        if (moveX < -sidemenuWidth)
          moveX = -sidemenuWidth;
        moveX = sidemenuWidth + moveX;
        sidebarBackground.style[opacity] = moveX / sidemenuWidth * 0.5;
        sidebarWrapper.style[transform] = "translateX(" + moveX + "px)";
      } else if (Math.abs(moveX) >= dragThreshold) {
        startMoveMenu = true;
        $sidebarBackground.addClass(noTransitionClass);
        $sidebarWrapper.addClass(noTransitionClass);
      }
    }

    function closeLeftEnd() {
      if (!startMoveMenu) {
        restart();
        return;
      }
      var runToggle = parseInt($sidebarWrapper.css(transform).match(matrixRegExp)[4], 10) <= sidemenuWidth / 2;
      $sidebarBackground.removeClass(noTransitionClass).css(opacity, emptyString);
      $sidebarWrapper.removeClass(noTransitionClass).css(transform, emptyString);
      if (runToggle)
        toggleSidebar();
      restart();
    }

    function openRightMove(e) {
      var touches = e.touches;
      if (touches.length < 1) return;
      var moveX = startX - touches[0].clientX;
      if (startMoveMenu) {
        if (moveX > sidemenuWidth)
          moveX = sidemenuWidth;
        sidebarBackground.style[opacity] = moveX / sidemenuWidth * 0.5;
        sidebarWrapperRight.style[transform] = "translateX(-" + moveX + "px)";
      } else if (moveX >= dragThreshold) {
        startMoveMenu = true;
        $sidebarBackground.addClass(noTransitionClass).css(width, percent100);
        $sidebarWrapperRight.addClass(noTransitionClass);
      }
    }

    function openRightEnd() {
      if (!startMoveMenu) {
        restart();
        return;
      }
      var runToggle = parseInt($sidebarWrapperRight.css(transform).match(matrixRegExp)[4], 10) <= -sidemenuWidth / 2;
      $sidebarBackground.removeClass(noTransitionClass).css({
        width: emptyString,
        opacity: emptyString
      });
      $sidebarWrapperRight.removeClass(noTransitionClass).css(transform, emptyString);
      if (runToggle)
        toggleSidebar(rightClass);
      restart();
    }

    function closeRightMove(e) {
      var touches = e.touches;
      if (touches.length < 1) return;
      var moveX = startX - touches[0].clientX;
      if (startMoveMenu) {
        if (moveX > 0)
          moveX = 0;
        if (moveX < -sidemenuWidth)
          moveX = -sidemenuWidth;
        moveX = sidemenuWidth + moveX;
        sidebarBackground.style[opacity] = moveX / sidemenuWidth * 0.5;
        sidebarWrapperRight.style[transform] = "translateX(-" + moveX + "px)";
      } else if (Math.abs(moveX) >= dragThreshold) {
        startMoveMenu = true;
        $sidebarBackground.addClass(noTransitionClass);
        $sidebarWrapperRight.addClass(noTransitionClass);
      }
    }

    function closeRightEnd() {
      if (!startMoveMenu) {
        restart();
        return;
      }
      var runToggle = parseInt($sidebarWrapperRight.css(transform).match(matrixRegExp)[4], 10) >= -sidemenuWidth / 2;
      $sidebarBackground.removeClass(noTransitionClass).css(opacity, emptyString);
      $sidebarWrapperRight.removeClass(noTransitionClass).css(transform, emptyString);
      if (runToggle)
        toggleSidebar(rightClass);
      restart();
    }

    restart();

    that.restart = restart;
  };
  var anim = new animateMenu();
  var $pageSpan = $("#pageSpan");

  that.changeHash = function() {
    pages.hide();
    var hash = location.hash;
    var hashArray = hash.split("@");
    if (hashArray.length > 1)
      hash = hashArray[0];
    var page = pages.filter(hash);
    if (page.length > 0)
      page.show();
    else
      pages.eq(0).show();
    var link = $links.removeClass("current").filter("[href='" + hash + "']");
    if (link.length == 0)
      $links.eq(0).addClass("current");
    else
      link.addClass("current");
    $pageSpan.text(link.text());
  };

  that.closeSidebar = function() {
    if ($wrapper.hasClass(toggledClass)) toggleSidebar();
  };
}
