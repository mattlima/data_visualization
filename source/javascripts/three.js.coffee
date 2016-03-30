#= require 'jquery/dist/jquery.min.js'
#= require 'three.js/build/three.js'

#= require 'three.js/examples/js/controls/OrbitControls.js'

#= require 'three.js/examples/js/postprocessing/ShaderPass.js'

#= require 'three.js/examples/js/shaders/HorizontalBlurShader.js'
#= require 'three.js/examples/js/shaders/VerticalBlurShader.js'
#= require 'stemkowski.github.com/Three.js/js/shaders/AdditiveBlendShader.js'
#= require 'three.js/examples/js/postprocessing/RenderPass.js'
#= require 'three.js/examples/js/shaders/CopyShader.js'

#= require 'three.js/examples/js/shaders/ConvolutionShader.js'
#= require 'three.js/examples/js/postprocessing/EffectComposer.js'

#= require 'three.js/examples/js/postprocessing/MaskPass.js'

#= require 'three.js/examples/js/renderers/Projector.js'

#= require 'BKCore_GodRayShader.js'




class Viz
  constructor: ()->
    $(document).ready @documentReady



  documentReady: () =>
    loader = new THREE.TextureLoader()
    loader.load 'images/marble_tiled.png', @textureLoaded

  textureLoaded: ( texture )=>
    texture.repeat = new THREE.Vector2 4,4
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    #

    @marble = texture
    @init()


  init: ()->
    @rendererWidth = window.innerWidth / 2
    @rendererHeight = window.innerHeight * 0.85
    @clock = new THREE.Clock()
    @scene = new THREE.Scene()
    @occlusionScene = new THREE.Scene()

    @camera = new THREE.PerspectiveCamera 75, @rendererWidth / @rendererHeight, 0.1, 1000
    @scene.add @camera
    @occlusionCamera = new THREE.PerspectiveCamera 75, (@rendererWidth) / @rendererHeight, 0.1, 1000
    @occlusionScene.add @occlusionCamera

    @renderer = new THREE.WebGLRenderer
      antialias: true
    @renderer.setSize( @rendererWidth, @rendererHeight )

    @renderer2 = new THREE.WebGLRenderer
      antialias: true
    @renderer2.setSize( @rendererWidth, @rendererHeight )

    @renderer.setClearColor( new THREE.Color(0x000, 1.0) )
    @renderer.shadowMap.enabled = true
    document.body.appendChild( @renderer.domElement )
    document.body.appendChild( @renderer2.domElement )



    controls = new THREE.OrbitControls @camera, @renderer.domElement
    controls.target = new THREE.Vector3(0, 0, 0);



    @camera.position.z = 15
    @camera.position.y = 10


    @load_queue [
      @load_font
      @setup_occlusion
      @setup_floor
      @setup_lights
      #@setup_cube
      @setup_text
    ]

  load_queue: (funcs)=>
    @funcs ?= funcs
    if @funcs.length > 0
      @funcs.shift().call this
    else
      @startTime = (new Date()).getTime()
      @render()



  render: ()=>
    delta = @clock.getDelta()
    requestAnimationFrame @render


    (@occlusionCamera.position[k] = @camera.position[k]) for k in ["x", "y", "z"]
    (@occlusionCamera.rotation[k] = @camera.rotation[k]) for k in ["x", "y", "z"]

    #vLight.updateMatrixWorld() for vLight in @vLights
    pos = new THREE.Vector3;
    pos.setFromMatrixPosition( @vLights[0].matrixWorld );
    pos.project @occlusionCamera;
    @grPass.uniforms.fX.value = (pos.x + 1) / 2
    @grPass.uniforms.fY.value = (pos.y + 1) / 2




    #@renderer.render @scene, @camera
    @renderer2.render @occlusionScene, @occlusionCamera
    @oclcomposer.render(delta)
    @finalcomposer.render(delta)

  setup_occlusion: ()->

    #Prepare the occlusion composer's render target
    renderTargetParameters =
      minFilter: THREE.LinearFilter
      magFilter: THREE.LinearFilter
      format: THREE.RGBAFormat
      stencilBuffer: false
    renderTargetOcl = new THREE.WebGLRenderTarget( @rendererWidth, @rendererHeight, renderTargetParameters )
    renderTarget2 = new THREE.WebGLRenderTarget( @rendererWidth, @rendererHeight, renderTargetParameters )
    renderTargetSave = new THREE.WebGLRenderTarget( @rendererWidth, @rendererHeight, renderTargetParameters )

    #prepare the composer
    oclcomposer = new THREE.EffectComposer( @renderer, renderTargetOcl )

    #Prepare and add the occlusion scene render pass
    renderModelOcl = new THREE.RenderPass( @occlusionScene, @occlusionCamera )
    oclcomposer.addPass( renderModelOcl )

    #add effects to the occlusion scene render pass
    hblur = new THREE.ShaderPass( THREE.HorizontalBlurShader )
    vblur = new THREE.ShaderPass( THREE.VerticalBlurShader )

    bluriness = 1
    hblur.uniforms[ "h" ].value = bluriness / @rendererWidth
    vblur.uniforms[ "v" ].value = bluriness / @rendererHeight

    oclcomposer.addPass( hblur )
    oclcomposer.addPass( vblur )
