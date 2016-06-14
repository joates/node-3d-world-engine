;'use strict'
exports.outline = tile_outline        //  <- Tile
exports.build = build_geometry        //  <- Region

var THREE = require('n3d-threejs')
  , o_o = require('./constants')
  , tile_size = o_o.map_tile.size

function tile_outline(tile) {
  return (function() {
    // render an outline of the map tile
    var bbox = [ [0, 0], [tile_size, 0], [tile_size, tile_size], [0, tile_size], [0, 0] ]
      , geometry = new THREE.Geometry()
    for (var i = 0, il = bbox.length-1; i < il; i++) {
      var v1 = bbox[i]
        , v2 = bbox[i+1]
      geometry.vertices.push(new THREE.Vector3(v1[0], 0.2, v1[1]), new THREE.Vector3(v2[0], 0.2, v2[1]))
    }
    return [{ type: 'outline', vertices: geometry.vertices }]
  }())
}

function build_geometry(region) {
  return (function() {
    var origin = region.center.position
      , num_verts = 0
      , is_welded = (region.flags.type & o_o.region.WELDED)
      , is_boundary = (region.flags.type & o_o.region.BOUNDARY)
      , geometry = new THREE.Geometry()
      , line_geo = new THREE.Geometry()
      , mesh_data = []

    region.edges.forEach(function(edge) {
      var v1_x = region.vertices[edge.voronoi_verts[0]].x
        , v1_z = region.vertices[edge.voronoi_verts[0]].z
        , v2_x = region.vertices[edge.voronoi_verts[1]].x
        , v2_z = region.vertices[edge.voronoi_verts[1]].z

      if ((! is_boundary) || is_welded) {
        // render the region as a polygon
        var v1 = new THREE.Vector3(v1_x, origin.y, v1_z)
          , v2 = new THREE.Vector3(v2_x, origin.y, v2_z)
        geometry.vertices.push(origin, v1, v2)
        geometry.faces.push(new THREE.Face3(num_verts, num_verts + 1, num_verts + 2))
        num_verts += 3

        if (region.DEBUG) {
          // outline this region
          line_geo.vertices.push(
              new THREE.Vector3(v1_x, origin.y + 0.1, v1_z)
            , new THREE.Vector3(v2_x, origin.y + 0.1, v2_z)
          )
        }

      } else {
        // render an outline of the region
        geometry.vertices.push(new THREE.Vector3(v1_x, origin.y, v1_z), new THREE.Vector3(v2_x, origin.y, v2_z))
      }
    })

    if ((! is_boundary) || is_welded) {
      geometry.computeFaceNormals()
      // Note: using __ORANGE__ fill color.. (which will be replaced with region.biome.color) !!
      mesh_data.push({ type: 'solid', color: '0xff9000', vertices: geometry.vertices, faces: geometry.faces })

      if (region.DEBUG) {
        mesh_data.push({ type: 'outline', vertices: line_geo.vertices })
      }
    }
    else {
      mesh_data.push({ type: 'line', vertices: geometry.vertices })
    }
    return mesh_data
  }())
}
