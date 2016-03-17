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


class Viz
  constructor: ()->
    $(document).ready @documentReady

  documentReady: ()=>
    @individualC = 0
    @osc = M.node
      node_type: 'Oscillator'
      type: 'triangle'
      frequency: 600
    @delay = M.node
      node_type: 'Delay'
      delayTime: 1
      feedback: 0.7
    @verb = M.node
      node_type: 'Convolver'
      buffer_source_file: 'sound/impulse-responses/st-andrews-church-ortf-shaped.wav'

#     @lfo = M.node
#       node_type: 'Oscillator'
#       frequency: 3
#     .start()
#     .chain M.node
#       node_type: 'Gain'
#       gain: 0.001
#
#     @lfo.connect(@delay.delayTime)





    setTimeout @mainInt, 10
    @osc.start()
    .chain @delay
    .chain @verb

  mainInt: ()=>
    @individualC += 1
    @individualC = 0 if @individualC is individuals_perc.length
    #console.log @individualC, individuals_perc[@individualC]
    @osc.param
      frequency: 250 + 500 * individuals_perc[@individualC]
      at: M.context.currentTime + 0.01
      from_now:true
      ramp: 'expo'
    $("#freq").text(Math.round( 250 + 500 * individuals_perc[@individualC] ))
    setTimeout @mainInt, 10



window.V = new Viz