#     oclcomposer.addPass( hblur )
#     oclcomposer.addPass( vblur )



    @grPass = new THREE.ShaderPass( THREE.Extras.Shaders.Godrays )
    @grPass.uniforms.fExposure.value = 0.1



    #Prepare the composer
    oclcomposer.addPass( @grPass )



    @oclcomposer = oclcomposer


    #prepare final composer
    @finalcomposer = new THREE.EffectComposer( @renderer, renderTargetOcl );

    #prepare the final render's passes
    renderModel = new THREE.RenderPass( @scene, @camera );
    @finalcomposer.addPass( renderModel );

    effectBlend = new THREE.ShaderPass( THREE.AdditiveBlendShader, "tDiffuse1" );

    effectBlend.uniforms[ 'tDiffuse2' ].value = renderTargetOcl
    #effectBlend.needsSwap = true
    effectBlend.renderToScreen = true;
    @finalcomposer.addPass( effectBlend );





    @load_queue()




  setup_floor: ()->
    @oclcomposer.render(0.1)
    geometry = new THREE.BoxGeometry( 50, 0.01, 50 )
    material = new THREE.MeshPhongMaterial
      color: 0xFFFFFF
      specular: 0xffffff
      shininess: 2
      shading: THREE.SmoothShading
      map: @marble
      lightMap: null
      aoMap: null
      #emissive: 0xFF0000
      #emissiveMap: @marble
      #specularMap: @marble
      #alphaMap: @marble
      #displacementMap: @marble
      #displacementScale: 20
      displacementBias: null
      envMap: null
      fog: true
      #vertexColors: THREE.VertexColors
    #material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } )
    @floor = new THREE.Mesh( geometry, material )

    geometry = new THREE.BoxGeometry( 50, 0.01, 50 )
    material = new THREE.MeshBasicMaterial
      color: 0x000000
      wireframe: false
      #vertexColors: THREE.VertexColors
    #material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } )

    @oc = new THREE.Mesh( geometry, material )
    @scene.add( @floor )
    @occlusionScene.add( @oc )
    @floor.position.y = 0.0
    @oc.position.y = 0.0
    @load_queue()


  load_font: () ->
    $.get "/javascripts/typeface/lato_medium_regular.json", {}, ( response ) =>
      @font1 = new THREE.Font response
      @load_queue()



  setup_lights: ()->

    ambientLight = new THREE.AmbientLight( 0xFFFFFF )
    @scene.add ambientLight
    ambientLight = new THREE.AmbientLight( 0xFFFFFF )
    @occlusionScene.add ambientLight


    @lights = []
    @vLights = []
    @spheres = []

    intensity = 20
    decay = 2
    positions = [
      [15, 3, -2]
      [-5, 4, 1]
      [2, 5, 2]
    ]
    colors = [
      0xffdddd
      0xddff33
      0xffffff
    ]

    lights_to_do = 1
    light_volume = 4
    if lights_to_do
      for i in [0..(lights_to_do - 1)]
        @lights[i] = new THREE.PointLight( colors[i], 2, intensity )
        geo = new THREE.SphereGeometry 0.2, 5, 5
        mat = new THREE.MeshBasicMaterial
          color: 0xffffff
        @spheres[i] = new THREE.Mesh geo, mat
        @scene.add @spheres[i]
        @scene.add @lights[i]
        @lights[i].decay = decay
        @lights[i].position.set positions[i]...
        @spheres[i].position.set positions[i]...
        geo = new THREE.IcosahedronGeometry(light_volume, 3)
        mat = new THREE.MeshBasicMaterial
          color: 0xffffff
        @vLights[i] = new THREE.Mesh geo, mat
        @occlusionScene.add @vLights[i]
        @vLights[i].position.set positions[i]...
    console.log 'a', this, @vLights


    @load_queue()

  setup_cube: ()->
    geometry = new THREE.BoxGeometry( 4, 4, 4 )
    material = new THREE.MeshPhongMaterial
      color: 0xff0000
    @cube = new THREE.Mesh geometry, material
    @scene.add @cube
    @cube.position.set 1,4,1
    @cube.rotation.y= 2
    @cube.rotation.x= 0.1



    @load_queue()

  setup_text: ()->
    geo = new THREE.TextGeometry "Shadow-match",
      font: @font1
      size: 5
      height: 0.3
#       curveSegments: 12
#       bevelEnabled: true
#       bevelThickness: 10
#       bevelSize: 8
    mat = new THREE.MeshPhongMaterial
        color: 0x000000
    @text = new THREE.Mesh geo, mat
    @scene.add @text
    @text.position.x = -10
    @text.position.z = 2
    @text.position.y = 0.01

    gmat = new THREE.MeshBasicMaterial( { color: 0x000000, map: null } )
    geometryClone = geo.clone()
    gmesh = new THREE.Mesh(geometryClone, gmat)
    #gmesh.position = @text.position
    gmesh.position.x = -10
    gmesh.position.z = 2
    gmesh.position.y = 0.01
    gmesh.rotation = @text.rotation
    gmesh.scale = @text.scale
    @occlusionScene.add(gmesh)
    @load_queue()


window.V = new Viz

