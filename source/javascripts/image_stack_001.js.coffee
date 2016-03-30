#= require 'jquery/dist/jquery.js'
#= require 'pixi.js/bin/pixi.js'



# Coffeescript has support for classes.
# We'll keep everything in a class file so we can control variable scope more easily
# In Coffeescript, whitespace is significant (like python)
# indentation level substitutes for brackets to define code blocks.
class ImageStack
  # The constructor runs when we do new ImageStack()
  # Functions in coffee script are given in arrow notation,
  # (argument1, args...) ->
  #   my function code here
  constructor: ()->
    # the @ sign in coffeescript is a shortcut for this
    # @canvas = this.canvas
    # also, you don't need parentheses around arguments. Coffeescript assumes they are present
    # if you put two expressions in a row. You can still put them if you want,
    # and sometimes you actually need them to disambiguate expression order.
    # so this next line in javascript would be: this.canvas = document.getElementById( "screen" )
    @canvas = document.getElementById "screen"
    # PS we don't need semicolons. Coffeescript knows when to add them

    #this.pixi will hold our pixi-related stuff.
    @pixi = {}


    # you don't need 'var' for local variables. Coffeescript assumes everything's local and adds var as
    # appropriate when compiling.
    renderer_config =
      "clearBeforeRender": true
      "preserveDrawingBuffer": true
    #in the object definition above, we don't need the curly brackets, they are created by the indentation.



    #the renderer is the thing we actually put on the page so we can see what happens inside pixi.
    @STAGE_WIDTH = window.innerWidth
    @STAGE_HEIGHT = window.innerHeight
    @pixi.r = PIXI.autoDetectRenderer(@STAGE_WIDTH, @STAGE_HEIGHT, renderer_config)

    #this puts the renderer on the page
    $(@canvas).replaceWith @pixi.r.view

    #the stage is like the top-level div where everything gets attached.
    @stage = new PIXI.Container()
    #we might need to do interactive stuff so let's turn this on it lets the stage receive mouse events
    @stage.interactive = true


    # load all our textures
    # prepare the loader that will get them all in memory before we do anything else
    loader = PIXI.loader
    # Coffeescript supprts dope loops and ruby-style range expressions
    # It also supports ruby-style string interpolation with #{} - as long as you use double quotes
    # single quotes are always taken literally, no interpolation


    for i in [1..53]
      loader.add "texture_#{i}", "/img/a#{i}.jpg"

    loader.once('complete',@init)
    loader.load()


  init: (loader)=>
    #we know the textures have loaded. We can now set up the sprites that use them

    @sprites = []

    for i in [1..53]
      sprite = new PIXI.Sprite()
      sprite.texture = new PIXI.Texture.fromImage "/img/a#{i}.jpg"
      sprite.width = @STAGE_WIDTH
      sprite.height = @STAGE_HEIGHT
      sprite.alpha = 0.075
      @stage.addChild sprite
      @sprites.push sprite

    @currentSprite = 0
    @frame = 0
    @doEvery = 10 # we will do a sprite swap every so many frames
    @render()



  # the fat arrow syntax ()=> defines a function and locks 'this' to the current context
  # the render function runs every frame
  render: ()=>
    @frame += 1
    #this prepares the launch of the render function for the next frame
    requestAnimationFrame @render

    unless @frame % @doEvery # this is a trick for doing something every X frames
      @stage.removeChild @sprites[@currentSprite]
      @stage.addChild @sprites[@currentSprite]
      @currentSprite += 1
      @currentSprite = 0 if @currentSprite is @sprites.length
      #this renders the PIXI stage to the canvas
      @pixi.r.render @stage



# We'll assign the class instance to a window variable in case we want to play with it in the console.
$(document).ready ()->
  window.IS = new ImageStack()
