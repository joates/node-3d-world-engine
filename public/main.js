;'use strict'

var width  = window.innerWidth
  , height = window.innerHeight
  , boundary_line_material  = new THREE.LineBasicMaterial({ color: 0x606060, linewidth: 1.5 })
  , welded_outline_material = new THREE.LineBasicMaterial({ color: 0x2020fa, linewidth: 2.0 })
  , scene_objects = {}

// on-demand map tile generation
var socket = io.connect('http://localhost:8000')
socket.on('new_tile', function(tile) {
  var tile_mesh = build_mesh(tile.mesh_data, tile.grid.position)

  if (scene_objects[tile.key]) {
    scene.children.forEach(function(child, idx) {
      if (child.uuid === scene_objects[tile.key])
        scene.children.splice(idx, 1)
    })
  }

  scene_objects[tile.key] = tile_mesh.uuid
  scene.add(tile_mesh)

  // DEBUG:
  if (tile.key === '00001_00001' && tile.flags.welded_edges === 15) {
    console.log('['+ tile.key +']', tile)
    tile.regions.forEach(function(region, region_id) {
      if (region.flags.type & 4) {  // is_welded
        region.edges.forEach(function(edge, edge_id) {
          if ( typeof edge.delaunay_neighbor !== 'string'
            || edge.delaunay_neighbors_edge_id === undefined ) console.error('region:', region_id, 'edge:', edge_id, 'encoding error !!')
        })
      }
    })
  }
  //

})

// define the scene graph
var scene    = new THREE.Scene()
  , camera   = new THREE.PerspectiveCamera(40, width / height, 0.1, 10000)
  , renderer = new THREE.WebGLRenderer({ antialias: true })
  , controls = new THREE.OrbitControls(camera)

// main
function init() {
  // lights
  var light = new THREE.DirectionalLight(0xffffff, 0.8)
  light.position.set(-10, 150, 20)
  light.target.position.set(0, 0, 0)

  // enable shadows
  light.castShadow = true
  light.shadow = new THREE.LightShadow(new THREE.PerspectiveCamera(50, 1, 100, 200))
  light.shadow.bias = 0.0001
  light.shadow.mapSize.width  = 2048
  light.shadow.mapSize.height = 2048
  scene.add(light)

  var sun = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.33)
  sun.color.setHSL(1.0, 0.7, 0)
  sun.groundColor.setHSL(0.095, 1, 0.75)
  sun.position.set(0, 500, 0)
  scene.add(sun)

  scene.add(new THREE.AmbientLight(0x202020))

  camera.position.set(0, 600, 800)
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true

  document.body.appendChild(renderer.domElement)
  window.addEventListener('resize', resize, false)

  // display a grid of map tiles
  for (var y = -1; y <= 1; y++ ) {
    for (var x = -1; x <= 1; x++) {
      socket.emit('get_tile', x, y)
    }
  }
}

function animate() {
  requestAnimationFrame(animate)      // start the animation loop

  // update
  camera.lookAt(scene.position)
  controls.update()

  // render
  renderer.render(scene, camera)
}

function build_mesh(mesh_data, pos) {
  var obj = new THREE.Object3D()
    , mesh
  obj.translateX( pos.x * 256 - 128)
  obj.translateZ(-pos.y * 256 - 128)      // Note: flipped y-coord when rendering !!

  // DEBUG: aka alternative tile layout
  // var offset_x = 280 * (num_tiles % 4) - 512
  //   , offset_y = 280 * parseInt(num_tiles / 4) - 256
  // obj.translateX( offset_x)
  // obj.translateZ(-offset_y)

  mesh_data.forEach(function(geometry) {
    for (var i = 0, il = geometry.length; i < il; i++) {
      switch(geometry[i].type) {
        case 'line': 
          mesh = line_mesh(geometry[i], boundary_line_material)
          obj.add(mesh)
          break
        case 'outline': 
          mesh = line_mesh(geometry[i], welded_outline_material)
          obj.add(mesh)
          break
        case 'solid':
        default:
          mesh = solid_mesh(geometry[i])
          mesh.castShadow = mesh.receiveShadow = true
          obj.add(mesh)
          break
      }
    }
  })
  return obj
}

function line_mesh(data, mat) {
  var geometry = new THREE.Geometry()
  geometry.vertices = data.vertices
  return new THREE.Line(geometry, mat)
}

function solid_mesh(data) {
  var geometry = new THREE.Geometry()
  geometry.vertices = data.vertices
  geometry.faces = data.faces
  geometry.normals = data.normals
  var material = new THREE.MeshLambertMaterial({ color: parseInt(data.color, 16) })
  return new THREE.Mesh(geometry, material)
}

function resize() {
  width  = window.innerWidth
  height = window.innerHeight
  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
