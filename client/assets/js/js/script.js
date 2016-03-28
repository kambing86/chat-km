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
	
	
	
	
	
	
	
	