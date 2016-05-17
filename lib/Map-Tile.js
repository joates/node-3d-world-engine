;"use strict"

module.exports = Tile
var map_size = 256
  , min_distance = 10
  , Regions = require('./Regions')()
  , biomes  = require('./biomes')

// Constructor:
function Tile(x, y) {
  if (! (this instanceof Tile)) return new Tile()

  // default properties
  this.size = { x: map_size, y: map_size }
  this.grid = { position: { x: x, y: y } }

  var start_time = Date.now()
  this.regions = Regions.create(map_size, min_distance)
  //this.voronoi_regions = obj.voronoi_regions          // Note: ** deprecated **
  this.exec_time = Date.now() - start_time
}
var proto = Tile.prototype


// Public API:
proto.create = function(x, y) { return Tile(x, y) }
proto.render = render_regions


// Class Methods:
function render_regions(THREE) {
  var tile = this
    , tile_offset = map_size * -0.5
    , boundary_sphere_mat = new THREE.MeshLambertMaterial({ color: 0x606060 })
    , sphere_mat = new THREE.MeshLambertMaterial({ color: 0xfa9000 })
    , sphere
    , boundary_line_mat = new THREE.LineBasicMaterial({ color: 0x606060, linewidth: 1.5 })
    , red_line_mat = new THREE.LineBasicMaterial({ color: 0xfa2020, linewidth: 1.5 })
    , line_mat = new THREE.LineBasicMaterial({ color: 0xf8f8f8, linewidth: 2.0 })
    , normal = new THREE.Vector3(0, 1, 0)
    , tile_object = new THREE.Object3D()


  // tile outline
  var bbox = [ [0, 1, 0], [256, 1, 0], [256, 1, 256], [0, 1, 256], [0, 1, 0] ]
  for (var i = 0, il = bbox.length - 1; i<il; i++) {
    var v1 = bbox[i]
      , v2 = bbox[i+1]
    geo = new THREE.Geometry()
    geo.vertices.push(
        new THREE.Vector3(v1[0] + tile_offset, v1[1], v1[2] + tile_offset)
      , new THREE.Vector3(v2[0] + tile_offset, v2[1], v2[2] + tile_offset)
    )
    line = new THREE.Line(geo, red_line_mat)
    tile_object.add(line)
  }

  tile.regions.forEach(function(region, id) {

    var origin = new THREE.Vector3(region.center.position.x + tile_offset, 1, region.center.position.z + tile_offset)
      , num_verts = 0

    // render regions which are NOT on the boundary
    if (! region.boundary) {
      var poly_geo = new THREE.Geometry()
        , outlines = []
        , next_to_water = false

      region.edges.forEach(function(edge) {

        // test for nearby water
        // if (! region.water) {
        //   var neighbor = tile.regions[edge.delaunay_neighbor]
        //   if (neighbor.water)
        //     next_to_water = true
        // }

        // define the geometry for this region
        var v1  = new THREE.Vector3(region.vertices[edge.voronoi_verts[0]].x + tile_offset, 1, region.vertices[edge.voronoi_verts[0]].z + tile_offset)
          , v2  = new THREE.Vector3(region.vertices[edge.voronoi_verts[1]].x + tile_offset, 1, region.vertices[edge.voronoi_verts[1]].z + tile_offset)
        poly_geo.vertices.push(origin, v1, v2)
        poly_geo.faces.push(new THREE.Face3(num_verts, num_verts + 1, num_verts + 2))
        num_verts += 3

        // outline this region
        var line_geo = new THREE.Geometry()
        line_geo.vertices.push(
            new THREE.Vector3(region.vertices[edge.voronoi_verts[0]].x + tile_offset, 1.1, region.vertices[edge.voronoi_verts[0]].z + tile_offset)
          , new THREE.Vector3(region.vertices[edge.voronoi_verts[1]].x + tile_offset, 1.1, region.vertices[edge.voronoi_verts[1]].z + tile_offset)
        )
        outlines.push(new THREE.Line(line_geo, line_mat))
      })

      // calculate biome for this region
      var color = new THREE.Color()
        , elevation = parseInt(tile.regions[id].center.position.y / 10 * 3)
        , moisture  = parseInt(tile.regions[id].moisture / 100 * 5)
      color.set(parseInt(biomes[elevation][moisture]), 16)

      // add color for water-filled regions
      // if (region.water) color.set(0x0000f8)
      // else if (region.moisture > 70 && next_to_water) color.set(0x4F86F7)

      // render filled polygon
      var poly_mat = new THREE.MeshBasicMaterial({ color: color })
      var poly = new THREE.Mesh(poly_geo, poly_mat)
      tile_object.add(poly)

      // render polygon outline
      for (var o = 0, ol = outlines.length; o < ol; o++) tile_object.add(outlines[o])

    } else {

      // show boundary regions (as only outlines)
      region.edges.forEach(function(edge) {
        var geo = new THREE.Geometry()
        geo.vertices.push(
            new THREE.Vector3(region.vertices[edge.voronoi_verts[0]].x + tile_offset, 1, region.vertices[edge.voronoi_verts[0]].z + tile_offset)
          , new THREE.Vector3(region.vertices[edge.voronoi_verts[1]].x + tile_offset, 1, region.vertices[edge.voronoi_verts[1]].z + tile_offset)
        )
        var line = new THREE.Line(geo, boundary_line_mat)
        tile_object.add(line)
      })
    }
  })

  return tile_object
}
