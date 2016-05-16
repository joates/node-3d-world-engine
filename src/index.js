;"use strict"

var domready = require('domready')
  ,      raf = require('raf-stream')

  , width    = window.innerWidth
  , height   = window.innerHeight

var THREE    = require('n3d-threejs')
require('../lib/myOrbitControls')(THREE)

// define the scene graph
var scene    = new THREE.Scene()
  , camera   = new THREE.PerspectiveCamera(40, width / height, 0.1, 10000)
  , renderer = new THREE.WebGLRenderer({ antialias: true })
  , controls = new THREE.OrbitControls(camera)

var map_tile = require('../lib/Map-Tile')
  , biomes = require('../lib/biomes')

// main
process.nextTick(function() {
  domready(function() {

    // lights
    var light1 = new THREE.DirectionalLight(0xffffbb, 0.8)
    light1.position.set(-1,  1,  1)
    scene.add(light1)

    var sunLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6)
    sunLight.color.setHSL( 0.6,  1,  0.6)
    sunLight.groundColor.setHSL( 0.095,  1,  0.75)
    sunLight.position.set( 0,  500,  0)
    scene.add(sunLight)

    scene.add(new THREE.AmbientLight(0x202020))

    camera.position.set(0, 250, 300)
    renderer.setSize(width, height)

    document.body.appendChild(renderer.domElement)
    window.addEventListener('resize', resize, false)

    var boundary_sphere_mat = new THREE.MeshLambertMaterial({ color: 0x606060 })
      , sphere_mat = new THREE.MeshLambertMaterial({ color: 0xfa9000 })
      , sphere
      , boundary_line_mat = new THREE.LineBasicMaterial({ color: 0x606060, linewidth: 1.5 })
      , red_line_mat = new THREE.LineBasicMaterial({ color: 0xfa0000, linewidth: 1.5 })
      , line_mat = new THREE.LineBasicMaterial({ color: 0xf8f8f8, linewidth: 2.0 })
      , normal = new THREE.Vector3(0, 1, 0)

    var tile = map_tile.create(1, 1)
    console.log('Tile:', tile)

    // @TODO: move all tile rendering code into -> `tile.nodes.draw()`

    // voronoi regions (lines)
    var offset = -128
    tile.regions.cells.forEach(function(cell) {
      var site = cell.site
        , node = tile.nodes[site.voronoiId]
        , cell_origin = new THREE.Vector3(node.position.x + offset, /*node.position.y*/ 1, node.position.z + offset)
        , half_edges = cell.halfedges
        , num_verts = 0

      half_edges.forEach(function(half_edge) {
        if (! half_edge.edge.rSite) node.boundary = true
      })

      // render regions NOT on boundary
      if (! node.boundary) {
        var poly_geo = new THREE.Geometry()
          , outlines = []
          , next_to_water = false

        half_edges.forEach(function(half_edge) {
          var edge = half_edge.edge

          // test for nearby water
          if (! node.water) {
            var lSite = tile.nodes[edge.lSite.voronoiId]
              , rSite = tile.nodes[edge.rSite.voronoiId]
            if (lSite.water || rSite.water)
              next_to_water = true
          }

          // calculate the cross product
          var v1  = new THREE.Vector3(edge.va.x + offset, 1, edge.va.y + offset)
            , v2  = new THREE.Vector3(edge.vb.x + offset, 1, edge.vb.y + offset)
            , sn1 = new THREE.Vector3()
            , sn2 = new THREE.Vector3()
            , nv  = new THREE.Vector3()
          sn1.subVectors(v1, cell_origin)
          sn2.subVectors(v2, cell_origin)
          nv.crossVectors(sn1, sn2)

          // filled polygon
          if (nv.y < 0) poly_geo.vertices.push(cell_origin, v2, v1)
          else poly_geo.vertices.push(cell_origin, v1, v2)
          poly_geo.faces.push(new THREE.Face3(num_verts, num_verts + 1, num_verts + 2))
          num_verts += 3

          // outline
          var line_geo = new THREE.Geometry()
          line_geo.vertices.push(
              new THREE.Vector3(edge.va.x + offset, 1.1, edge.va.y + offset)
            , new THREE.Vector3(edge.vb.x + offset, 1.1, edge.vb.y + offset)
          )
          outlines.push(new THREE.Line(line_geo, line_mat))
        })

        // calculate biome for each node
        var color = new THREE.Color()
          , elevation = parseInt(tile.nodes[site.voronoiId].position.y / 10 * 3)
          , moisture  = parseInt(tile.nodes[site.voronoiId].moisture / 100 * 5)

        color.set(parseInt(biomes[elevation][moisture]), 16)

        // add color for water filled regions
        // if (node.water) color.set(0x0000f8)
        // else if (node.moisture > 70 && next_to_water) color.set(0x4F86F7)

        // render filled polygon
        var poly_mat = new THREE.MeshBasicMaterial({ color: color })
        var poly = new THREE.Mesh(poly_geo, poly_mat)
        scene.add(poly)

        // render polygon outline
        for (var o = 0, ol = outlines.length; o < ol; o++) {
          scene.add(outlines[o])
        }

      } else {

        // show boundary regions (as only outlines)
        half_edges.forEach(function(half_edge) {
          var edge = half_edge.edge

          var geo = new THREE.Geometry()
          geo.vertices.push(
              new THREE.Vector3(edge.va.x + offset, 1, edge.va.y + offset)
            , new THREE.Vector3(edge.vb.x + offset, 1, edge.vb.y + offset)

          )
          var line = new THREE.Line(geo, boundary_line_mat)
          scene.add(line)
        })
      }
    })

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
