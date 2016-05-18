;"use strict"

var domready = require('domready')
  , raf = require('raf-stream')
  , width  = window.innerWidth
  , height = window.innerHeight
  , THREE  = require('n3d-threejs')
  , map_tile = require('../lib/Map-Tile')()

require('../lib/myOrbitControls')(THREE)

// define the scene graph
var scene    = new THREE.Scene()
  , camera   = new THREE.PerspectiveCamera(40, width / height, 0.1, 10000)
  , renderer = new THREE.WebGLRenderer({ antialias: true })
  , controls = new THREE.OrbitControls(camera)

// main
process.nextTick(function() {
  domready(function() {

    // lights
    var dir_light = new THREE.DirectionalLight(0xffffbb, 0.8)
    var sun_light = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6)
    dir_light.position.set(-1,  1,  1)
    sun_light.color.setHSL( 0.6,  1,  0.6)
    sun_light.groundColor.setHSL( 0.095,  1,  0.75)
    sun_light.position.set( 0,  500,  0)
    scene.add(dir_light)
    scene.add(sun_light)
    scene.add(new THREE.AmbientLight(0x202020))

    camera.position.set(0, 500, 800)
    renderer.setSize(width, height)

    document.body.appendChild(renderer.domElement)
    window.addEventListener('resize', resize, false)

    for (var y = -1, yl = 1; y <= yl; y++) {
      for (var x = -1, xl = 1; x <= xl; x++) {
        var tile = map_tile.create(x, y)
        scene.add(tile.render(THREE))
        console.log('new tile: ['+ tile.grid.position.x +', '+ tile.grid.position.y +'] generated in '+ tile.exec_time +'ms')
      }
    }

    // animation.
    raf(renderer.domElement).on('data', function(dt) {
      update(dt)
      render()
    })
  })
})

// helpers
function update(dt) {
  camera.lookAt(scene.position)
  //controls.update()
}

function render() {
  renderer.render(scene, camera)
}

function resize() {
  width  = window.innerWidth
  height = window.innerHeight
  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
