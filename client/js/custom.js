// JavaScript Document
$(window).scroll(function(){
		if($(window).scrollTop() >70){
            $(".navbar-fixed-top").addClass('past-main');
        } else {
        	$(".navbar-fixed-top").removeClass('past-main');
        }
});
