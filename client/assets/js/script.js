// JavaScript Document
$(document).ready(function(){
	
	$('.collapse').on('shown.bs.collapse', function(){
$(this).parent().find(".icon-plus-sign").removeClass("icon-plus-sign").addClass("icon-minus-sign");
}).on('hidden.bs.collapse', function(){
$(this).parent().find(".icon-minus-sign").removeClass("icon-minus-sign").addClass("icon-plus-sign");
});

  
  

$( "#hamburger" ).click(function() {
  $( "#navtest" ).toggle("slow");
    $("html, body").animate({ scrollTop: 0 }, "slow");
});

	
	
	});
	
function blink(selector) { 
    if (!stopBlinking) {
      $(selector).delay(500).fadeIn('fast', function() {
        $(this).delay(2000).fadeOut('fast', function() {
            if (!stopBlinking)
            {
                blink(this);
            }
            else
            {
                $(this).hide();
            }
        });
      });
   }
}
$("#mark").on("click", function() {
	stopBlinking = true;
	$("#mark").hide();
});
	
