//= require "mooog/dist/mooog.js"
//= require "individuals.js"
//= require "jquery/dist/jquery.min.js"
//= require "imagesloaded//imagesloaded.pkgd.min.js"

//console.log('ind = ' + individuals);
var M = new Mooog();
M.node(
    { id:'lfo', node_type:'Oscillator', type:'sawtooth', frequency:3 }
  )
	//.start()
  .chain( 
    M.node( {id:'gain', node_type:'Gain', gain:40} )
  )
  .chain(
    M.node({id:'osc', node_type:'Oscillator', frequency:300}), 'frequency'
  )

  .start();


  $(document).ready(function(){

  	$('i').css('top', '100px');
  	startNow();
  	var display = false;


  	$('html').click(function(){
	  	if ( display === true ) {
	  		 //console.log('click : '  + display);
			  	M.node('osc').start();
          display = false;
          //console.log('click 2 : '  + display);
			   //return;
			} else if ( display === false ) {
				//console.log('click : '  + display);
			   
			    M.node('osc').stop();
			   display = true;
			   //return;
			}
  	});


  });
  
  function startNow(){
	  
	  (function(){

	  var indCounter=0,
	  imgCounter = 0,
	  zIndexCounter = 53;

	  var homelessImg = 53,
	  homelessImgCounter = 0;
	  	console.log(homelessImg);

      function loadImages(){
      	for (var i = homelessImg - 1; i >= 0; i--) {
      	  homelessImgCounter++;
      	  
      	  if (homelessImgCounter < 10) {
      	 		$('#screen').append( '<img class="dataImage" id="dataImagea'+homelessImgCounter+'" src="/img/couch/mc_0'+homelessImgCounter+'.jpg" />' );
      	 	} else if (homelessImgCounter >= 10 && homelessImgCounter < 38 ) {
      	 		$('#screen').append( '<img class="dataImage" id="dataImagea'+homelessImgCounter+'" src="/img/couch/mc_'+homelessImgCounter+'.jpg" />' );
      	 	}
      	 	// $('#screen').append( '<img class="dataImage" id="dataImagea'+homelessImgCounter+'" src="/img/a'+homelessImgCounter+'.jpg" />' );
      	 	//$('#screen').append( 'a');
      	 //	console.log(homelessImgCounter);
      	 	
      	};


      };

      //loadImages();  

      $('body').imagesLoaded()
		  .always( function( instance ) {
		    // console.log('all images loaded');
		  })
		  .done( function( instance ) {
		  	console.log('all images are loaded');
      	setInterval(moveDot, 125);
		  })
		  .fail( function() {
		    // console.log('all images loaded, at least one is broken');
		  })
		  .progress( function( instance, image ) {
		    var result = image.isLoaded ? 'loaded' : 'broken';
		    // console.log( 'image is ' + result + ' for ' + image.img.src );
		  });


      //log.entries.response.content.text

      // <img id='base64image' src='data:image/jpeg;base64, <!-- base64 data -->'/>
	  	


			function moveDot() {
			  // Your code here
			  //console.log('moveDot');
			  var individual =  individuals[indCounter],
			  freqVal = individual-58000,
			  visVal = freqVal, 
			  counterVal = visVal+20;

			  
			   

			  indCounter += 1;
			  zIndexCounter -=1; 
			  imgCounter += 1;
	  	  
			  M.node('osc').param("frequency",freqVal);
			  //console.log('freq '+freqVal+ ' curtime '+M.context.currentTime);
			  // $('i.tracker').css('top', visVal + 'px');
			  // $('i.tracker').css('left', indCounter + 'px');
			  // $('i.tracker').css('border-width', visVal/5 + 'px');
			  // $('i.tracker').css('border-radius', visVal/5 + 'px');
			  // $( '.container' ).append( '<i style="top:' + visVal + 'px; left:' + indCounter*10 + 'px; border-width:' +  visVal/5 + 'px;border-radius:' + visVal/5 + 'px;"></i>' );
			  // $( '.container' ).append( '<div class="counter" style="top:' + visVal  + 'px; left:' + indCounter + 'px;">'+freqVal+'</div>' );
			  

			  // if ( imgCounter <= 53 ) {
			  if ( imgCounter <= 37 ) {

			  	$('#dataImagea' + imgCounter).css('z-index', zIndexCounter + 1000 );
			  	//console.log('#dataImagea' + (imgCounter));
			  } else {
			  	imgCounter = 0;
			  }
			  
			} 
			console.log('int'); 
			 
			

		})()
 
  }

  