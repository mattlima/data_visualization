//= require "mooog/dist/mooog.js"
//= require "_individuals.js"
//= require "jquery/dist/jquery.min.js"

//console.log('ind = ' + individuals);
M = new Mooog();
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

  });
  
  function startNow(){
  	// for(var i = 0; i < individuals.length; i+=1) {
	  // 	val = individuals[i],
	  // 	curTime = M.context.currentTime,
	  // 	freqVal = val-57000,
	  // 	visVal = freqVal/100,
	  // 	otherVisVal = visVal + 100;
	  // 	//range: rom 30hz up to 22000 hz
	  // 	//44252 max: 63714

	  // 	//console.log(val + ' ' + freqVal + ' ' + otherVisVal + ' ' + curTime+(i*0.25));
	  	
	  // 	//M.node('osc').param({frequency:val-59000, at:curTime+(i*0.25), ramp:'linear' });
	  // 	// M.node('osc').param({frequency:freqVal, at:curTime+(i*0.25)});

      
	  // 	// ramp makes so that the transition between frequencies is gradual instead of sudden.
	  	
	  // }

	  
	  (function(){
	  	var indCounter=0;
			function moveDot() {
			  // Your code here

			  var individual =  individuals[indCounter],
			  freqVal = individual-57000,
			  visVal = freqVal/5,
			  counterVal = visVal+20;
			  
			  

			  indCounter += 1;
	  	
	  	
			  M.node('osc').param("frequency",freqVal);
			  console.log('freq '+freqVal+ ' curtime '+M.context.currentTime);
			  $('i.tracker').css('top', visVal + 'px');
			  $('i.tracker').css('left', indCounter*10 + 'px');
			  $('i.tracker').css('border-width', visVal/5 + 'px');
			  $('i.tracker').css('border-radius', visVal/5 + 'px');
			  //$( '.container' ).append( '<i style="top:' + visVal + 'px; left:' + indCounter*10 + 'px; border-width:' +  visVal/5 + 'px;border-radius:' + visVal/5 + 'px;"></i>' );
			  //$( '.container' ).append( '<i class="counter" style="top:' + counterVal  + 'px; left:' + indCounter*10 + 'px;">'+individual+'</i>' );

			}
			console.log('int');
			setInterval(moveDot, 500);
		})()

  }

  