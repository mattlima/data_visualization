#= require 'jquery/dist/jquery.min.js'
#= require 'webfontloader/webfontloader.js'
#= require 'individuals.js'
#= require 'mooog/dist/mooog.js'

WebFont.load
  google:
    families: [ 'Roboto+Condensed:400,400italic,700,700italic:latin' ]




least = (a,b)->
  if a < b then a else b

most = (a,b)->
  if a > b then a else b

individuals_min = individuals.reduce least
individuals_max = individuals.reduce most
range = individuals_max - individuals_min



M = new Mooog
  debug:false


class Viz
  constructor: ()->
    @mousedown = false
    $(document).ready @documentReady

  onmousedown: ()=>
    @osc1_track.param 'gain', 1
    @osc2_track.param 'gain', 1

    @lfo.adsr 'frequency',
      base: 0
      times: [0.01, 0.01, 10]
      a: 6
    @lfo_gain.adsr 'gain',
      base: 0
      times: [0.01, 0.01, 8]
      a: 1

    @mousedown = true

  onmouseup: ()=>
    @osc1_track.param 'gain', 0
    @osc2_track.param 'gain', 0
    @mousedown = false


  onmousemove: (e)=>
#     @osc1.param "frequency", e.offsetX
#     @osc2.param "frequency", e.offsetY

  documentReady: ()=>
    $(document).on 'mousemove',   @onmousemove
    $(document).on 'mouseup',  @onmouseup
    $(document).on 'mousedown',  @onmousedown

    @individualC = 0
    console.log "INIT MASTER"
    @master = M.node
      node_type: 'Gain'
      gain: 0.75

    console.log "INIT OSCTRACK"

    @osc1_track = M.track 'osc1_track', M.node
      node_type: 'Oscillator'
      type: 'sawtooth'
      frequency: 600
      id: 'osc1'
    @osc1_track.param 'gain', 0
    @osc1 = M.node('osc1')



#         @_pan_stage.connect @_gain_stage
#         @_gain_stage.connect @_destination
#         @_destination = @_pan_stage



    @osc2_track = M.track 'osc2_track', M.node
      node_type: 'Oscillator'
      type: 'sawtooth'
      frequency: 600
      id: 'osc2'
    @osc2_track.param 'gain', 0
    @osc2 = M.node('osc2')

    @verb = M.node
      node_type: 'Convolver'
      buffer_source_file: 'sound/impulse-responses/st-andrews-church-ortf-shaped.wav'
    @verb.chain @master

    console.log "DELAY"
    @delay = M.node
      node_type: 'Delay'
      delayTime: 1
      feedback: 0.5
    @delay.chain @verb


    @lfo = M.node
      node_type: 'Oscillator'
      frequency: 3
    .start()
    @lfo_gain = M.node
      node_type: 'Gain'
      gain: 1
    @lfo.chain @lfo_gain
    .chain @master, "gain"

    @lfo.connect(@master.gain)




    console.log "DO SEND"
    @osc1_track.send( 'osc1_delay', @delay, 'post' ).param('gain',0.25)
    @osc1_track.send( 'osc1_verb', @delay, 'post' ).param('gain',0.55)
    @osc1_track.chain @master
    @osc1.start()
    @osc2_track.send( 'osc2_delay', @delay, 'post' ).param('gain',0.25)
    @osc2_track.send( 'osc2_verb', @delay, 'post' ).param('gain',0.55)
    @osc2_track.chain @master
    @osc2.start()
#     .connect @delay
#     .chain @verb
#     .chain @master
#     @osc2.start()
#     .connect @delay
#     .chain @verb
#     .chain @master



    setTimeout @mainInt, 20

  mainInt: ()=>
    setTimeout @mainInt, 20
    return unless @mousedown
    @individualC += 1
    @individualC = 0 if @individualC is individuals_perc.length
    factor = individuals_perc[@individualC]
    freq1 = factor * 1000 - 100
    freq2 = factor * 1000
    @osc1.param
      frequency: freq1
      at: M.context.currentTime + 0.01
      from_now:true
      ramp: 'expo'
    @osc2.param
      frequency:  freq2
      at: M.context.currentTime + 0.01
      from_now:true
      ramp: 'expo'
    $("#freq").text(Math.round( 250 + 500 * factor ))



window.V = new Viz
