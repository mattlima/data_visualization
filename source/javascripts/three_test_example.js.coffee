class Viz
  constructor: ()->
    @fonts = {}
    @textures = {}
    @conditions =
      texturesLoaded: false
      fontsLoaded: false
    @loadTextures()
    @loadFonts()
    @init()

  loadTextures: ()->
    loader = new THREE.TextureLoader()
    loader.load 'images/marble_tiled.png', @textureLoaded

  textureLoaded: ( texture )=>
    texture.repeat = new THREE.Vector2 4,4
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    #

    @textures.marble = texture
    @conditions.texturesLoaded = true
    @init()


  loadFonts: () ->
    $.get "/javascripts/typeface/lato_medium_regular.json", {}, ( response ) =>
      @fonts.lato = new THREE.Font response
      @conditions.fontsLoaded = true
      @init()


  init: ()->
    return if ( v for k,v of @conditions when !v ).length
    SCREEN_WIDTH = window.innerWidth
    SCREEN_HEIGHT = window.innerHeight
    @clock = new THREE.Clock()
    @scene = new THREE.Scene()
    @camera = new THREE.PerspectiveCamera 75, (SCREEN_WIDTH) / SCREEN_HEIGHT, 0.1, 1000
    @camera.postio
    @camera.position.z = 15
    @camera.position.y = 4



    @renderer = new THREE.WebGLRenderer
      antialias: true
    @renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT )
    @renderer.setClearColor( new THREE.Color(0x000, 1.0) )
    @renderer.shadowMap.enabled = true

    document.body.appendChild( @renderer.domElement )


    controls = new THREE.OrbitControls @camera, @renderer.domElement
    controls.target = new THREE.Vector3(0, 0, 0);

    #@setup_floor()
    @setup_lights()
    #@setup_box()
    @setup_sphere()

    @composer = new THREE.EffectComposer( @renderer );
    @composer.addPass( new THREE.RenderPass( @scene, @camera ) );

    effect = new THREE.ShaderPass( THREE.DotScreenShader );
    effect.uniforms[ 'scale' ].value = 4;
    effect.renderToScreen = true
    @composer.addPass( effect );


#     effect = new THREE.ShaderPass( THREE.RGBShiftShader );
#     effect.uniforms[ 'amount' ].value = 0.0015;
#     #effect.renderToScreen = true;
#     @composer.addPass( effect );


    @render()


  setup_floor: ()->
    geometry = new THREE.BoxGeometry( 50, 0.01, 50 )
    material = new THREE.MeshPhongMaterial
      color: 0xFFFFFF
      specular: 0xffffff
      #shininess: 2
      shading: THREE.SmoothShading
      map: @textures.marble
      lightMap: null
      aoMap: null
      displacementBias: null
      envMap: null
      fog: true
    @floor = new THREE.Mesh( geometry, material )
    @scene.add @floor

  setup_box: ()->
    geometry = new THREE.BoxGeometry( 5, 5, 5 )
    material = new THREE.MeshBasicMaterial
      color: 0xFF00FF
      #specular: 0xffffff
      #shininess: 2
      shading: THREE.SmoothShading
      #map: @textures.marble
      #lightMap: @textures.marble
      #aoMap: null
      #displacementBias: null
      #envMap: null
      fog: true
    @box = new THREE.Mesh( geometry, material )
    @box.position.y = 5
    @scene.add @box

  setup_sphere: ()->
    geometry = new THREE.SphereGeometry( 4, 20, 20 )
    material = new THREE.MeshPhongMaterial
      color: 0xFFFFFF
      #specular: 0xffffff
      #shininess: 2
      shading: THREE.SmoothShading
      map: @textures.marble
      #lightMap: null
      #aoMap: null
      #displacementBias: null
      #envMap: null
      #fog: true
    @sphere = new THREE.Mesh( geometry, material )
    @sphere.position.y = 0
    @sphere.position.x = 0
    @sphere.position.z = 0
    @scene.add @sphere

  setup_lights: ()->
    ambientLight = new THREE.AmbientLight( 0xFFFFFF, 2 )
    @scene.add ambientLight
#     ambientLight = new THREE.AmbientLight( 0xFFFFFF )
#     @scene.add ambientLight


  render: ()=>
    delta = @clock.getDelta()
    requestAnimationFrame @render
    #@renderer.render @scene, @camera
    @composer.render( delta )





$(document).ready ()->
  window.V = new Viz
